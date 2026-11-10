import { expect, spyOn, test } from "bun:test";
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { JudgmentSpanExporter } from "./JudgmentSpanExporter";
import { Logger } from "../../utils/logger";

const fallback =
  "Payment required. Review your organization's billing and usage limits.";

test.each([
  [
    '{"error":"Usage limit exceeded","message":"Allowance exhausted"}',
    "Allowance exhausted",
  ],
  ["<html>Payment Required</html>", fallback],
  ['{"message":123}', fallback],
])("billing diagnostics through HTTP export: %s", async (body, message) => {
  const statuses = [402, 402, 200, 402, 403];
  let request = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      new Response(body, {
        status: statuses[request++],
        headers: { "Content-Type": "application/json" },
      }),
  });
  const spans = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spans)],
  });
  provider.getTracer("billing-test").startSpan("test").end();
  const exporter = new JudgmentSpanExporter(
    `${server.url}otel/v1/traces`,
    "key",
    "org",
    "project",
  );
  const log = spyOn(Logger, "error").mockImplementation(() => {});
  try {
    const results: ExportResultCode[] = [];
    for (const _status of statuses) {
      const result = await new Promise<ExportResult>((resolve) => {
        exporter.export(spans.getFinishedSpans(), resolve);
      });
      results.push(result.code);
    }
    expect({ results, logs: log.mock.calls }).toEqual({
      results: [
        ExportResultCode.FAILED,
        ExportResultCode.FAILED,
        ExportResultCode.SUCCESS,
        ExportResultCode.FAILED,
        ExportResultCode.FAILED,
      ],
      logs: [
        [`Trace export rejected (HTTP 402): ${message}`],
        [`Trace export rejected (HTTP 402): ${message}`],
      ],
    });
  } finally {
    log.mockRestore();
    await exporter.shutdown();
    await provider.shutdown();
    await server.stop(true);
  }
});
