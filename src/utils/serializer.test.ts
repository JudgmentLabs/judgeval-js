import { describe, expect, test } from "bun:test";
import { safeStringify } from "./serializer";

describe("safeStringify", () => {
  test("primitives", () => {
    expect(safeStringify("hello")).toBe('"hello"');
    expect(safeStringify(42)).toBe("42");
    expect(safeStringify(true)).toBe("true");
    expect(safeStringify(null)).toBe("null");
    expect(safeStringify(undefined)).toBe("undefined");
  });

  test("plain objects", () => {
    expect(safeStringify({ a: 1, b: "two" })).toBe('{"a":1,"b":"two"}');
  });

  test("arrays", () => {
    expect(safeStringify([1, 2, 3])).toBe("[1,2,3]");
  });

  test("nested objects", () => {
    expect(safeStringify({ a: { b: { c: 1 } } })).toBe('{"a":{"b":{"c":1}}}');
  });

  test("circular reference in object", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = safeStringify(obj);
    expect(result).toBe('{"a":1,"self":"[Circular]"}');
    expect(obj.self).toBe(obj);
  });

  test("circular reference in array", () => {
    const arr: unknown[] = [1, 2];
    arr.push(arr);
    const result = safeStringify(arr);
    expect(result).toBe('[1,2,"[Circular]"]');
    expect(arr[2]).toBe(arr);
  });

  test("deep circular reference", () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a };
    a.b = b;
    const result = safeStringify(a);
    expect(result).toBe('{"b":{"a":"[Circular]"}}');
    expect(a.b).toBe(b);
    expect(b.a).toBe(a);
  });

  test("shared non-circular references", () => {
    const shared = { x: 1 };
    const obj = { a: shared, b: shared };
    const result = safeStringify(obj);
    expect(result).toBe('{"a":{"x":1},"b":"[Circular]"}');
  });

  test("bigint", () => {
    expect(safeStringify(BigInt(42))).toBe('"42"');
    expect(safeStringify({ n: BigInt(9007199254740991) })).toBe(
      '{"n":"9007199254740991"}',
    );
  });

  test("bigint in array", () => {
    expect(safeStringify([BigInt(1), BigInt(2)])).toBe('["1","2"]');
  });

  test("object restores after circular serialization", () => {
    const obj: Record<string, unknown> = { a: 1, b: 2 };
    obj.self = obj;
    safeStringify(obj);
    expect(obj.a).toBe(1);
    expect(obj.b).toBe(2);
    expect(obj.self).toBe(obj);
  });

  test("configurable getter", () => {
    const obj: Record<string, unknown> = {};
    Object.defineProperty(obj, "val", {
      get() {
        return obj;
      },
      configurable: true,
      enumerable: true,
    });
    const result = safeStringify(obj);
    expect(result).toBe('{"val":"[Circular]"}');
    expect(obj.val).toBe(obj);
  });

  test("non-configurable getter with circular ref", () => {
    const obj: Record<string, unknown> = {};
    Object.defineProperty(obj, "val", {
      get() {
        return obj;
      },
      configurable: false,
      enumerable: true,
    });
    const result = safeStringify(obj);
    expect(result).toBe('{"val":"[Circular]"}');
    expect(obj.val).toBe(obj);
  });

  test("multiple circular paths", () => {
    const a: Record<string, unknown> = { name: "a" };
    const b: Record<string, unknown> = { name: "b" };
    a.b = b;
    b.a = a;
    a.self = a;
    const result = JSON.parse(safeStringify(a)) as Record<string, unknown>;
    expect(result.name).toBe("a");
    expect(result.self).toBe("[Circular]");
    expect((result.b as Record<string, unknown>).a).toBe("[Circular]");
  });

  test("matches JSON.stringify for safe values", () => {
    const values = [
      { key: "value" },
      [1, "two", null, true],
      "string",
      123,
      null,
      { nested: { deep: [1, 2, { three: 3 }] } },
    ];
    for (const val of values) {
      expect(safeStringify(val)).toBe(JSON.stringify(val));
    }
  });
});
