#!/usr/bin/env bun

import { unlink } from "fs/promises";

export const PRIVATE_SOURCE_MARKER = "PRIVATE MONOREPO CONTENT";
export const MAX_ARCHIVE_FILES = 1_000;
export const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 10 * 1024 * 1024;

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

export interface PackFile {
  path: string;
  size: number;
  mode: number;
}

export interface PackResult {
  filename: string;
  size: number;
  unpackedSize: number;
  entryCount: number;
  files: PackFile[];
}

export function expectedPackageFiles(trackedPaths: string[]): Set<string> {
  const expected = new Set(["package.json", ...BUNDLE_FILES]);
  for (const path of trackedPaths) {
    if (["README.md", "LICENSE", "LICENSE.md"].includes(path)) {
      expected.add(path);
      continue;
    }
    if (
      !path.startsWith("src/") ||
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

async function packPackage(): Promise<PackResult> {
  const process = Bun.spawn(["npm", "pack", "--json", "--ignore-scripts"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`npm pack failed: ${stderr}`);
  }
  const results = JSON.parse(stdout) as PackResult[];
  if (results.length !== 1) {
    throw new Error(`expected one packed artifact, found ${results.length}`);
  }
  return results[0];
}

async function archiveContainsMarker(filename: string): Promise<boolean> {
  const process = Bun.spawn(["tar", "-xOzf", filename], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [contents, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`could not inspect ${filename}: ${stderr}`);
  }
  return contents.includes(PRIVATE_SOURCE_MARKER);
}

async function main(): Promise<void> {
  const pack = await packPackage();
  try {
    const errors = manifestErrors(pack, expectedPackageFiles(trackedPaths()));
    if (await archiveContainsMarker(pack.filename)) {
      errors.push("private-source marker found in packed file contents");
    }
    if (errors.length > 0) {
      throw new Error(`Invalid npm package contents:\n${errors.join("\n")}`);
    }
    console.log(
      `Validated ${pack.filename}: ${pack.entryCount} files, ${pack.unpackedSize} unpacked bytes.`,
    );
  } finally {
    await unlink(pack.filename);
  }
}

if (import.meta.main) {
  await main();
}
