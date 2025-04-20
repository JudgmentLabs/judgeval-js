#!/bin/bash
# Script to run all examples in the judgeval-js project
# run this for testing to test all files in examples at once

# Build the examples
echo "Building examples..."
npm run build:examples

# Run each example file
echo "Running examples..."

# Basic examples
echo "=== Running basic-evaluation.ts ==="
npx tsx src/examples/basic-evaluation.ts

echo "=== Running custom-scorer.ts ==="
npx tsx src/examples/custom-scorer.ts

echo "=== Running result-retrieval.ts ==="
npx tsx src/examples/result-retrieval.ts

echo "=== Running local-scorers-examples.ts ==="
npx tsx src/examples/local-scorers-examples.ts

echo "=== Running async-evaluation.ts ==="
npx tsx src/examples/async-evaluation.ts

echo "=== Running simple-async.ts ==="
npx tsx src/examples/simple-async.ts

echo "=== Running compare-with-python.ts ==="
npx tsx src/examples/compare-with-python.ts

# OTEL Exporter Demo
echo -e "\n=== Running OTEL Exporter Demo ==="
echo "=== Running otel-exporter-demo/run-demo.ts ==="
npx tsx src/examples/otel-exporter-demo/run-demo.ts

# Demo examples
echo -e "\n=== Running Demo Examples ==="

echo "=== Running demo/basic-bot.ts ==="
npx tsx src/examples/demo/basic-bot.ts

echo "=== Running demo/llm-wrap-demo.ts ==="
npx tsx src/examples/demo/llm-wrap-demo.ts

echo "=== Running demo/openai-wrap-demo.ts ==="
npx tsx src/examples/demo/openai-wrap-demo.ts

echo "=== Running demo/demo-complex-async.ts ==="
npx tsx src/examples/demo/demo-complex-async.ts

echo "=== Running demo/langgraph-demo.ts ==="
npx tsx src/examples/demo/langgraph-demo.ts

echo "=== Running demo/rules-demo.ts ==="
npx tsx src/examples/demo/rules-demo.ts

echo "=== Running demo/dataset_demo.ts ==="
npx tsx src/examples/demo/dataset_demo.ts

echo "Done running examples!"
