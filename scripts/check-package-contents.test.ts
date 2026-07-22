import { describe, expect, test } from "bun:test";
import {
  expectedPackageFiles,
  manifestErrors,
  type PackResult,
} from "./check-package-contents";

const tracked = ["README.md", "src/index.ts", "src/example.test.ts"];
const expected = expectedPackageFiles(tracked);

function pack(paths: string[]): PackResult {
  const files = paths.map((path) => ({ path }));
  return {
    filename: "judgeval-1.0.0.tgz",
    size: files.length,
    unpackedSize: files.length,
    entryCount: files.length,
    files,
  };
}

describe("package manifest validation", () => {
  test("derives the full manifest from tracked paths", () => {
    expect(expected).toEqual(
      new Set([
        "package.json",
        "README.md",
        "dist/index.d.ts",
        "dist/index.d.ts.map",
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
      ]),
    );
  });

  test("rejects extra files even under dist", () => {
    const result = pack([...expected, "dist/private-source.d.ts"]);

    expect(manifestErrors(result, expected)).toEqual([
      "unexpected files: dist/private-source.d.ts",
    ]);
  });

  test("rejects missing expected files", () => {
    const paths = [...expected].filter((path) => path !== "package.json");

    expect(manifestErrors(pack(paths), expected)).toEqual([
      "missing files: package.json",
    ]);
  });

  test("rejects duplicate pack entries", () => {
    expect(
      manifestErrors(pack([...expected, "package.json"]), expected),
    ).toEqual(["pack manifest contains duplicate or inconsistent entries"]);
  });
});
