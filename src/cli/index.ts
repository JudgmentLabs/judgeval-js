#!/usr/bin/env node
/**
 * `judgeval` command line.
 *
 *   npx judgeval tests attach [run_id] [--project <name>] [--agent <path[:export]>]
 *                             [--concurrency <n>] [--wait]
 *
 * Runs the local agent for a test run that the platform started with
 * "Run your agent". Without a run id it attaches to the newest run in the
 * project that is still waiting. The agent entrypoint comes from `--agent`,
 * or from `judgeval.config.json` / the `judgeval` field of `package.json`
 * in the current directory, so the command copied from the platform needs
 * no editing.
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { Judgeval } from "../Judgeval";
import type { AgentFunction } from "../offline-tests/types";

interface CliConfig {
  agent?: string;
  project?: string;
  concurrency?: number;
}

const USAGE = `Usage:
  judgeval tests attach [run_id] [--project <name>] [--agent <path[:export]>] [--concurrency <n>] [--wait]

Runs your agent for a test run started from the Judgment platform. Without a
run id, attaches to the newest run in the project that is waiting for traces.
Returns once every trace is attached and the judges have been queued; pass
--wait to block until the run finishes and print the results.

The agent entrypoint is read from --agent, or from judgeval.config.json
({ "agent": "./scripts/agent.ts:myAgent" }) or the "judgeval" field of
package.json in the current directory. TypeScript entrypoints load through
the project's own tsx when it is installed.

Environment: JUDGMENT_API_KEY, JUDGMENT_ORG_ID, JUDGMENT_API_URL, JUDGMENT_PROJECT.`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readConfig(cwd: string): CliConfig {
  const file = join(cwd, "judgeval.config.json");
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8")) as CliConfig;
  }
  const pkg = join(cwd, "package.json");
  if (existsSync(pkg)) {
    const parsed = JSON.parse(readFileSync(pkg, "utf8")) as {
      judgeval?: CliConfig;
    };
    return parsed.judgeval ?? {};
  }
  return {};
}

function splitEntrypoint(spec: string): { file: string; exportName: string } {
  const separator = Math.max(spec.lastIndexOf("#"), spec.lastIndexOf(":"));
  // A Windows drive letter also contains ":"; only treat it as a separator
  // when something follows it that is not a path.
  if (separator > 1 && !spec.slice(separator + 1).includes("/")) {
    return {
      file: spec.slice(0, separator),
      exportName: spec.slice(separator + 1) || "default",
    };
  }
  return { file: spec, exportName: "default" };
}

type ModuleRecord = Record<string, unknown>;

/**
 * TypeScript entrypoints go through the project's own `tsx` when it is
 * installed (scoped import, no global loader hook); anything else, or a
 * project without tsx, uses Node's import directly.
 */
async function importModule(absolute: string, cwd: string): Promise<ModuleRecord> {
  const url = pathToFileURL(absolute).href;
  if (/\.[cm]?tsx?$/.test(absolute)) {
    try {
      const projectRequire = createRequire(join(cwd, "package.json"));
      // The require hook covers CommonJS-style projects (no "type": "module"),
      // where the agent's own relative imports are resolved with require().
      const tsxCjs = (await import(projectRequire.resolve("tsx/cjs/api"))) as {
        register?: () => unknown;
      };
      tsxCjs.register?.();
      const tsx = (await import(projectRequire.resolve("tsx/esm/api"))) as {
        tsImport?: (
          specifier: string,
          options: { parentURL: string },
        ) => Promise<ModuleRecord>;
      };
      if (tsx.tsImport) {
        return await tsx.tsImport(url, {
          parentURL: pathToFileURL(join(cwd, "package.json")).href,
        });
      }
    } catch (error) {
      if (!String(error).includes("Cannot find module")) throw error;
    }
  }
  return (await import(url)) as ModuleRecord;
}

async function loadAgent(spec: string, cwd: string): Promise<AgentFunction> {
  const { file, exportName } = splitEntrypoint(spec);
  const absolute = isAbsolute(file) ? file : resolve(cwd, file);
  if (!existsSync(absolute)) fail(`Agent file not found: ${absolute}`);

  const mod = await importModule(absolute, cwd);
  const candidate = mod[exportName] ?? (exportName === "default" ? mod : null);
  if (typeof candidate !== "function") {
    fail(
      `${absolute} has no exported function "${exportName}". Exports: ${Object.keys(mod).join(", ") || "none"}`,
    );
  }
  return candidate as AgentFunction;
}

async function testsAttach(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      project: { type: "string" },
      agent: { type: "string" },
      concurrency: { type: "string" },
      wait: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  const cwd = process.cwd();
  const config = readConfig(cwd);
  const projectName =
    values.project ?? process.env.JUDGMENT_PROJECT ?? config.project;
  if (!projectName) {
    fail("Pass --project <name> or set JUDGMENT_PROJECT.");
  }
  const agentSpec = values.agent ?? config.agent;
  if (!agentSpec) {
    fail(
      'No agent entrypoint. Pass --agent ./path/to/agent.ts:exportName or add { "agent": "..." } to judgeval.config.json.',
    );
  }
  const concurrency = Number(values.concurrency ?? config.concurrency ?? 1);

  const agentFunction = await loadAgent(agentSpec, cwd);
  const client = await Judgeval.create({ projectName });

  let runId = positionals[0];
  if (!runId) {
    const waiting = await client.offlineTests.waitingRuns();
    const next = waiting[0];
    if (!next) {
      fail(
        `No run in "${projectName}" is waiting for an agent. Start one from the platform with "Run your agent".`,
      );
    }
    runId = next.testRunId;
    console.log(
      `Attaching to ${next.name} (${runId}): ${next.waiting} of ${next.expected} examples waiting`,
    );
  }

  const outcome = await client.offlineTests.attach(runId, {
    agentFunction,
    concurrency,
    wait: values.wait,
  });
  if (outcome?.uiResultsUrl) {
    console.log(
      values.wait
        ? outcome.uiResultsUrl
        : `Traces attached. Judges are scoring now: ${outcome.uiResultsUrl}`,
    );
  }
  process.exit(outcome ? 0 : 1);
}

async function main(): Promise<void> {
  const [group, command, ...rest] = process.argv.slice(2);
  if (group === "tests" && command === "attach") {
    await testsAttach(rest);
    return;
  }
  if (!group || group === "--help" || group === "-h") {
    console.log(USAGE);
    return;
  }
  fail(`Unknown command: ${[group, command].filter(Boolean).join(" ")}\n\n${USAGE}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
