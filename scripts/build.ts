#!/usr/bin/env bun

import type { BuildConfig } from "bun";
import { build } from "bun";

const target = process.argv[2] || "lib";
const isDev = process.argv.includes("--dev");
const isProduction = !isDev;

async function buildLib() {
  const config: BuildConfig = {
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "node",
    format: "esm",
    external: [
      "@opentelemetry/api",
      "@opentelemetry/core",
      "@opentelemetry/exporter-trace-otlp-http",
      "@opentelemetry/sdk-trace-base",
      "@opentelemetry/sdk-trace-web",
      "@opentelemetry/sdk-node",
      "@opentelemetry/sdk-trace-node",
      "@opentelemetry/auto-instrumentations-node",
      "@opentelemetry/resources",
      "@opentelemetry/semantic-conventions",
    ],
    minify: isProduction,
    sourcemap: isProduction ? "linked" : "inline",
    naming: { entry: "index.mjs" },
  };

  const result = await build(config);

  if (!result.success) {
    console.error(`Build failed for target '${target}':`);
    result.logs.forEach((log) => {
      const level = log.level === "error" ? "ERROR" : log.level.toUpperCase();
      console.error(`  [${level}] ${log.message}`);
      if (log.position) {
        console.error(
          `    at ${log.position.file}:${log.position.line}:${log.position.column}`
        );
      }
    });
    process.exit(1);
  }

  console.log(
    `✓ Built lib bundle: ${result.outputs.map((o) => o.path).join(", ")}`
  );
}

async function buildUmd() {
  const config: BuildConfig = {
    entrypoints: ["./src/umd.ts"],
    outdir: "./dist",
    target: "browser",
    format: "iife",
    external: [
      "@opentelemetry/api",
      "@opentelemetry/core",
      "@opentelemetry/exporter-trace-otlp-http",
      "@opentelemetry/sdk-trace-base",
      "@opentelemetry/sdk-trace-web",
      "@opentelemetry/sdk-node",
      "@opentelemetry/sdk-trace-node",
      "@opentelemetry/auto-instrumentations-node",
      "@opentelemetry/resources",
      "@opentelemetry/semantic-conventions",
    ],
    minify: isProduction,
    sourcemap: isProduction ? "linked" : "inline",
    naming: { entry: "index.umd.js" },
  };

  const result = await build(config);

  if (!result.success) {
    console.error(`Build failed for target '${target}':`);
    result.logs.forEach((log) => {
      const level = log.level === "error" ? "ERROR" : log.level.toUpperCase();
      console.error(`  [${level}] ${log.message}`);
      if (log.position) {
        console.error(
          `    at ${log.position.file}:${log.position.line}:${log.position.column}`
        );
      }
    });
    process.exit(1);
  }

  console.log(
    `✓ Built UMD bundle: ${result.outputs.map((o) => o.path).join(", ")}`
  );
}

async function main() {
  switch (target) {
    case "lib":
      await buildLib();
      break;
    case "umd":
      await buildUmd();
      break;
    default:
      console.error(`Unknown target: ${target}`);
      console.error("Available targets: lib, umd");
      process.exit(1);
  }
}

main().catch(console.error);
