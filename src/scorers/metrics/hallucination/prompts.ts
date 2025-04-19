import { z } from 'zod';

/**
 * Schema for hallucination verdict
 */
export const HallucinationVerdictSchema = z.object({
  verdict: z.string(),
  reason: z.string()
});

export type HallucinationVerdict = z.infer<typeof HallucinationVerdictSchema>;

/**
 * Schema for verdicts
 */
export const VerdictsSchema = z.object({
  verdicts: z.array(HallucinationVerdictSchema)
});

/**
 * Schema for reason
 */
export const ReasonSchema = z.object({
  reason: z.string()
});

/**
 * Templates for hallucination scorer prompts
 */
export class HallucinationTemplate {
  /**
   * Generate a prompt to evaluate hallucinations in the actual output
   */
  static generateVerdicts(actualOutput: string, contexts: string[]): string {
    return `==== TASK INSTRUCTIONS ====
You will be provided with an \`actual output\` (the response of an LLM to a particular query) and \`contexts\` (ground truth contextual information from a knowledge base).
Your task is to take each context in contexts and determine whether the \`actual output\` factually agrees with the context.

Additional notes:
You should NOT use any prior knowledge you have in your decision making process; take each context at face value. 
Since you will determine a verdict for EACH context, the number of 'verdicts' is EXACTLY EQUAL TO the number of contexts. 
You should be lenient in your judgment when the actual output lacks detail with respect to the context segment; you should ONLY provide a 'no' answer if the context contradicts the actual output.

==== FORMATTING INSTRUCTIONS ====
You should return a JSON object with a key 'verdicts', which is a list of JSON objects. Each JSON object corresponds to a context in \`contexts\`, and should have 2 fields: 'verdict' and 'reason'. 
The 'verdict' key should be EXACTLY one of 'yes' or 'no', representing whether the \`actual output\` factually agrees with the context segment. 
The 'reason' is the justification for the verdict. If your verdict is 'no', try to provide a correction in the reason. 

==== EXAMPLE ====
Example contexts: ["Einstein won the Nobel Prize for his discovery of the photoelectric effect.", "Einstein won the Nobel Prize in 1968."]
Example actual output: "Einstein won the Nobel Prize in 1969 for his discovery of the photoelectric effect."

Example:
{
    "verdicts": [
        {
            "verdict": "yes",
            "reason": "The actual output agrees with the provided context which states that Einstein won the Nobel Prize for his discovery of the photoelectric effect."
        },
        {
            "verdict": "no",
            "reason": "The actual output contradicts the provided context which states that Einstein won the Nobel Prize in 1968, not 1969."
        }
    ]  
}

==== YOUR TURN ====
Contexts:
${contexts.map((context, index) => `${index + 1}. ${context}`).join('\n')}

Actual Output:
${actualOutput}

JSON:`;
  }

  /**
   * Generate a prompt to create a reason for the hallucination score
   */
  static generateReason(actualOutput: string, contexts: string[]): string {
    return `==== TASK INSTRUCTIONS ====
You will be provided with an \`actual output\` (the response of an LLM to a particular query) and \`contexts\` (ground truth contextual information from a knowledge base).
Your task is to analyze whether the actual output contains any hallucinations (factual inaccuracies) when compared to the provided contexts.

Please provide a clear and concise reason summarizing your analysis. Focus on any contradictions between the actual output and the contexts, or note if the output is factually consistent with the contexts.

==== FORMATTING INSTRUCTIONS ====
Please make sure to only return in JSON format, with the 'reason' key providing the reason.
Example JSON:
{
    "reason": "The output contains factual inaccuracies because..."
}

Or if no hallucinations:
{
    "reason": "The output is factually consistent with the provided contexts."
}

==== YOUR TURN ====
Contexts:
${contexts.map((context, index) => `${index + 1}. ${context}`).join('\n')}

Actual Output:
${actualOutput}

JSON:`;
  }
}
