// Ported from https://github.com/JudgmentLabs/judgment-cookbook/blob/main/integrations/langgraph/basic.py

import * as dotenv from 'dotenv';
import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { JudgevalLanggraphCallbackHandler } from "../../common/integrations/langgraph";
import { Tracer } from "../../common/tracer";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
// I don't have a Tavily API key
// import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

dotenv.config({ path: '.env.local' });

const PROJECT_NAME = "LangGraphBasic";

interface State {
  messages: BaseMessage[];
}

const judgment = Tracer.getInstance({
  projectName: PROJECT_NAME,
});

// REPLACE THIS WITH YOUR OWN TOOLS
const searchRestaurantsTool = new DynamicStructuredTool({
  name: "search_restaurants",
  description: "Search for restaurants in a location with specific cuisine",
  schema: z.object({
    location: z.string().describe("The location to search in"),
    cuisine: z.string().describe("The type of cuisine to search for"),
  }),
  func: async ({ location, cuisine }) => {
    const ans = `Top 3 ${cuisine} restaurants in ${location}: 1. Le Gourmet 2. Spice Palace 3. Carbones`;
    // TODO: Async evaluate
    return ans;
  },
});

// REPLACE THIS WITH YOUR OWN TOOLS
const checkOpeningHoursTool = new DynamicStructuredTool({
  name: "check_opening_hours",
  description: "Check opening hours for a specific restaurant",
  schema: z.object({
    restaurant: z.string().describe("The name of the restaurant"),
  }),
  func: async ({ restaurant }) => {
    const ans = `${restaurant} hours: Mon-Sun 11AM-10PM`;
    // TODO: Async evaluate
    return ans;
  },
});

// REPLACE THIS WITH YOUR OWN TOOLS
const getMenuItemsTool = new DynamicStructuredTool({
  name: "get_menu_items",
  description: "Get popular menu items for a restaurant",
  schema: z.object({
    restaurant: z.string().describe("The name of the restaurant"),
  }),
  func: async ({ restaurant }) => {
    const ans = `${restaurant} popular dishes: 1. Chef's Special 2. Seafood Platter 3. Vegan Delight`;
    // TODO: Async evaluate
    return ans;
  },
});

async function runAgent(prompt: string) {
  const tools = [
    // new TavilySearchResults({ maxResults: 2, apiKey: TAVILY_API_KEY }),
    checkOpeningHoursTool,
    getMenuItemsTool,
    searchRestaurantsTool,
  ];

  const llm = new ChatOpenAI({ 
    modelName: "gpt-4",
    temperature: 0,
  });

  const graphBuilder = new StateGraph<State>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: (): BaseMessage[] => [],
      },
    },
  });

  async function assistant(state: State) {
    const llmWithTools = llm.bind({ tools });
    const response = await llmWithTools.invoke(state.messages);
    return { messages: [...state.messages, response] };
  }

  const toolNode = new ToolNode(tools);

  const graph = graphBuilder
    .addNode("assistant", assistant)
    .addNode("tools", toolNode)
    .addEdge(START, "assistant")
    .addConditionalEdges(
      "assistant",
      (state) => {
        const lastMessage = state.messages.at(-1);
        return lastMessage &&
          "tool_calls" in lastMessage &&
          Array.isArray(lastMessage.tool_calls) &&
          lastMessage.tool_calls.length > 0 ? "tools" : END;
      }
    )
    .addEdge("tools", "assistant")
    .compile();

  const handler = new JudgevalLanggraphCallbackHandler(judgment);

  let result;
  for (const trace of judgment.trace("langchain")) {
    result = await graph.invoke({
      messages: [new HumanMessage({ content: prompt })],
    }, {
      callbacks: [handler],
    });
  }
  return { result, handler };
}

async function main() {
  const { result, handler } = await runAgent(
    "Find me a good Italian restaurant in Manhattan. Check their opening hours and most popular dishes."
  );
  console.log("Result:", result?.messages.at(-1)?.content);
  
  console.log("Executed Node-Tools:");
  console.log(handler.executedNodeTools);
}

main().catch(console.error);