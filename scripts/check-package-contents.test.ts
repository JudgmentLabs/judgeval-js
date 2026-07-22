import { describe, expect, test } from "bun:test";
import {
  expectedPackageFiles,
  manifestErrors,
  type PackFile,
  type PackResult,
} from "./check-package-contents";

const tracked = ["README.md", "src/index.ts", "src/example.test.ts"];
const expected = expectedPackageFiles(tracked);

function pack(paths: string[]): PackResult {
  const files: PackFile[] = paths.map((path) => ({
    path,
    size: 1,
    mode: 0o644,
  }));
  return {
    filename: "judgeval-1.0.0.tgz",
    size: files.length,
    unpackedSize: files.length,
    entryCount: files.length,
    files,
  };
}

describe("package manifest validation", () => {
  test("derives declarations from tracked runtime sources", () => {
    expect(expected.has("dist/index.d.ts")).toBe(true);
    expect(expected.has("dist/index.d.ts.map")).toBe(true);
    expect(expected.has("dist/example.test.d.ts")).toBe(false);
  });

  test("rejects extra files even under dist", () => {
    const result = pack([...expected, "dist/private-source.d.ts"]);

    expect(manifestErrors(result, expected)).toEqual([
      "unexpected files: dist/private-source.d.ts",
    ]);
  });

  test("rejects missing expected files", () => {
    const [missing, ...paths] = [...expected];

    expect(manifestErrors(pack(paths), expected)).toEqual([
      `missing files: ${missing}`,
    ]);
  });
});
