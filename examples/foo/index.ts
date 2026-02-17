import { Example, NodeTracer } from "judgeval";
import OpenAI from "openai";
import "./instrumentation";

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Environment variable ${name} is not set`);
    return value;
}

const client = new OpenAI({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    baseURL: "https://api.anthropic.com/v1",
});

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

let fibonacci: (n: number) => Promise<number>;
fibonacci = NodeTracer.observe(async (n: number): Promise<number> => {
    await sleep(100);
    if (n <= 1) return n;
    const [a, b] = await Promise.all([fibonacci(n - 1), fibonacci(n - 2)]);
    return a + b;
});

const fizzbuzz = NodeTracer.observe(async (n: number): Promise<string[]> => {
    await sleep(100);
    const result: string[] = [];
    for (let i = 1; i <= n; i += 1) {
        if (i % 15 === 0) result.push("FizzBuzz");
        else if (i % 3 === 0) result.push("Fizz");
        else if (i % 5 === 0) result.push("Buzz");
        else result.push(String(i));
    }
    return result;
});

const chat = NodeTracer.observe(async (message: string): Promise<string> => {
    const response = await client.chat.completions.create({
        model: "claude-opus-4-1",
        messages: [{ role: "user", content: message }],
        max_tokens: 50,
    });
    NodeTracer.asyncTraceEvaluate("Hallucination");
    return response.choices[0]?.message?.content ?? "";
});

const longRunningTask = NodeTracer.observe(
    async (duration: number): Promise<string> => {
        await sleep(duration * 1000);
        await NodeTracer.span("long_running_task_inner", async () => {
            NodeTracer.setInput("hi");
        });
        return `Sleeping for ${duration} seconds`;
    },
);

type RequestSpec =
    | {
        name: "fibonacci";
        customerId: string;
        sessionId: string;
        tags: string[];
        n: number;
    }
    | {
        name: "fizzbuzz";
        customerId: string;
        sessionId: string;
        tags: string[];
        n: number;
    }
    | {
        name: "chat";
        customerId: string;
        sessionId: string;
        tags: string[];
        message: string;
    }
    | {
        name: "long_running_task";
        customerId: string;
        sessionId: string;
        tags: string[];
        duration: number;
    };

async function handleRequest(spec: RequestSpec): Promise<number | string | string[]> {
    await NodeTracer.init({ projectName: spec.name });
    return NodeTracer.span("handle", async () => {
        NodeTracer.setCustomerId(spec.customerId);
        NodeTracer.setSessionId(spec.sessionId);
        NodeTracer.tag(spec.tags);
        if (spec.name === "fibonacci") return fibonacci(spec.n);
        if (spec.name === "fizzbuzz") return fizzbuzz(spec.n);
        if (spec.name === "chat") {
            const result = await chat(spec.message);
            NodeTracer.asyncEvaluate("answer_relevancy", [
                Example.create({
                    input: spec.message,
                    actual_output: result,
                }),
            ]);
            return result;
        }
        return longRunningTask(spec.duration);
    });
}

async function main(): Promise<void> {
    const requests: RequestSpec[] = [
        {
            name: "fibonacci",
            customerId: "cust_001",
            sessionId: "sess_01",
            tags: ["math", "recursive"],
            n: 5,
        },
        {
            name: "long_running_task",
            customerId: "cust_001",
            sessionId: "sess_02",
            tags: ["long"],
            duration: 10,
        },
        {
            name: "fibonacci",
            customerId: "cust_001",
            sessionId: "sess_02",
            tags: ["math", "recursive"],
            n: 12,
        },
        {
            name: "chat",
            customerId: "cust_003",
            sessionId: "sess_03",
            tags: ["llm", "research"],
            message: "whats the latest anthropic model?",
        },
        {
            name: "fibonacci",
            customerId: "cust_001",
            sessionId: "sess_04",
            tags: ["math", "recursive"],
            n: 8,
        },
        {
            name: "fizzbuzz",
            customerId: "cust_003",
            sessionId: "sess_05",
            tags: ["math"],
            n: 30,
        },
        {
            name: "chat",
            customerId: "cust_002",
            sessionId: "sess_06",
            tags: ["llm"],
            message: "explain quantum computing in one sentence",
        },
        {
            name: "fibonacci",
            customerId: "cust_002",
            sessionId: "sess_07",
            tags: ["math", "recursive"],
            n: 3,
        },
        {
            name: "fizzbuzz",
            customerId: "cust_001",
            sessionId: "sess_08",
            tags: ["math", "iterative"],
            n: 20,
        },
        {
            name: "chat",
            customerId: "cust_001",
            sessionId: "sess_09",
            tags: ["llm", "research"],
            message: "what is RLHF?",
        },
        {
            name: "fibonacci",
            customerId: "cust_003",
            sessionId: "sess_10",
            tags: ["math"],
            n: 6,
        },
        {
            name: "fizzbuzz",
            customerId: "cust_002",
            sessionId: "sess_11",
            tags: ["math"],
            n: 10,
        },
        {
            name: "chat",
            customerId: "cust_003",
            sessionId: "sess_12",
            tags: ["llm"],
            message: "summarize transformers architecture",
        },
    ];

    const results = await Promise.all(requests.map(handleRequest));
    for (const result of results) console.log(result);
}

await main();
await NodeTracer.shutdown();