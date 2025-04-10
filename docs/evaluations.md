# JudgEval Evaluations Guide

This guide provides a detailed explanation of how to use the JudgEval TypeScript SDK to evaluate LLM outputs.

## Understanding Evaluations

Evaluations in JudgEval are a way to assess the quality of LLM outputs across various dimensions. Each evaluation consists of:

1. **Examples**: Input-output pairs that you want to evaluate
2. **Scorers**: Components that evaluate different aspects of the outputs
3. **Results**: Scores and feedback for each example

## Creating Examples

Examples are the foundation of any evaluation. Each example should include:

```typescript
import { Example } from 'judgeval';

// Using the builder pattern
const example = Example.builder()
  .input("What's the capital of France?")
  .actualOutput("The capital of France is Paris.")
  .expectedOutput("Paris is the capital of France.")
  .build();

// Using the constructor
const example = new Example({
  input: "What's the capital of France?",
  actualOutput: "The capital of France is Paris.",
  expectedOutput: "Paris is the capital of France."
});
```

### Example Fields

- `input` (required): The prompt or question given to the model
- `actualOutput` (required): The model's response that you want to evaluate
- `expectedOutput` (optional): The expected or reference output
- `context` (optional): Additional context for the input
- `retrievalContext` (optional): Context used for retrieval-based evaluations
- `metadata` (optional): Additional metadata for the example

### Context-Based Examples

For evaluations that involve context (like RAG systems), you can add context to your examples:

```typescript
const contextExample = Example.builder()
  .input("Based on the context, what is the capital of France?")
  .actualOutput("According to the context, the capital of France is Paris.")
  .context([
    "France is a country in Western Europe.",
    "Paris is the capital and most populous city of France."
  ])
  .build();
```

## Using Scorers

Scorers evaluate different aspects of the model's output. Each scorer focuses on a specific dimension of quality:

### Answer Quality Scorers

```typescript
import { 
  AnswerCorrectnessScorer, 
  AnswerRelevancyScorer, 
  HallucinationScorer 
} from 'judgeval';

// Create scorers with thresholds
const correctnessScorer = new AnswerCorrectnessScorer(0.7);
const relevancyScorer = new AnswerRelevancyScorer(0.7);
const hallucinationScorer = new HallucinationScorer(0.3);
```

### Context-Based Scorers

```typescript
import { 
  FaithfulnessScorer, 
  ContextualRelevancyScorer, 
  ContextualPrecisionScorer, 
  ContextualRecallScorer 
} from 'judgeval';

// Create context-based scorers
const faithfulnessScorer = new FaithfulnessScorer(0.7);
const relevancyScorer = new ContextualRelevancyScorer(0.6);
const precisionScorer = new ContextualPrecisionScorer(0.6);
const recallScorer = new ContextualRecallScorer(0.6);
```

### Specialized Scorers

```typescript
import { 
  SummarizationScorer, 
  JsonCorrectnessScorer, 
  InstructionAdherenceScorer, 
  ComparisonScorer, 
  ExecutionOrderScorer 
} from 'judgeval';

// Create specialized scorers
const summScorer = new SummarizationScorer(0.7);
const jsonScorer = new JsonCorrectnessScorer(0.7);
const instructionScorer = new InstructionAdherenceScorer(0.7);
const comparisonScorer = new ComparisonScorer(0.5);
const executionOrderScorer = new ExecutionOrderScorer(0.7);
```

## Running Evaluations

### Basic Evaluation

The simplest way to run an evaluation is using the `evaluate` method:

```typescript
import { JudgmentClient, Example, AnswerCorrectnessScorer } from 'judgeval';

const client = JudgmentClient.getInstance();
const examples = [/* your examples */];
const scorers = [new AnswerCorrectnessScorer(0.7)];

const results = await client.evaluate({
  examples: examples,
  scorers: scorers,
  projectName: 'my-project',
  evalName: 'my-evaluation'
});
```

### Evaluation Options

The `evaluate` method accepts a configuration object with the following options:

```typescript
const results = await client.evaluate({
  examples: examples,                                      // Required: Array of examples to evaluate
  scorers: scorers,                                        // Required: Array of scorers to use
  model: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',     // Optional: Model to use for evaluation
  aggregator: undefined,                                   // Optional: Aggregation method
  metadata: { test: "basic" },                             // Optional: Additional metadata
  projectName: 'my-project',                               // Optional: Project name (default: 'default_project')
  evalName: 'my-evaluation',                               // Optional: Evaluation run name (default: timestamp)
  logResults: true,                                        // Optional: Whether to log results (default: true)
  override: false,                                         // Optional: Whether to override existing evaluations (default: false)
  useJudgment: true,                                       // Optional: Whether to use Judgment API (default: true)
  ignoreErrors: true,                                      // Optional: Whether to ignore errors (default: true)
  asyncExecution: false,                                   // Optional: Whether to run asynchronously (default: false)
  rules: []                                                // Optional: Additional rules for evaluation
});
```

### Asynchronous Evaluation

For large-scale evaluations, you can use asynchronous execution:

```typescript
// Start an asynchronous evaluation
await client.evaluate({
  examples: examples,
  scorers: scorers,
  projectName: 'my-project',
  evalName: 'my-evaluation',
  asyncExecution: true
});

// Check the status of the evaluation
const status = await client.checkEvalStatus('my-project', 'my-evaluation');
console.log(`Status: ${status.status}`);

// Pull the results when the evaluation is complete
if (status.status === 'COMPLETED') {
  const results = await client.pullEval('my-project', 'my-evaluation');
  console.log(results);
}
```

## Understanding Results

The evaluation results include detailed information about each example and scorer:

```typescript
// Example result structure
[
  {
    "example": {
      "id": "d4268b81-3189-4524-af44-b50c67837474",
      "input": "What's the capital of France?",
      "actualOutput": "The capital of France is Paris.",
      "expectedOutput": "Paris is the capital of France.",
      "context": null,
      "retrievalContext": null,
      "metadata": null
    },
    "scores": [
      {
        "name": "Answer Correctness",
        "score": 0.95,
        "threshold": 0.7,
        "success": true,
        "reason": "The answer is correct. Paris is indeed the capital of France.",
        "error": null
      }
    ],
    "success": true
  }
]
```

### Analyzing Results

You can analyze the results programmatically:

```typescript
// Calculate overall success rate
const successRate = results.filter(r => r.success).length / results.length;
console.log(`Success rate: ${successRate * 100}%`);

// Calculate average score for a specific scorer
const scorerName = "Answer Correctness";
const scores = results.flatMap(r => r.scores.filter(s => s.name === scorerName).map(s => s.score));
const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
console.log(`Average ${scorerName} score: ${averageScore}`);
```

## Logging and Visualization

The SDK includes a comprehensive logging system:

```typescript
import logger from 'judgeval/common/logger';

// Enable logging
logger.enableLogging('my-app', './logs');

// Log messages at different levels
logger.debug('Detailed debugging information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error message');

// Format and log evaluation results
logger.info(logger.formatEvaluationResults(results, 'my-project', 'my-evaluation'));
```

### Viewing Results in the UI

You can view evaluation results in the JudgEval UI:

```
https://app.judgmentlabs.ai/app/experiment?project_name=my-project&eval_run_name=my-evaluation
```

## Best Practices

1. **Use meaningful names**: Choose descriptive project and evaluation names
2. **Start small**: Begin with a small set of examples before scaling up
3. **Combine scorers**: Use multiple scorers to evaluate different aspects
4. **Set appropriate thresholds**: Adjust thresholds based on your requirements
5. **Use async for large evaluations**: For large datasets, use asynchronous execution
6. **Log results**: Enable logging to track the evaluation process
7. **Analyze trends**: Compare results across different models or versions

## Troubleshooting

### Common Issues

1. **Authentication errors**: Ensure your API key and organization ID are set correctly
2. **Missing fields**: Check that your examples have all required fields for the scorers you're using
3. **Timeout errors**: For large evaluations, use asynchronous execution
4. **Model errors**: Ensure you're using a valid model name

### Debugging

Enable verbose logging to get more detailed information:

```typescript
logger.enableLogging('my-app', './logs', 'debug');
```

## Examples

See the `examples` directory for complete examples:

- `basic-evaluation.ts`: Demonstrates how to use all available scorers
- `async-evaluation.ts`: Demonstrates how to use asynchronous evaluation
- `error-handling-test.ts`: Demonstrates how to handle errors
