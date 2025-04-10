import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// Assuming Tracer, wrap, scorers are exported from the main index file
// Adjust the path based on the final file location if needed
import { Tracer, wrap, TraceClient } from '../common/tracer'; // Import Tracer, wrap, TraceClient
import { AnswerRelevancyScorer, FaithfulnessScorer } from '../scorers/api-scorer'; // Import scorers directly

dotenv.config();

// --- Configuration ---
const JUDGMENT_API_KEY = process.env.JUDGMENT_API_KEY;
const JUDGMENT_ORG_ID = process.env.JUDGMENT_ORG_ID; // Assuming ORG_ID is used
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROJECT_NAME = "test-bot-ts";
const OPENAI_MODEL = "gpt-4"; // Or your preferred model

// --- Initialize Judgment Tracer ---
const judgment = Tracer.getInstance({
    apiKey: JUDGMENT_API_KEY,
    organizationId: JUDGMENT_ORG_ID,
    projectName: PROJECT_NAME,
    // enableEvaluations: true // Ensure evaluations are enabled if needed globally
});

// Exit if monitoring is disabled or keys are missing
if (!judgment.enableMonitoring || !JUDGMENT_API_KEY || !JUDGMENT_ORG_ID) {
    console.warn("Judgment monitoring is disabled or API keys are missing. Exiting.");
    process.exit(0);
}
if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is missing from environment variables. Exiting.");
    process.exit(0);
}

// --- Initialize OpenAI Client ---
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// --- Wrap OpenAI Client for Tracing ---
// Ensure the 'wrap' function is correctly imported and handles the OpenAI client object
const client = wrap(openai);

// --- Type Definitions ---
interface Restaurant {
    name: string;
    rating: number; // Assuming rating is a number
    price_range: string;
}

// --- Helper Functions with Tracing ---

/**
 * Searches for restaurants matching the cuisine type using OpenAI.
 */
const search_restaurants = judgment.observe({ spanType: 'research' })(
    async function search_restaurants(cuisine: string, location: string = "nearby"): Promise<Restaurant[]> {
        const prompt = `Find 3 popular ${cuisine} restaurants ${location}. Return ONLY a JSON array of objects with 'name', 'rating', and 'price_range' fields. No other text.`;
        console.log(`Searching restaurants for: ${cuisine}`);

        try {
            const response = await client.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: `You are a restaurant search expert. Return ONLY valid JSON arrays containing restaurant objects. Example format: [{"name": "Restaurant Name", "rating": 4.5, "price_range": "$$"}] Do not include any other text or explanations.` },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2 // Adjust temperature for more deterministic JSON
            });

            const content = response.choices[0].message?.content;
            if (!content) {
                console.error("No content received from OpenAI for restaurant search.");
                return [{ name: "Error fetching restaurants", rating: 0, price_range: "N/A" }];
            }

            // Attempt to parse the JSON
            return JSON.parse(content.trim()) as Restaurant[];

        } catch (error) {
            if (error instanceof SyntaxError) {
                 console.error(`Error parsing JSON response for restaurants: ${error.message}`);
            } else {
                console.error(`Error searching restaurants: ${error instanceof Error ? error.message : String(error)}`);
            }
            // Return a structured error object matching the expected type
            return [{ name: "Error fetching restaurants", rating: 0, price_range: "N/A" }];
        }
    }
);

/**
 * Gets popular menu items for a restaurant using OpenAI.
 */
const get_menu_highlights = judgment.observe({ spanType: 'research' })(
    async function get_menu_highlights(restaurant_name: string): Promise<string[]> {
        const prompt = `What are 3 must-try dishes at ${restaurant_name}? List only the dish names, each on a new line. No numbering or other text.`;
        console.log(`Getting menu highlights for: ${restaurant_name}`);
        let actualOutput = "";

        try {
            const response = await client.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: "You are a food critic. List only the dish names, each on a new line. No numbering or other text." },
                    { role: "user", content: prompt }
                ]
            });
            actualOutput = response.choices[0].message?.content ?? "";

        } catch (error) {
             console.error(`Error getting menu highlights for ${restaurant_name}: ${error instanceof Error ? error.message : String(error)}`);
             actualOutput = "Error fetching menu"; // Set error output
        }


        // Perform async evaluation if enabled
        const traceClient = judgment.getCurrentTrace();
        if (traceClient && judgment.enableEvaluations) {
            traceClient.asyncEvaluate(
                // Ensure scorers are correctly instantiated with necessary options (like threshold)
                [new AnswerRelevancyScorer(0.5)],
                {
                    input: prompt,
                    actualOutput: actualOutput,
                    model: OPENAI_MODEL, // Or extract from response if needed
                }
            ).catch((err: Error) => console.error(`Async evaluation failed for get_menu_highlights (${restaurant_name}):`, err));
        } else if (!traceClient && judgment.enableEvaluations) {
             console.warn("Cannot perform asyncEvaluate in get_menu_highlights: No active trace client.");
        }

        // Split into lines and remove empty lines
        return actualOutput.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    }
);

/**
 * Generates a natural language recommendation based on search results.
 */
const generate_recommendation = judgment.observe({ spanType: 'llm' })(
    async function generate_recommendation(cuisine: string, restaurants: Restaurant[], menuItems: { [key: string]: string[] }): Promise<string> {
        // Filter out error entries before generating recommendation
        const validRestaurants = restaurants.filter((r: Restaurant) => r.name !== "Error fetching restaurants");
        if (validRestaurants.length === 0) {
            return "I couldn't find any valid restaurants to recommend based on the search results.";
        }

        const context = `
        User wants recommendations for ${cuisine} cuisine.
        Here are some options found:
        ${JSON.stringify(validRestaurants, null, 2)}

        Here are some popular menu items for them:
        ${JSON.stringify(menuItems, null, 2)}

        Generate a friendly, natural language recommendation based on this data. Mention one or two restaurants and some suggested dishes.
        `;
        console.log("Generating final recommendation...");

        try {
             const response = await client.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: "You are a helpful food recommendation bot. Provide a concise and appealing recommendation based ONLY on the provided restaurant and menu data. Do not mention errors." },
                    { role: "user", content: context }
                ]
            });
            return response.choices[0].message?.content ?? "Sorry, I couldn't generate a recommendation.";
        } catch (error) {
            console.error(`Error generating recommendation: ${error instanceof Error ? error.message : String(error)}`);
            return "Sorry, an error occurred while generating the recommendation.";
        }

    }
);


/**
 * Main chain function to get restaurant recommendations.
 */
const get_food_recommendations = judgment.observe({ spanType: 'chain' })(
    async function get_food_recommendations(cuisine: string): Promise<string> {
        console.log(`Starting recommendation chain for: ${cuisine}`);
        // 1. Search for restaurants
        const restaurants = await search_restaurants(cuisine);
        // Check if search failed entirely
        if (restaurants.length === 1 && restaurants[0].name === "Error fetching restaurants") {
             return "Sorry, I had trouble finding restaurants for that cuisine.";
        }

        // 2. Get menu highlights for each valid restaurant
        const menuItems: { [key: string]: string[] } = {};
        const validRestaurants = restaurants.filter((r: Restaurant) => r.name !== "Error fetching restaurants");

        // Run highlight fetching concurrently
        await Promise.all(validRestaurants.map(async (restaurant: Restaurant) => {
            menuItems[restaurant.name] = await get_menu_highlights(restaurant.name);
        }));


        // 3. Generate final recommendation
        const recommendation = await generate_recommendation(cuisine, validRestaurants, menuItems);

        // 4. Perform final evaluation if enabled
        const traceClient = judgment.getCurrentTrace();
        if (traceClient && judgment.enableEvaluations) {
            const evaluationInput = `Create a recommendation for ${cuisine} restaurants and dishes.`;
            // Use JSON strings for complex context
            const retrievalContext = [
                 `Restaurants Found: ${JSON.stringify(validRestaurants)}`,
                 `Menu Highlights: ${JSON.stringify(menuItems)}`
            ];

            traceClient.asyncEvaluate(
                [
                    // Ensure scorers are correctly imported and instantiated
                    new AnswerRelevancyScorer(0.5),
                    new FaithfulnessScorer(0.8)
                ],
                {
                    input: evaluationInput,
                    actualOutput: recommendation,
                    retrievalContext: retrievalContext,
                    model: OPENAI_MODEL, // Or the model used for generation
                }
            ).catch((err: Error) => console.error("Final async evaluation failed:", err));
        } else if (!traceClient && judgment.enableEvaluations) {
            console.warn("Cannot perform final asyncEvaluate: No active trace client.");
        }

        return recommendation;
    }
);


// --- Main Execution ---
async function main() {
    const rl = readline.createInterface({ input, output });
    let cuisine = "";
    try {
        cuisine = await rl.question("What kind of food would you like to eat? ");
    } finally {
         rl.close(); // Ensure readline closes even if runInTrace throws early
    }


    if (!cuisine.trim()) {
        console.log("No cuisine specified. Exiting.");
        return;
    }

    console.log(`\nOkay, looking for ${cuisine} recommendations...`);

    try {
        // Run the main logic within a named trace
        const recommendation = await judgment.runInTrace(
            {
                name: `Food Bot Recommendation: ${cuisine}`,
                 // Optional: Add input/output logging to trace automatically if needed
                 // input: { cuisine: cuisine }
            },
            async (traceClient: TraceClient) => { // runInTrace provides the traceClient -> Add type TraceClient
                console.log(`Trace started: ${traceClient.traceId}`);
                // Call the main application logic function
                return await get_food_recommendations(cuisine);
                // Trace saving is handled automatically by runInTrace on success/error
            }
        );

        console.log("\n--- Recommendation ---");
        console.log(recommendation);
        console.log("----------------------\n");

    } catch (error) {
        console.error("\n--- An error occurred during the recommendation process ---");
        console.error(error instanceof Error ? error.message : String(error));
         if (error instanceof Error && error.stack) {
             console.error(error.stack);
         }
        console.error("----------------------------------------------------------\n");
    } finally {
         // Optional cleanup if needed
         console.log("Process finished.");
    }
}

// Start the application
main(); 