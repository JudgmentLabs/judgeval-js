import { Judgeval } from "judgeval";

async function main() {
  const client = await Judgeval.create({ projectName: "my-project" });

  // External judges don't run on the Judgment platform -- you register the
  // judge's name and score shape once, then submit as many results as you
  // like from your own evaluation code (a human review queue, an offline
  // eval job, another LLM judge you already run elsewhere, etc.). Each judge
  // keeps one current score per trace or session; resubmitting replaces it.
  const judge = await client.externalJudges.create({
    name: "human-thumbs-up",
    scoreType: "binary",
    judgeDescription: "Whether a human reviewer approved the response.",
  });
  if (!judge) throw new Error("Project could not be resolved");
  console.log(`Created external judge: ${judge.judgeId}`);

  // Replace with the id of a trace you've already ingested (e.g. from a
  // `Tracer`-instrumented run, or copied from the platform UI).
  const traceId = "<trace_id>";

  const resultId = await client.externalJudges.submitResult({
    judgeId: judge.judgeId,
    target: { type: "trace", traceId },
    value: true,
    reason: "Reviewer approved the response.",
  });
  console.log(`Submitted result: ${resultId}`);

  // A categorical judge scores against a fixed set of named outputs instead
  // of a boolean/number.
  const topicJudge = await client.externalJudges.create({
    name: "topic-classifier",
    scoreType: "categorical",
    outputs: [
      { name: "billing", description: "Billing questions" },
      { name: "support", description: "Support requests" },
    ],
  });

  if (!topicJudge) throw new Error("Project could not be resolved");
  await client.externalJudges.submitResult({
    judgeName: topicJudge.name,
    target: { type: "trace", traceId },
    value: "billing",
  });

  const rating = await client.externalJudges.create({
    name: "review-rating",
    scoreType: "numeric",
  });
  if (!rating) throw new Error("Project could not be resolved");
  // Session feedback needs only the session ID. Resubmitting replaces its current score.
  await client.externalJudges.submitResult({
    judgeId: rating.judgeId,
    target: { type: "session", sessionId: "<session_id>" },
    value: 4.5,
  });
}

main().catch(console.error);
