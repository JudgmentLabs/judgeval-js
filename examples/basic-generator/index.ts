import { Tracer } from "judgeval";

// ── Sync generator ──────────────────────────────────────────────────
const fibonacci = Tracer.observe(function* fibonacci(limit: number) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < limit; i++) {
    yield a;
    [a, b] = [b, a + b];
  }
}, { spanName: "fibonacci", spanType: "tool" });

// ── Async generator ─────────────────────────────────────────────────
const streamMessages = Tracer.observe(async function* streamMessages(
  messages: string[],
) {
  for (const message of messages) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield message;
  }
}, { spanName: "streamMessages", spanType: "tool" });

// ── Async generator that throws ─────────────────────────────────────
const failingStream = Tracer.observe(async function* failingStream() {
  yield "ok";
  throw new Error("stream broke");
}, { spanName: "failingStream", spanType: "tool" });

async function main() {
  await Tracer.init({ projectName: "generator-example" });

  // Test sync generator
  console.log("--- Sync generator (fibonacci) ---");
  const fibs: number[] = [];
  for (const n of fibonacci(8)) {
    fibs.push(n);
  }
  console.log("fibonacci(8):", fibs);

  // Test async generator
  console.log("\n--- Async generator (streamMessages) ---");
  const collected: string[] = [];
  for await (const msg of streamMessages(["hello", "world", "done"])) {
    collected.push(msg);
    console.log("  yielded:", msg);
  }
  console.log("all messages:", collected);

  // Test async generator error
  console.log("\n--- Async generator (error handling) ---");
  try {
    for await (const value of failingStream()) {
      console.log("  yielded:", value);
    }
  } catch (error) {
    console.log("  caught error:", (error as Error).message);
  }

  await Tracer.forceFlush();
  await Tracer.shutdown();
}

main().catch(console.error);
