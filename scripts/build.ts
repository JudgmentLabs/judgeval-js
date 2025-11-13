#!/usr/bin/env bun

import { build } from "bun";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const minify = !process.argv.includes("--dev");
const external = ["@opentelemetry/*"];

const configs = [
  { format: "esm", naming: "[dir]/[name].mjs" },
  { format: "cjs", naming: "[dir]/[name].cjs" },
] as const;

await Promise.all(
  configs.map((config) =>
    build({
      entrypoints: ["./src/index.ts"],
      outdir: "./dist",
      target: "node",
      format: config.format,
      external,
      minify,
      sourcemap: minify ? "linked" : "inline",
      naming: { entry: config.naming },
    })
  )
);

await execAsync("bunx tsc -p tsconfig.build.json");
console.log("✓ Build complete");
