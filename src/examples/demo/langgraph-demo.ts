import * as dotenv from 'dotenv';
import { END, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables"; // Import RunnableConfig
import { JudgevalLanggraphCallbackHandler } from "../../common/integrations/langgraph.js"; // Added .js extension
import { Tracer } from "../../common/tracer.js"; // Ensure correct path
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { JudgmentClient } from "../../judgment-client.js";
import { FaithfulnessScorer } from "../../scorers/api-scorer.js";

// Load environment variables from .env.local BEFORE accessing them
dotenv.config({ path: '.env.local' });

// Ensure API keys are set in environment variables
const OPENAI_API_KEY = getEnvironmentVariable("OPENAI_API_KEY");
const JUDGEVAL_API_KEY = getEnvironmentVariable("JUDGEVAL_API_KEY"); // Assuming you have this

// 0. Initialize Judgeval Tracer (optional, but recommended)
// NOTE: Assuming Tracer singleton handles initialization via env vars or a separate setup.
// The JudgevalLanggraphCallbackHandler will use Tracer.getInstance().

/* Remove explicit init:
if (JUDGEVAL_API_KEY) {
    // Attempt to configure the singleton instance if a configure method exists
    // Tracer.getInstance().configure({ // Example, adjust if method name differs
    //     apiKey: JUDGEVAL_API_KEY,
    //     projectName: "langgraph-js-demo",
    // });
    console.log("Judgeval Tracer should pick up config (ensure JUDGEVAL_API_KEY is set).");
} else {
    console.warn("JUDGEVAL_API_KEY not found. Judgeval tracing might be disabled or use defaults.");
    // Tracer.getInstance().configure({ enableMonitoring: false }); // Example
}
*/

// 1. Define the state
interface AgentState {
  messages: BaseMessage[];
  input: string;
}

// Define a type for the state updates the node can return
type PartialAgentState = Partial<AgentState>;

// 2. Define the nodes
// Use the specific update type for clarity
// **** Update function signature to accept config ****
async function callModel(state: AgentState, config?: RunnableConfig): Promise<PartialAgentState> {
  const { messages, input } = state; // Use input if needed, or pass relevant history
  const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-4o-mini" }); // Use a specific model

  // *** Get the current trace client from the context established by runInTrace ***
  const tracer = Tracer.getInstance(); // Get tracer instance
  const traceClient = tracer.getCurrentTrace(); // Get the active trace client

  console.log("--- Node: callModel - Preparing LLM call ---");
  const modelMessages = messages.length > 0 ? messages : [{ role: "user", content: input }];

  // The handler should capture this automatically via onChatModelStart/onLlmEnd
  console.log("--- Node: callModel - Invoking model (handler should trace) ---");
  // **** Pass callbacks from config to model.invoke ****
  const response = await model.invoke(modelMessages, { callbacks: config?.callbacks });
  console.log("--- Node: callModel - Model Response --- ", response.content);

  // Return the response to append to the messages list
  return {
    messages: [response], // LangGraph knows how to append this based on channel config
  };
}

// 3. Define the graph
const workflow = new StateGraph<AgentState>({
  channels: {
    messages: {
      value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: (): BaseMessage[] => [],
    },
    input: {
        // Re-add the explicit "last write wins" reducer as required by types
        value: (x: string, y: string) => y,
        default: (): string => "",
    },
  },
});

// Define the graph structure using chained calls for proper type inference
const workflowWithNodesAndEdges = workflow
  .addNode("agent", callModel)
  .setEntryPoint("agent")
  .addEdge("agent", END);

// 4. Compile the graph
const app = workflowWithNodesAndEdges.compile();

// 5. Run the graph with the Judgeval handler
async function runDemo() {
  // console.log("--- Starting LangGraph Demo ---"); // Removed

  // Get the tracer instance
  const tracer = Tracer.getInstance({
      projectName: "langgraph-js-demo",
      // API Key and Org ID should be picked up from env vars by the Tracer singleton
  });

  // Define the full initial state, not partial
  const inputs: AgentState = {
    messages: [], // Start with empty message list
    input: "What is the capital of France?",
  };

  // console.log("--- Invoking Graph within runInTrace --- "); // Removed
  try {
    // Wrap the invocation in tracer.runInTrace
    let graphResult_: AgentState;
    for (const trace of tracer.trace("langgraph-demo-trace")) {
      // console.log(`>>> Main: Inside trace context: ${traceClient.traceId}`); // Removed

      // *** Instantiate handler INSIDE the trace context ***
      const judgevalHandler = new JudgevalLanggraphCallbackHandler(tracer);

      // Invoke the graph *within* the established trace context
      const graphResult = await app.invoke(inputs, {
          callbacks: [judgevalHandler],
      }) as AgentState; // Assert the final state shape

      // console.log("\n--- Graph Result (inside trace) ---"); // Removed
      // console.log(JSON.stringify(graphResult, null, 2)); // Removed

      // Access messages safely after type assertion
      const finalMessages = graphResult.messages || [];
      const finalAiMessage = finalMessages.length > 0 ? finalMessages[finalMessages.length - 1] : null;
      console.log("\nFinal AI Message Content:", finalAiMessage?.content); // Keep final output log

      graphResult_ = graphResult; // Return the result from the traced function
    }
    // @ts-ignore graphResult_ is assigned
    const graphResult = graphResult_;

    // Handler should save the trace upon completion (when root span ends)
    // runInTrace handles saving the trace upon completion
    // console.log("--- Trace execution finished ---"); // Removed

  } catch (e) {
    console.error("--- Error during traced execution ---", e);
    // runInTrace attempts to save the trace even on error
  } finally {
      // console.log("--- Demo Finished ---"); // Removed
      if (tracer.enableMonitoring) {
          console.log("Check Judgment dashboard for the trace."); // Simplified
      } else {
          console.log("Judgment monitoring disabled, no trace was sent.");
      }
  }
}

runDemo();

// Example command to run (ensure you have ts-node installed):
// OPENAI_API_KEY="sk-..." JUDGEVAL_API_KEY="jv_..." JUDGMENT_ORG_ID="..." ts-node src/demo/langgraph_demo.ts 