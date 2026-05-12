import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function pickPort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port in range ${start}-${end}`);
}

async function main() {
  const port = String(await pickPort(40000, 40100));
  const env = { ...process.env, PORT: port };

  const server = spawn("node", [path.join(__dirname, "server.js")], {
    stdio: "inherit",
    env,
  });
  await sleep(500);

  const client = spawn("node", [path.join(__dirname, "client.js")], {
    stdio: "inherit",
    env,
  });
  await once(client, "exit");

  server.kill("SIGTERM");
  await once(server, "exit");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
