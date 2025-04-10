# JudgEval TypeScript SDK


```typescript
import { JudgmentClient, Example, FaithfulnessScorer } from 'judgeval';

// Initialize client
const client = JudgmentClient.getInstance();

// Create an example
const example = new Example({
  input: "What if these shoes don't fit?",
  actualOutput: "We offer a 30-day full refund at no extra cost.",
  retrievalContext: ["All customers are eligible for a 30 day full refund at no extra cost."]
});

// Create a scorer
const scorer = new FaithfulnessScorer(0.5);

// Run evaluation
const results = await client.evaluate({
  examples: [example],
  scorers: [scorer],
  model: "gpt-4"
});

console.log(results);
```

## Examples

Examples represent the input-output pairs you want to evaluate.

```typescript
// Using constructor
const example = new Example({
  input: "What's the capital of France?",
  actualOutput: "The capital of France is Paris.",
  expectedOutput: "Paris is the capital of France.",
  context: ["France is a country in Western Europe."],
  retrievalContext: ["Paris is the capital of France."],
  toolsCalled: ["search_tool"],
  expectedTools: ["search_tool"],
  metadata: { source: "geography_dataset" }
});

// Using builder pattern
const example = Example.builder()
  .input("What's the capital of France?")
  .actualOutput("The capital of France is Paris.")
  .expectedOutput("Paris is the capital of France.")
  .build();
```

## Scorers

Scorers evaluate different aspects of LLM outputs.

### Answer Quality

```typescript
import { 
  AnswerCorrectnessScorer, 
  AnswerRelevancyScorer, 
  HallucinationScorer 
} from 'judgeval';

const correctnessScorer = new AnswerCorrectnessScorer(0.7);
const relevancyScorer = new AnswerRelevancyScorer(0.7);
const hallucinationScorer = new HallucinationScorer(0.3);
```

### RAG Evaluation

```typescript
import { 
  FaithfulnessScorer, 
  ContextualRelevancyScorer, 
  ContextualPrecisionScorer, 
  ContextualRecallScorer 
} from 'judgeval';

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
  ExecutionOrderScorer,
  GroundednessScorer
} from 'judgeval';

const summScorer = new SummarizationScorer(0.7);
const jsonScorer = new JsonCorrectnessScorer(0.7);
const instructionScorer = new InstructionAdherenceScorer(0.7);
```

## Running Evaluations

### Synchronous Evaluation

```typescript
const results = await client.evaluate({
  examples: examples,
  scorers: scorers,
  model: "gpt-4",
  projectName: "my-project",
  evalName: "my-evaluation"
});
```

### Asynchronous Evaluation


```typescript
// Submit async evaluation
await client.evaluate({
  examples: examples,
  scorers: scorers,
  projectName: "my-project",
  evalName: "my-evaluation",
  asyncExecution: true
});

// Check status
const status = await client.checkEvalStatus("my-project", "my-evaluation");

// Wait for completion and get results
const results = await client.waitForEvaluation("my-project", "my-evaluation", {
  intervalMs: 2000,
  maxAttempts: 30,
  showProgress: true
});
```

### Alternative Async API

```typescript
// Using aRunEvaluation
await client.aRunEvaluation(
  examples,
  scorers,
  "gpt-4",
  undefined, // aggregator
  { test: "async" }, // metadata
  true, // logResults
  "my-project",
  "my-evaluation"
);

// Get results when complete
const results = await client.pullEval("my-project", "my-evaluation");
```

## Trace-Based Evaluation

Evaluate LLM outputs within traces:

```typescript
import { Tracer, FaithfulnessScorer } from 'judgeval';

// Get tracer instance
const tracer = Tracer.getInstance();

// Run in trace
await tracer.runInTrace({
  name: "my-trace",
  projectName: "my-project"
}, async (trace) => {
  // Run LLM call in span
  await trace.runInSpan("llm_call", { spanType: "llm" }, async () => {
    // Record input
    trace.recordInput({ prompt: "What's the capital of France?" });
    
    // Record output
    trace.recordOutput({
      response: "The capital of France is Paris.",
      usage: {
        prompt_tokens: 7,
        completion_tokens: 6,
        total_tokens: 13
      }
    });
    
    // Evaluate output
    await trace.asyncEvaluate(
      [new FaithfulnessScorer()],
      {
        input: "What's the capital of France?",
        actualOutput: "The capital of France is Paris.",
        expectedOutput: "Paris is the capital of France."
      }
    );
  });
});
```

## Result Format

```typescript
[
  {
    "example": {
      "id": "d4268b81-3189-4524-af44-b50c67837474",
      "input": "What's the capital of France?",
      "actualOutput": "The capital of France is Paris.",
      "expectedOutput": "Paris is the capital of France."
    },
    "scores": [
      {
        "name": "Answer Correctness",
        "score": 0.95,
        "threshold": 0.7,
        "success": true,
        "reason": "The answer is correct. Paris is indeed the capital of France."
      }
    ],
    "success": true
  }
]
```