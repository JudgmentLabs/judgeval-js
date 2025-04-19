/**
 * Utility prompts for FaithfulnessScorer
 */

import { z } from 'zod';

// Schema definitions for LLM responses
export const FaithfulnessVerdictSchema = z.object({
  verdict: z.string(),
  reason: z.string().optional()
});

export type FaithfulnessVerdict = z.infer<typeof FaithfulnessVerdictSchema>;

export const VerdictsSchema = z.object({
  verdicts: z.array(FaithfulnessVerdictSchema)
});

export type Verdicts = z.infer<typeof VerdictsSchema>;

export const TruthsSchema = z.object({
  truths: z.array(z.string())
});

export type Truths = z.infer<typeof TruthsSchema>;

export const ClaimsSchema = z.object({
  claims: z.array(z.object({
    claim: z.string(),
    quote: z.string()
  }))
});

export type Claims = z.infer<typeof ClaimsSchema>;

export const ReasonSchema = z.object({
  reason: z.string()
});

export type Reason = z.infer<typeof ReasonSchema>;

/**
 * Template prompts for the FaithfulnessScorer
 */
export class FaithfulnessTemplate {
  /**
   * Generate a prompt to extract claims from the actual output
   */
  static findClaims(text: string, allClaims: boolean = false): string {
    return `==== TASK INSTRUCTIONS ====
You will be provided with a passage of text. Based on the text, your task is to generate a comprehensive list of ALL CLAIMS that can be inferred from the text.  
For every claim that you derive from the text, provide the source of the claim via quoting the original text. Please try to extract EVERY CLAIM that is in the original text; priortize generating the most claims rather than being concise. 
You should NOT include any prior knowledge, and take the text at face value when extracting claims.

==== FORMATTING YOUR ANSWER ====
Please return your answer in JSON format, with the "claims" key as a list of JSON objects with keys "claim" and "quote". No words or explanation beyond the output JSON is needed.

==== EXAMPLES ====

---- START OF EXAMPLE 1 ----
Example Text: 
"Einstein won the nobel prize in 1968 for his discovery of the photoelectric effect."

Example JSON: 
{
    "claims": [
        {
             "claim": "Einstein won the nobel prize for his discovery of the photoelectric effect.",
             "quote": "Einstein won the nobel prize in 1968 for his discovery of the photoelectric effect."
        },
        {
             "claim": "Einstein won the nobel prize in 1968.",
             "quote": "Einstein won the nobel prize in 1968 for his discovery of the photoelectric effect."
        }
    ]  
}
---- END OF EXAMPLE 1 ----

---- START OF EXAMPLE 2 ----
Example Text: "The Wright brothers successfully flew the first powered airplane on December 17, 1903, in Kitty Hawk, North Carolina."

{
    "claims": [
        {
            "claim": "The Wright brothers flew the first powered airplane.",
            "quote": "The Wright brothers successfully flew the first powered airplane on December 17, 1903, in Kitty Hawk, North Carolina."
        },
        {
            "claim": "The Wright brothers made their flight in Kitty Hawk, North Carolina.",
            "quote": "The Wright brothers successfully flew the first powered airplane on December 17, 1903, in Kitty Hawk, North Carolina."
        },
        {
            "claim": "The first powered airplane flight occurred on December 17, 1903.",
            "quote": "The Wright brothers successfully flew the first powered airplane on December 17, 1903, in Kitty Hawk, North Carolina."
        }
    ]
}
---- END OF EXAMPLE 2 ----

---- START OF EXAMPLE 3 ----
Example Text:
"The Great Wall of China was built over many centuries by different Chinese dynasties. Construction began more than 2,000 years ago during the Warring States period. The most famous sections were built during the Ming Dynasty. The wall stretches for thousands of miles across northern China and was primarily built for military defense."

Example JSON:
{
    "claims": [
        {
            "claim": "The Great Wall of China was built by multiple Chinese dynasties",
            "quote": "The Great Wall of China was built over many centuries by different Chinese dynasties."
        },
        {
            "claim": "Construction of the Great Wall began over 2,000 years ago",
            "quote": "Construction began more than 2,000 years ago during the Warring States period."
        },
        {
            "claim": "Construction started during the Warring States period",
            "quote": "Construction began more than 2,000 years ago during the Warring States period."
        },
        {
            "claim": "The most well-known parts of the wall were constructed during the Ming Dynasty",
            "quote": "The most famous sections were built during the Ming Dynasty."
        },
        {
            "claim": "The Great Wall extends for thousands of miles across northern China",
            "quote": "The wall stretches for thousands of miles across northern China and was primarily built for military defense."
        },
        {
            "claim": "The Great Wall was mainly constructed for defense purposes",
            "quote": "The wall stretches for thousands of miles across northern China and was primarily built for military defense."
        }
    ]
}
---- END OF EXAMPLE 3 ----

==== YOUR TURN ====
Text:
${text}

JSON:`;
  }

  /**
   * Generate a prompt to evaluate claims against the retrieval context
   */
  static generateVerdicts(claims: string[], retrievalContext: string): string {
    const claimsStr = claims.map((claim, i) => `Claim ${i+1}: ${claim}`).join('\n');
    
    return `==== TASK INSTRUCTIONS ====
You will be provided with a set of claims and a retrieval context. Your task is to determine whether each claim is supported by the retrieval context.

For each claim, provide a verdict of "yes" if the claim is supported by the retrieval context, "no" if the claim is contradicted by the retrieval context, or "partially" if the claim is partially supported.

Also provide a reason for your verdict, citing evidence from the retrieval context.

==== FORMATTING YOUR ANSWER ====
Please return your answer in JSON format, with the "verdicts" key as a list of JSON objects with keys "verdict" and "reason". The verdict should be one of "yes", "no", or "partially". The reason should explain your verdict.

==== EXAMPLES ====

---- START OF EXAMPLE 1 ----
Example Claims:
Claim 1: Einstein won the Nobel Prize in 1921.
Claim 2: Einstein won the Nobel Prize for his work on relativity.

Example Retrieval Context:
"Albert Einstein was awarded the Nobel Prize in Physics in 1921 for his explanation of the photoelectric effect, not for his theories of relativity which were still controversial at the time."

Example JSON:
{
    "verdicts": [
        {
            "verdict": "yes",
            "reason": "The retrieval context explicitly states that 'Albert Einstein was awarded the Nobel Prize in Physics in 1921'."
        },
        {
            "verdict": "no",
            "reason": "The retrieval context contradicts this claim, stating that Einstein won the Nobel Prize 'for his explanation of the photoelectric effect, not for his theories of relativity'."
        }
    ]
}
---- END OF EXAMPLE 1 ----

---- START OF EXAMPLE 2 ----
Example Claims:
Claim 1: The Great Wall of China is visible from space.
Claim 2: The Great Wall of China was built during the Ming Dynasty.

Example Retrieval Context:
"The Great Wall of China was built over many centuries by different Chinese dynasties, with the most famous sections built during the Ming Dynasty (1368-1644). Contrary to popular belief, the Great Wall is not visible from space with the naked eye, as confirmed by multiple astronauts."

Example JSON:
{
    "verdicts": [
        {
            "verdict": "no",
            "reason": "The retrieval context explicitly contradicts this claim, stating that 'the Great Wall is not visible from space with the naked eye, as confirmed by multiple astronauts'."
        },
        {
            "verdict": "partially",
            "reason": "The retrieval context states that 'the most famous sections [were] built during the Ming Dynasty', but also mentions that the wall 'was built over many centuries by different Chinese dynasties'. This suggests that while significant portions were built during the Ming Dynasty, the entire wall was not built during this period."
        }
    ]
}
---- END OF EXAMPLE 2 ----

==== YOUR TURN ====
Claims:
${claimsStr}

Retrieval Context:
${retrievalContext}

JSON:`;
  }

  /**
   * Generate a prompt to explain the score based on verdicts
   */
  static generateReason(verdicts: FaithfulnessVerdict[], score: string): string {
    const verdictsStr = verdicts.map((v, i) => {
      return `Verdict ${i+1}: ${v.verdict}\nReason: ${v.reason || 'No reason provided'}\n------`;
    }).join('\n');

    return `==== TASK INSTRUCTIONS ====
You will be provided with a faithfulness score and a list of verdicts for claims made in a model's output. Your task is to provide a CLEAR and CONCISE reason for the faithfulness score.

The faithfulness score represents how well the model's output is supported by the provided retrieval context. A score of 1.0 means all claims are fully supported, while a score of 0.0 means none of the claims are supported.

You should explain why the score is what it is, highlighting key supported and unsupported claims.

==== FORMATTING YOUR ANSWER ====
IMPORTANT: Please make sure to only return in JSON format, with the 'reason' key providing the reason.
Example JSON:
{
    "reason": "The faithfulness score is <score> because <your_reason>."
}

==== YOUR TURN ====
---- FAITHFULNESS SCORE ----
${score}

---- VERDICTS ----
${verdictsStr}

---- YOUR RESPONSE ----
JSON:`;
  }
}
