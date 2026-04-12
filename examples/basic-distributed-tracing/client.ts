import { Tracer, propagation } from "judgeval";

const callServer = Tracer.observe(async function _callServer(
  message: string,
): Promise<unknown> {
  const headers: Record<string, string> = {};
  propagation.inject(headers);
  const res = await fetch("http://127.0.0.1:8000/run", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return res.json();
}, "agent");

async function main() {
  await Tracer.init({
    projectName: "basic-distributed-tracing",
    resourceAttributes: { "service.name": "client" },
  });
  console.log(await callServer("hello"));
  await Tracer.forceFlush();
  await Tracer.shutdown();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
