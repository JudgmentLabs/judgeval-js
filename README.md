# Judgeval TypeScript SDK

[![npm version](https://badge.fury.io/js/judgeval.svg)](https://www.npmjs.com/package/judgeval)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Installation

Find the latest version on [npm](https://www.npmjs.com/package/judgeval).

**npm:**

```bash
npm install judgeval
```

**yarn:**

```bash
yarn add judgeval
```

**bun:**

```bash
bun add judgeval
```

**pnpm:**

```bash
pnpm add judgeval
```

## Usage

### Tracer

```typescript
import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { Judgeval, type NodeTracer } from "judgeval";

const client = Judgeval.create();

const tracer = await client.nodeTracer.create({
  projectName: "my-llm-app",
  enableEvaluation: true,
  enableMonitoring: true,
  instrumentations: [new OpenAIInstrumentation()],
});

async function chatWithUser(userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userMessage }],
  });
  return response.choices[0].message.content || "";
}

const tracedChat = tracer.observe(chatWithUser);
const result = await tracedChat("What is the capital of France?");

await tracer.shutdown();
```

### Scorer

```typescript
import { Example } from "judgeval";

const scorer = client.scorers.builtIn.answerRelevancy();

const example = Example.create({
  input: "What is the capital of France?",
  actual_output: "Paris is the capital of France.",
});

await tracer.asyncEvaluate(scorer, example);
```

## Documentation

- [Full Documentation](https://docs.judgmentlabs.ai/)

## License

Apache 2.0
