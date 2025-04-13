import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load .env.local

import { setTimeout } from 'timers/promises';

// Assuming tracer.ts is compiled to ./dist/common/tracer.js
// Adjust the import path based on your actual project structure and build output
import { Tracer, SpanType } from '../../common/tracer.js'; // Use relative path

// Initialize the tracer singleton
// Environment variables JUDGMENT_API_KEY and JUDGMENT_ORG_ID should be set
const tracer = Tracer.getInstance({
    projectName: "complex_async_ts_test",
    // Ensure monitoring is enabled (or rely on default env var JUDGMENT_MONITORING=true)
    enableMonitoring: true,
    enableEvaluations: true // Or false if not needed for this demo
});

// --- Define Observed Functions (equivalent to @tracer.observe) ---

// Level 5 - Deepest level
const level5_function = tracer.observe({ name: "level5_function" }) // Use observe as a HOF
    (async (param: string): Promise<string> => {
        console.log(`Level 5 function with ${param}`);
        await setTimeout(50); // Equivalent to asyncio.sleep(0.05)
        return `level5:${param}`;
    });

// Recursive Fibonacci example
const fib = tracer.observe<[number], Promise<number>>({ name: "fib" })
    (async (n: number): Promise<number> => {
        if (n <= 1) {
            return n;
        }
        // Note: Parallel execution in TS needs Promise.all
        const [res1, res2] = await Promise.all([fib(n - 1), fib(n - 2)]);
        return res1 + res2;
    });


// Level 4 - Deep function that calls level 5 and fib
const level4_deep_function = tracer.observe({ name: "level4_deep_function" })
    (async (param: string): Promise<string> => {
        console.log(`Level 4 deep function with ${param}`);
        const [result_l5, result_fib] = await Promise.all([
            level5_function(`${param}_final`),
            fib(5) // Keep fib small for demo
        ]);
        return `level4_deep:(l5:${result_l5}, fib:${result_fib})`;
    });

// Level 4 - Deepest regular function
const level4_function = tracer.observe({ name: "level4_function" })
    (async (param: string): Promise<string> => {
        console.log(`Level 4 function with ${param}`);
        await setTimeout(50);
        return `level4:${param}`;
    });


// Level 3 - Second parallel function called by level2_parallel1
const level3_parallel2 = tracer.observe({ name: "level3_parallel2" })
    (async (param: string): Promise<string> => {
        console.log(`Level 3 parallel 2 with ${param}`);
        await setTimeout(100);
        // Direct call to level 4 deep
        const result = await level4_deep_function(`${param}_deep`);
        return `level3_p2:${result}`;
    });


// Level 3 - First parallel function called by level2_parallel1
const level3_parallel1 = tracer.observe({ name: "level3_parallel1" })
    (async (param: string): Promise<string> => {
        console.log(`Level 3 parallel 1 with ${param}`);
        // Nested Promise.all (gather) call with level 4 functions
        const results = await Promise.all([
            level4_function(`${param}_a`),
            level4_function(`${param}_b`),
            level4_function(`${param}_c`)
        ]);
        return `level3_p1:${results.join(',')}`;
    });


// Level 3 - Child of level 2 direct
const level3_function = tracer.observe({ name: "level3_function" })
    (async (param: string): Promise<string> => {
        console.log(`Level 3 function with ${param}`);
        // Call to level 4
        const result = await level4_function(`${param}_deep`);
        return `level3:${result}`;
    });


// Level 2 - Second parallel function
const level2_parallel2 = tracer.observe({ name: "level2_parallel2" })
    (async (param: string): Promise<string> => {
        console.log(`Level 2 parallel 2 with ${param}`);
        // Direct await to level 3
        const result = await level3_function(`${param}_direct`);
        return `level2_parallel2:${result}`;
    });


// Level 2 - First parallel function
const level2_parallel1 = tracer.observe({ name: "level2_parallel1" })
    (async (param: string): Promise<string> => {
        console.log(`Level 2 parallel 1 with ${param}`);
        // Parallel call to level 3 functions using Promise.all
        const [r1, r2] = await Promise.all([
            level3_parallel1(`${param}_1`),
            level3_parallel2(`${param}_2`)
        ]);
        return `level2_parallel1:${r1},${r2}`;
    });


// Level 2 - Direct child of root
const level2_function = tracer.observe({ name: "level2_function" })
    (async (param: string): Promise<string> => {
        console.log(`Level 2 function with ${param}`);
        // Call to level 3
        const result = await level3_function(`${param}_child`);
        return `level2:${result}`;
    });

// Root Function - uses observe with a specific name
const root_function = tracer.observe({ name: "root_function" }) // Pass options object
    (async (): Promise<string> => {
        console.log("Root function starting");

        // Direct await call to level 2
        const result1_task = level2_function("direct"); // Start task

        // Parallel calls (Promise.all) to level 2 functions
        const level2_parallel1_task = level2_parallel1("gather1");
        const level2_parallel2_task = level2_parallel2("gather2");

        // Await all parallel tasks
        const [result1, result2, result3] = await Promise.all([
            result1_task, // Await the direct call task here
            level2_parallel1_task,
            level2_parallel2_task
        ]);

        console.log("Root function completed");
        return `Root results: ${result1}, ${result2}, ${result3}`;
    });

// Main execution function
async function main() {
    const startTime = Date.now();
    try {
        console.log("Starting complex async demo...");

        // Call root_function directly as it's already observed
        const finalResult = await root_function();

        console.log(`\nAsync Final result: ${finalResult}`);
    } catch (error) {
        console.error("\nError during execution:", error);
    } finally {
        const endTime = Date.now();
        console.log(`Async Total execution time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
        // Note: Trace saving happens asynchronously for observed functions.
        // We might need a way to ensure all traces are sent before exiting.
        // Let's remove the explicit wait for now, as runInTrace is gone.
        // If traces seem incomplete, we might need to add a tracer.shutdown() or similar mechanism.
        // console.log("Waiting slightly for trace saving..."); 
        // await setTimeout(2000); // Adjust or replace with proper shutdown if needed
        console.log("Demo finished.");
    }
}

// Run the main function
main(); 