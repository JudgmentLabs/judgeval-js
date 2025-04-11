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

await tracer.runInTrace({ name: "my-trace" }, async (trace) => {
  // Run operations within the trace
  await trace.runInSpan("operation", { spanType: "tool" }, async () => {
    // Perform operations
  });
});
```

## Environment Variables

- `JUDGMENT_API_KEY`: Your JudgmentLabs API key
- `JUDGMENT_ORG_ID`: Your organization ID

## Examples

See the `/examples` directory for complete usage examples:
- `basic-evaluation.ts`: Simple evaluation workflow
- `async-evaluation.ts`: Asynchronous evaluation
- `llm-async-tracer.ts`: Workflow tracing with evaluation
- `simple-async.ts`: Simplified async evaluation