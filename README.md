# JudgEval TypeScript SDK

The JudgEval TypeScript SDK provides a powerful and flexible way to evaluate LLM outputs using a variety of scorers. This SDK is designed to be easy to use while providing comprehensive evaluation capabilities.

## Installation

```bash
npm install judgeval
```

## Quick Start

```typescript
import { JudgmentClient, Example, AnswerRelevancyScorer } from 'judgeval';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize the client
const client = JudgmentClient.getInstance();

// Create examples
const examples = [
  new Example({
    input: "What's the capital of France?",
    actualOutput: "The capital of France is Paris.",
    expectedOutput: "Paris is the capital of France."
  })
];

// Create a scorer
const scorer = new AnswerRelevancyScorer(0.7);

// Run the evaluation
async function runEvaluation() {
  const results = await client.evaluate({
    examples: examples,
    scorers: [scorer],
    projectName: 'my-project',
    evalName: 'my-evaluation'
  });
  
  console.log(results);
}

runEvaluation();
```


The `JudgmentClient` is the main entry point for the SDK. It provides methods to run evaluations, manage datasets, and interact with the JudgEval API.

```typescript
// Get the singleton instance
const client = JudgmentClient.getInstance();
```

### Examples

Examples are the inputs and outputs that you want to evaluate. Each example consists of:

- `input`: The prompt or question given to the model
- `actualOutput`: The model's response that you want to evaluate
- `expectedOutput` (optional): The expected or reference output
- `context` (optional): Additional context for the input
- `retrievalContext` (optional): Context used for retrieval-based evaluations

```typescript
// Create an example using the builder pattern
const example = Example.builder()
  .input("What's the capital of France?")
  .actualOutput("The capital of France is Paris.")
  .expectedOutput("Paris is the capital of France.")
  .build();

// Or create an example using the constructor
const example = new Example({
  input: "What's the capital of France?",
  actualOutput: "The capital of France is Paris.",
  expectedOutput: "Paris is the capital of France."
});
```

### Scorers

Scorers evaluate different aspects of the model's output. 

```typescript
// Create a scorer with a threshold
const scorer = new AnswerRelevancyScorer(0.7);

// Run an evaluation with multiple scorers
const results = await client.evaluate({
  examples: examples,
  scorers: [
    new AnswerCorrectnessScorer(0.7),
    new FaithfulnessScorer(0.8),
    new HallucinationScorer(0.5)
  ],
  projectName: 'my-project',
  evalName: 'my-evaluation'
});
```

## Running Evaluations

The SDK provides a simplified interface for running evaluations:

```typescript
const results = await client.evaluate({
  examples: examples,
  scorers: scorers,
  model: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo', // Optional, defaults to Meta-Llama-3
  projectName: 'my-project',
  evalName: 'my-evaluation',
  logResults: true, // Optional, defaults to true
  asyncExecution: false // Optional, defaults to false
});
```

### Synchronous vs. Asynchronous Evaluation

By default, evaluations run synchronously, and the results are returned when the evaluation is complete. For large-scale evaluations, you can use asynchronous execution:

```typescript
// Run an evaluation asynchronously
await client.evaluate({
  examples: examples,
  scorers: scorers,
  projectName: 'my-project',
  evalName: 'my-evaluation',
  asyncExecution: true
});

// The evaluation will run in the background, and results will be available in the JudgEval UI
```

## Viewing Results

Evaluation results can be viewed in the JudgEval UI or accessed programmatically:

```typescript
// View results in the JudgEval UI
console.log(`View results at: https://app.judgmentlabs.ai/app/experiment?project_name=my-project&eval_run_name=my-evaluation`);

// Access results programmatically
const results = await client.pullEval('my-project', 'my-evaluation');
```

## Logging

The SDK includes a comprehensive logging system that provides detailed information about the evaluation process:

```typescript
import logger from 'judgeval/common/logger';

// Enable logging
logger.enableLogging('my-app', './logs');

// Log messages
logger.info('Starting evaluation...');
logger.error('An error occurred');

// Disable logging
logger.disableLogging();
```

## Advanced Usage

### Custom Scorers

You can create custom scorers by extending the `APIJudgmentScorer` or `JudgevalScorer` classes:

```typescript
import { APIJudgmentScorer } from 'judgeval';

class MyCustomScorer extends APIJudgmentScorer {
  constructor(threshold: number) {
    super('my_custom_scorer', threshold);
  }
}
```