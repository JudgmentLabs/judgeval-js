import http from "node:http";
import { Tracer } from "judgeval";

const handle = Tracer.observe(function _handle(message: string): string {
  return `server received: ${message}`;
}, "agent");

async function main() {
  await Tracer.init({
    projectName: "basic-distributed-tracing",
    resourceAttributes: { "service.name": "server" },
  });

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/run") {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body) as { message: string };

    Tracer.continueTrace(
      req.headers as Record<string, unknown>,
      () => {
        const result = handle(payload.message);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result }));
      },
    );
  });

  server.listen(8000, "127.0.0.1", () => {
    console.log("Server listening on http://127.0.0.1:8000");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
