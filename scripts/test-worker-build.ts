#!/usr/bin/env bun

import { build } from "bun";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

type WorkerEnv = Record<string, string>;

type WorkerContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

type WorkerModule = {
  default: {
    fetch(
      request: Request,
      env: WorkerEnv,
      ctx: WorkerContext,
    ): Response | Promise<Response>;
  };
};

const tmpDir = await mkdtemp(join(tmpdir(), "judgeval-worker-build-"));
const outDir = join(tmpDir, "dist");
const entrypoint = join(tmpDir, "worker-entry.ts");
const bundlePath = join(outDir, "worker-entry.mjs");
const packageLink = join(tmpDir, "node_modules", "judgeval");

await mkdir(join(tmpDir, "node_modules"), { recursive: true });
await symlink(process.cwd(), packageLink, "dir");

await writeFile(
  entrypoint,
  `
import { Tracer, propagation } from "judgeval/workers";

export { Tracer };

export default {
  async fetch(_request, env, ctx) {
    await Tracer.init({
      apiKey: env.JUDGMENT_API_KEY,
      organizationId: env.JUDGMENT_ORG_ID,
      apiUrl: env.JUDGMENT_API_URL,
      projectId: env.JUDGMENT_PROJECT_ID,
      projectName: "worker-project",
      environment: env.ENVIRONMENT,
      resourceAttributes: { "worker.test": "true" },
    });

    const span = Tracer.startSpan("worker.run");
    Tracer.setAttribute("worker.step", "started", span);
    const headers = {};
    propagation.inject(headers);
    span.end();

    await Tracer.forceFlush();
    await Tracer.shutdown();
    ctx.waitUntil(Promise.resolve());
    return new Response("ok");
  },
};
`,
);

const result = await build({
  entrypoints: [entrypoint],
  outdir: outDir,
  target: "browser",
  format: "esm",
  minify: false,
  sourcemap: "none",
  naming: { entry: "[name].mjs" },
});

if (!result.success) {
  throw new Error("Failed to bundle judgeval/workers for browser target");
}

const bundle = await readFile(bundlePath, "utf8");
const forbidden = [
  "node:module",
  "node:async_hooks",
  "async_hooks",
  "fs/promises",
  "@opentelemetry/sdk-trace-node",
  'from "crypto"',
  "from 'crypto'",
];

for (const token of forbidden) {
  if (bundle.includes(token)) {
    throw new Error(
      `Worker bundle contains forbidden Node dependency: ${token}`,
    );
  }
}

const originalFetch = globalThis.fetch;
const fetchCalls: string[] = [];
let failNextTraceExport = false;
const waitUntilPromises: Promise<unknown>[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  fetchCalls.push(url);

  if (url.endsWith("/v1/projects/resolve/")) {
    return Response.json({ project_id: "project_worker_test" });
  }

  if (url.endsWith("/otel/v1/traces")) {
    if (init?.headers instanceof Headers) {
      const contentType = init.headers.get("Content-Type");
      if (contentType !== "application/x-protobuf") {
        throw new Error(`Unexpected trace content type: ${contentType}`);
      }
    } else {
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers?.["Content-Type"] !== "application/x-protobuf") {
        throw new Error(
          `Unexpected trace content type: ${headers?.["Content-Type"]}`,
        );
      }
    }
    if (failNextTraceExport) {
      failNextTraceExport = false;
      return new Response("bad trace", { status: 500 });
    }
    return new Response("", { status: 200 });
  }

  return new Response("not found", { status: 404 });
}) as typeof fetch;

try {
  const worker = (await import(
    `${pathToFileURL(bundlePath).href}?t=${Date.now()}`
  )) as WorkerModule;
  const response = await worker.default.fetch(
    new Request("https://worker.test/"),
    {
      JUDGMENT_API_KEY: "test-api-key",
      JUDGMENT_ORG_ID: "test-org",
      JUDGMENT_API_URL: "https://api.worker.test",
      JUDGMENT_PROJECT_ID: "project_worker_test",
      ENVIRONMENT: "test",
    },
    {
      waitUntil(promise) {
        waitUntilPromises.push(Promise.resolve(promise));
      },
      passThroughOnException() {
        /* empty */
      },
    },
  );

  await Promise.all(waitUntilPromises);

  if (response.status !== 200 || (await response.text()) !== "ok") {
    throw new Error("Bundled Worker did not return the expected response");
  }

  if (fetchCalls.some((url) => url.endsWith("/v1/projects/resolve/"))) {
    throw new Error("Bundled Worker resolved the project despite projectId");
  }

  if (!fetchCalls.some((url) => url.endsWith("/otel/v1/traces"))) {
    throw new Error("Bundled Worker did not flush traces");
  }

  failNextTraceExport = true;
  const { Tracer } = await import(
    `${pathToFileURL(bundlePath).href}?t=${Date.now()}&mode=flush-failure`
  );
  await Tracer.init({
    apiKey: "test-api-key",
    organizationId: "test-org",
    apiUrl: "https://api.worker.test",
    projectId: "project_worker_test",
    projectName: "worker-project",
  });
  const span = Tracer.startSpan("worker.failure");
  span.end();
  let sawFlushFailure = false;
  try {
    await Tracer.forceFlush();
  } catch (error) {
    sawFlushFailure = String(error).includes("OTLP export failed: 500");
  } finally {
    await Tracer.shutdown();
  }
  if (!sawFlushFailure) {
    throw new Error("Bundled Worker did not surface OTLP export failure");
  }
} finally {
  globalThis.fetch = originalFetch;
  await rm(tmpDir, { recursive: true, force: true });
}

console.log("✓ Worker bundle test complete");
