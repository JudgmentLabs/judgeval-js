// judgeval-js/src/demo/human_in_the_loop_demo.ts

import * as dotenv from 'dotenv';
import { StateGraph, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { addMessages } from "@langchain/langgraph";
import { DynamicTool } from "@langchain/core/tools"; // Import DynamicTool
import { z } from "zod"; // Import Zod for schema definition (optional but recommended)

// Judgeval Imports
import { JudgevalLanggraphCallbackHandler } from "../common/integrations/langgraph"; // Adjust path
import { Tracer } from "../common/tracer"; // Adjust path
import { AnswerRelevancyScorer, AnswerCorrectnessScorer } from "../scorers/api-scorer"; // For tool evals

// Load environment variables
dotenv.config({ path: '.env.local' });

// --- Configuration ---
const PROJECT_NAME = "langgraph-js-human-loop-demo";

// --- Initialize Judgeval Tracer ---
const tracer = Tracer.getInstance({
    projectName: PROJECT_NAME,
});

// --- Tool Definitions ---
// Wrap functions with tracer.observe FIRST
// REMOVED: const _searchRestaurantsFunc = tracer.observe({ name: "search_restaurants", spanType: "tool" })(
async function _searchRestaurantsFunc(input: any): Promise<string> {
    const location = input?.location ?? input?.input?.split(' in ')[1] ?? 'unknown location';
    const cuisine = input?.cuisine ?? input?.input?.split(' ')[0] ?? 'unknown cuisine';

    console.log(`--- TOOL: search_restaurants called with location: ${location}, cuisine: ${cuisine} ---`);
    const ans = `Top 3 ${cuisine} restaurants in ${location}: 1. Le Gourmet 2. Spice Palace 3. Carbones`;
    // Keep the asyncEvaluate call, but ensure it gets the trace client correctly
    // (It should get it from context if run within tracer.runInTrace)
    const traceClient = tracer.getCurrentTrace();
    if (traceClient) {
        traceClient.asyncEvaluate([
            new AnswerRelevancyScorer(0.8)],
            { input: "Search for restaurants", actualOutput: ans, model: "mock" }
        ).catch(e => console.error("Async eval error (searchRestaurants):", e));
    }
    return ans;
}
// REMOVED: );

// REMOVED: const _checkOpeningHoursFunc = tracer.observe({ name: "check_opening_hours", spanType: "tool" })(
async function _checkOpeningHoursFunc(input: any): Promise<string> {
    const restaurant = input?.restaurant ?? input?.input ?? 'unknown restaurant';

    console.log(`--- TOOL: check_opening_hours called for restaurant: ${restaurant} ---`);
    const ans = `${restaurant} hours: Mon-Sun 11AM-10PM`;
    // Keep the asyncEvaluate call
    const traceClient = tracer.getCurrentTrace();
    if (traceClient) {
         traceClient.asyncEvaluate([
             new AnswerCorrectnessScorer(1.0)],
             { input: "Check opening hours", actualOutput: ans, expectedOutput: ans, model: "mock" }
         ).catch(e => console.error("Async eval error (checkOpeningHours):", e));
     }
    return ans;
}
// REMOVED: );

// REMOVED: const _getMenuItemsFunc = tracer.observe({ name: "get_menu_items", spanType: "tool" })(
async function _getMenuItemsFunc(input: any): Promise<string> {
    const restaurant = input?.restaurant ?? input?.input ?? 'unknown restaurant';

    console.log(`--- TOOL: get_menu_items called for restaurant: ${restaurant} ---`);
    const ans = `${restaurant} popular dishes: 1. Chef's Special 2. Seafood Platter 3. Vegan Delight`;
    // Keep the asyncEvaluate call
    const traceClient = tracer.getCurrentTrace();
    if (traceClient) {
         traceClient.asyncEvaluate([
             new AnswerRelevancyScorer(0.8)],
             { input: "Get menu items", actualOutput: ans, model: "mock" }
         ).catch(e => console.error("Async eval error (getMenuItems):", e));
     }
    return ans;
}
// REMOVED: );

// Create DynamicTool instances FROM the observed functions (mainly for LLM binding)
const searchRestaurantsTool = new DynamicTool({
    name: "search_restaurants",
    description: "Search for restaurants in a location with specific cuisine. Requires location and cuisine arguments.",
    func: _searchRestaurantsFunc,
});

const checkOpeningHoursTool = new DynamicTool({
    name: "check_opening_hours",
    description: "Check opening hours for a specific restaurant. Requires restaurant argument.",
    func: _checkOpeningHoursFunc,
});

const getMenuItemsTool = new DynamicTool({
    name: "get_menu_items",
    description: "Get popular menu items for a restaurant. Requires restaurant argument.",
    func: _getMenuItemsFunc,
});


// --- Agent State ---
interface AgentState {
  messages: BaseMessage[];
}

// --- Agent Nodes ---

// Define the function that calls the model
// async function callModel(state: AgentState, config?: RunnableConfig): Promise<Partial<AgentState>> {
// Wrap the node function for tracing
const callModel = tracer.observe({ name: "NODE: assistant", spanType: "chain" })(
    async (state: AgentState, config?: RunnableConfig): Promise<Partial<AgentState>> => {
        console.log("--- NODE: callModel (Assistant) ---");
        const { messages } = state;
        const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-4o-mini" });

        // Bind the DynamicTool instances (guides LLM output format)
        const toolsForLlm = [searchRestaurantsTool, checkOpeningHoursTool, getMenuItemsTool];
        const modelWithTools = model.bindTools(toolsForLlm);

        // Invoke the model
        // The handler passed in config *should* trace this, but currently doesn't seem to.
        const response: AIMessage = await modelWithTools.invoke(messages, config);
        console.log("--- NODE: callModel response ---", response.content, response.tool_calls);

        return {
            messages: [response],
        };
    }
);

// --- Graph Definition ---

// Define the conditional edge logic
function shouldContinue(state: AgentState): "tools" | typeof END {
    console.log("--- CONDITIONAL EDGE: shouldContinue ---");
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    // If there are no tool calls, exit
    if (!lastMessage || !(lastMessage instanceof AIMessage) || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
        console.log("--- CONDITIONAL EDGE: No AI message with tool calls, ending graph. ---");
        return END;
    }
    // Otherwise, call tools
    console.log("--- CONDITIONAL EDGE: Tool calls detected, routing to tools node. ---");
    return "tools";
}

// Define the graph builder
const workflow = new StateGraph<AgentState>({
    channels: {
        messages: {
            value: addMessages,
            default: () => [],
        },
    },
});

// Define the ToolNode with the DynamicTool instances
const toolsForNode = [searchRestaurantsTool, checkOpeningHoursTool, getMenuItemsTool];
const toolNode = new ToolNode<{ messages: BaseMessage[] }>(toolsForNode);

// Define node names as constants for type safety
const ASSISTANT_NODE = "assistant";
const TOOLS_NODE = "tools";

// Add nodes to the graph using constants
workflow.addNode(ASSISTANT_NODE, callModel); // Pass the wrapped callModel
workflow.addNode(TOOLS_NODE, toolNode);

// Set the entrypoint
workflow.addEdge(START, ASSISTANT_NODE as any);

// Add the conditional edge using constants
workflow.addConditionalEdges(
    ASSISTANT_NODE as any,
    shouldContinue,
    { 
        tools: TOOLS_NODE as any,
        [END]: END,
    }
);

// Add the edge from the tools node back to the assistant using constants
workflow.addEdge(TOOLS_NODE as any, ASSISTANT_NODE as any);

// Compile the graph
const app = workflow.compile();

// --- Run the Demo ---
async function runDemo() {
    console.log("--- Starting Multi-Step LangGraph Demo ---");

    const initialPrompt = "Search for Italian restaurants in New York and then check the opening hours for Spice Palace.";

    console.log("--- Invoking Graph within runInTrace ---");
    try {
        // Wrap the invocation in tracer.runInTrace
        const result = await tracer.runInTrace(
            {
                name: "human-loop-demo-trace", // Name for the overall trace
            },
            async (traceClient) => { // runInTrace provides the active client
                console.log(`>>> Main: Inside trace context: ${traceClient.traceId}`);

                // Instantiate handler INSIDE the trace context
                const judgevalHandler = new JudgevalLanggraphCallbackHandler(tracer);
                const config: RunnableConfig = { callbacks: [judgevalHandler] };

                // Define the input for the graph run
                const inputs: AgentState = {
                    messages: [new HumanMessage(initialPrompt)],
                };

                // Invoke the graph *within* the established trace context
                console.log("--- Invoking app.invoke... ---");
                const finalState = await app.invoke(inputs, config);

                console.log("\n--- Graph Final State ---");
                console.log(JSON.stringify(finalState, null, 2));

                // Access messages safely from the final state
                const finalMessages = finalState?.messages || [];
                const finalAiMessage = finalMessages.length > 0 ? finalMessages[finalMessages.length - 1] : null;
                console.log("\nFinal Message Content:", finalAiMessage?.content);

                return finalState; // Return the final state from the traced function
            }
        );

        console.log("--- Trace execution finished ---");

    } catch (e) {
        console.error("--- Error during traced execution ---", e);
    } finally {
        console.log("--- Demo Finished ---");
        if (tracer.enableMonitoring) {
            console.log("Check Judgment dashboard for the trace.");
        } else {
            console.log("Judgment monitoring disabled, no trace was sent.");
        }
    }
}

// Run the demo
runDemo();

// Example command to run (ensure you have ts-node and dotenv installed):
// OPENAI_API_KEY="..." JUDGEVAL_API_KEY="..." JUDGMENT_ORG_ID="..." ts-node src/demo/human_in_the_loop_demo.ts 