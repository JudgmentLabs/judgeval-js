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

// Export evaluation results to different formats
const jsonData = await client.exportEvalResults('my-project', 'my-eval-run', 'json');
const csvData = await client.exportEvalResults('my-project', 'my-eval-run', 'csv');
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

You can create custom scorers by extending the `JudgevalScorer` class. This implementation aligns with the Python SDK approach, making it easy to port scorers between languages.

### Creating a Custom Scorer

To create a custom scorer:

1. **Extend the JudgevalScorer class**:

```typescript
import { Example } from 'judgeval/data/example';
import { JudgevalScorer } from 'judgeval/scorers/base-scorer';
import { ScorerData } from 'judgeval/data/result';

class ExactMatchScorer extends JudgevalScorer {
  constructor(
    threshold: number = 1.0, 
    additional_metadata?: Record<string, any>, 
    include_reason: boolean = true,
    async_mode: boolean = true,
    strict_mode: boolean = false,
    verbose_mode: boolean = true
  ) {
    super('exact_match', threshold, additional_metadata, include_reason, async_mode, strict_mode, verbose_mode);
  }

  async scoreExample(example: Example): Promise<ScorerData> {
    try {
      // Check if the example has expected output
      if (!example.expectedOutput) {
        this.error = "Missing expected output";
        this.score = 0;
        this.success = false;
        this.reason = "Expected output is required for exact match scoring";
        
        return {
          name: this.type,
          threshold: this.threshold,
          success: false,
          score: 0,
          reason: this.reason,
          strict_mode: this.strict_mode,
          evaluation_model: "exact-match",
          error: this.error,
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
      this.reason = isMatch
        ? "The actual output exactly matches the expected output."
        : `The actual output "${actualOutput}" does not match the expected output "${expectedOutput}".`;
      
      // Set success based on the score and threshold
      this.success = this._successCheck();
      
      // Generate verbose logs if verbose mode is enabled
      if (this.verbose_mode) {
        this.verbose_logs = `Comparing: "${actualOutput}" with "${expectedOutput}"`;
      }
      
      // Return the scorer data
      return {
        name: this.type,
        threshold: this.threshold,
        success: this.success,
        score: this.score,
        reason: this.include_reason ? this.reason : null,
        strict_mode: this.strict_mode,
        evaluation_model: "exact-match",
        error: null,
        evaluation_cost: null,
        verbose_logs: this.verbose_mode ? this.verbose_logs : null,
        additional_metadata: this.additional_metadata || {}
      };
    } catch (error) {
      // Handle any errors during scoring
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.error = errorMessage;
      this.score = 0;
      this.success = false;
      this.reason = `Error during scoring: ${errorMessage}`;
      
      return {
        name: this.type,
        threshold: this.threshold,
        success: false,
        score: 0,
        reason: this.reason,
        strict_mode: this.strict_mode,
        evaluation_model: "exact-match",
        error: errorMessage,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: this.additional_metadata || {}
      };
    }
  }
  
  /**
   * Get the name of the scorer
   * This is equivalent to Python's __name__ property
   */
  get name(): string {
    return "Exact Match Scorer";
  }
}
```

2. **Implement required methods**:

- `scoreExample(example: Example)`: The core method that evaluates an example and returns a score
- `name`: A getter property that returns the human-readable name of your scorer

3. **Set internal state**:

Your implementation should set these internal properties:
- `this.score`: The numerical score (typically between 0 and 1)
- `this.success`: Whether the example passed the evaluation
- `this.reason`: A human-readable explanation of the score
- `this.error`: Any error that occurred during scoring

### Using Custom Scorers

You can use custom scorers with the JudgmentClient just like any other scorer:

```typescript
// Create examples
const examples = [
  new ExampleBuilder()
    .input("What is the capital of France?")
    .actualOutput("Paris is the capital of France.")
    .expectedOutput("Paris is the capital of France.")
    .build(),
  // Add more examples...
];

// Create a custom scorer
const exactMatchScorer = new ExactMatchScorer(
  1.0, 
  { description: "Checks for exact string match" },
  true,  // include_reason
  true,  // async_mode
  false, // strict_mode
  true   // verbose_mode
);

// Run evaluation with the custom scorer
const results = await client.runEvaluation({
  examples: examples,
  scorers: [exactMatchScorer],
  projectName: "my-project",
  evalRunName: "custom-scorer-test",
  useJudgment: false // Run locally, don't use Judgment API
});
```

### Custom Scorer Parameters

- `threshold`: The minimum score required for success (0-1 for most scorers)
- `additional_metadata`: Extra information to include with results
- `include_reason`: Whether to include a reason for the score
- `async_mode`: Whether to run the scorer asynchronously
- `strict_mode`: If true, sets threshold to 1.0 for strict evaluation
- `verbose_mode`: Whether to include detailed logs

For a complete example of creating and using custom scorers, see `src/examples/custom-scorer.ts`.

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