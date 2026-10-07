import Anthropic from "@anthropic-ai/sdk";
import { Tracer, wrapAnthropicManagedAgents } from "judgeval";

const client = wrapAnthropicManagedAgents(new Anthropic());

async function main() {
  await Tracer.init({ projectName: "default_project" });

  const agent = await client.beta.agents.create({
    name: "assistant",
    model: "claude-haiku-4-5",
    system: "You are a concise assistant. Use bash when asked to run commands.",
    tools: [{ type: "agent_toolset_20260401" }],
  });
  const environment = await client.beta.environments.create({
    name: `judgeval-example-${Date.now()}`,
    config: { type: "cloud", networking: { type: "limited" } },
  });
  const session = await client.beta.sessions.create({
    agent: agent.id,
    environment_id: environment.id,
  });

  const stream = await client.beta.sessions.events.stream(session.id);
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: "Run `echo hello` in bash and tell me the output.",
          },
        ],
      },
    ],
  });

  for await (const event of stream) {
    if (event.type === "agent.message") {
      for (const block of event.content) {
        if (block.type === "text") console.log(block.text);
      }
    }
    if (
      event.type === "session.status_idle" &&
      event.stop_reason.type !== "requires_action"
    ) {
      break;
    }
  }

  await client.beta.sessions.delete(session.id);
  await client.beta.environments.delete(environment.id);
  await client.beta.agents.archive(agent.id);
  await Tracer.forceFlush();
  await Tracer.shutdown();
}

main().catch(console.error);
