import { Tracer } from "../common/tracer";
import { JudgevalLanggraphCallbackHandler } from "../common/integrations/langgraph";
import { createReactAgent } from "langchain/agents";
import { HumanMessage } from "@langchain/core/messages";

const judgment = Tracer.getInstance();
const handler = new JudgevalLanggraphCallbackHandler(judgment);

const agent = createReactAgent({
    llm: "openai:gpt-4o-mini",
    tools: [get_code_by_name, get_code_by_name_fuzzily],
    callbackHandler: handler,
})

async function ask(question: string) {  
    // handler needs to be re-initialized before each question
    const handler = new JudgevalLanggraphCallbackHandler(judgment);

    const output = await agent.invoke({ messages: [new HumanMessage(question)] })
    return output["messages"][-1].content
}

(async () => {
    const output = await ask("What is the capital of France?")
    console.log(output)
})()
