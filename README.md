# Judgeval TypeScript SDK

[![npm version](https://badge.fury.io/js/judgeval.svg)](https://www.npmjs.com/package/judgeval)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Installation

Find the latest version on [npm](https://www.npmjs.com/package/judgeval).

```bash
npm install judgeval
```

## Usage

### Tracer

```typescript
import { Tracer } from "judgeval";

const tracer = await Tracer.init({
  projectName: "my-llm-app",
});

async function chatWithUser(userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userMessage }],
  });
  return response.choices[0].message.content || "";
}

const tracedChat = Tracer.observe(chatWithUser);
const result = await tracedChat("What is the capital of France?");

await Tracer.shutdown();
```

### Async Evaluation

Trigger server-side evaluation on the current span:

```typescript
import { Tracer } from "judgeval";

const tracedChat = Tracer.observe(async (userMessage: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userMessage }],
  });

  Tracer.asyncEvaluate({ judge: "Relevancy" });

  return response.choices[0].message.content || "";
});

await tracedChat("What is the capital of France?");
```

### JQL

Build JQL with the `judgeval/jql` entry point and run it through the authenticated
Judgeval client. Organization and project scope come from the client, never from
the query payload.

```typescript
import { Judgeval } from "judgeval";
import { eq, traces } from "judgeval/jql";

const client = await Judgeval.create({ projectName: "my-llm-app" });
const result = await client.query(
  traces().where(eq("session", "session-123")).ids(),
);
```

## Documentation

- [Full Documentation](https://docs.judgmentlabs.ai/)

## License

Apache 2.0
