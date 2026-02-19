#!/usr/bin/env node

import * as fs from "fs";
import * as http from "http";
import * as https from "https";

const INCLUDE_PREFIXES = ["/v1", "/otel"];

interface OpenAPISpec {
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

interface QueryParam {
  name: string;
  required: boolean;
  type: string;
}

interface PathParam {
  name: string;
  snakeName: string;
}

interface MethodInfo {
  name: string;
  path: string;
  method: string;
  requestType?: string;
  pathParams: PathParam[];
  queryParams: QueryParam[];
  responseType: string;
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  if (name.includes("_")) {
    return name
      .split("_")
      .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ""))
      .join("");
  }
  return name;
}

function collectSchemasWithId(spec: OpenAPISpec): Map<string, any> {
  const schemasById = new Map<string, any>();

  function collect(value: any): void {
    if (typeof value !== "object" || value === null) return;

    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }

    if ("$id" in value && !schemasById.has(value.$id)) {
      const { $id, ...schemaWithoutId } = value;
      schemasById.set($id, schemaWithoutId);
    }

    if (!("$ref" in value)) {
      for (const v of Object.values(value)) collect(v);
    }
  }

  collect(spec);
  return schemasById;
}

function getTypeScriptType(
  schema: any,
  schemasById: Map<string, any>
): string {
  if (!schema || typeof schema !== "object") return "unknown";

  if ("$ref" in schema) {
    const ref = schema.$ref as string;
    const name = ref.replace("#/components/schemas/", "");
    return toPascalCase(name);
  }

  if ("$id" in schema) {
    return schema.$id;
  }

  for (const key of ["anyOf", "oneOf", "allOf"]) {
    if (key in schema && Array.isArray(schema[key])) {
      const types: string[] = [];
      let hasNull = false;

      for (const item of schema[key]) {
        if (item?.type === "null") {
          hasNull = true;
        } else {
          types.push(getTypeScriptType(item, schemasById));
        }
      }

      if (types.length === 0) return "unknown";

      const unique = [...new Set(types)];
      let result = unique.length === 1 ? unique[0] : `(${unique.join(" | ")})`;

      if (hasNull) result = `${result} | null`;
      return result;
    }
  }

  const schemaType = schema.type ?? "object";

  switch (schemaType) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array": {
      const items = schema.items;
      if (!items) return "unknown[]";
      return `${getTypeScriptType(items, schemasById)}[]`;
    }
    case "object": {
      if (!schema.properties) {
        if (schema.additionalProperties === true) return "Record<string, unknown>";
        if (typeof schema.additionalProperties === "object") {
          return `Record<string, ${getTypeScriptType(schema.additionalProperties, schemasById)}>`;
        }
        return "Record<string, unknown>";
      }
      return "Record<string, unknown>";
    }
    default:
      return "unknown";
  }
}

function generateInterface(
  name: string,
  schema: any,
  schemasById: Map<string, any>
): string {
  if (schema.type === "array") {
    const itemType = schema.items
      ? getTypeScriptType(schema.items, schemasById)
      : "unknown";
    return `export type ${name} = ${itemType}[];`;
  }

  const lines: string[] = [`export interface ${name} {`];
  const required = new Set<string>(schema.required ?? []);
  const properties = schema.properties ?? {};

  for (const [propName, propSchema] of Object.entries(properties)) {
    const isRequired = required.has(propName);
    const propType = getTypeScriptType(propSchema, schemasById);
    const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)
      ? propName
      : `"${propName}"`;

    if (isRequired) {
      lines.push(`  ${safeName}: ${propType};`);
    } else {
      lines.push(`  ${safeName}?: ${propType} | null;`);
    }
  }

  if (Object.keys(properties).length === 0) {
    lines.push("  [key: string]: unknown;");
  }

  lines.push("}");
  return lines.join("\n");
}

function getSchemaNameFromContent(content: any): string | undefined {
  if (!content) return undefined;

  for (const contentType of ["application/json", "text/plain"]) {
    const mediaType = content[contentType];
    if (!mediaType?.schema) continue;

    const schema = mediaType.schema;
    if ("$id" in schema) return schema.$id;
    if ("$ref" in schema) {
      const ref = schema.$ref as string;
      return toPascalCase(ref.replace("#/components/schemas/", ""));
    }
  }

  return undefined;
}

function getRequestSchema(operation: any): string | undefined {
  return getSchemaNameFromContent(operation.requestBody?.content);
}

function getResponseSchema(operation: any): string | undefined {
  const responses = operation.responses ?? {};
  for (const status of ["200", "201"]) {
    if (status in responses) {
      const result = getSchemaNameFromContent(responses[status].content);
      if (result) return result;
    }
  }
  return undefined;
}

function extractPathParams(path: string): PathParam[] {
  const params: PathParam[] = [];
  const regex = /\{(\w+)\}/g;
  let match;
  while ((match = regex.exec(path)) !== null) {
    params.push({
      name: match[1],
      snakeName: toSnakeCase(match[1]),
    });
  }
  return params;
}

function getQueryParameters(operation: any): QueryParam[] {
  return (operation.parameters ?? [])
    .filter((p: any) => p.in === "query")
    .map((p: any) => ({
      name: p.name,
      required: p.required ?? false,
      type: p.schema?.type ?? "string",
    }));
}

function getMethodName(operation: any, path: string, method: string): string {
  const operationId = operation.operationId;
  if (operationId) {
    let name = toSnakeCase(operationId);
    name = name.replace(/^(get|post|put|patch|delete)_v1_/, "$1_");
    name = name.replace(/_by_project_id/g, "");
    name = name.replace(/-/g, "_");
    return toCamelCase(name);
  }

  let name = path
    .replace(/\{[^}]+\}/g, "")
    .replace(/^\//, "")
    .replace(/\//g, "_")
    .replace(/-/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (name.startsWith("v1_")) name = name.slice(3);
  if (!name || name === "v1") name = "index";

  return toCamelCase(name);
}

function generateMethodSignature(method: MethodInfo): string {
  const params: string[] = [];

  for (const p of method.pathParams) {
    params.push(`${toCamelCase(p.snakeName)}: string`);
  }

  for (const p of method.queryParams) {
    if (p.required) params.push(`${p.name}: string`);
  }

  if (method.requestType) {
    params.push(`payload: ${method.requestType}`);
  }

  for (const p of method.queryParams) {
    if (!p.required) params.push(`${p.name}?: string`);
  }

  const returnType = method.responseType === "void" ? "void" : method.responseType;
  return `async ${method.name}(${params.join(", ")}): Promise<${returnType}>`;
}

function generateMethodBody(method: MethodInfo): string {
  const lines: string[] = [];

  let urlExpr: string;
  if (method.pathParams.length > 0) {
    let urlPath = method.path;
    for (const p of method.pathParams) {
      urlPath = urlPath.replace(
        `{${p.name}}`,
        `\${${toCamelCase(p.snakeName)}}`
      );
    }
    urlExpr = `\`${urlPath}\``;
  } else {
    urlExpr = `"${method.path}"`;
  }

  if (method.queryParams.length > 0) {
    lines.push("    const params = new URLSearchParams();");
    for (const p of method.queryParams) {
      if (p.required) {
        lines.push(`    params.set("${p.name}", ${p.name});`);
      } else {
        lines.push(`    if (${p.name} !== undefined) params.set("${p.name}", ${p.name});`);
      }
    }
    lines.push(
      `    const url = this.baseUrl + ${urlExpr} + (params.toString() ? "?" + params.toString() : "");`
    );
  } else {
    lines.push(`    const url = this.baseUrl + ${urlExpr};`);
  }

  if (method.method === "GET") {
    lines.push(`    return this.request("${method.method}", url, undefined);`);
  } else if (method.requestType) {
    lines.push(`    return this.request("${method.method}", url, payload);`);
  } else {
    lines.push(`    return this.request("${method.method}", url, {});`);
  }

  return lines.join("\n");
}

function generateClient(methods: MethodInfo[]): string {
  const lines = [
    `export class JudgmentApiClient {`,
    `  private baseUrl: string;`,
    `  private apiKey: string;`,
    `  private organizationId: string;`,
    ``,
    `  constructor(baseUrl: string, apiKey: string, organizationId: string) {`,
    `    this.baseUrl = baseUrl;`,
    `    this.apiKey = apiKey;`,
    `    this.organizationId = organizationId;`,
    `  }`,
    ``,
    `  getBaseUrl(): string { return this.baseUrl; }`,
    `  getApiKey(): string { return this.apiKey; }`,
    `  getOrganizationId(): string { return this.organizationId; }`,
    ``,
    `  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {`,
    `    const response = await fetch(url, {`,
    `      method,`,
    `      headers: {`,
    `        "Content-Type": "application/json",`,
    `        "Authorization": \`Bearer \${this.apiKey}\`,`,
    `        "X-Organization-Id": this.organizationId,`,
    `      },`,
    `      body: body !== undefined ? JSON.stringify(body) : undefined,`,
    `    });`,
    `    if (!response.ok) {`,
    `      const text = await response.text();`,
    `      throw new Error(\`HTTP \${response.status}: \${text}\`);`,
    `    }`,
    `    return response.json() as T;`,
    `  }`,
    ``,
  ];

  for (const m of methods) {
    lines.push(`  ${generateMethodSignature(m)} {`);
    lines.push(generateMethodBody(m));
    lines.push(`  }`);
    lines.push(``);
  }

  lines.push(`}`);
  return lines.join("\n");
}

async function fetchSpec(url: string): Promise<OpenAPISpec> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function main(): Promise<void> {
  const specFile = process.argv[2] ?? "http://localhost:10001/openapi/json";

  const spec: OpenAPISpec = specFile.startsWith("http")
    ? await fetchSpec(specFile)
    : JSON.parse(fs.readFileSync(specFile, "utf8"));

  const schemasById = collectSchemasWithId(spec);
  console.error(`Collected ${schemasById.size} schemas with $id`);

  const apiDir = "src/internal/api";
  fs.mkdirSync(apiDir, { recursive: true });

  const typeLines = [
    `// Auto-generated by scripts/generate-client.ts`,
    `// DO NOT EDIT MANUALLY`,
    ``,
    `export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";`,
    ``,
  ];

  for (const [schemaId, schema] of [...schemasById.entries()].sort()) {
    typeLines.push(generateInterface(schemaId, schema, schemasById));
    typeLines.push(``);
    console.error(`Generated: ${schemaId}`);
  }

  fs.writeFileSync(`${apiDir}/types.ts`, typeLines.join("\n"));
  console.error(`Generated: ${apiDir}/types.ts`);

  const methods: MethodInfo[] = [];

  for (const [path, pathData] of Object.entries(spec.paths)) {
    if (!INCLUDE_PREFIXES.some((p) => path.startsWith(p))) continue;

    for (const [httpMethod, operation] of Object.entries(pathData)) {
      const method = httpMethod.toUpperCase();
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) continue;

      const name = getMethodName(operation, path, method);
      const requestType = getRequestSchema(operation);
      const responseType = getResponseSchema(operation) ?? "unknown";
      const pathParams = extractPathParams(path);
      const queryParams = getQueryParameters(operation);

      console.error(
        `${name} request=${requestType} response=${responseType} path=${JSON.stringify(pathParams)} query=${JSON.stringify(queryParams)}`
      );

      methods.push({
        name,
        path,
        method,
        requestType,
        pathParams,
        queryParams,
        responseType,
      });
    }
  }

  const clientCode = [
    `// Auto-generated by scripts/generate-client.ts`,
    `// DO NOT EDIT MANUALLY`,
    ``,
    `import type {`,
    ...([...schemasById.keys()].sort().map((k) => `  ${k},`)),
    `} from "./types";`,
    ``,
    generateClient(methods),
  ].join("\n");

  fs.writeFileSync(`${apiDir}/client.ts`, clientCode);
  console.error(`Generated: ${apiDir}/client.ts`);

  const indexCode = [
    `// Auto-generated by scripts/generate-client.ts`,
    `// DO NOT EDIT MANUALLY`,
    ``,
    `export * from "./types";`,
    `export * from "./client";`,
  ].join("\n");

  fs.writeFileSync(`${apiDir}/index.ts`, indexCode);
  console.error(`Generated: ${apiDir}/index.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
