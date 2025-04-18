import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import * as dotenv from 'dotenv';
import path, { dirname } from 'path'; // Import path AND dirname
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Import JudgevalExporter using relative path from src - ADD .js
import { JudgevalExporter } from '../../exporters/otel-exporter.js';
// Import TraceClient from the library (this might still be needed for type checking or internal use)
// Or remove if truly unused by the exporter setup itself - ADD .js
import { TraceClient } from '../../common/tracer.js'; // Assuming TraceClient is needed for instantiation context

// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the root of judgeval-js package
// Correct path goes up 3 levels from src/examples/otel-exporter-demo/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// --- Judgeval Configuration ---
const JUDGMENT_API_KEY = process.env.JUDGMENT_API_KEY;
const JUDGMENT_ORG_ID = process.env.JUDGMENT_ORG_ID;
const JUDGMENT_PROJECT_NAME = process.env.JUDGMENT_PROJECT_NAME || "default-otel-project";

// --- Configuration Checks ---
if (!JUDGMENT_API_KEY) {
    console.error('[otel-setup.ts] FATAL: JUDGMENT_API_KEY missing.');
    process.exit(1);
}
if (!JUDGMENT_ORG_ID) {
    console.error('[otel-setup.ts] FATAL: JUDGMENT_ORG_ID missing.');
    process.exit(1);
}
console.log('[otel-setup.ts] Required Judgeval environment variables found.');

// --- TraceClient Instantiation (potentially needed for type context or future use) ---
// Keep this if JudgevalExporter constructor or types implicitly need it,
// otherwise, it can be removed if the exporter ONLY needs apiKey/orgId config.
let judgevalTraceClientInstance: TraceClient | null = null; // Added type annotation
try {
    console.log('[otel-setup.ts] Attempting to initialize Judgeval TraceClient (for context/types)...');
    // Note: Exporter now uses config directly, but we keep this for potential type dependencies
    judgevalTraceClientInstance = new TraceClient({
        apiKey: JUDGMENT_API_KEY,
        organizationId: JUDGMENT_ORG_ID,
        projectName: JUDGMENT_PROJECT_NAME,
        enableMonitoring: true, // These flags might not be relevant here anymore
        enableEvaluations: true,
        // Casting tracer to any to satisfy constructor if Tracer isn't fully defined/imported here
        tracer: {} as any, // Provide a dummy tracer object if needed by constructor
    });
    console.log('[otel-setup.ts] Judgeval TraceClient initialized (for context/types).');
} catch (error) {
    console.error('[otel-setup.ts] WARNING: Error initializing Judgeval TraceClient (may not be needed): ', error);
    // Don't exit, the exporter might not strictly need this instance anymore
    // process.exit(1);
}

console.log('[otel-setup.ts] Initializing OpenTelemetry SDK with JudgevalExporter...');

// --- Exporter Instantiation ---
let judgevalExporter: JudgevalExporter; // Added type annotation
try {
    console.log('[otel-setup.ts] Attempting to instantiate JudgevalExporter...');
    // Pass config object directly
    judgevalExporter = new JudgevalExporter({
        apiKey: JUDGMENT_API_KEY,
        organizationId: JUDGMENT_ORG_ID,
        // serviceName is optional
    });
    console.log('[otel-setup.ts] JudgevalExporter instantiated successfully.');
} catch (error) {
    console.error('[otel-setup.ts] FATAL: Error instantiating JudgevalExporter:', error);
    process.exit(1);
}

// --- SpanProcessor Instantiation ---
let spanProcessor: BatchSpanProcessor; // Added type annotation
try {
    console.log('[otel-setup.ts] Attempting to create BatchSpanProcessor...');
    spanProcessor = new BatchSpanProcessor(judgevalExporter);
    console.log('[otel-setup.ts] BatchSpanProcessor created successfully.');
} catch (error) {
    console.error('[otel-setup.ts] FATAL: Error creating BatchSpanProcessor:', error);
    process.exit(1);
}

// --- SDK Initialization ---
const sdk = new NodeSDK({
    spanProcessors: [spanProcessor],
});

try {
    console.log('[otel-setup.ts] Attempting to start NodeSDK...');
    sdk.start();
    console.log('[otel-setup.ts] OpenTelemetry SDK with JudgevalExporter started successfully.');
} catch (error) {
    console.error('[otel-setup.ts] FATAL: Error starting NodeSDK:', error);
    process.exit(1);
}

// --- Graceful Shutdown Handler ---
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('[otel-setup.ts] Tracing terminated by SIGTERM'))
        .catch((error) => console.error('[otel-setup.ts] Error terminating tracing on SIGTERM', error))
        .finally(() => process.exit(0));
});

// --- Export SDK for Explicit Shutdown ---
export { sdk }; 