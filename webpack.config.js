const path = require("path");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";
  const target = env.target || "esm";

  const getOutputConfig = () => {
    switch (target) {
      case "esm":
        return {
          filename: "index.mjs",
          library: {
            type: "module",
          },
          environment: {
            module: true,
          },
        };
      case "cjs":
        return {
          filename: "index.js",
          library: {
            type: "commonjs2",
          },
          environment: {
            module: false,
          },
        };
      case "umd":
        return {
          filename: "index.umd.js",
          library: {
            name: "JudgevalJS",
            type: "umd",
          },
          globalObject: "this",
        };
      default:
        throw new Error(`Unknown target: ${target}`);
    }
  };

  const outputConfig = getOutputConfig();

  return {
    entry: target === "umd" ? "./src/umd.ts" : "./src/index.ts",
    target: "node",
    mode: isProduction ? "production" : "development",
    devtool: isProduction ? "source-map" : "eval-source-map",
    output: {
      path: path.resolve(__dirname, "dist"),
      ...outputConfig,
      clean: false, // Don't clean dist folder as we build multiple targets
    },
    resolve: {
      extensions: [".ts", ".js", ".json"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: "ts-loader",
              options: {
                configFile: "tsconfig.webpack.json",
                transpileOnly: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
    externals: {
      // Keep OpenTelemetry dependencies as external for better tree-shaking
      "@opentelemetry/api": "@opentelemetry/api",
      "@opentelemetry/core": "@opentelemetry/core",
      "@opentelemetry/exporter-trace-otlp-http":
        "@opentelemetry/exporter-trace-otlp-http",
      "@opentelemetry/sdk-trace-base": "@opentelemetry/sdk-trace-base",
    },
    experiments: {
      outputModule: target === "esm",
    },
    optimization: {
      minimize: isProduction,
      usedExports: true,
      sideEffects: false,
    },
  };
};
