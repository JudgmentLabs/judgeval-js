import * as dotenv from 'dotenv';
import OpenAI from 'openai';
// No longer need base-scorer import directly if using concrete scorer
// import { APIJudgmentScorer } from '../scorers/base-scorer';
import { AnswerRelevancyScorer } from '../scorers/api-scorer'; // <<< Import concrete scorer
import { Tracer, wrap, Rule, Condition } from '../common/tracer'; // Adjust path as necessary

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

// --- Instantiate the actual Scorer ---
// Threshold can be defined here or overridden by rule condition processing on backend
const answerRelevancyScorer = new AnswerRelevancyScorer(0.8);

// --- Define a Sample Rule using the actual scorer instance ---
const sampleRule: Rule = {
  name: "AnswerRelevancyThreshold",
  description: "Checks if the Answer Relevancy score meets a threshold.",
  conditions: [
    {
      // Use the actual scorer instance for the metric
      metric: answerRelevancyScorer,
    } as Condition,
  ],
  combine_type: "all",
  notification: {
    enabled: true,
    communication_methods: ["email"],
    email_addresses: ["minh@judgmentlabs.ai"],
  },
};

// --- Main Demo Function ---
async function runRulesDemo() {
  // 1. Initialize the Tracer
  const tracer = Tracer.getInstance({
    projectName: 'js-rules-demo-project',
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
  const userInput = 'What is the capital of Germany?';
  console.log(`\nStarting trace with rule: ${traceName}`);

  try {
    const result = await tracer.runInTrace(
      {
        name: traceName,
        rules: [sampleRule], // Pass the defined rule
      },
      async (traceClient) => { // Ensure the callback is async
        console.log(`Inside trace context for ${traceClient.name} (ID: ${traceClient.traceId})`);
        console.log(`Trace rules: ${JSON.stringify(traceClient.rules, null, 2)}`);

        const params: OpenAI.Chat.ChatCompletionCreateParams = {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: userInput },
          ],
          temperature: 0.7,
          max_tokens: 50,
        };

        console.log('Making OpenAI API call...');
        const response = await openai.chat.completions.create(params);
        const responseContent = response.choices[0].message?.content ?? "";
        console.log('OpenAI API call successful.');

        // *** ADDING asyncEvaluate call ***
        console.log('Calling asyncEvaluate...');
        await traceClient.asyncEvaluate(
          [answerRelevancyScorer], // <<< Use the actual scorer instance
          {
            input: userInput,
            actualOutput: "Lies",
            model: 'gpt-3.5-turbo', // <<< ADDED model name
            // expectedOutput: "Berlin" // Optionally provide expected output
          }
        );
        console.log('asyncEvaluate finished.');
        // **********************************

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
    console.log(`\nTrace finished. Check Judgment dashboard for the trace and evaluation results associated with the 'answer_relevancy' scorer.`);
  }
}

// Run the demo
runRulesDemo();

// To run:
// Ensure .env.local has OPENAI_API_KEY, JUDGMENT_API_KEY, JUDGMENT_ORG_ID
// npm install
// npx ts-node src/demo/rules-demo.ts 