const path = require("path");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";
  const target = env.target || "main";

  const getConfig = () => {
    switch (target) {
      case "main":
        return {
          entry: "./src/index.ts",
          filename: "index.mjs",
          libraryType: "module",
          target: "node",
        };
      case "browser":
        return {
          entry: "./src/browser.ts",
          filename: "browser.mjs",
          libraryType: "module",
          target: "web",
        };
      case "node":
        return {
          entry: "./src/node.ts",
          filename: "node.mjs",
          libraryType: "module",
          target: "node",
        };
      case "umd":
        return {
          entry: "./src/umd.ts",
          filename: "index.umd.js",
          libraryType: "umd",
          target: "web",
        };
      default:
        throw new Error(`Unknown target: ${target}`);
    }
  };

  const config = getConfig();

  return {
    entry: config.entry,
    target: config.target,
    mode: isProduction ? "production" : "development",
    devtool: isProduction ? "source-map" : "eval-source-map",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: config.filename,
      library: {
        name: config.libraryType === "umd" ? "JudgevalJS" : undefined,
        type: config.libraryType,
      },
      globalObject: config.libraryType === "umd" ? "this" : undefined,
      environment: {
        module: config.libraryType === "module",
      },
      clean: false,
      iife: config.libraryType === "umd",
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
      "@opentelemetry/api": "@opentelemetry/api",
      "@opentelemetry/core": "@opentelemetry/core",
      "@opentelemetry/exporter-trace-otlp-http":
        "@opentelemetry/exporter-trace-otlp-http",
      "@opentelemetry/sdk-trace-base": "@opentelemetry/sdk-trace-base",
      "@opentelemetry/sdk-trace-web": "@opentelemetry/sdk-trace-web",
      "@opentelemetry/sdk-node": "@opentelemetry/sdk-node",
      "@opentelemetry/sdk-trace-node": "@opentelemetry/sdk-trace-node",
      "@opentelemetry/auto-instrumentations-node":
        "@opentelemetry/auto-instrumentations-node",
      "@opentelemetry/resources": "@opentelemetry/resources",
      "@opentelemetry/semantic-conventions":
        "@opentelemetry/semantic-conventions",
    },
    experiments: {
      outputModule: config.libraryType === "module",
    },
    optimization: {
      minimize: isProduction,
      usedExports: true,
      sideEffects: false,
    },
  };
};
