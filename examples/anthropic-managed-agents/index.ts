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
    title: "judgeval example",
  });

  try {
    // Open the stream before sending the message, then read until the turn ends.
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
      // The session also goes idle while it waits for a tool result or a tool
      // confirmation (`requires_action`); the turn is over for any other reason.
      if (
        event.type === "session.status_idle" &&
        event.stop_reason.type !== "requires_action"
      ) {
        break;
      }
    }

    // The trace for the turn has been exported by the time the loop exits.
    await Tracer.forceFlush();
  } finally {
    await client.beta.sessions.delete(session.id);
    await client.beta.environments.delete(environment.id);
    await client.beta.agents.archive(agent.id);
    await Tracer.shutdown();
  }
}

main().catch(console.error);
