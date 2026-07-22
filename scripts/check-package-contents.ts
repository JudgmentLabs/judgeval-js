#!/usr/bin/env bun

import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";

const PRIVATE_SOURCE_MARKER = "PRIVATE MONOREPO CONTENT";
const MAX_ARCHIVE_FILES = 1_000;
const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 10 * 1024 * 1024;

const BUNDLE_FILES = new Set([
  "dist/node/index.cjs",
  "dist/node/index.cjs.map",
  "dist/node/index.d.ts",
  "dist/node/index.mjs",
  "dist/node/index.mjs.map",
  "dist/node/jql.cjs",
  "dist/node/jql.cjs.map",
  "dist/node/jql.mjs",
  "dist/node/jql.mjs.map",
  "dist/workers/index.mjs",
  "dist/workers/index.mjs.map",
  "dist/workers/jql.mjs",
  "dist/workers/jql.mjs.map",
]);

export interface PackResult {
  filename: string;
  size: number;
  unpackedSize: number;
  entryCount: number;
  files: { path: string }[];
}

export function expectedPackageFiles(trackedPaths: string[]): Set<string> {
  const expected = new Set(["package.json", ...BUNDLE_FILES]);
  for (const path of trackedPaths) {
    if (!path.startsWith("src/")) {
      expected.add(path);
      continue;
    }
    if (
      !path.endsWith(".ts") ||
      path.endsWith(".d.ts") ||
      path.endsWith(".test.ts")
    ) {
      continue;
    }
    const declaration = `dist/${path.slice("src/".length, -".ts".length)}.d.ts`;
    expected.add(declaration);
    expected.add(`${declaration}.map`);
  }
  return expected;
}

export function manifestErrors(
  pack: PackResult,
  expected: Set<string>,
): string[] {
  const paths = new Set(pack.files.map((file) => file.path));
  const errors: string[] = [];
  const unexpected = [...paths].filter((path) => !expected.has(path)).sort();
  const missing = [...expected].filter((path) => !paths.has(path)).sort();

  if (unexpected.length > 0) {
    errors.push(`unexpected files: ${unexpected.join(", ")}`);
  }
  if (missing.length > 0) {
    errors.push(`missing files: ${missing.join(", ")}`);
  }
  if (
    paths.size !== pack.files.length ||
    pack.entryCount !== pack.files.length
  ) {
    errors.push("pack manifest contains duplicate or inconsistent entries");
  }
  if (pack.entryCount > MAX_ARCHIVE_FILES) {
    errors.push(
      `contains ${pack.entryCount} files; limit is ${MAX_ARCHIVE_FILES}`,
    );
  }
  if (pack.size > MAX_ARCHIVE_BYTES) {
    errors.push(`archive is ${pack.size} bytes; limit is ${MAX_ARCHIVE_BYTES}`);
  }
  if (pack.unpackedSize > MAX_UNPACKED_BYTES) {
    errors.push(
      `unpacked size is ${pack.unpackedSize} bytes; limit is ${MAX_UNPACKED_BYTES}`,
    );
  }
  return errors;
}

function trackedPaths(): string[] {
  const result = Bun.spawnSync([
    "git",
    "ls-files",
    "-z",
    "--",
    "src",
    "README.md",
    "LICENSE",
    "LICENSE.md",
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString().split("\0").filter(Boolean);
}

function packPackage(): PackResult {
  const result = Bun.spawnSync(["npm", "pack", "--json", "--ignore-scripts"]);
  if (result.exitCode !== 0) {
    throw new Error(`npm pack failed: ${result.stderr.toString()}`);
  }
  const results = JSON.parse(result.stdout.toString()) as PackResult[];
  if (results.length !== 1) {
    throw new Error(`expected one packed artifact, found ${results.length}`);
  }
  return results[0];
}

function archiveContainsMarker(filename: string): boolean {
  const result = Bun.spawnSync(["tar", "-xOzf", filename]);
  if (result.exitCode !== 0) {
    throw new Error(
      `could not inspect ${filename}: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString().includes(PRIVATE_SOURCE_MARKER);
}

function plantMarker(): void {
  mkdirSync(".jql-source/judgment-mono", { recursive: true });
  writeFileSync(
    ".jql-source/judgment-mono/PRIVATE_SOURCE_MARKER",
    PRIVATE_SOURCE_MARKER,
  );
}

function main(): void {
  const pack = packPackage();
  try {
    const errors = manifestErrors(pack, expectedPackageFiles(trackedPaths()));
    if (archiveContainsMarker(pack.filename)) {
      errors.push("private-source marker found in packed file contents");
    }
    if (errors.length > 0) {
      throw new Error(`Invalid npm package contents:\n${errors.join("\n")}`);
    }
    console.log(
      `Validated ${pack.filename}: ${pack.entryCount} files, ${pack.unpackedSize} unpacked bytes.`,
    );
  } finally {
    unlinkSync(pack.filename);
  }
}

if (import.meta.main) {
  if (process.argv.includes("--plant")) {
    plantMarker();
  } else {
    main();
  }
}
