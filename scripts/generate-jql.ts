import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const contractDir = resolve("scripts/jql-contract");
const generatedDir = resolve("src/jql/generated");
const generatedPaths = [
  resolve("src/jql/builder.ts"),
  resolve("src/jql/wire.ts"),
  resolve(generatedDir, "api.ts"),
  resolve(generatedDir, "public-api.ts"),
];
const usage =
  "usage: bun run generate-jql [--sync] [<dal-openapi.json> <generated-dal-builder.ts> <judgeval-public-jql-openapi.json>]";

const args = process.argv.slice(2);
const sync = args[0] === "--sync";
const sourceArgs = sync ? args.slice(1) : args;

let openapiPath: string;
let builderPath: string;
let publicOpenapiPath: string;

if (sourceArgs.length === 0 && !sync) {
  openapiPath = resolve(contractDir, "jql-ir.openapi.json");
  builderPath = resolve(contractDir, "builder.ts");
  publicOpenapiPath = resolve(contractDir, "public-openapi.json");
} else if (sourceArgs.length === 3) {
  [openapiPath, builderPath, publicOpenapiPath] = sourceArgs.map((path) =>
    resolve(path),
  ) as [string, string, string];
} else {
  throw new Error(usage);
}

const dalOpenapi = JSON.parse(readFileSync(openapiPath, "utf8")) as {
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

function run(command: string[]): void {
  const result = Bun.spawnSync(command, {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(`${command[0]} exited ${result.exitCode}`);
  }
}

roots.forEach(includeSchema);
mkdirSync(generatedDir, { recursive: true });

const publicJqlContract = {
  openapi: "3.1.0",
  info: { title: "Public JQL IR", version: "1" },
  paths: {},
  components: {
    schemas: Object.fromEntries(
      [...included].map((name) => [name, dalOpenapi.components.schemas[name]]),
    ),
  },
};
const sourceBuilder = readFileSync(builderPath, "utf8");
const sourceWirePath = resolve(dirname(builderPath), "wire.ts");
const sourceWire = readFileSync(sourceWirePath, "utf8");
const publicSourceWire = sourceWire
  .split("\n")
  .filter((line) => !line.startsWith("export type Dal"))
  .join("\n");

if (sync) {
  mkdirSync(contractDir, { recursive: true });
  writeFileSync(
    resolve(contractDir, "jql-ir.openapi.json"),
    `${JSON.stringify(publicJqlContract, null, 2)}\n`,
  );
  writeFileSync(
    resolve(contractDir, "public-openapi.json"),
    `${JSON.stringify(JSON.parse(readFileSync(publicOpenapiPath, "utf8")), null, 2)}\n`,
  );
  writeFileSync(resolve(contractDir, "builder.ts"), sourceBuilder);
  writeFileSync(resolve(contractDir, "wire.ts"), publicSourceWire);
}

const tempDir = mkdtempSync(`${tmpdir()}/judgeval-jql-`);
const publicJqlSchemaPath = resolve(tempDir, "jql-openapi.json");

try {
  writeFileSync(publicJqlSchemaPath, JSON.stringify(publicJqlContract));
  run([
    "bunx",
    "openapi-typescript",
    publicJqlSchemaPath,
    "--default-non-nullable",
    "false",
    "-o",
    resolve(generatedDir, "api.ts"),
  ]);
  run([
    "bunx",
    "openapi-typescript",
    publicOpenapiPath,
    "--default-non-nullable",
    "false",
    "-o",
    resolve(generatedDir, "public-api.ts"),
  ]);

  writeFileSync(
    resolve("src/jql/builder.ts"),
    sourceBuilder.replace(
      /^(\/\/[^\n]*\n){2}/,
      "// AUTO-GENERATED from the DAL OpenAPI x-jql registry; do not edit.\n" +
        "// Regenerate with `bun run generate-jql`.\n",
    ),
  );
  writeFileSync(
    resolve("src/jql/wire.ts"),
    publicSourceWire.replace(
      /^(\/\/[^\n]*\n)+/,
      "// AUTO-GENERATED — do not edit; regenerate with `bun run generate-jql`.\n" +
        "// Named aliases over the OpenAPI-generated components (./generated/api).\n",
    ),
  );
  run(["bunx", "prettier", "--write", ...generatedPaths]);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log("Generated public JQL TypeScript builder and wire types.");
