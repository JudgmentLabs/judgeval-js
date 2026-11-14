import { randomBytes } from "node:crypto";

const INTENT_ARGUMENT = "context";
const MODEL_ARGUMENT = "llm_model";
const CONVERSATION_ARGUMENT = "conversation_id";
const MAX_INTENT_LENGTH = 500;
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AGENT_ARGUMENT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  [INTENT_ARGUMENT]:
    "Optional, for analytics only. In 15-25 words, describe in general terms why you are calling this tool. Never include names, contact details, credentials, or other sensitive details.",
  [MODEL_ARGUMENT]:
    'Optional, for analytics only. The exact model identifier you are running as. Pass "unknown" if you are not certain.',
  [CONVERSATION_ARGUMENT]:
    "Optional, for analytics only. Pass the conversation_id from the server's earlier response, unchanged, on later calls in this conversation. Omit it on the first call, and do not invent one.",
};

const AGENT_ARGUMENTS: ReadonlySet<string> = new Set(
  Object.keys(AGENT_ARGUMENT_DESCRIPTIONS),
);

/** Schema keywords whose meaning could change if a property were added. */
const COMPOSITION_KEYWORDS = ["oneOf", "anyOf", "allOf", "$ref"] as const;

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

/**
 * Removes well-defined personal identifiers from free text. It can't recognize
 * free-form data such as names, so the argument's description also tells agents
 * not to send them.
 */
export function sanitizeIntent(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]")
    .replace(/(?:\d[ -]?){13,19}/g, (match) =>
      isLuhnValid(match.replace(/[ -]/g, "")) ? "[card]" : match,
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]")
    .replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi, "[ip]")
    .replace(/(?<![\w.])\+?\d[\d ().-]{7,}\d\b/g, "[phone]")
    .slice(0, MAX_INTENT_LENGTH);
}

function isLuhnValid(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    const digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 0) sum += digit;
    else sum += digit > 4 ? digit * 2 - 9 : digit * 2;
  }
  return sum % 10 === 0;
}

/** Reads agent-reported values, skipping any name the tool itself declares. */
export function readReportedArguments(
  args: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
): ReportedArguments {
  const read = (name: string): string | undefined => {
    const value = args[name];
    return !declared.has(name) && typeof value === "string" && value !== ""
      ? value
      : undefined;
  };
  const model = read(MODEL_ARGUMENT);
  const conversationId = read(CONVERSATION_ARGUMENT);
  const intent = read(INTENT_ARGUMENT);
  return {
    intent: intent === undefined ? undefined : sanitizeIntent(intent),
    model: model?.toLowerCase() === "unknown" ? undefined : model,
    conversationId:
      conversationId !== undefined && UUID_V7.test(conversationId)
        ? conversationId
        : undefined,
  };
}

/** Removes injected values so a tool's strict schema still accepts the call. */
export function withoutAgentArguments(
  args: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).filter(
      ([name]) => !AGENT_ARGUMENTS.has(name) || declared.has(name),
    ),
  );
}

/** Tells whether a name is one of the injected arguments. */
export function isAgentArgument(name: string): boolean {
  return AGENT_ARGUMENTS.has(name);
}

/**
 * Adds the optional arguments to a listed tool. Schemas we can't safely extend
 * are returned unchanged, and a tool's own property of the same name wins.
 */
export function withAgentArguments<Tool extends ListedTool>(tool: Tool): Tool {
  const schema = tool.inputSchema;
  if (schema === undefined || !canExtendSchema(schema)) return tool;
  return {
    ...tool,
    inputSchema: {
      ...schema,
      properties: {
        ...Object.fromEntries(
          Object.entries(AGENT_ARGUMENT_DESCRIPTIONS).map(
            ([name, description]) => [name, { type: "string", description }],
          ),
        ),
        ...(schema["properties"] as Record<string, unknown> | undefined),
      },
    },
  };
}

function canExtendSchema(schema: Readonly<Record<string, unknown>>): boolean {
  return (
    schema["type"] === "object" &&
    COMPOSITION_KEYWORDS.every((keyword) => !(keyword in schema))
  );
}

/**
 * Tells the agent which ID to send next. It goes in `content` only: changing
 * `structuredContent` could break a client validating against an output schema
 * it listed earlier, so clients reading only structured output won't echo it.
 */
export function withConversationIdPrompt<
  Result extends { readonly content?: readonly unknown[] },
>(result: Result, conversationId: string): Result {
  if (!Array.isArray(result.content)) return result;
  return {
    ...result,
    content: [
      ...result.content,
      {
        type: "text",
        text: JSON.stringify({
          [CONVERSATION_ARGUMENT]: conversationId,
          note: `Pass this ${CONVERSATION_ARGUMENT} on later tool calls in this conversation.`,
        }),
      },
    ],
  };
}
