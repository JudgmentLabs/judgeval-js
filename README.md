# JudgEval TypeScript SDK

A TypeScript SDK for evaluating LLM outputs using the JudgmentLabs evaluation platform.

## Installation

```bash
npm install judgeval
```

## Quick Start

```typescript
import { JudgmentClient, ExampleBuilder, AnswerRelevancyScorer } from 'judgeval';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize client
const client = JudgmentClient.getInstance();

// Create example
const example = new ExampleBuilder()
  .input("What's the capital of France?")
  .actualOutput("The capital of France is Paris.")
  .build();

// Run evaluation
async function main() {
  const results = await client.runEvaluation(
    [example],
    [new AnswerRelevancyScorer(0.7)],
    "meta-llama/Meta-Llama-3-8B-Instruct-Turbo"
  );
  
  // Print results using standardized logger
  logger.print(results);
}

main();
```

## Key Features

- **Standardized Logging**: Consistent logging across all examples with formatted output
- **Asynchronous Evaluation**: Support for both sync and async evaluation workflows
- **Comprehensive Scorers**: Multiple pre-built scorers for different evaluation aspects
- **Tracing Support**: Trace LLM workflows with spans and evaluation integration
- **Pay-as-you-go Integration**: Automatic handling of billing limits and resource allocation

## Core Components

### JudgmentClient

The main entry point for interacting with the JudgmentLabs API:

```typescript
// Get singleton instance
const client = JudgmentClient.getInstance();

// Or create with explicit credentials
const client = new JudgmentClient(process.env.JUDGMENT_API_KEY, process.env.JUDGMENT_ORG_ID);
```

### Examples

Create examples using the builder pattern:

```typescript
const example = new ExampleBuilder()
  .input("What's the capital of France?")
  .actualOutput("The capital of France is Paris.")
  .expectedOutput("Paris is the capital of France.")
  .retrievalContext(["France is a country in Western Europe."])
  .build();
```

### Scorers

Available scorers include:

- `AnswerCorrectnessScorer`: Evaluates factual correctness
- `AnswerRelevancyScorer`: Measures relevance to the input
- `FaithfulnessScorer`: Checks adherence to provided context
- `HallucinationScorer`: Detects fabricated information
- `GroundednessScorer`: Evaluates grounding in context
- `InstructionAdherenceScorer`: Measures adherence to instructions
- `JsonCorrectnessScorer`: Validates JSON structure
- `ComparisonScorer`: Compares outputs on multiple criteria
- `ExecutionOrderScorer`: Evaluates tool usage sequences

### Evaluation Methods

```typescript
// Synchronous evaluation
const results = await client.runEvaluation(examples, scorers, model);

// Asynchronous evaluation
await client.aRunEvaluation(
  examples,
  scorers,
  model,
  projectName,
  evalRunName
);
```

### Logging

```typescript
import logger from 'judgeval/common/logger';

// Enable logging
logger.enableLogging();

// Log messages
logger.info("Starting evaluation...");

// Print results in standardized format
logger.print(results);
```

### Tracing

```typescript
import { Tracer } from 'judgeval/common/tracer';

const tracer = Tracer.getInstance({
  projectName: "my-project",
  enableEvaluations: true
});

// Analogous to Python SDK's with, e.g.
//
// with tracer.trace("my-trace") as trace:
//   with trace.span("operation") as span:
//     # Perform operations
//
for (const trace of tracer.trace("my-trace")) {
  for (const span of trace.span("operation")) {
    // Perform operations
  }
}
```

## Result Retrieval

You can retrieve past evaluation results using several methods:

```typescript
// Initialize the JudgmentClient
const client = JudgmentClient.getInstance();

// Using pullEval
const results = await client.pullEval('my-project', 'my-eval-run');

// List all evaluation runs for a project
const evalRuns = await client.listEvalRuns('my-project', 100, 0); // limit=100, offset=0

// Get statistics for an evaluation run
const stats = await client.getEvalRunStats('my-project', 'my-eval-run');

// Export evaluation results to JSON or CSV
const jsonExport = await client.exportEvalResults('my-project', 'my-eval-run', 'json');
const csvExport = await client.exportEvalResults('my-project', 'my-eval-run', 'csv');
```

The returned results include the evaluation run ID and a list of scoring results:

```typescript
[
  {
    "id": "eval-run-id",
    "results": [
      {
        // ScoringResult object with dataObject, scorersData, etc.
      }
    ]
  }
]
```

For a complete example of retrieving evaluation results, see `src/examples/result-retrieval.ts`.

## Custom Scorers

You can create custom scorers by extending the `JudgevalScorer` class. Here's an example of a custom scorer that checks for exact string matches:

```typescript
import { Example } from './data/example';
import { JudgevalScorer } from './scorers/base-scorer';
import { ScorerData } from './data/result';

/**
 * ExactMatchScorer - A custom scorer that checks if the actual output exactly matches the expected output
 */
class ExactMatchScorer extends JudgevalScorer {
  constructor(threshold: number, additionalMetadata?: Record<string, any>, verbose: boolean = false) {
    super('exact_match', threshold, additionalMetadata, verbose);
  }

  async scoreExample(example: Example): Promise<ScorerData> {
    try {
      // Check if the example has expected output
      if (!example.expectedOutput) {
        return {
          name: this.type,
          threshold: this.threshold,
          success: false,
          score: 0,
          reason: "Expected output is required for exact match scoring",
          strict_mode: null,
          evaluation_model: "exact-match",
          error: "Missing expected output",
          evaluation_cost: null,
          verbose_logs: null,
          additional_metadata: this.additional_metadata || {}
        };
      }

      // Compare the actual output with the expected output
      const actualOutput = example.actualOutput?.trim() || '';
      const expectedOutput = example.expectedOutput.trim();
      
      // Calculate the score (1 for exact match, 0 otherwise)
      const isMatch = actualOutput === expectedOutput;
      this.score = isMatch ? 1 : 0;
      
      // Generate a reason for the score
      const reason = isMatch
        ? "The actual output exactly matches the expected output."
        : `The actual output "${actualOutput}" does not match the expected output "${expectedOutput}".`;
      
      // Return the scorer data
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.successCheck(),
        score: this.score,
        reason: reason,
        strict_mode: null,
        evaluation_model: "exact-match",
        error: null,
        evaluation_cost: null,
        verbose_logs: this.verbose ? `Comparing: "${actualOutput}" with "${expectedOutput}"` : null,
        additional_metadata: this.additional_metadata || {}
      };
    } catch (error) {
      // Handle any errors during scoring
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: `Error during scoring: ${errorMessage}`,
        strict_mode: null,
        evaluation_model: "exact-match",
        error: errorMessage,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: this.additional_metadata || {}
      };
    }
  }
}
```

### Using Custom Scorers

You can use custom scorers with the JudgmentClient just like any other scorer:

```typescript
// Create examples
const examples = [
  new ExampleBuilder()
    .input("What is the capital of France?")
    .actualOutput("Paris is the capital of France.")
    .expectedOutput("Paris is the capital of France.")
    .exampleIndex(0)
    .build(),
  // Add more examples...
];

// Create a custom scorer
const exactMatchScorer = new ExactMatchScorer(1.0, { description: "Checks for exact string match" }, true);

// Initialize the JudgmentClient
const client = JudgmentClient.getInstance();

// Run evaluation with the custom scorer
const results = await client.runEvaluation(
  examples,
  [exactMatchScorer],
  "gpt-3.5-turbo", // Specify a valid model name
  "my-project",
  {
    evalRunName: "custom-scorer-test",
    logResults: true
  }
);
```

### Viewing Results

After running an evaluation with custom scorers, you can view the results in the Judgment platform:

```
https://app.judgmentlabs.ai/app/experiment?project_name=my-project&eval_run_name=custom-scorer-test
```

You can also access the results programmatically:

```typescript
// Print the results
console.log(results);

// Get success rate
const successCount = results.filter(r => {
  return r.scorersData?.every(s => s.success) ?? false;
}).length;

console.log(`Success rate: ${successCount}/${examples.length} (${(successCount/examples.length*100).toFixed(2)}%)`);
```

For a complete example of using custom scorers, see `src/examples/custom-scorer.ts`.

## Examples

See the `/examples` directory for complete usage examples:
- `basic-evaluation.ts`: Simple evaluation workflow
- `async-evaluation.ts`: Asynchronous evaluation
- `llm-async-tracer.ts`: Workflow tracing with evaluation
- `simple-async.ts`: Simplified async evaluation
- `custom-scorer.ts`: Custom scorer implementation

## Environment Variables

- `JUDGMENT_API_KEY`: Your JudgmentLabs API key
- `JUDGMENT_ORG_ID`: Your organization ID