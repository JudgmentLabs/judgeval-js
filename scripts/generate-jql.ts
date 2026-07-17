#!/usr/bin/env bun

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const openapiPath = process.argv[2];
const builderPath = process.argv[3];
const publicOpenapiPath = process.argv[4];

if (!openapiPath || !builderPath || !publicOpenapiPath) {
  throw new Error(
    "usage: bun scripts/generate-jql.ts <dal-openapi.json> <generated-dal-builder.ts> <judgeval-public-jql-openapi.json>",
  );
}

const generatedDir = resolve("src/jql/generated");
mkdirSync(generatedDir, { recursive: true });

const dalOpenapi = JSON.parse(readFileSync(resolve(openapiPath), "utf8")) as {
  components: { schemas: Record<string, unknown> };
};
const included = new Set<string>();
const roots = [
  "SourceQuery",
  "DiscoveryQuery",
  "ChartQuery",
  "TableQuery",
  "TimeSpec",
];
function includeSchema(name: string): void {
  if (included.has(name)) return;
  const schema = dalOpenapi.components.schemas[name];
  if (!schema) throw new Error(`Missing DAL schema ${name}`);
  included.add(name);
  for (const match of JSON.stringify(schema).matchAll(
    /#\/components\/schemas\/([^"/]+)/g,
  )) {
    includeSchema(match[1]!);
  }
}
roots.forEach(includeSchema);

const tempDir = mkdtempSync(`${tmpdir()}/judgeval-jql-`);
const publicJqlSchemaPath = resolve(tempDir, "jql-openapi.json");
writeFileSync(
  publicJqlSchemaPath,
  JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Public JQL IR", version: "1" },
    paths: {},
    components: {
      schemas: Object.fromEntries(
        [...included].map((name) => [
          name,
          dalOpenapi.components.schemas[name],
        ]),
      ),
    },
  }),
);

const result = Bun.spawnSync(
  [
    "bunx",
    "openapi-typescript",
    publicJqlSchemaPath,
    "--default-non-nullable",
    "false",
    "-o",
    resolve(generatedDir, "api.ts"),
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (result.exitCode !== 0) {
  throw new Error(`openapi-typescript exited ${result.exitCode}`);
}

const publicResult = Bun.spawnSync(
  [
    "bunx",
    "openapi-typescript",
    resolve(publicOpenapiPath),
    "--default-non-nullable",
    "false",
    "-o",
    resolve(generatedDir, "public-api.ts"),
  ],
  { stdout: "inherit", stderr: "inherit" },
);
rmSync(tempDir, { recursive: true, force: true });
if (publicResult.exitCode !== 0) {
  throw new Error(`public openapi-typescript exited ${publicResult.exitCode}`);
}

const sourceBuilder = readFileSync(resolve(builderPath), "utf8");
writeFileSync(
  resolve("src/jql/builder.ts"),
  sourceBuilder.replace(
    /^(\/\/[^\n]*\n){2}/,
    "// AUTO-GENERATED from the DAL OpenAPI x-jql registry; do not edit.\n" +
      "// Regenerate with `bun run generate-jql`.\n",
  ),
);

const sourceWirePath = resolve(dirname(resolve(builderPath)), "wire.ts");
const sourceWire = readFileSync(sourceWirePath, "utf8")
  .replace(
    /^(\/\/[^\n]*\n)+/,
    "// AUTO-GENERATED — do not edit; regenerate with `bun run generate-jql`.\n" +
      "// Named aliases over the OpenAPI-generated components (./generated/api).\n",
  )
  .split("\n")
  .filter((line) => !line.startsWith("export type Dal"))
  .join("\n");
writeFileSync(resolve("src/jql/wire.ts"), sourceWire);

console.log("Generated public JQL TypeScript builder and wire types.");
