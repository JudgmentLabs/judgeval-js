#!/bin/bash
# Script to run all examples in the judgeval-js project

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

# Demo examples
echo "=== Running demo/basic-bot.ts ==="
npx tsx src/examples/demo/basic-bot.ts

echo "Done running examples!"
