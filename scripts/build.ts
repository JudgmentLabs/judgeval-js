#!/usr/bin/env bun

import { build } from "bun";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const minify = !process.argv.includes("--dev");
const external = ["@opentelemetry/*"];

const configs = [
  {
    entrypoints: ["./src/node/index.ts"],
    target: "node",
    format: "esm",
    naming: "node/[name].mjs",
  },
  {
    entrypoints: ["./src/node/index.ts"],
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
console.log("✓ Build complete");
