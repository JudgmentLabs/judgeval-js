import {
  Judgeval,
  Example,
  Judge,
  type BinaryResponse,
  type NumericResponse,
} from "judgeval";

/**
 * Checks that the expected answer appears in the actual output.
 */
class ContainsExpectedAnswer extends Judge<BinaryResponse> {
  async score(data: Example): Promise<BinaryResponse> {
    const expected = (data.get("expected_output") as string)
      .trim()
      .toLowerCase();
    const actual = (data.get("actual_output") as string).trim().toLowerCase();
    const passed = actual.includes(expected);
    return {
      value: passed,
      reason: `Expected answer ${passed ? "found" : "not found"} in output`,
    };
  }
}

/**
 * Scores output based on whether it stays within a reasonable length
 * (under 300 chars).
 */
class OutputLength extends Judge<NumericResponse> {
  async score(data: Example): Promise<NumericResponse> {
    const length = (data.get("actual_output") as string).length;
    const score = Math.max(1.0 - length / 300, 0.0);
    return {
      value: Math.round(score * 100) / 100,
      reason: `Output is ${length} characters`,
    };
  }
}

async function main() {
  const client = await Judgeval.create({ projectName: "my-project" });

  const examples = [
    Example.create({
      input: "What is the capital of France?",
      actual_output: "The capital of France is Paris.",
      expected_output: "Paris",
    }),
    Example.create({
      input: "What is 12 * 8?",
      actual_output: "12 * 8 = 96",
      expected_output: "97",
    }),
  ];

  const evaluation = client.evaluation.create();
  const results = await evaluation.run({
    examples,
    scorers: [new ContainsExpectedAnswer(), new OutputLength()],
    evalRunName: "basic-eval",
    assertTest: true,
  });

  for (const result of results) {
    console.log(`Success: ${result.success}`);
    for (const scorer of result.scorers) {
      console.log(
        `  ${scorer.name}: score=${scorer.score}, reason=${scorer.reason}`,
      );
    }
  }
}

main().catch(console.error);
