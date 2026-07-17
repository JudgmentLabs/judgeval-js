#!/usr/bin/env bun

import { build } from "bun";
import { exec } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { promisify } from "util";

const execAsync = promisify(exec);
const minify = !process.argv.includes("--dev");
const external = ["@opentelemetry/*", "async_hooks"];

const configs = [
  {
    entrypoints: ["./src/index.ts"],
    target: "node",
    format: "esm",
    naming: "node/[name].mjs",
  },
  {
    entrypoints: ["./src/index.ts"],
    target: "node",
    format: "cjs",
    naming: "node/[name].cjs",
  },
  {
    entrypoints: ["./src/workers/index.ts"],
    target: "browser",
    format: "esm",
    naming: "workers/[name].mjs",
  },
  {
    entrypoints: ["./src/jql/index.ts"],
    target: "node",
    format: "esm",
    naming: "node/jql.mjs",
  },
  {
    entrypoints: ["./src/jql/index.ts"],
    target: "node",
    format: "cjs",
    naming: "node/jql.cjs",
  },
  {
    entrypoints: ["./src/jql/index.ts"],
    target: "browser",
    format: "esm",
    naming: "workers/jql.mjs",
  },
] as const;

await Promise.all(
  configs.map((config) =>
    build({
      entrypoints: config.entrypoints,
      outdir: "./dist",
      target: config.target,
      format: config.format,
      external,
      minify,
      sourcemap: minify ? "linked" : "inline",
      naming: { entry: config.naming },
    }),
  ),
);

await execAsync("bunx tsc -p tsconfig.build.json");
await mkdir("./dist/node", { recursive: true });
await writeFile(
  "./dist/node/index.d.ts",
  'export * from "../index";\n',
);
console.log("✓ Build complete");
