import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { Judgeval, Tracer } from "judgeval";

// Set SDK credentials and JUDGMENT_PROJECT_NAME, then run in this directory:
// npm run start -- setup
// npm run start -- request message-123 conversation-456
// npm run start -- trace-feedback message-123 false
// npm run start -- session-feedback conversation-456 4.5
// Replace this local JSON file with your application database for multi-worker services.
const projectName = process.env.JUDGMENT_PROJECT_NAME ?? "my-project";
const targetsFile = "feedback-targets.json";

type SavedTarget = {
  projectName: string;
  traceId: string;
  sessionId: string;
};

async function loadTargets(): Promise<Record<string, SavedTarget>> {
  return existsSync(targetsFile)
    ? JSON.parse(await readFile(targetsFile, "utf8"))
    : {};
}

const answer = Tracer.observe(
  async (messageId: string, sessionId: string) => {
    Tracer.setSessionId(sessionId);
    const span = Tracer.getCurrentSpan();
    if (!span?.isRecording())
      throw new Error("Enable tracing before retaining a feedback target");
    const traceId = span.spanContext().traceId;
    const targets = await loadTargets();
    if (Object.hasOwn(targets, messageId))
      throw new Error("Use a unique message ID for each response being rated");
    targets[messageId] = { projectName, traceId, sessionId };
    await writeFile(targetsFile, JSON.stringify(targets, null, 2));
    return { messageId, answer: "Here is the answer." };
  },
  { spanType: "agent", spanName: "answer" },
);

async function main() {
  const [command, targetId, detail] = process.argv.slice(2);
  if (
    !["setup", "request", "trace-feedback", "session-feedback"].includes(
      command,
    ) ||
    (command !== "setup" && !targetId)
  ) {
    throw new Error(
      "Use setup, request MESSAGE_ID SESSION_ID, trace-feedback MESSAGE_ID [true|false], or session-feedback SESSION_ID [rating]",
    );
  }
  if (command === "request") {
    if (!detail) throw new Error("request requires MESSAGE_ID SESSION_ID");
    await Tracer.init({ projectName });
    const response = await answer(targetId, detail);
    await Tracer.forceFlush();
    console.log(response);
    return;
  }

  const client = await Judgeval.create({ projectName });
  if (command === "setup") {
    await client.externalJudges.create({
      name: "Response helpful",
      scoreType: "binary",
    });
    await client.externalJudges.create({
      name: "Session quality",
      scoreType: "numeric",
    });
  } else if (command === "trace-feedback") {
    if (detail !== undefined && detail !== "true" && detail !== "false")
      throw new Error("trace-feedback value must be true or false");
    const target = (await loadTargets())[targetId];
    if (!target || target.projectName !== projectName)
      throw new Error(
        "No retained trace for this message in the current project",
      );
    // A later worker needs only the customer's message ID, not an active span.
    console.log(
      await client.externalJudges.submitResult({
        judgeName: "Response helpful",
        target: { type: "trace", traceId: target.traceId },
        value: detail === "true",
        reason: "Feedback on this specific response.",
      }),
    );
  } else {
    // Rate the whole session using the ID attached to each request with setSessionId.
    console.log(
      await client.externalJudges.submitResult({
        judgeName: "Session quality",
        target: { type: "session", sessionId: targetId },
        value: detail === undefined ? 4.5 : Number(detail),
        reason: "Rating of the whole session.",
      }),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
