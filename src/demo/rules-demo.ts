import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { Tracer, wrap, Rule, Condition, ScorerDefinition } from '../common/tracer'; // Adjust path as necessary

// Load environment variables from .env file
dotenv.config({ path: '.env.local' });

// Ensure necessary environment variables are set
if (!process.env.OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}
if (!process.env.JUDGMENT_API_KEY) {
  console.warn("Warning: JUDGMENT_API_KEY environment variable is not set. Tracing will be disabled.");
}
if (!process.env.JUDGMENT_ORG_ID) {
  console.warn("Warning: JUDGMENT_ORG_ID environment variable is not set. Tracing will be disabled.");
}

// --- Define a Sample Rule ---
// This rule demonstrates the structure. Replace with actual scorer types and thresholds.
const sampleRule: Rule = {
  name: "CapitalCheckThreshold",
  description: "Checks if a hypothetical 'Answer Relevancy' score meets a threshold.",
  conditions: [
    {
      metric: {
        score_type: "answer_relevancy",
        threshold: 0.8, // Example threshold
      } as ScorerDefinition, // Cast to ensure type compatibility if ScorerDefinition has more fields
    } as Condition,
  ],
  combine_type: "all", // Only one condition, so 'all' or 'any' works
  notification: { // Optional notification configuration
    enabled: true,
    communication_methods: ["email"],
    email_addresses: ["alerts@example.com"], // Replace with actual emails
  },
};

// --- Main Demo Function ---
async function runRulesDemo() {
  // 1. Initialize the Tracer (using environment variables)
  const tracer = Tracer.getInstance({
    projectName: 'js-rules-demo-project',
    // You could also provide default rules here:
    // rules: [anotherDefaultRule]
  });

  // 2. Create an OpenAI client instance
  const rawOpenai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 3. Wrap the OpenAI client
  const openai = wrap(rawOpenai);
  console.log('OpenAI client wrapped for tracing.');

  // 4. Use the wrapped client within a trace context, passing the rule
  const traceName = 'openai-rules-demo-trace';
  console.log(`\nStarting trace with rule: ${traceName}`);

  try {
    const result = await tracer.runInTrace(
      {
        name: traceName,
        rules: [sampleRule], // Pass the defined rule(s) for this specific trace
      },
      async (traceClient) => {
        console.log(`Inside trace context for ${traceClient.name} (ID: ${traceClient.traceId})`);
        console.log(`Trace rules: ${JSON.stringify(traceClient.rules, null, 2)}`);

        // Make the API call using the *wrapped* client
        const params: OpenAI.Chat.ChatCompletionCreateParams = {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'What is the capital of Germany?' },
          ],
          temperature: 0.7,
          max_tokens: 50,
        };

        console.log('Making OpenAI API call...');
        const response = await openai.chat.completions.create(params);

        console.log('OpenAI API call successful.');
        return response;
      }
    );

    console.log("\n--- OpenAI Response ---");
    if (result && result.choices && result.choices.length > 0) {
      console.log('Assistant:', result.choices[0].message?.content);
      console.log('Usage:', result.usage);
    } else {
      console.log('No response content found.');
      console.log('Full Response:', JSON.stringify(result, null, 2));
    }
    console.log('-----------------------');

  } catch (error) {
    console.error("\n--- Error during demo execution ---");
    console.error(error);
    console.log('-----------------------------------');
  } finally {
    console.log(`\nTrace finished. Check Judgment dashboard if monitoring was enabled. If the rule condition was met and notifications configured, those should trigger.`);
  }
}

// Run the demo
runRulesDemo();

// To run:
// Ensure .env.local has OPENAI_API_KEY, JUDGMENT_API_KEY, JUDGMENT_ORG_ID
// npm install
// npx ts-node src/demo/rules-demo.ts 