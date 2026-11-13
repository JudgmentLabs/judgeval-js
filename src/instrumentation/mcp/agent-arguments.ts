import { randomBytes } from "node:crypto";

const INTENT_ARGUMENT = "intent";
const MODEL_ARGUMENT = "llm_model";
const CONVERSATION_ARGUMENT = "conversation_id";
const RESPONSE_CONTEXT = "_judgment";
const MAX_INTENT_LENGTH = 500;
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AGENT_ARGUMENT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  [INTENT_ARGUMENT]:
    "Optional, for analytics only. In 15-25 words, describe in general terms why you are calling this tool. Never include names, contact details, credentials, or other sensitive details.",
  [MODEL_ARGUMENT]:
    'Optional, for analytics only. The exact model identifier you are running as. Pass "unknown" if you are not certain.',
  [CONVERSATION_ARGUMENT]:
    "Optional, for analytics only. Read conversation_id from the server's earlier response text or structuredContent._judgment and pass it unchanged as {argument_name} on later calls in this conversation. Omit it on the first call, and do not invent one.",
};

/** Explicit names opt application-owned arguments into telemetry. */
export interface ArgumentNames {
  readonly intent?: string;
  readonly model?: string;
  readonly conversationId?: string;
}

export function argumentNames(
  names: ArgumentNames = {},
): readonly [string, string, string] {
  const resolved = [
    names.intent ?? INTENT_ARGUMENT,
    names.model ?? MODEL_ARGUMENT,
    names.conversationId ?? CONVERSATION_ARGUMENT,
  ] as const;
  if (
    resolved.some((name) => name.trim() === "") ||
    new Set(resolved).size !== 3
  )
    throw new Error(
      "MCP telemetry argument names must be non-empty and distinct",
    );
  return resolved;
}

/** Schema keywords whose meaning could change if a property were added. */
const COMPOSITION_KEYWORDS = [
  "oneOf",
  "anyOf",
  "allOf",
  "$ref",
  "not",
  "if",
  "then",
  "else",
  "dependentSchemas",
  "dependentRequired",
  "dependencies",
  "propertyNames",
] as const;

/** Values an agent reported on a call, kept apart from the tool's own input. */
export interface ReportedArguments {
  readonly intent: string | undefined;
  readonly model: string | undefined;
  readonly conversationId: string | undefined;
}

interface ListedTool {
  readonly name?: string;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
}

/** Mints an RFC 9562 UUIDv7, the only shape accepted when an agent echoes one. */
export function mintConversationId(now = Date.now()): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(now, 0, 6);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Reads injected arguments and explicitly opted-in business arguments. */
export function readReportedArguments(
  args: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
  names: ArgumentNames = {},
  injected = true,
): ReportedArguments {
  const read = (
    name: string,
    configured: string | undefined,
  ): string | undefined => {
    if (configured === undefined && (!injected || declared.has(name)))
      return undefined;
    const value = args[name];
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
  };
  const [intentName, modelName, conversationName] = argumentNames(names);
  const model = read(modelName, names.model);
  const conversationId = read(conversationName, names.conversationId);
  const intent = read(intentName, names.intent);
  return {
    intent:
      intent === undefined ? undefined : intent.slice(0, MAX_INTENT_LENGTH),
    model: model?.toLowerCase() === "unknown" ? undefined : model,
    conversationId:
      conversationId !== undefined &&
      ((names.conversationId !== undefined &&
        (declared.has(conversationName) || !injected)) ||
        UUID_V7.test(conversationId))
        ? conversationId
        : undefined,
  };
}

/** Removes injected values so a tool's strict schema still accepts the call. */
export function withoutAgentArguments(
  args: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
  names: ArgumentNames = {},
  injectConversationId = true,
): Record<string, unknown> {
  const injectedNames = new Set(
    argumentNames(names).slice(0, injectConversationId ? 3 : 2),
  );
  return Object.fromEntries(
    Object.entries(args).filter(
      ([name]) => !injectedNames.has(name) || declared.has(name),
    ),
  );
}

/** Tells whether a name is one of the injected arguments. */
export function isAgentArgument(
  name: string,
  names: ArgumentNames = {},
  injectConversationId = true,
): boolean {
  return argumentNames(names)
    .slice(0, injectConversationId ? 3 : 2)
    .includes(name);
}

/**
 * Adds the optional arguments to a listed tool. Schemas we can't safely extend
 * are returned unchanged, and a tool's own property of the same name wins.
 */
export function withAgentArguments<Tool extends ListedTool>(
  tool: Tool,
  injectConversationId = true,
  names: ArgumentNames = {},
): Tool {
  const schema = tool.inputSchema;
  if (schema === undefined || !canExtendSchema(schema)) return tool;
  const resolved = argumentNames(names);
  const declared = new Set(declaredArguments(schema, names));
  return {
    ...tool,
    inputSchema: {
      ...schema,
      properties: {
        ...Object.fromEntries(
          Object.entries(AGENT_ARGUMENT_DESCRIPTIONS)
            .map(
              ([name, description], index) =>
                [resolved[index]!, description, name] as const,
            )
            .filter(
              ([name, , original]) =>
                !declared.has(name) &&
                (injectConversationId || original !== CONVERSATION_ARGUMENT),
            )
            .map(([name, description]) => [
              name,
              {
                type: "string",
                description: description.replace("{argument_name}", name),
              },
            ]),
        ),
        ...(schema["properties"] as Record<string, unknown> | undefined),
      },
    },
  };
}

export function canExtendSchema(
  schema: Readonly<Record<string, unknown>>,
): boolean {
  return (
    schema["type"] === "object" &&
    COMPOSITION_KEYWORDS.every((keyword) => !(keyword in schema))
  );
}

/** Names owned by the tool must never be removed as telemetry arguments. */
export function declaredArguments(
  schema: Readonly<Record<string, unknown>>,
  names: ArgumentNames = {},
): string[] {
  const keys = new Set(Object.keys((schema["properties"] as object) ?? {}));
  for (const key of (schema["required"] as unknown[] | undefined) ?? [])
    if (typeof key === "string") keys.add(key);
  for (const pattern of Object.keys(
    (schema["patternProperties"] as object) ?? {},
  )) {
    const expression = new RegExp(pattern);
    for (const name of argumentNames(names))
      if (expression.test(name)) keys.add(name);
  }
  return [...keys];
}

/** Extends simple object outputs without taking over a developer's field. */
export function withConversationOutputSchema(
  schema: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  if (
    !canExtendSchema(schema) ||
    [
      "not",
      "if",
      "then",
      "else",
      "dependentSchemas",
      "dependentRequired",
      "dependencies",
      "propertyNames",
      "patternProperties",
      "maxProperties",
      "const",
      "enum",
    ].some((keyword) => keyword in schema) ||
    RESPONSE_CONTEXT in ((schema["properties"] as object) ?? {}) ||
    (schema["required"] as readonly unknown[] | undefined)?.includes(
      RESPONSE_CONTEXT,
    )
  )
    return undefined;
  return {
    ...schema,
    properties: {
      ...(schema["properties"] as object),
      [RESPONSE_CONTEXT]: {
        type: "object",
        properties: {
          conversation_id: { type: "string" },
          note: { type: "string" },
        },
        required: ["conversation_id", "note"],
        additionalProperties: false,
      },
    },
  };
}

/** Gives text-only and structured-only clients the same ID without replacing output. */
export function withConversationIdPrompt<
  Result extends {
    readonly content?: readonly unknown[];
    readonly structuredContent?: unknown;
  },
>(
  result: Result,
  conversationId: string,
  structuredTools: ReadonlySet<string>,
  toolName: string,
  conversationArgument = CONVERSATION_ARGUMENT,
): Result {
  const prompt = {
    [CONVERSATION_ARGUMENT]: conversationId,
    note: `Pass this ${conversationArgument} on later tool calls in this conversation.`,
  };
  const structured = result.structuredContent;
  const structuredUpdate =
    structuredTools.has(toolName) &&
    typeof structured === "object" &&
    structured !== null &&
    !Array.isArray(structured) &&
    !(RESPONSE_CONTEXT in structured)
      ? { structuredContent: { ...structured, [RESPONSE_CONTEXT]: prompt } }
      : {};
  return {
    ...result,
    ...structuredUpdate,
    content: [
      ...(Array.isArray(result.content) ? result.content : []),
      {
        type: "text",
        text: JSON.stringify(prompt),
      },
    ],
  };
}
