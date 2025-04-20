import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import * as dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { AttributeValue } from '@opentelemetry/api'; // Import AttributeValue

// --- Restore OTel SDK Import ---
import { sdk } from './otel-setup.js';

// --- Remove Native Tracer --- 
// import { Tracer } from '../../common/tracer.js';

// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the root of judgeval-js package
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// --- Configuration & Checks --- 
const JUDGMENT_ORG_ID = process.env.JUDGMENT_ORG_ID;
const PROJECT_NAME = process.env.JUDGMENT_PROJECT_NAME || "vercel-otel-nested-test"; // Or your desired default

if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
}
if (!JUDGMENT_ORG_ID) {
    console.error("Error: JUDGMENT_ORG_ID missing from env.");
    process.exit(1);
}

// --- Use original OpenAI Provider ---
const openaiProvider = createOpenAI();

// --- Restore Helper function to create telemetry config ---
function createTelemetryConfig(functionIdSuffix: string) {
    const orgId = JUDGMENT_ORG_ID ?? 'MISSING_ORG_ID';
    const projName = PROJECT_NAME ?? 'MISSING_PROJECT_NAME';
    const traceName = `otel-exporter-demo-trace-${functionIdSuffix}`;

    const telemetryMetadata: Record<string, AttributeValue> = {
        test_run_id: `otel-exporter-demo-${Date.now()}`,
        environment: "local-ts-example",
        // Pass necessary metadata for the exporter to extract
        judgeval_org_id: orgId, 
        project_name: projName, 
        trace_name: traceName,
    };
    console.log(`[run-demo.ts] Injecting metadata for ${functionIdSuffix}:`, telemetryMetadata);
    return {
        isEnabled: true,
        functionId: `otel_demo_${functionIdSuffix}`,
        metadata: telemetryMetadata,
    };
}

// --- Inner LLM Call (Using OTel Context Propagation) ---
async function innerLLMCall(): Promise<string> {
    console.log("[run-demo.ts] --> Entering innerLLMCall");
    // --- DO NOT provide experimental_telemetry here to allow OTel context to propagate ---
    // const telemetryConfig = createTelemetryConfig('inner'); 
    try {
        const result = await generateText({
            model: openaiProvider('gpt-4o-mini'), 
            prompt: 'Explain OpenTelemetry context propagation briefly.',
            // experimental_telemetry: telemetryConfig, // Intentionally commented out
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

// --- Outer LLM Call (Initiates Trace via experimental_telemetry) ---
async function outerLLMCall(): Promise<{ outer: string; inner: string }> {
    console.log("[run-demo.ts] -> Entering outerLLMCall");
    // --- Use telemetry config HERE to initiate trace/metadata ---
    const telemetryConfig = createTelemetryConfig('outer');
    let outerResultText = '';
    try {
        const result = await generateText({
            model: openaiProvider('gpt-4o-mini'),
            prompt: 'Write a short question about nested distributed traces.',
            experimental_telemetry: telemetryConfig, // Use telemetry here
        });
        outerResultText = result.text;
        console.log("[run-demo.ts] -> outerLLMCall generateText finished.");
        console.log("[run-demo.ts] -> Outer Result Snippet:", outerResultText.substring(0, 50) + "...");

        console.log("[run-demo.ts] -> Calling innerLLMCall from outerLLMCall...");
        // Call the standard innerLLMCall - OTel context should propagate
        const innerResultText = await innerLLMCall(); 
        console.log("[run-demo.ts] -> Returned from innerLLMCall.");

        return { outer: outerResultText, inner: innerResultText };

    } catch (error) {
        console.error('\n[run-demo.ts] --- Error during outer generation or nested call --- ');
        console.error(error);
        throw error;
    }
}


// --- Main Execution (OTel based) --- 
async function main() {
    console.log("[run-demo.ts] Starting OTel Exporter demo (restored)...");
    try {
        // Call the outer function which uses telemetry config
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
        // --- Restore OTel SDK Shutdown ---
        console.log('[run-demo.ts] Shutting down OpenTelemetry SDK...');
        await sdk.shutdown()
            .then(() => console.log('[run-demo.ts] OpenTelemetry SDK shutdown complete.'))
            .catch((error: unknown) => console.error('[run-demo.ts] Error shutting down SDK:', error));
    }
}

main(); 