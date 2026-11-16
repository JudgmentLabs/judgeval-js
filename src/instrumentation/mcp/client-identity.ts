import { randomUUID } from "node:crypto";

const PREFIX = "judgment-mcp-v1.";
const MAX_TOKEN_LENGTH = 4096;
const MAX_INITIALIZE_BYTES = 8192;

export interface ClientIdentity {
  readonly name?: string;
  readonly version?: string;
  readonly protocolVersion?: string;
}

export interface HttpTransport {
  readonly sessionIdGenerator?: unknown;
  handleRequest?: (request: Request, ...args: unknown[]) => Promise<Response>;
  readonly _webStandardTransport?: HttpTransport;
}

/** Metadata is client-reported, never an authentication or authorization fact. */
export function readClientIdentity(token: string | undefined): ClientIdentity {
  if (
    token === undefined ||
    !token.startsWith(PREFIX) ||
    token.length > MAX_TOKEN_LENGTH
  )
    return {};
  try {
    const value: unknown = JSON.parse(
      Buffer.from(token.slice(PREFIX.length), "base64url").toString("utf8"),
    );
    if (typeof value !== "object" || value === null) return {};
    return {
      name: text(Reflect.get(value, "name")),
      version: text(Reflect.get(value, "version")),
      protocolVersion: text(Reflect.get(value, "protocolVersion")),
    };
  } catch {
    return {};
  }
}

/** Adds a carrier at the HTTP boundary, before SSE response headers are sent. */
export function instrumentClientIdentity(transport: HttpTransport): void {
  const http = transport._webStandardTransport ?? transport;
  const handle = http.handleRequest?.bind(http);
  if (
    handle === undefined ||
    !("sessionIdGenerator" in http) ||
    http.sessionIdGenerator !== undefined
  )
    return;
  http.handleRequest = async (request, ...args) => {
    const token = await initializeToken(request).catch(() => undefined);
    const response = await handle(request, ...args);
    if (
      token === undefined ||
      response.status !== 200 ||
      response.headers.has("mcp-session-id")
    )
      return response;
    const headers = new Headers(response.headers);
    headers.set("mcp-session-id", token);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

async function initializeToken(request: Request): Promise<string | undefined> {
  if (request.method !== "POST" || request.headers.has("mcp-session-id"))
    return undefined;
  // Bound our copy without changing the body the MCP transport reads.
  const reader = request.clone().body?.getReader();
  if (reader === undefined) return undefined;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_INITIALIZE_BYTES) return undefined;
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  const message: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (
    typeof message !== "object" ||
    message === null ||
    Reflect.get(message, "method") !== "initialize"
  )
    return undefined;
  const params: unknown = Reflect.get(message, "params");
  if (typeof params !== "object" || params === null) return undefined;
  const info: unknown = Reflect.get(params, "clientInfo");
  const protocolVersion = text(Reflect.get(params, "protocolVersion"));
  if (
    typeof info !== "object" ||
    info === null ||
    protocolVersion === undefined ||
    protocolVersion >= "2026-07-28"
  )
    return undefined;
  const name = text(Reflect.get(info, "name"));
  if (name === undefined) return undefined;
  const token =
    PREFIX +
    Buffer.from(
      JSON.stringify({
        name,
        version: text(Reflect.get(info, "version")),
        protocolVersion,
        nonce: randomUUID(),
      }),
    ).toString("base64url");
  return token.length <= MAX_TOKEN_LENGTH ? token : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
