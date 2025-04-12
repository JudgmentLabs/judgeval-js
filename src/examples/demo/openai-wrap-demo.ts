import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { Tracer, wrap } from '../../common/tracer'; // Adjust path as necessary

// Load environment variables from .env file
dotenv.config({ path: '.env.local' });

// Ensure necessary environment variables are set
if (!process.env.OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}
if (!process.env.JUDGMENT_API_KEY) {
  console.warn("Warning: JUDGMENT_API_KEY environment variable is not set. Tracing will be disabled.");
  // No need to exit, tracer handles disabling itself
}
if (!process.env.JUDGMENT_ORG_ID) {
  console.warn("Warning: JUDGMENT_ORG_ID environment variable is not set. Tracing will be disabled.");
  // No need to exit, tracer handles disabling itself
}

// --- Main Demo Function ---
async function runDemo() {
  // 1. Initialize the Tracer (using environment variables)
  // Note: You could also pass config directly: Tracer.getInstance({ apiKey: '...', organizationId: '...' })
  const tracer = Tracer.getInstance({
    // Optionally override project name or other settings here
    projectName: 'js-wrap-demo-project',
  });

  // 2. Create an OpenAI client instance
  const rawOpenai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 3. Wrap the OpenAI client
  // The 'wrap' function modifies the client instance in place.
  const openai = wrap(rawOpenai);
  console.log('OpenAI client wrapped for tracing.');

  // 4. Use the wrapped client within a trace context
  const traceName = 'openai-wrap-demo-trace';
  console.log(`
Starting trace: ${traceName}`);

  try {
    const result = await tracer.runInTrace(
      {
        name: traceName,
        // You can specify overwrite: true if needed
      },
      async (traceClient) => { // The callback receives the active TraceClient
        console.log(`Inside trace context for ${traceClient.name} (ID: ${traceClient.traceId})`);

        // Make the API call using the *wrapped* client
        // This call will automatically be captured as an 'llm' span within the trace
        const params: OpenAI.Chat.ChatCompletionCreateParams = {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'What is the capital of France?' },
          ],
          temperature: 0.7,
          max_tokens: 50,
        };

        console.log('Making OpenAI API call...');
        const response = await openai.chat.completions.create(params);

        console.log('OpenAI API call successful.');
        return response; // Return the response from the traced function
      }
    );

    console.log("\n--- OpenAI Response ---");
    // Log the response content (or the full object)
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
    console.log(`
Trace finished. Check Judgment dashboard if monitoring was enabled.`);
  }
}

// Run the demo
runDemo();

