import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import * as dotenv from 'dotenv';
import path, { dirname } from 'path'; // Import path AND dirname
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Import the initialized SDK instance from the setup file
import { sdk } from './otel-setup.js'; // Keep .js extension for runtime

// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the root of judgeval-js package
// Correct path goes up 3 levels from src/examples/otel-exporter-demo/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// --- Configuration & Checks ---
const JUDGMENT_ORG_ID = process.env.JUDGMENT_ORG_ID;
// Use a specific project name for this demo
const PROJECT_NAME = process.env.JUDGMENT_PROJECT_NAME || "vercel-otel-nested-test";

if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
}
if (!JUDGMENT_ORG_ID) {
    console.error("Error: JUDGMENT_ORG_ID missing from env.");
    process.exit(1);
}

const openaiProvider = createOpenAI();

// --- Helper function to create telemetry config ---
function createTelemetryConfig(functionIdSuffix: string) {
    // Ensure metadata values are never undefined
    const orgId = JUDGMENT_ORG_ID ?? 'MISSING_ORG_ID';
    const projName = PROJECT_NAME ?? 'MISSING_PROJECT_NAME';
    const traceName = `otel-exporter-demo-trace-${functionIdSuffix}`;

    const telemetryMetadata = {
        test_run_id: `otel-exporter-demo-${Date.now()}`,
        environment: "local-ts-example",
        // Pass necessary metadata for the exporter to extract
        judgeval_org_id: orgId, // Use variable guaranteed to be string
        project_name: projName, // Use variable guaranteed to be string
        trace_name: traceName,
    };
    console.log(`[run-demo.ts] Injecting metadata for ${functionIdSuffix}:`, telemetryMetadata);
    return {
        isEnabled: true,
        functionId: `otel_demo_${functionIdSuffix}`,
        metadata: telemetryMetadata, // Now conforms to Record<string, AttributeValue>
    };
}

// --- Inner LLM Call ---
async function innerLLMCall(): Promise<string> {
    console.log("[run-demo.ts] --> Entering innerLLMCall");
    // const telemetryConfig = createTelemetryConfig('inner'); // Temporarily comment out
    try {
        const result = await generateText({
            model: openaiProvider('gpt-4o-mini'),
            prompt: 'Explain OpenTelemetry context propagation briefly.',
            // experimental_telemetry: telemetryConfig, // Temporarily comment out
        });
        console.log("[run-demo.ts] --> innerLLMCall generateText finished.");
        console.log("[run-demo.ts] --> Inner Result Snippet:", result.text.substring(0, 50) + "...");
        return result.text;
    } catch (error) {
        console.error('\n[run-demo.ts] --- Error during inner generation --- ');
        console.error(error);
        throw error;
    }
}

// --- Outer LLM Call ---
async function outerLLMCall(): Promise<{ outer: string; inner: string }> {
    console.log("[run-demo.ts] -> Entering outerLLMCall");
    const telemetryConfig = createTelemetryConfig('outer');
    let outerResultText = '';
    try {
        const result = await generateText({
            model: openaiProvider('gpt-4o-mini'),
            prompt: 'Write a short question about nested distributed traces.',
            experimental_telemetry: telemetryConfig,
        });
        outerResultText = result.text;
        console.log("[run-demo.ts] -> outerLLMCall generateText finished.");
        console.log("[run-demo.ts] -> Outer Result Snippet:", outerResultText.substring(0, 50) + "...");

        console.log("[run-demo.ts] -> Calling innerLLMCall from outerLLMCall...");
        const innerResultText = await innerLLMCall();
        console.log("[run-demo.ts] -> Returned from innerLLMCall.");

        return { outer: outerResultText, inner: innerResultText };

    } catch (error) {
        console.error('\n[run-demo.ts] --- Error during outer generation or nested call --- ');
        console.error(error);
        throw error;
    }
}

// --- Main Execution ---
async function main() {
    console.log("[run-demo.ts] Starting OTel Exporter demo...");
    try {
        const finalResult = await outerLLMCall();
        console.log("\n[run-demo.ts] --- Final Combined Results ---");
        console.log("Outer:", finalResult.outer);
        console.log("Inner:", finalResult.inner);
        console.log("\n[run-demo.ts] Test completed successfully.");
        console.log("--- Telemetry should have been sent via JudgevalExporter (check backend) --- ");
    } catch (error) {
        console.error("[run-demo.ts] Test failed with error:", error);
        process.exitCode = 1;
    } finally {
        console.log('[run-demo.ts] Shutting down OpenTelemetry SDK...');
        await sdk.shutdown()
            .then(() => console.log('[run-demo.ts] OpenTelemetry SDK shutdown complete.'))
            .catch((error: unknown) => console.error('[run-demo.ts] Error shutting down SDK:', error));
    }
}

main(); 