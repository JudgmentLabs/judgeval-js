import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/env.ts
function getEnvVar(varName, defaultValue) {
  const value = process.env[varName];
  if (!value) {
    return defaultValue ?? null;
  }
  return value;
}
var JUDGMENT_API_KEY, JUDGMENT_ORG_ID, JUDGMENT_API_URL, JUDGMENT_LOG_LEVEL;
var init_env = __esm(() => {
  JUDGMENT_API_KEY = getEnvVar("JUDGMENT_API_KEY");
  JUDGMENT_ORG_ID = getEnvVar("JUDGMENT_ORG_ID");
  JUDGMENT_API_URL = getEnvVar("JUDGMENT_API_URL", "https://api.judgmentlabs.ai");
  JUDGMENT_LOG_LEVEL = getEnvVar("JUDGMENT_LOG_LEVEL", "warn");
});
// src/internal/api/client.ts
class JudgmentApiClient {
  baseUrl;
  apiKey;
  organizationId;
  constructor(baseUrl, apiKey, organizationId) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.organizationId = organizationId;
  }
  getBaseUrl() {
    return this.baseUrl;
  }
  getApiKey() {
    return this.apiKey;
  }
  getOrganizationId() {
    return this.organizationId;
  }
  async request(method, url, body) {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Organization-Id": this.organizationId
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response.json();
  }
  async postOtelV1traces() {
    const url = this.baseUrl + "/otel/v1/traces";
    return this.request("POST", url, {});
  }
  async postOtelV1offlineTraces() {
    const url = this.baseUrl + "/otel/v1/offline-traces";
    return this.request("POST", url, {});
  }
  async postV1projectsResolve(payload) {
    const url = this.baseUrl + "/v1/projects/resolve/";
    return this.request("POST", url, payload);
  }
  async postV1projects(payload) {
    const url = this.baseUrl + "/v1/projects";
    return this.request("POST", url, payload);
  }
  async deleteV1projects(projectId) {
    const url = this.baseUrl + `/v1/projects/${projectId}`;
    return this.request("DELETE", url, {});
  }
  async postV1projectsDatasets(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/datasets`;
    return this.request("POST", url, payload);
  }
  async getV1projectsDatasets(projectId) {
    const url = this.baseUrl + `/v1/projects/${projectId}/datasets`;
    return this.request("GET", url, undefined);
  }
  async postV1projectsDatasetsByDatasetNameExamples(projectId, datasetName, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/datasets/${datasetName}/examples`;
    return this.request("POST", url, payload);
  }
  async getV1projectsDatasetsByDatasetName(projectId, datasetName) {
    const url = this.baseUrl + `/v1/projects/${projectId}/datasets/${datasetName}`;
    return this.request("GET", url, undefined);
  }
  async postV1projectsEvaluateExamples(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/evaluate/examples`;
    return this.request("POST", url, payload);
  }
  async postV1projectsEvaluateTraces(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/evaluate/traces`;
    return this.request("POST", url, payload);
  }
  async postV1projectsEvalResults(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/eval-results`;
    return this.request("POST", url, payload);
  }
  async postV1projectsEvalResultsExamples(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/eval-results/examples`;
    return this.request("POST", url, payload);
  }
  async getV1projectsExperimentsByRunId(projectId, runId) {
    const url = this.baseUrl + `/v1/projects/${projectId}/experiments/${runId}`;
    return this.request("GET", url, undefined);
  }
  async postV1projectsEvalQueueExamples(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/eval-queue/examples`;
    return this.request("POST", url, payload);
  }
  async postV1projectsEvalQueueTraces(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/eval-queue/traces`;
    return this.request("POST", url, payload);
  }
  async getV1projectsPromptsByName(projectId, name, commit_id, tag) {
    const params = new URLSearchParams;
    if (commit_id !== undefined)
      params.set("commit_id", commit_id);
    if (tag !== undefined)
      params.set("tag", tag);
    const url = this.baseUrl + `/v1/projects/${projectId}/prompts/${name}` + (params.toString() ? "?" + params.toString() : "");
    return this.request("GET", url, undefined);
  }
  async postV1projectsPrompts(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/prompts`;
    return this.request("POST", url, payload);
  }
  async postV1projectsPromptsByNameTags(projectId, name, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/prompts/${name}/tags`;
    return this.request("POST", url, payload);
  }
  async deleteV1projectsPromptsByNameTags(projectId, name, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/prompts/${name}/tags`;
    return this.request("DELETE", url, payload);
  }
  async getV1projectsPromptsByNameVersions(projectId, name) {
    const url = this.baseUrl + `/v1/projects/${projectId}/prompts/${name}/versions`;
    return this.request("GET", url, undefined);
  }
  async getV1projectsScorers(projectId, names, is_trace) {
    const params = new URLSearchParams;
    if (names !== undefined)
      params.set("names", names);
    if (is_trace !== undefined)
      params.set("is_trace", is_trace);
    const url = this.baseUrl + `/v1/projects/${projectId}/scorers` + (params.toString() ? "?" + params.toString() : "");
    return this.request("GET", url, undefined);
  }
  async getV1projectsScorersByNameExists(projectId, name) {
    const url = this.baseUrl + `/v1/projects/${projectId}/scorers/${name}/exists`;
    return this.request("GET", url, undefined);
  }
  async postV1projectsScorersCustom(projectId) {
    const url = this.baseUrl + `/v1/projects/${projectId}/scorers/custom`;
    return this.request("POST", url, {});
  }
  async postV1projectsScorersCustomBundle(projectId) {
    const url = this.baseUrl + `/v1/projects/${projectId}/scorers/custom/bundle`;
    return this.request("POST", url, {});
  }
  async getV1projectsScorersCustomByNameExists(projectId, name) {
    const url = this.baseUrl + `/v1/projects/${projectId}/scorers/custom/${name}/exists`;
    return this.request("GET", url, undefined);
  }
  async postV1projectsTracesByTraceIdTags(projectId, traceId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/traces/${traceId}/tags`;
    return this.request("POST", url, payload);
  }
  async getV1e2eFetchTraceByProjectNameByTraceId(projectName, traceId) {
    const url = this.baseUrl + `/v1/e2e_fetch_trace/${projectName}/${traceId}`;
    return this.request("GET", url, undefined);
  }
  async getV1e2eTracesPerProject(projectId, limit, offset) {
    const params = new URLSearchParams;
    if (limit !== undefined)
      params.set("limit", limit);
    if (offset !== undefined)
      params.set("offset", offset);
    const url = this.baseUrl + `/v1/e2e_traces_per_project/${projectId}` + (params.toString() ? "?" + params.toString() : "");
    return this.request("GET", url, undefined);
  }
  async postV1e2eFetchSpanScore(payload) {
    const url = this.baseUrl + "/v1/e2e_fetch_span_score/";
    return this.request("POST", url, payload);
  }
  async postV1projectsJudges(projectId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/judges`;
    return this.request("POST", url, payload);
  }
  async patchV1projectsJudgesByJudgeId(projectId, judgeId, payload) {
    const url = this.baseUrl + `/v1/projects/${projectId}/judges/${judgeId}`;
    return this.request("PATCH", url, payload);
  }
}

// src/internal/api/index.ts
var init_api = () => {};

// src/utils/logger.ts
function getProcess() {
  return globalThis.process;
}
function getEnvVar2(name, defaultValue) {
  return getProcess()?.env?.[name] ?? defaultValue;
}
var Logger;
var init_logger = __esm(() => {
  Logger = class Logger {
    static RESET = "\x1B[0m";
    static RED = "\x1B[31m";
    static YELLOW = "\x1B[33m";
    static GRAY = "\x1B[90m";
    static Level = {
      DEBUG: 0,
      INFO: 1,
      WARNING: 2,
      ERROR: 3,
      CRITICAL: 4
    };
    static initialized = false;
    static levelSetManually = false;
    static currentLevel = Logger.Level.WARNING;
    static useColor = true;
    static initialize() {
      if (!Logger.initialized) {
        const proc = getProcess();
        const noColor = proc?.env?.JUDGMENT_NO_COLOR;
        Logger.useColor = !noColor && proc?.stdout?.isTTY === true;
        if (!Logger.levelSetManually) {
          const logLevel = getEnvVar2("JUDGMENT_LOG_LEVEL", "warn").toLowerCase();
          if (logLevel) {
            const levelMap = {
              debug: Logger.Level.DEBUG,
              info: Logger.Level.INFO,
              warning: Logger.Level.WARNING,
              warn: Logger.Level.WARNING,
              error: Logger.Level.ERROR,
              critical: Logger.Level.CRITICAL
            };
            Logger.currentLevel = levelMap[logLevel] ?? Logger.Level.WARNING;
          }
        }
        Logger.initialized = true;
      }
    }
    static setLevel(level) {
      Logger.currentLevel = level;
      Logger.levelSetManually = true;
    }
    static setUseColor(useColor) {
      Logger.useColor = useColor;
    }
    static log(level, message) {
      Logger.initialize();
      if (level < Logger.currentLevel) {
        return;
      }
      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
      const levelName = Object.keys(Logger.Level).find((key) => Logger.Level[key] === level) ?? "UNKNOWN";
      let formattedMessage = `${timestamp} - judgeval - ${levelName} - ${message}`;
      if (Logger.useColor) {
        const color = level === Logger.Level.DEBUG || level === Logger.Level.INFO ? Logger.GRAY : level === Logger.Level.WARNING ? Logger.YELLOW : Logger.RED;
        formattedMessage = `${color}${formattedMessage}${Logger.RESET}`;
      }
      const proc = getProcess();
      const output = level >= Logger.Level.ERROR ? proc?.stderr : proc?.stdout;
      if (output?.write) {
        output.write(formattedMessage + `
`);
        return;
      }
      if (level >= Logger.Level.ERROR) {
        console.error(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }
    static debug(message) {
      Logger.log(Logger.Level.DEBUG, message);
    }
    static info(message) {
      Logger.log(Logger.Level.INFO, message);
    }
    static warning(message) {
      Logger.log(Logger.Level.WARNING, message);
    }
    static warn(message) {
      Logger.log(Logger.Level.WARNING, message);
    }
    static error(message) {
      Logger.log(Logger.Level.ERROR, message);
    }
    static critical(message) {
      Logger.log(Logger.Level.CRITICAL, message);
    }
  };
});

// src/utils/retry.ts
async function retry(fn, config = {}) {
  const { maxRetries = 3, backoff = () => 1000, onRetry } = config;
  for (let attempt = 1;attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      onRetry?.(attempt, error);
      await new Promise((resolve) => setTimeout(resolve, backoff(attempt)));
    }
  }
  throw new Error("retry: exhausted all attempts");
}

// src/utils/resolve-project-id.ts
async function resolveProjectId(client2, projectName) {
  const cacheKey = `org:${client2.getOrganizationId()}:project:${projectName}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const pending = inflight.get(cacheKey);
  if (pending) {
    return pending;
  }
  const request = (async () => {
    Logger.info(`Resolving project ID for project: ${projectName}`);
    const projectId = await retry(async () => {
      const response = await client2.postV1projectsResolve({
        project_name: projectName
      });
      const id = response.project_id;
      if (!id) {
        throw new Error(`Project ID not found for project: ${projectName}`);
      }
      return id;
    }, {
      maxRetries: 3,
      backoff: (iteration) => iteration * 1000,
      onRetry: (attempt, error) => {
        Logger.warning(`Failed to resolve project ID for '${projectName}' (attempt ${attempt}): ${String(error)}`);
      }
    });
    Logger.info(`Resolved project ID: ${projectId}`);
    cache.set(cacheKey, projectId);
    return projectId;
  })();
  inflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inflight.delete(cacheKey);
  }
}
var cache, inflight;
var init_resolve_project_id = __esm(() => {
  init_logger();
  cache = new Map;
  inflight = new Map;
});

// node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS((exports, module) => {
  var p = process || {};
  var argv = p.argv || [];
  var env = p.env || {};
  var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
  var formatter = (open, close, replace = open) => (input) => {
    let string = "" + input, index = string.indexOf(close, open.length);
    return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
  };
  var replaceClose = (string, close, replace, index) => {
    let result = "", cursor = 0;
    do {
      result += string.substring(cursor, index) + replace;
      cursor = index + close.length;
      index = string.indexOf(close, cursor);
    } while (~index);
    return result + string.substring(cursor);
  };
  var createColors = (enabled = isColorSupported) => {
    let f = enabled ? formatter : () => String;
    return {
      isColorSupported: enabled,
      reset: f("\x1B[0m", "\x1B[0m"),
      bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: f("\x1B[3m", "\x1B[23m"),
      underline: f("\x1B[4m", "\x1B[24m"),
      inverse: f("\x1B[7m", "\x1B[27m"),
      hidden: f("\x1B[8m", "\x1B[28m"),
      strikethrough: f("\x1B[9m", "\x1B[29m"),
      black: f("\x1B[30m", "\x1B[39m"),
      red: f("\x1B[31m", "\x1B[39m"),
      green: f("\x1B[32m", "\x1B[39m"),
      yellow: f("\x1B[33m", "\x1B[39m"),
      blue: f("\x1B[34m", "\x1B[39m"),
      magenta: f("\x1B[35m", "\x1B[39m"),
      cyan: f("\x1B[36m", "\x1B[39m"),
      white: f("\x1B[37m", "\x1B[39m"),
      gray: f("\x1B[90m", "\x1B[39m"),
      bgBlack: f("\x1B[40m", "\x1B[49m"),
      bgRed: f("\x1B[41m", "\x1B[49m"),
      bgGreen: f("\x1B[42m", "\x1B[49m"),
      bgYellow: f("\x1B[43m", "\x1B[49m"),
      bgBlue: f("\x1B[44m", "\x1B[49m"),
      bgMagenta: f("\x1B[45m", "\x1B[49m"),
      bgCyan: f("\x1B[46m", "\x1B[49m"),
      bgWhite: f("\x1B[47m", "\x1B[49m"),
      blackBright: f("\x1B[90m", "\x1B[39m"),
      redBright: f("\x1B[91m", "\x1B[39m"),
      greenBright: f("\x1B[92m", "\x1B[39m"),
      yellowBright: f("\x1B[93m", "\x1B[39m"),
      blueBright: f("\x1B[94m", "\x1B[39m"),
      magentaBright: f("\x1B[95m", "\x1B[39m"),
      cyanBright: f("\x1B[96m", "\x1B[39m"),
      whiteBright: f("\x1B[97m", "\x1B[39m"),
      bgBlackBright: f("\x1B[100m", "\x1B[49m"),
      bgRedBright: f("\x1B[101m", "\x1B[49m"),
      bgGreenBright: f("\x1B[102m", "\x1B[49m"),
      bgYellowBright: f("\x1B[103m", "\x1B[49m"),
      bgBlueBright: f("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
      bgCyanBright: f("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: f("\x1B[107m", "\x1B[49m")
    };
  };
  module.exports = createColors();
  module.exports.createColors = createColors;
});

// src/data/Example.ts
var Example;
var init_Example = __esm(() => {
  Example = class Example {
    exampleId;
    createdAt;
    name;
    _properties;
    constructor(exampleId, createdAt, name, properties) {
      this.exampleId = exampleId;
      this.createdAt = createdAt;
      this.name = name;
      this._properties = properties;
    }
    static create(props = {}) {
      return new Example(crypto.randomUUID(), new Date().toISOString(), null, {
        ...props
      });
    }
    static META_KEYS = new Set([
      "example_id",
      "created_at",
      "name",
      "trace_id",
      "span_id",
      "offline_trace_id"
    ]);
    static from(data) {
      const properties = {};
      for (const key of Object.keys(data)) {
        if (!Example.META_KEYS.has(key)) {
          properties[key] = data[key];
        }
      }
      return new Example(data.example_id ?? "", data.created_at ?? "", data.name ?? null, properties);
    }
    get(key) {
      return this._properties[key];
    }
    has(key) {
      return key in this._properties;
    }
    get properties() {
      return { ...this._properties };
    }
    toJSON() {
      const result = {
        example_id: this.exampleId,
        created_at: this.createdAt,
        name: this.name
      };
      for (const [key, value] of Object.entries(this._properties)) {
        result[key] = value;
      }
      return result;
    }
  };
});

// src/utils/serializer.ts
function createCircularReplacer() {
  const seen = new WeakSet;
  return function(_key, value) {
    if (typeof value === "bigint")
      return value.toString();
    if (typeof value === "object" && value !== null) {
      if (seen.has(value))
        return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}
function safeStringify(obj) {
  try {
    const result = JSON.stringify(obj);
    if (typeof result === "string")
      return result;
    return String(result);
  } catch {
    try {
      const result = JSON.stringify(obj, createCircularReplacer());
      return typeof result === "string" ? result : String(obj);
    } catch (e) {
      Logger.error(`safeStringify failed: ${e}`);
      return String(obj);
    }
  }
}
function serializeAttribute(value, serializer) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  return serializer(value);
}
var init_serializer = __esm(() => {
  init_logger();
});

// package.json
var version = "1.0.1";
var init_package = () => {};

// src/version.ts
var VERSION;
var init_version = __esm(() => {
  init_package();
  VERSION = version;
});

// src/trace/instrumentation/OtelContextBridge.ts
import {
  ROOT_CONTEXT,
  context as otelContext
} from "@opentelemetry/api";
import { AsyncLocalStorage } from "async_hooks";
function isGateEnabled() {
  return gateStorage.getStore() === true;
}
function installOtelContextBridge(getCurrentJudgmentContext) {
  getJudgmentContext = getCurrentJudgmentContext;
  if (installed)
    return;
  const api = otelContext;
  api.active = () => {
    if (!isGateEnabled())
      return originalActive();
    const bridged = bridgeContextStorage.getStore();
    if (bridged)
      return bridged;
    return getJudgmentContext ? getJudgmentContext() : ROOT_CONTEXT;
  };
  api.with = (contextValue, fn, thisArg, ...args) => {
    if (!isGateEnabled())
      return originalWith(contextValue, fn, thisArg, ...args);
    return bridgeContextStorage.run(contextValue, () => fn.apply(thisArg, args));
  };
  api.bind = (contextValue, target) => {
    if (!isGateEnabled())
      return originalBind(contextValue, target);
    if (typeof target !== "function")
      return target;
    const fn = target;
    return (...args) => bridgeContextStorage.run(contextValue, () => fn(...args));
  };
  installed = true;
}
function runWithOtelBridgeGate(ctx, fn) {
  return gateStorage.run(true, () => bridgeContextStorage.run(ctx, fn));
}
var installed = false, getJudgmentContext = null, gateStorage, bridgeContextStorage, originalActive, originalWith, originalBind;
var init_OtelContextBridge = __esm(() => {
  gateStorage = new AsyncLocalStorage;
  bridgeContextStorage = new AsyncLocalStorage;
  originalActive = otelContext.active.bind(otelContext);
  originalWith = otelContext.with.bind(otelContext);
  originalBind = otelContext.bind.bind(otelContext);
});

// src/trace/runtime.ts
import {
  INVALID_SPAN_CONTEXT,
  ROOT_CONTEXT as ROOT_CONTEXT2,
  SpanStatusCode,
  trace
} from "@opentelemetry/api";

class NoOpTracer {
  startSpan() {
    return trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
  }
  startActiveSpan(_name, ...args) {
    const fn = args.length === 1 ? args[0] : args.length === 2 ? args[1] : args[2];
    return fn(this.startSpan());
  }
}
function setTraceRuntime(nextRuntime) {
  runtime = nextRuntime;
}
function getTraceRuntime() {
  return runtime ?? noOpRuntime;
}
function setLLMWrapper(wrapper) {
  llmWrapper = wrapper;
}
function wrapLLMClient(client2) {
  if (!llmWrapper) {
    Logger.warning("LLM client instrumentation is not available from this entrypoint.");
    return client2;
  }
  return llmWrapper(client2);
}
var noOpTracer, noOpRuntime, runtime = null, llmWrapper = null;
var init_runtime = __esm(() => {
  init_logger();
  noOpTracer = new NoOpTracer;
  noOpRuntime = {
    register() {},
    deregister() {},
    setActive() {
      return false;
    },
    getActiveTracer() {
      return null;
    },
    getCurrentContext() {
      return ROOT_CONTEXT2;
    },
    setSpan(ctx, span) {
      return trace.setSpan(ctx, span);
    },
    wrapSpanContext(spanContext) {
      return trace.wrapSpanContext(spanContext);
    },
    getCurrentSpan() {
      return;
    },
    getTracer() {
      Logger.debug("No active tracer provider, returning NoOpTracer");
      return noOpTracer;
    },
    addInstrumentation() {
      Logger.warning("No active tracer provider. Instrumentation was not registered.");
    },
    useSpan(span, endOnExit, recordException, setStatusOnException, fn) {
      try {
        const result = fn();
        if (result instanceof Promise) {
          return result.catch((exc) => {
            if (span.isRecording()) {
              if (recordException)
                span.recordException(exc);
              if (setStatusOnException) {
                const err = exc;
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: `${err.name}: ${err.message}`
                });
              }
            }
            throw exc;
          }).finally(() => {
            if (endOnExit)
              span.end();
          });
        }
        if (endOnExit)
          span.end();
        return result;
      } catch (exc) {
        if (span.isRecording()) {
          if (recordException)
            span.recordException(exc);
          if (setStatusOnException) {
            const err = exc;
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `${err.name}: ${err.message}`
            });
          }
        }
        if (endOnExit)
          span.end();
        throw exc;
      }
    },
    attachContext() {},
    withContext(_ctx, fn) {
      return fn();
    },
    forceFlush() {
      return Promise.resolve();
    },
    shutdown() {
      return Promise.resolve();
    }
  };
});

// src/trace/JudgmentTracerProvider.ts
import {
  INVALID_SPAN_CONTEXT as INVALID_SPAN_CONTEXT2,
  ROOT_CONTEXT as ROOT_CONTEXT3,
  SpanStatusCode as SpanStatusCode2,
  trace as trace2
} from "@opentelemetry/api";
import {
  registerInstrumentations
} from "@opentelemetry/instrumentation";
import { AsyncLocalStorage as AsyncLocalStorage2 } from "async_hooks";

class ProxyTracer {
  _provider;
  constructor(provider) {
    this._provider = provider;
  }
  startSpan(name, options, context) {
    const ctx = context ?? this._provider.getCurrentContext();
    const delegate = this._provider._getDelegateTracer();
    return delegate.startSpan(name, options, ctx);
  }
  startActiveSpan(name, ...args) {
    let options = {};
    let context = this._provider.getCurrentContext();
    let fn;
    if (args.length === 1) {
      fn = args[0];
    } else if (args.length === 2) {
      options = args[0];
      fn = args[1];
    } else {
      options = args[0];
      context = args[1];
      fn = args[2];
    }
    const span = this.startSpan(name, options, context);
    return this._provider.useSpan(span, false, false, false, () => fn(span));
  }
}

class NoOpTracer2 {
  startSpan() {
    return trace2.wrapSpanContext(INVALID_SPAN_CONTEXT2);
  }
  startActiveSpan(_name, ...args) {
    const fn = args.length === 1 ? args[0] : args.length === 2 ? args[1] : args[2];
    return fn(this.startSpan());
  }
}

class JudgmentTracerProvider {
  static _instance = null;
  _activeTracer = null;
  _instrumentations = [];
  _noOpTracer;
  _proxyTracer;
  _tracers = new Set;
  constructor() {
    this._noOpTracer = new NoOpTracer2;
    this._proxyTracer = new ProxyTracer(this);
    setTraceRuntime(this);
    installOtelContextBridge(() => this.getCurrentContext());
  }
  static getInstance() {
    JudgmentTracerProvider._instance ??= new JudgmentTracerProvider;
    return JudgmentTracerProvider._instance;
  }
  static installAsGlobalTracerProvider() {
    const instance = JudgmentTracerProvider.getInstance();
    return trace2.setGlobalTracerProvider(instance);
  }
  register(tracer) {
    this._tracers.add(tracer);
  }
  deregister(tracer) {
    this._tracers.delete(tracer);
  }
  setActive(tracer) {
    const currentSpan = this.getCurrentSpan();
    if (currentSpan?.isRecording()) {
      if (trace2.getSpan(this.getCurrentContext()) === currentSpan) {
        Logger.error("Cannot set_active() while a root span is active. Keeping existing tracer provider.");
        return false;
      }
    }
    this.register(tracer);
    this._activeTracer = tracer;
    return true;
  }
  getActiveTracer() {
    return this._activeTracer;
  }
  getCurrentContext() {
    return _contextStorage.getStore() ?? ROOT_CONTEXT3;
  }
  setSpan(ctx, span) {
    return trace2.setSpan(ctx, span);
  }
  wrapSpanContext(spanContext) {
    return trace2.wrapSpanContext(spanContext);
  }
  getCurrentSpan() {
    const ctx = this.getCurrentContext();
    return trace2.getSpan(ctx);
  }
  hasActiveRootSpan() {
    const currentSpan = this.getCurrentSpan();
    if (!currentSpan?.isRecording())
      return false;
    return true;
  }
  _getDelegateTracer() {
    const tracer = this._activeTracer;
    if (!tracer) {
      Logger.debug("No active tracer, returning NoOpTracer");
      return this._noOpTracer;
    }
    return tracer._tracerProvider.getTracer(TRACER_NAME);
  }
  getTracer(_instrumentingModuleName, _instrumentingLibraryVersion, _options) {
    return this._proxyTracer;
  }
  addInstrumentation(instrumentor) {
    try {
      registerInstrumentations({
        tracerProvider: this,
        instrumentations: [instrumentor]
      });
      this._instrumentations.push(instrumentor);
    } catch (err) {
      Logger.error(`Failed to add instrumentation: ${String(err)}`);
    }
  }
  useSpan(span, endOnExit, recordException, setStatusOnException, fn) {
    const prevCtx = this.getCurrentContext();
    const ctx = trace2.setSpan(prevCtx, span);
    return _contextStorage.run(ctx, () => runWithOtelBridgeGate(ctx, () => {
      try {
        const result = fn();
        if (result instanceof Promise) {
          return result.catch((exc) => {
            if (span.isRecording()) {
              if (recordException)
                span.recordException(exc);
              if (setStatusOnException) {
                const err = exc;
                span.setStatus({
                  code: SpanStatusCode2.ERROR,
                  message: `${err.name}: ${err.message}`
                });
              }
            }
            throw exc;
          }).finally(() => {
            if (endOnExit)
              span.end();
          });
        }
        if (endOnExit)
          span.end();
        return result;
      } catch (exc) {
        if (span.isRecording()) {
          if (recordException)
            span.recordException(exc);
          if (setStatusOnException) {
            const err = exc;
            span.setStatus({
              code: SpanStatusCode2.ERROR,
              message: `${err.name}: ${err.message}`
            });
          }
        }
        if (endOnExit)
          span.end();
        throw exc;
      }
    }));
  }
  attachContext(ctx) {
    _contextStorage.enterWith(ctx);
  }
  withContext(ctx, fn) {
    return _contextStorage.run(ctx, () => runWithOtelBridgeGate(ctx, fn));
  }
  async forceFlush() {
    const results = await Promise.allSettled(Array.from(this._tracers).map((t) => t._tracerProvider.forceFlush()));
    for (const r of results) {
      if (r.status === "rejected") {
        Logger.error(`forceFlush failed: ${String(r.reason)}`);
      }
    }
  }
  async shutdown() {
    const results = await Promise.allSettled(Array.from(this._tracers).map((t) => t._tracerProvider.shutdown()));
    for (const r of results) {
      if (r.status === "rejected") {
        Logger.error(`shutdown failed: ${String(r.reason)}`);
      }
    }
    this._activeTracer = null;
    this._tracers.clear();
  }
}
var TRACER_NAME = "judgeval", _contextStorage;
var init_JudgmentTracerProvider = __esm(() => {
  init_logger();
  init_OtelContextBridge();
  init_runtime();
  _contextStorage = new AsyncLocalStorage2;
});

// src/JudgmentAttributeKeys.ts
var init_JudgmentAttributeKeys = () => {};

// src/utils/annotate.ts
function stringifyFn(fn) {
  return Function.prototype.toString.call(fn);
}
function extractArgs(fn) {
  const fnText = stringifyFn(fn).replace(STRIP_COMMENTS, "");
  return fnText.match(ARROW_ARG) || fnText.match(FN_ARGS);
}
function parseFunctionArgs(fn) {
  const args = extractArgs(fn);
  if (!args || !args[1]) {
    return [];
  }
  return args[1].split(FN_ARG_SPLIT).map((arg) => {
    const match = arg.replace(FN_ARG, (all, underscore, name) => name);
    return match.trim();
  }).filter((name) => name.length > 0);
}
var ARROW_ARG, FN_ARGS, FN_ARG_SPLIT, FN_ARG, STRIP_COMMENTS;
var init_annotate = __esm(() => {
  ARROW_ARG = /^([^(]+?)=>/;
  FN_ARGS = /^[^(]*\(\s*([^)]*)\)/m;
  FN_ARG_SPLIT = /,/;
  FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
  STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
});

// src/utils/dont-throw.ts
function dontThrow(name, fn, fallback) {
  try {
    return fn();
  } catch (err) {
    const stack = err instanceof Error && err.stack ? `
${err.stack}` : "";
    Logger.error(`[Caught] An exception was raised in ${name}: ${String(err)}${stack}`);
    return fallback;
  }
}
var init_dont_throw = __esm(() => {
  init_logger();
});

// src/utils/random-uuid.ts
function createRandomUUID() {
  const cryptoObject = globalThis.crypto;
  if (typeof cryptoObject?.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }
  if (typeof cryptoObject?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    bytes[6] = bytes[6] & 15 | 64;
    bytes[8] = bytes[8] & 63 | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join("-");
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ Math.floor(Math.random() * 256) & 15 >> Number(c) / 4).toString(16));
}

// src/trace/baggage/constants.ts
var BAGGAGE_KEY_PAIR_SEPARATOR = "=", BAGGAGE_PROPERTIES_SEPARATOR = ";", BAGGAGE_ITEMS_SEPARATOR = ",", BAGGAGE_HEADER = "baggage", BAGGAGE_MAX_NAME_VALUE_PAIRS = 180, BAGGAGE_MAX_PER_NAME_VALUE_PAIRS = 4096, BAGGAGE_MAX_TOTAL_LENGTH = 8192;

// src/trace/baggage/utils.ts
import {
  baggageEntryMetadataFromString
} from "@opentelemetry/api";
function serializeKeyPairs(keyPairs) {
  return keyPairs.reduce((hValue, current) => {
    const value = `${hValue}${hValue !== "" ? BAGGAGE_ITEMS_SEPARATOR : ""}${current}`;
    return value.length > BAGGAGE_MAX_TOTAL_LENGTH ? hValue : value;
  }, "");
}
function getKeyPairs(baggage) {
  return baggage.getAllEntries().map(([key, value]) => {
    let entry = `${encodeURIComponent(key)}=${encodeURIComponent(value.value)}`;
    if (value.metadata !== undefined) {
      entry += BAGGAGE_PROPERTIES_SEPARATOR + value.metadata.toString();
    }
    return entry;
  });
}
function parsePairKeyValue(entry) {
  const valueProps = entry.split(BAGGAGE_PROPERTIES_SEPARATOR);
  if (valueProps.length <= 0)
    return;
  const keyPairPart = valueProps.shift();
  if (!keyPairPart)
    return;
  const separatorIndex = keyPairPart.indexOf(BAGGAGE_KEY_PAIR_SEPARATOR);
  if (separatorIndex <= 0)
    return;
  const key = decodeURIComponent(keyPairPart.substring(0, separatorIndex).trim());
  const value = decodeURIComponent(keyPairPart.substring(separatorIndex + 1).trim());
  let metadata;
  if (valueProps.length > 0) {
    metadata = baggageEntryMetadataFromString(valueProps.join(BAGGAGE_PROPERTIES_SEPARATOR));
  }
  return { key, value, metadata };
}
var init_utils = () => {};

// src/trace/baggage/JudgmentBaggagePropagator.ts
import { isTracingSuppressed } from "@opentelemetry/core";

class JudgmentBaggagePropagator {
  inject(context, carrier, setter) {
    const baggage = getBaggage(context);
    if (!baggage || isTracingSuppressed(context))
      return;
    const keyPairs = getKeyPairs(baggage).filter((pair) => pair.length <= BAGGAGE_MAX_PER_NAME_VALUE_PAIRS).slice(0, BAGGAGE_MAX_NAME_VALUE_PAIRS);
    const headerValue = serializeKeyPairs(keyPairs);
    if (headerValue.length > 0) {
      setter.set(carrier, BAGGAGE_HEADER, headerValue);
    }
  }
  extract(context, carrier, getter) {
    const headerValue = getter.get(carrier, BAGGAGE_HEADER);
    const baggageString = Array.isArray(headerValue) ? headerValue.join(BAGGAGE_ITEMS_SEPARATOR) : headerValue;
    if (!baggageString)
      return context;
    const baggage = {};
    if (baggageString.length === 0)
      return context;
    const pairs = baggageString.split(BAGGAGE_ITEMS_SEPARATOR);
    pairs.forEach((entry) => {
      const keyPair = parsePairKeyValue(entry);
      if (keyPair) {
        const baggageEntry = { value: keyPair.value };
        if (keyPair.metadata) {
          baggageEntry.metadata = keyPair.metadata;
        }
        baggage[keyPair.key] = baggageEntry;
      }
    });
    if (Object.entries(baggage).length === 0) {
      return context;
    }
    return setBaggage(context, createBaggage(baggage));
  }
  fields() {
    return [BAGGAGE_HEADER];
  }
}
var init_JudgmentBaggagePropagator = __esm(() => {
  init_baggage();
  init_utils();
});

// src/trace/baggage/index.ts
var exports_baggage = {};
__export(exports_baggage, {
  setBaggage: () => setBaggage,
  getBaggage: () => getBaggage,
  getActiveBaggage: () => getActiveBaggage,
  deleteBaggage: () => deleteBaggage,
  createBaggage: () => createBaggage,
  baggageEntryMetadataFromString: () => baggageEntryMetadataFromString2,
  JudgmentBaggagePropagator: () => JudgmentBaggagePropagator
});
import {
  createContextKey,
  propagation
} from "@opentelemetry/api";
import { baggageEntryMetadataFromString as baggageEntryMetadataFromString2 } from "@opentelemetry/api";
function getBaggage(context) {
  return context.getValue(BAGGAGE_KEY);
}
function getActiveBaggage() {
  return getBaggage(getTraceRuntime().getCurrentContext());
}
function setBaggage(context, baggage) {
  return context.setValue(BAGGAGE_KEY, baggage);
}
function deleteBaggage(context) {
  return context.deleteValue(BAGGAGE_KEY);
}
var createBaggage, BAGGAGE_KEY;
var init_baggage = __esm(() => {
  init_runtime();
  init_JudgmentBaggagePropagator();
  createBaggage = propagation.createBaggage.bind(propagation);
  BAGGAGE_KEY = createContextKey("baggage");
});

// src/trace/propagation/index.ts
var exports_propagation = {};
__export(exports_propagation, {
  setGlobalTextmap: () => setGlobalTextmap,
  inject: () => inject,
  getGlobalTextmap: () => getGlobalTextmap,
  extract: () => extract
});
import {
  defaultTextMapGetter,
  defaultTextMapSetter
} from "@opentelemetry/api";
import {
  CompositePropagator,
  W3CTraceContextPropagator
} from "@opentelemetry/core";
function getGlobalTextmap() {
  return _globalTextmap;
}
function setGlobalTextmap(propagator) {
  _globalTextmap = propagator;
}
function _resolveContext(context) {
  if (context !== undefined)
    return context;
  return getTraceRuntime().getCurrentContext();
}
function inject(carrier, context, setter = defaultTextMapSetter) {
  dontThrow("propagation.inject", () => {
    getGlobalTextmap().inject(_resolveContext(context), carrier, setter);
  });
}
function extract(carrier, context, getter = defaultTextMapGetter) {
  const base = _resolveContext(context);
  return dontThrow("propagation.extract", () => getGlobalTextmap().extract(base, carrier, getter), base);
}
var _globalTextmap;
var init_propagation = __esm(() => {
  init_dont_throw();
  init_JudgmentBaggagePropagator();
  init_runtime();
  _globalTextmap = new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator,
      new JudgmentBaggagePropagator
    ]
  });
});

// src/trace/BaseTracer.ts
import {
  INVALID_SPAN_CONTEXT as INVALID_SPAN_CONTEXT3,
  SpanStatusCode as SpanStatusCode3
} from "@opentelemetry/api";

class BaseTracer {
  projectName;
  projectId;
  apiKey;
  organizationId;
  apiUrl;
  environment;
  serializer;
  _tracerProvider;
  _client;
  _enableMonitoring;
  supportsLiveInstrumentation = true;
  constructor(projectName, projectId, apiKey, organizationId, apiUrl, environment, serializer, tracerProvider, client2, enableMonitoring) {
    this.projectName = projectName;
    this.projectId = projectId;
    this.apiKey = apiKey;
    this.organizationId = organizationId;
    this.apiUrl = apiUrl;
    this.environment = environment;
    this.serializer = serializer;
    this._tracerProvider = tracerProvider;
    this._client = client2;
    this._enableMonitoring = enableMonitoring;
  }
  setActive() {
    return getTraceRuntime().setActive(this);
  }
  static _getProxyProvider() {
    return getTraceRuntime();
  }
  static _getSerializer() {
    const tracer = BaseTracer._getProxyProvider().getActiveTracer();
    return tracer?.serializer ?? safeStringify;
  }
  static _getCurrentTraceAndSpanId() {
    const proxy = BaseTracer._getProxyProvider();
    const currentSpan = proxy.getCurrentSpan();
    if (!currentSpan?.isRecording())
      return null;
    const ctx = currentSpan.spanContext();
    if (!ctx.traceId || !(ctx.traceFlags & 1))
      return null;
    return [ctx.traceId, ctx.spanId];
  }
  static _emitPartial() {
    dontThrow("BaseTracer._emitPartial", () => {
      const tracer = BaseTracer._getProxyProvider().getActiveTracer();
      if (!tracer || !tracer.supportsLiveInstrumentation)
        return;
      tracer.getSpanProcessor().emitPartial();
    });
  }
  static getCurrentSpan() {
    const proxy = BaseTracer._getProxyProvider();
    return proxy.getCurrentSpan();
  }
  static async forceFlush() {
    const proxy = BaseTracer._getProxyProvider();
    await proxy.forceFlush();
  }
  static async shutdown() {
    const proxy = BaseTracer._getProxyProvider();
    await proxy.shutdown();
  }
  static registerOTELInstrumentation(instrumentor) {
    dontThrow("BaseTracer.registerOTELInstrumentation", () => {
      const proxy = BaseTracer._getProxyProvider();
      proxy.addInstrumentation(instrumentor);
    });
  }
  static wrap(client2) {
    return wrapLLMClient(client2);
  }
  static getOTELTracer() {
    const proxy = BaseTracer._getProxyProvider();
    return proxy.getTracer(TRACER_NAME2);
  }
  static startSpan(name, attributes) {
    const span = BaseTracer.getOTELTracer().startSpan(name, { attributes });
    BaseTracer._emitPartial();
    return span;
  }
  static startActiveSpan(options, fn) {
    const { name, attributes } = options;
    return BaseTracer.getOTELTracer().startActiveSpan(name, { attributes }, (span) => {
      BaseTracer._emitPartial();
      try {
        const result = fn(span);
        if (result instanceof Promise) {
          return result.finally(() => {
            span.end();
          });
        }
        span.end();
        return result;
      } catch (e) {
        span.end();
        throw e;
      }
    });
  }
  static span(spanName, fn) {
    return BaseTracer.startActiveSpan({ name: spanName }, (span) => {
      try {
        const result = fn(span);
        if (result instanceof Promise) {
          return result.catch((e) => {
            span.setStatus({ code: SpanStatusCode3.ERROR, message: String(e) });
            span.recordException(e);
            throw e;
          });
        }
        return result;
      } catch (e) {
        span.setStatus({ code: SpanStatusCode3.ERROR, message: String(e) });
        span.recordException(e);
        throw e;
      }
    });
  }
  static with(spanName, fn) {
    return BaseTracer.span(spanName, fn);
  }
  static continueTrace(carrier, fn) {
    const proxy = BaseTracer._getProxyProvider();
    const ctx = extract(carrier);
    return proxy.withContext(ctx, () => fn(ctx));
  }
  static observe(funcOrOptions, options) {
    let func;
    if (typeof funcOrOptions === "function") {
      func = funcOrOptions;
    } else {
      options = funcOrOptions;
    }
    const {
      spanType = "span",
      spanName,
      recordInput = true,
      recordOutput = true,
      fork = false
    } = options ?? {};
    const proxy = BaseTracer._getProxyProvider();
    const decorator = (innerFunc) => {
      const name = spanName ?? innerFunc.name;
      return function(...args) {
        const otelTracer = proxy.getTracer(TRACER_NAME2);
        const shouldFork = fork && proxy.getActiveTracer() !== null && proxy.getCurrentSpan()?.isRecording() === true;
        if (shouldFork) {
          const serializer = BaseTracer._getSerializer();
          const invocationSpan = otelTracer.startSpan(name);
          const invocationCtx = invocationSpan.spanContext();
          if (spanType) {
            invocationSpan.setAttribute("judgment.span_kind" /* JUDGMENT_SPAN_KIND */, spanType);
          }
          const linkedRootAttrs = {
            ["judgment.link.source_trace_id" /* JUDGMENT_LINK_SOURCE_TRACE_ID */]: invocationCtx.traceId,
            ["judgment.link.source_span_id" /* JUDGMENT_LINK_SOURCE_SPAN_ID */]: invocationCtx.spanId
          };
          if (spanType) {
            linkedRootAttrs["judgment.span_kind" /* JUDGMENT_SPAN_KIND */] = spanType;
          }
          const parentlessCtx = proxy.setSpan(proxy.getCurrentContext(), proxy.wrapSpanContext(INVALID_SPAN_CONTEXT3));
          const linkedRoot = otelTracer.startSpan(name, { attributes: linkedRootAttrs }, parentlessCtx);
          const linkedRootCtx = linkedRoot.spanContext();
          invocationSpan.setAttribute("judgment.link.target_trace_id" /* JUDGMENT_LINK_TARGET_TRACE_ID */, linkedRootCtx.traceId);
          invocationSpan.setAttribute("judgment.link.target_span_id" /* JUDGMENT_LINK_TARGET_SPAN_ID */, linkedRootCtx.spanId);
          const endBoth = () => {
            linkedRoot.end();
            invocationSpan.end();
          };
          const recordErrorOnBoth = (e) => {
            for (const s of [linkedRoot, invocationSpan]) {
              s.recordException(e);
              s.setStatus({
                code: SpanStatusCode3.ERROR,
                message: String(e)
              });
            }
          };
          const recordOutputOnBoth = (value) => {
            const serialized = serializeAttribute(value, serializer);
            linkedRoot.setAttribute("judgment.output" /* JUDGMENT_OUTPUT */, serialized);
            invocationSpan.setAttribute("judgment.output" /* JUDGMENT_OUTPUT */, serialized);
          };
          if (recordInput) {
            const serializedInput = serializeAttribute(getInputs(innerFunc, args), serializer);
            linkedRoot.setAttribute("judgment.input" /* JUDGMENT_INPUT */, serializedInput);
            invocationSpan.setAttribute("judgment.input" /* JUDGMENT_INPUT */, serializedInput);
          }
          BaseTracer._emitPartial();
          return proxy.useSpan(linkedRoot, false, false, false, () => {
            try {
              const result = innerFunc.call(this, ...args);
              if (result instanceof Promise) {
                return result.then((res) => {
                  if (recordOutput)
                    recordOutputOnBoth(res);
                  return res;
                }).catch((e) => {
                  recordErrorOnBoth(e);
                  throw e;
                }).finally(endBoth);
              }
              if (recordOutput)
                recordOutputOnBoth(result);
              endBoth();
              return result;
            } catch (e) {
              recordErrorOnBoth(e);
              endBoth();
              throw e;
            }
          });
        }
        return otelTracer.startActiveSpan(name, (span) => {
          if (spanType) {
            span.setAttribute("judgment.span_kind" /* JUDGMENT_SPAN_KIND */, spanType);
          }
          try {
            if (recordInput) {
              span.setAttribute("judgment.input" /* JUDGMENT_INPUT */, serializeAttribute(getInputs(innerFunc, args), BaseTracer._getSerializer()));
            }
            BaseTracer._emitPartial();
            const result = innerFunc.call(this, ...args);
            if (result instanceof Promise) {
              return result.then((res) => {
                if (recordOutput) {
                  span.setAttribute("judgment.output" /* JUDGMENT_OUTPUT */, serializeAttribute(res, BaseTracer._getSerializer()));
                }
                return res;
              }).catch((e) => {
                span.recordException(e);
                span.setStatus({
                  code: SpanStatusCode3.ERROR,
                  message: String(e)
                });
                throw e;
              }).finally(() => {
                span.end();
              });
            }
            if (recordOutput) {
              span.setAttribute("judgment.output" /* JUDGMENT_OUTPUT */, serializeAttribute(result, BaseTracer._getSerializer()));
            }
            span.end();
            return result;
          } catch (e) {
            span.recordException(e);
            span.setStatus({ code: SpanStatusCode3.ERROR, message: String(e) });
            span.end();
            throw e;
          }
        });
      };
    };
    if (!func)
      return decorator;
    return decorator(func);
  }
  static _resolveSpan(span) {
    if (span)
      return span;
    return BaseTracer._getProxyProvider().getCurrentSpan();
  }
  static setSpanKind(kind, span) {
    dontThrow("BaseTracer.setSpanKind", () => {
      if (!kind)
        return;
      const target = BaseTracer._resolveSpan(span);
      if (target?.isRecording()) {
        target.setAttribute("judgment.span_kind" /* JUDGMENT_SPAN_KIND */, kind);
      }
    });
  }
  static setLLMSpan() {
    BaseTracer.setSpanKind("llm");
  }
  static setToolSpan() {
    BaseTracer.setSpanKind("tool");
  }
  static setGeneralSpan() {
    BaseTracer.setSpanKind("span");
  }
  static setAttribute(key, value, span) {
    dontThrow("BaseTracer.setAttribute", () => {
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording())
        return;
      if (!key || value == null)
        return;
      target.setAttribute(key, serializeAttribute(value, BaseTracer._getSerializer()));
    });
  }
  static setAttributes(attributes, span) {
    for (const [key, value] of Object.entries(attributes)) {
      if (span)
        BaseTracer.setAttribute(key, value, span);
      else
        BaseTracer.setAttribute(key, value);
    }
  }
  static setInput(inputData, span) {
    if (span)
      BaseTracer.setAttribute("judgment.input" /* JUDGMENT_INPUT */, inputData, span);
    else
      BaseTracer.setAttribute("judgment.input" /* JUDGMENT_INPUT */, inputData);
  }
  static setOutput(outputData, span) {
    if (span)
      BaseTracer.setAttribute("judgment.output" /* JUDGMENT_OUTPUT */, outputData, span);
    else
      BaseTracer.setAttribute("judgment.output" /* JUDGMENT_OUTPUT */, outputData);
  }
  static setError(error, span) {
    dontThrow("BaseTracer.setError", () => {
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording())
        return;
      target.recordException(error);
      target.setStatus({ code: SpanStatusCode3.ERROR, message: String(error) });
    });
  }
  static recordLLMMetadata(metadata, span) {
    dontThrow("BaseTracer.recordLLMMetadata", () => {
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording())
        return;
      if (typeof metadata.model === "string") {
        target.setAttribute("judgment.llm.model" /* JUDGMENT_LLM_MODEL_NAME */, metadata.model);
      }
      if (typeof metadata.provider === "string") {
        target.setAttribute("judgment.llm.provider" /* JUDGMENT_LLM_PROVIDER */, metadata.provider);
      }
      if (typeof metadata.non_cached_input_tokens === "number") {
        target.setAttribute("judgment.usage.non_cached_input_tokens" /* JUDGMENT_USAGE_NON_CACHED_INPUT_TOKENS */, metadata.non_cached_input_tokens);
      }
      if (typeof metadata.output_tokens === "number") {
        target.setAttribute("judgment.usage.output_tokens" /* JUDGMENT_USAGE_OUTPUT_TOKENS */, metadata.output_tokens);
      }
      if (typeof metadata.cache_read_input_tokens === "number") {
        target.setAttribute("judgment.usage.cache_read_input_tokens" /* JUDGMENT_USAGE_CACHE_READ_INPUT_TOKENS */, metadata.cache_read_input_tokens);
      }
      if (typeof metadata.cache_creation_input_tokens === "number") {
        target.setAttribute("judgment.usage.cache_creation_input_tokens" /* JUDGMENT_USAGE_CACHE_CREATION_INPUT_TOKENS */, metadata.cache_creation_input_tokens);
      }
      if (typeof metadata.total_cost_usd === "number") {
        target.setAttribute("judgment.usage.total_cost_usd" /* JUDGMENT_USAGE_TOTAL_COST_USD */, metadata.total_cost_usd);
      }
    });
  }
  static _setPropagatingBaggageKey(key, value) {
    dontThrow("BaseTracer._setPropagatingBaggageKey", () => {
      const proxy = BaseTracer._getProxyProvider();
      const currentSpan = proxy.getCurrentSpan();
      if (!currentSpan?.isRecording())
        return;
      currentSpan.setAttribute(key, value);
      const ctx = proxy.getCurrentContext();
      const baggage = (getBaggage(ctx) ?? createBaggage()).setEntry(key, {
        value
      });
      proxy.attachContext(setBaggage(ctx, baggage));
    });
  }
  static setCustomerId(customerId) {
    BaseTracer._setPropagatingBaggageKey("judgment.customer_id" /* JUDGMENT_CUSTOMER_ID */, customerId);
  }
  static setCustomerUserId(customerUserId) {
    BaseTracer._setPropagatingBaggageKey("judgment.customer_user_id" /* JUDGMENT_CUSTOMER_USER_ID */, customerUserId);
  }
  static setSessionId(sessionId) {
    BaseTracer._setPropagatingBaggageKey("judgment.session_id" /* JUDGMENT_SESSION_ID */, sessionId);
  }
  static tag(tags) {
    dontThrow("BaseTracer.tag", () => {
      if (!tags || Array.isArray(tags) && tags.length === 0)
        return;
      const proxy = BaseTracer._getProxyProvider();
      const tracer = proxy.getActiveTracer();
      if (!tracer?.projectId || !tracer._client)
        return;
      if (!tracer.supportsLiveInstrumentation)
        return;
      const ids = BaseTracer._getCurrentTraceAndSpanId();
      if (!ids)
        return;
      const [traceId] = ids;
      const tagArray = Array.isArray(tags) ? tags : [tags];
      tracer._client.postV1projectsTracesByTraceIdTags(tracer.projectId, traceId, {
        tags: tagArray
      }).catch((err) => {
        Logger.error(`tag failed: ${String(err)}`);
      });
    });
  }
  static asyncEvaluate(options, span) {
    dontThrow("BaseTracer.asyncEvaluate", () => {
      const { judge, example } = options;
      const proxy = BaseTracer._getProxyProvider();
      const tracer = proxy.getActiveTracer();
      if (!tracer?.projectId)
        return;
      if (!tracer.supportsLiveInstrumentation)
        return;
      const target = BaseTracer._resolveSpan(span);
      if (!target?.isRecording())
        return;
      const processor = tracer.getSpanProcessor();
      const ctx = target.spanContext();
      const idx = processor.stateIncr(ctx, "pending_evals_count" /* PENDING_EVALS_COUNT */);
      const payload = {
        project_id: tracer.projectId,
        eval_name: `async_evaluate_${judge}_${idx}`,
        judges: [{ name: judge }],
        examples: [
          {
            ...example,
            example_id: createRandomUUID(),
            created_at: new Date().toISOString(),
            trace_id: ctx.traceId,
            span_id: ctx.spanId
          }
        ],
        is_offline: false,
        is_behavior: false
      };
      const updated = processor.stateAppend(ctx, "pending_evals" /* PENDING_EVALS */, payload);
      target.setAttribute("judgment.pending_trace_eval" /* JUDGMENT_PENDING_TRACE_EVAL */, JSON.stringify(updated));
    });
  }
}
function getInputs(f, args) {
  try {
    const paramNames = parseFunctionArgs(f).map((param) => param.replace(/^\.\.\./, "").split("=")[0].trim()).filter((param) => param.length > 0);
    const inputs = {};
    paramNames.forEach((name, index) => {
      if (index < args.length) {
        inputs[name] = args[index];
      }
    });
    return inputs;
  } catch {
    return {};
  }
}
var TRACER_NAME2 = "judgeval";
var init_BaseTracer = __esm(() => {
  init_JudgmentAttributeKeys();
  init_annotate();
  init_dont_throw();
  init_logger();
  init_serializer();
  init_baggage();
  init_propagation();
  init_runtime();
});

// src/trace/exporters/JudgmentSpanExporter.ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

class JudgmentSpanExporter {
  _delegate;
  constructor(endpoint, apiKey, organizationId, projectId) {
    if (!endpoint) {
      this._delegate = null;
      return;
    }
    this._delegate = new OTLPTraceExporter({
      url: endpoint,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Organization-Id": organizationId,
        "X-Project-Id": projectId
      }
    });
  }
  export(spans, resultCallback) {
    Logger.info(`Exported ${spans.length} spans`);
    this._delegate?.export(spans, resultCallback);
  }
  shutdown() {
    return this._delegate?.shutdown() ?? Promise.resolve();
  }
  forceFlush() {
    return this._delegate?.forceFlush() ?? Promise.resolve();
  }
}
var init_JudgmentSpanExporter = __esm(() => {
  init_logger();
});

// src/trace/exporters/NoOpSpanExporter.ts
import { ExportResultCode } from "@opentelemetry/core";
var NoOpSpanExporter;
var init_NoOpSpanExporter = __esm(() => {
  init_JudgmentSpanExporter();
  NoOpSpanExporter = class NoOpSpanExporter extends JudgmentSpanExporter {
    constructor() {
      super("", "", "", "");
    }
    export(_spans, resultCallback) {
      resultCallback({ code: ExportResultCode.SUCCESS });
    }
    shutdown() {
      return Promise.resolve();
    }
    forceFlush() {
      return Promise.resolve();
    }
  };
});

// src/trace/processors/JudgmentBaggageSpanProcessor.ts
class JudgmentBaggageSpanProcessor {
  _keyPredicate;
  constructor(keyPredicate = ALLOW_ALL_BAGGAGE_KEYS) {
    this._keyPredicate = keyPredicate;
  }
  onStart(span, parentContext) {
    const entries = getBaggage(parentContext)?.getAllEntries() ?? [];
    for (const [key, entry] of entries) {
      if (this._keyPredicate(key)) {
        span.setAttribute(key, entry.value);
      }
    }
  }
  onEnd(_span) {}
  forceFlush() {
    return Promise.resolve();
  }
  shutdown() {
    return Promise.resolve();
  }
}
var ALLOW_ALL_BAGGAGE_KEYS = () => true;
var init_JudgmentBaggageSpanProcessor = __esm(() => {
  init_baggage();
});

// src/trace/processors/JudgmentSpanProcessor.ts
import {
  BatchSpanProcessor
} from "@opentelemetry/sdk-trace-base";
function makeSpanKey(ctx) {
  return `${ctx.traceId}:${ctx.spanId}`;
}
function isZeroHrTime(hrTime) {
  return hrTime[0] === 0 && hrTime[1] === 0;
}
var JudgmentSpanProcessor;
var init_JudgmentSpanProcessor = __esm(() => {
  init_JudgmentAttributeKeys();
  init_dont_throw();
  init_runtime();
  init_JudgmentBaggageSpanProcessor();
  JudgmentSpanProcessor = class JudgmentSpanProcessor extends BatchSpanProcessor {
    tracer;
    _state = new Map;
    _spanFinalizers;
    _baggageProcessor;
    constructor(tracer, exporter, config) {
      super(exporter, config);
      this.tracer = tracer;
      this._spanFinalizers = new FinalizationRegistry((spanKey) => {
        this._cleanupSpanState(spanKey);
      });
      this._baggageProcessor = new JudgmentBaggageSpanProcessor;
    }
    _cleanupSpanState(spanKey) {
      this._state.delete(spanKey);
    }
    _registerSpan(span) {
      const ctx = span.spanContext();
      if (!ctx.traceId || !ctx.spanId)
        return;
      const spanKey = makeSpanKey(ctx);
      this._spanFinalizers.register(span, spanKey);
    }
    stateSet(spanContext, key, value) {
      const spanKey = makeSpanKey(spanContext);
      let attrs = this._state.get(spanKey);
      if (!attrs) {
        attrs = new Map;
        this._state.set(spanKey, attrs);
      }
      attrs.set(key, value);
    }
    stateGet(spanContext, key, defaultValue) {
      const spanKey = makeSpanKey(spanContext);
      const attrs = this._state.get(spanKey);
      if (!attrs?.has(key))
        return defaultValue;
      return attrs.get(key);
    }
    stateIncr(spanContext, key) {
      const spanKey = makeSpanKey(spanContext);
      let attrs = this._state.get(spanKey);
      if (!attrs) {
        attrs = new Map;
        this._state.set(spanKey, attrs);
      }
      const stored = attrs.get(key);
      const prev = typeof stored === "number" ? stored : 0;
      attrs.set(key, prev + 1);
      return prev;
    }
    stateAppend(spanContext, key, item) {
      const spanKey = makeSpanKey(spanContext);
      let attrs = this._state.get(spanKey);
      if (!attrs) {
        attrs = new Map;
        this._state.set(spanKey, attrs);
      }
      const stored = attrs.get(key);
      const list = Array.isArray(stored) ? [...stored, item] : [item];
      attrs.set(key, list);
      return list;
    }
    _emitSpan(span, isPartial = false) {
      const ctx = span.spanContext();
      if (!ctx.traceId)
        return;
      const currId = this.stateIncr(ctx, "judgment.update_id" /* JUDGMENT_UPDATE_ID */);
      const attributes = {
        ...span.attributes,
        ["judgment.update_id" /* JUDGMENT_UPDATE_ID */]: currId
      };
      if (isPartial) {
        delete attributes["judgment.pending_trace_eval" /* JUDGMENT_PENDING_TRACE_EVAL */];
      }
      const emittedSpan = Object.create(span);
      Object.defineProperty(emittedSpan, "attributes", {
        value: attributes,
        writable: false
      });
      const endTime = isZeroHrTime(span.endTime) ? span.startTime : span.endTime;
      Object.defineProperty(emittedSpan, "endTime", {
        value: endTime,
        writable: false
      });
      super.onEnd(emittedSpan);
    }
    emitPartial() {
      dontThrow("JudgmentSpanProcessor.emitPartial", () => {
        const span = getTraceRuntime().getCurrentSpan();
        if (!span?.isRecording())
          return;
        const ctx = span.spanContext();
        if (!ctx.traceId)
          return;
        if (this.stateGet(ctx, "disable_partial_emit" /* DISABLE_PARTIAL_EMIT */, false)) {
          return;
        }
        this._emitSpan(span, true);
      });
    }
    onStart(span, parentContext) {
      dontThrow("JudgmentSpanProcessor.onStart", () => {
        this._baggageProcessor.onStart(span, parentContext);
        this._registerSpan(span);
      });
    }
    onEnd(span) {
      dontThrow("JudgmentSpanProcessor.onEnd", () => {
        const ctx = span.spanContext();
        if (!ctx.traceId) {
          super.onEnd(span);
          return;
        }
        const spanKey = makeSpanKey(ctx);
        try {
          const isCancelled = this.stateGet(ctx, "cancelled" /* CANCELLED */, false);
          if (!isCancelled) {
            this._emitSpan(span);
          }
        } finally {
          this._cleanupSpanState(spanKey);
        }
      });
    }
  };
});

// src/trace/processors/NoOpSpanProcessor.ts
var NoOpSpanProcessor;
var init_NoOpSpanProcessor = __esm(() => {
  init_NoOpSpanExporter();
  init_JudgmentSpanProcessor();
  NoOpSpanProcessor = class NoOpSpanProcessor extends JudgmentSpanProcessor {
    constructor() {
      super(null, new NoOpSpanExporter);
    }
    onStart(_span, _parentContext) {}
    onEnd(_span) {}
    shutdown() {
      return Promise.resolve();
    }
    forceFlush() {
      return Promise.resolve();
    }
    emitPartial() {}
    stateSet(_spanContext, _key, _value) {}
    stateGet(_spanContext, _key, defaultValue) {
      return defaultValue;
    }
    stateIncr(_spanContext, _key) {
      return 0;
    }
    stateAppend(_spanContext, _key, item) {
      return [item];
    }
  };
});

// src/trace/Tracer.ts
import {
  defaultResource,
  resourceFromAttributes
} from "@opentelemetry/resources";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
var Tracer;
var init_Tracer = __esm(() => {
  init_env();
  init_api();
  init_logger();
  init_resolve_project_id();
  init_serializer();
  init_version();
  init_BaseTracer();
  init_JudgmentTracerProvider();
  init_JudgmentSpanExporter();
  init_NoOpSpanExporter();
  init_JudgmentSpanProcessor();
  init_NoOpSpanProcessor();
  Tracer = class Tracer extends BaseTracer {
    _spanExporter = null;
    _spanProcessor = null;
    constructor(projectName, projectId, apiKey, organizationId, apiUrl, environment, serializer, tracerProvider, client2, enableMonitoring) {
      super(projectName, projectId, apiKey, organizationId, apiUrl, environment, serializer, tracerProvider, client2, enableMonitoring);
    }
    static async init(config = {}) {
      const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
      const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
      const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;
      const projectName = config.projectName ?? null;
      const serializer = config.serializer ?? safeStringify;
      let enableMonitoring = true;
      if (!projectName) {
        Logger.warning("project_name not provided. Tracer will not export spans.");
        enableMonitoring = false;
      }
      if (!apiKey) {
        Logger.warning("api_key not provided. Tracer will not export spans.");
        enableMonitoring = false;
      }
      if (!organizationId) {
        Logger.warning("organization_id not provided. Tracer will not export spans.");
        enableMonitoring = false;
      }
      if (!apiUrl) {
        Logger.warning("api_url not provided. Tracer will not export spans.");
        enableMonitoring = false;
      }
      let client2 = null;
      let projectId = null;
      if (enableMonitoring && projectName && apiKey && organizationId && apiUrl) {
        client2 = new JudgmentApiClient(apiUrl, apiKey, organizationId);
        projectId = await resolveProjectId(client2, projectName).catch(() => null);
        if (!projectId) {
          Logger.warning(`Project '${projectName}' not found. Tracer will not export spans.`);
          enableMonitoring = false;
        }
      }
      const resourceAttrs = {
        "service.name": projectName ?? "unknown",
        "telemetry.sdk.name": "judgeval",
        "telemetry.sdk.version": VERSION
      };
      if (config.environment) {
        resourceAttrs["deployment.environment"] = config.environment;
      }
      if (config.resourceAttributes) {
        Object.assign(resourceAttrs, config.resourceAttributes);
      }
      const resource = defaultResource().merge(resourceFromAttributes(resourceAttrs));
      const tracerProvider = new NodeTracerProvider({
        resource,
        sampler: config.sampler,
        spanLimits: config.spanLimits
      });
      const tracer = new Tracer(projectName, projectId, apiKey, organizationId, apiUrl, config.environment ?? null, serializer, tracerProvider, client2, enableMonitoring);
      if (enableMonitoring) {
        const providerWithProcessor = new NodeTracerProvider({
          resource,
          sampler: config.sampler,
          spanLimits: config.spanLimits,
          spanProcessors: [
            tracer.getSpanProcessor(),
            ...config.spanProcessors ?? []
          ]
        });
        tracer._tracerProvider = providerWithProcessor;
      }
      const proxy = JudgmentTracerProvider.getInstance();
      proxy.register(tracer);
      if (config.setActive ?? true) {
        tracer.setActive();
      }
      return tracer;
    }
    getSpanExporter() {
      if (this._spanExporter)
        return this._spanExporter;
      if (!this._enableMonitoring || !this.projectId || !this.apiKey || !this.organizationId || !this.apiUrl) {
        this._spanExporter = new NoOpSpanExporter;
      } else {
        const endpoint = this.apiUrl.endsWith("/") ? this.apiUrl + "otel/v1/traces" : this.apiUrl + "/otel/v1/traces";
        this._spanExporter = new JudgmentSpanExporter(endpoint, this.apiKey, this.organizationId, this.projectId);
      }
      return this._spanExporter;
    }
    getSpanProcessor() {
      if (this._spanProcessor)
        return this._spanProcessor;
      if (!this._enableMonitoring) {
        this._spanProcessor = new NoOpSpanProcessor;
      } else {
        this._spanProcessor = new JudgmentSpanProcessor(this, this.getSpanExporter());
      }
      return this._spanProcessor;
    }
  };
});

// src/trace/processors/OfflineJudgmentSpanProcessor.ts
var OfflineJudgmentSpanProcessor;
var init_OfflineJudgmentSpanProcessor = __esm(() => {
  init_Example();
  init_JudgmentSpanProcessor();
  OfflineJudgmentSpanProcessor = class OfflineJudgmentSpanProcessor extends JudgmentSpanProcessor {
    _dataset;
    _exampleFields;
    _seenTraceIds = new Set;
    constructor(tracer, exporter, options) {
      super(tracer, exporter);
      this._dataset = options.dataset;
      this._exampleFields = { ...options.exampleFields ?? {} };
    }
    _maybeCreateExample(span) {
      if (span.parentSpanContext)
        return;
      const ctx = span.spanContext();
      if (!ctx?.traceId)
        return;
      if (this._seenTraceIds.has(ctx.traceId))
        return;
      this._seenTraceIds.add(ctx.traceId);
      const example = Example.create({
        ...this._exampleFields,
        offline_trace_id: ctx.traceId
      });
      this._dataset.push(example);
    }
    onEnd(span) {
      try {
        this._maybeCreateExample(span);
      } finally {
        super.onEnd(span);
      }
    }
  };
});

// src/trace/OfflineTracer.ts
var exports_OfflineTracer = {};
__export(exports_OfflineTracer, {
  OfflineTracer: () => OfflineTracer
});
import {
  defaultResource as defaultResource2,
  resourceFromAttributes as resourceFromAttributes2
} from "@opentelemetry/resources";
import { NodeTracerProvider as NodeTracerProvider2 } from "@opentelemetry/sdk-trace-node";
var OFFLINE_TRACES_PATH = "otel/v1/offline-traces", OfflineTracer;
var init_OfflineTracer = __esm(() => {
  init_env();
  init_api();
  init_resolve_project_id();
  init_serializer();
  init_version();
  init_JudgmentTracerProvider();
  init_Tracer();
  init_JudgmentSpanExporter();
  init_OfflineJudgmentSpanProcessor();
  OfflineTracer = class OfflineTracer extends Tracer {
    supportsLiveInstrumentation = false;
    _offlineApiUrl;
    _offlineApiKey;
    _offlineOrganizationId;
    _offlineProjectId;
    _dataset;
    _exampleFields;
    _offlineSpanExporter = null;
    _offlineSpanProcessor = null;
    constructor(args) {
      super(args.projectName, args.projectId, args.apiKey, args.organizationId, args.apiUrl, args.environment, args.serializer, args.tracerProvider, args.client, true);
      this._offlineApiUrl = args.apiUrl;
      this._offlineApiKey = args.apiKey;
      this._offlineOrganizationId = args.organizationId;
      this._offlineProjectId = args.projectId;
      this._dataset = args.dataset;
      this._exampleFields = args.exampleFields;
    }
    static async create(config) {
      const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
      const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
      const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;
      const projectName = config.projectName;
      const serializer = config.serializer ?? safeStringify;
      if (!projectName) {
        throw new Error("projectName is required for OfflineTracer");
      }
      if (!apiKey) {
        throw new Error("apiKey is required for OfflineTracer");
      }
      if (!organizationId) {
        throw new Error("organizationId is required for OfflineTracer");
      }
      if (!apiUrl) {
        throw new Error("apiUrl is required for OfflineTracer");
      }
      const client2 = new JudgmentApiClient(apiUrl, apiKey, organizationId);
      let projectId;
      try {
        projectId = await resolveProjectId(client2, projectName);
      } catch (err) {
        throw new Error(`Project '${projectName}' not found; cannot start OfflineTracer: ${String(err)}`);
      }
      const resourceAttrs = {
        "service.name": projectName,
        "telemetry.sdk.name": "judgeval",
        "telemetry.sdk.version": VERSION,
        "judgment.offline": "true"
      };
      if (config.environment) {
        resourceAttrs["deployment.environment"] = config.environment;
      }
      if (config.resourceAttributes) {
        Object.assign(resourceAttrs, config.resourceAttributes);
      }
      const resource = defaultResource2().merge(resourceFromAttributes2(resourceAttrs));
      const tracer = new OfflineTracer({
        projectName,
        projectId,
        apiKey,
        organizationId,
        apiUrl,
        environment: config.environment ?? null,
        serializer,
        tracerProvider: new NodeTracerProvider2({ resource }),
        client: client2,
        dataset: config.dataset,
        exampleFields: { ...config.exampleFields ?? {} }
      });
      const providerWithProcessor = new NodeTracerProvider2({
        resource,
        sampler: config.sampler,
        spanLimits: config.spanLimits,
        spanProcessors: [
          tracer.getSpanProcessor(),
          ...config.spanProcessors ?? []
        ]
      });
      tracer._tracerProvider = providerWithProcessor;
      const proxy = JudgmentTracerProvider.getInstance();
      proxy.register(tracer);
      if (config.setActive ?? true) {
        tracer.setActive();
      }
      return tracer;
    }
    getSpanExporter() {
      if (this._offlineSpanExporter)
        return this._offlineSpanExporter;
      const base = this._offlineApiUrl.endsWith("/") ? this._offlineApiUrl + OFFLINE_TRACES_PATH : this._offlineApiUrl + "/" + OFFLINE_TRACES_PATH;
      this._offlineSpanExporter = new JudgmentSpanExporter(base, this._offlineApiKey, this._offlineOrganizationId, this._offlineProjectId);
      return this._offlineSpanExporter;
    }
    getSpanProcessor() {
      if (this._offlineSpanProcessor)
        return this._offlineSpanProcessor;
      this._offlineSpanProcessor = new OfflineJudgmentSpanProcessor(this, this.getSpanExporter(), {
        dataset: this._dataset,
        exampleFields: this._exampleFields
      });
      return this._offlineSpanProcessor;
    }
  };
});

// src/Judgeval.ts
init_env();
init_api();
init_resolve_project_id();
init_logger();

// src/judges/Judge.ts
class Judge {
}

// src/evaluation/Evaluation.ts
init_logger();

// src/evaluation/LocalEvaluatorRunner.ts
var import_picocolors2 = __toESM(require_picocolors(), 1);

// src/evaluation/EvaluatorRunner.ts
init_logger();
var import_picocolors = __toESM(require_picocolors(), 1);
var POLL_INTERVAL_MS = 2000;

class EvaluatorRunner {
  _client;
  _projectId;
  _projectName;
  constructor(client2, projectId, projectName) {
    this._client = client2;
    this._projectId = projectId;
    this._projectName = projectName;
  }
  async _poll(projectId, evalId, expectedCount, timeoutSeconds) {
    const startTime = Date.now();
    while (true) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > timeoutSeconds) {
        throw new Error(`Evaluation timed out after ${timeoutSeconds}s`);
      }
      const response = await this._client.getV1projectsExperimentsByRunId(projectId, evalId);
      const resultsData = response.results ?? [];
      const completed = resultsData.length;
      if (completed >= expectedCount) {
        const url = response.ui_results_url ?? "Failed to get UI results URL";
        console.log(`${import_picocolors.default.green("✓")} Evals completed and saved in ${import_picocolors.default.bold(`${elapsed.toFixed(1)}s`)}`);
        return { results: resultsData, url };
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  _displayResults(examples, resultsData, url, assertTest) {
    const results = [];
    let passed = 0;
    let failed = 0;
    console.log();
    for (let i = 0;i < resultsData.length; i++) {
      const res = resultsData[i];
      const success = res.scorers.every((s) => Boolean(s.success));
      if (success) {
        passed++;
        console.log(`${import_picocolors.default.green("✓")} Example ${i + 1}: ${import_picocolors.default.green("PASSED")}`);
      } else {
        failed++;
        console.log(`${import_picocolors.default.red("✗")} Example ${i + 1}: ${import_picocolors.default.red("FAILED")}`);
      }
      for (const s of res.scorers) {
        const scoreStr = s.score !== null ? s.score.toFixed(3) : "N/A";
        const colored = s.success ? import_picocolors.default.green(scoreStr) : import_picocolors.default.red(scoreStr);
        console.log(`  ${import_picocolors.default.dim(`${s.name}:`)} ${colored} ${import_picocolors.default.dim(`(threshold: ${s.threshold})`)}`);
      }
      results.push({ success, scorers: res.scorers, example: examples[i] });
    }
    console.log();
    if (passed === results.length) {
      console.log(`${import_picocolors.default.bold(import_picocolors.default.green("✓ All tests passed!"))} (${passed}/${results.length})`);
    } else {
      console.log(`${import_picocolors.default.bold(import_picocolors.default.yellow("⚠ Results:"))} ${import_picocolors.default.green(`${passed} passed`)} | ${import_picocolors.default.red(`${failed} failed`)}`);
    }
    console.log(`${import_picocolors.default.dim("View full details:")} ${import_picocolors.default.underline(url)}`);
    console.log();
    if (assertTest && results.some((r) => !r.success)) {
      const lines = [
        `Evaluation failed: ${failed}/${results.length} examples failed`
      ];
      for (let i = 0;i < results.length; i++) {
        if (!results[i].success) {
          lines.push(`  Example ${i + 1}:`);
          for (const s of results[i].scorers) {
            if (!s.success) {
              lines.push(`    ${s.name}: ${s.score !== null ? s.score.toFixed(3) : "N/A"} (threshold: ${s.threshold})`);
              if (s.reason)
                lines.push(`      ${s.reason}`);
            }
          }
        }
      }
      throw new Error(lines.join(`
`));
    }
    return results;
  }
  async run(examples, scorers, evalRunName, assertTest = false, timeoutSeconds = 300) {
    if (!this._projectId) {
      Logger.error("Project ID is not resolved. Evaluation requires a valid project.");
      return [];
    }
    const projectId = this._projectId;
    const evalId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    console.log();
    console.log(import_picocolors.default.bold(import_picocolors.default.cyan("Starting Evaluation")));
    console.log(`${import_picocolors.default.dim("Run:")} ${evalRunName}`);
    console.log(`${import_picocolors.default.dim("Project:")} ${this._projectName}`);
    console.log(`${import_picocolors.default.dim("Examples:")} ${examples.length} | ${import_picocolors.default.dim("Scorers:")} ${scorers.length}`);
    console.log();
    const payload = this._buildPayload(evalId, projectId, evalRunName, createdAt, examples, scorers);
    const expectedCount = await this._submit(projectId, evalId, examples, scorers, payload);
    const { results: resultsData, url } = await this._poll(projectId, evalId, expectedCount, timeoutSeconds);
    return this._displayResults(examples, resultsData, url, assertTest);
  }
}

// src/evaluation/LocalEvaluatorRunner.ts
class LocalEvaluatorRunner extends EvaluatorRunner {
  _buildPayload(evalId, projectId, evalRunName, createdAt, examples, _scorers) {
    return {
      id: evalId,
      project_id: projectId,
      eval_name: evalRunName,
      created_at: createdAt,
      examples: examples.map((e) => e.toJSON()),
      judgment_scorers: [],
      custom_scorers: []
    };
  }
  async _submit(projectId, _evalId, examples, scorers, payload) {
    const startTime = Date.now();
    const jobs = examples.flatMap((example, exampleIdx) => scorers.map((scorer) => scorer.score(example).then((result) => ({
      exampleIdx,
      scorer,
      result,
      error: null
    })).catch((err) => ({
      exampleIdx,
      scorer,
      result: null,
      error: String(err)
    }))));
    const jobResults = await Promise.all(jobs);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`${import_picocolors2.default.green("✓")} Scoring completed in ${import_picocolors2.default.bold(`${elapsed}s`)}`);
    const byExample = new Map;
    for (const jr of jobResults) {
      let list = byExample.get(jr.exampleIdx);
      if (!list) {
        list = [];
        byExample.set(jr.exampleIdx, list);
      }
      list.push(jr);
    }
    const apiResults = examples.map((example, i) => {
      const entries = byExample.get(i) ?? [];
      return {
        scorers_data: entries.map((jr) => {
          if (jr.error !== null) {
            return {
              scorer_name: jr.scorer.constructor.name,
              value: 0,
              reason: "",
              error: jr.error
            };
          }
          const r = jr.result;
          return {
            scorer_name: jr.scorer.constructor.name,
            value: r.value,
            reason: r.reason,
            ...r.citations && {
              citations: r.citations.map((c) => ({
                span_id: c.spanId,
                span_attribute: c.spanAttribute
              }))
            }
          };
        }),
        data_object: example.toJSON()
      };
    });
    await this._client.postV1projectsEvalResultsExamples(projectId, {
      results: apiResults,
      run: payload
    });
    return examples.length;
  }
}

// src/evaluation/HostedEvaluatorRunner.ts
var import_picocolors3 = __toESM(require_picocolors(), 1);
class HostedEvaluatorRunner extends EvaluatorRunner {
  _buildPayload(evalId, projectId, evalRunName, createdAt, examples, scorers) {
    return {
      id: evalId,
      project_id: projectId,
      eval_name: evalRunName,
      created_at: createdAt,
      examples: examples.map((e) => e.toJSON()),
      judgment_scorers: scorers.map((name) => ({ name })),
      custom_scorers: []
    };
  }
  async _submit(projectId, _evalId, examples, _scorers, payload) {
    await this._client.postV1projectsEvalQueueExamples(projectId, payload);
    console.log(`${import_picocolors3.default.green("✓")} Evaluation submitted`);
    return examples.length;
  }
}

// src/evaluation/Evaluation.ts
class Evaluation {
  _local;
  _hosted;
  constructor(client2, projectId, projectName) {
    this._local = new LocalEvaluatorRunner(client2, projectId, projectName);
    this._hosted = new HostedEvaluatorRunner(client2, projectId, projectName);
  }
  run(options) {
    const {
      examples,
      scorers,
      evalRunName,
      assertTest = false,
      timeoutSeconds = 300
    } = options;
    const hostedScorers = scorers.filter((s) => typeof s === "string");
    const localScorers = scorers.filter((s) => s instanceof Judge);
    if (localScorers.length > 0 && hostedScorers.length > 0) {
      Logger.error("Running both local and hosted scorers is not supported. " + "Please run your evaluation with either local or hosted scorers, but not both.");
      return Promise.resolve([]);
    }
    if (localScorers.length === 0 && hostedScorers.length === 0) {
      Logger.error("No valid local or hosted scorers provided. " + "Please provide at least one local or hosted scorer.");
      return Promise.resolve([]);
    }
    if (localScorers.length > 0) {
      return this._local.run(examples, localScorers, evalRunName, assertTest, timeoutSeconds);
    }
    return this._hosted.run(examples, hostedScorers, evalRunName, assertTest, timeoutSeconds);
  }
}

// src/evaluation/EvaluationFactory.ts
class EvaluationFactory {
  _client;
  _projectId;
  _projectName;
  constructor(client2, projectId, projectName) {
    this._client = client2;
    this._projectId = projectId;
    this._projectName = projectName;
  }
  create() {
    return new Evaluation(this._client, this._projectId, this._projectName);
  }
}

// src/datasets/DatasetFactory.ts
init_Example();
init_logger();

// src/datasets/Dataset.ts
init_Example();

class Dataset {
  name;
  projectId;
  projectName;
  datasetKind;
  examples;
  _client;
  constructor(opts) {
    this.name = opts.name;
    this.projectId = opts.projectId;
    this.projectName = opts.projectName;
    this.datasetKind = opts.datasetKind ?? "example";
    this.examples = opts.examples ?? [];
    this._client = opts.client ?? null;
  }
  async addExamples(examples, batchSize = 100) {
    if (!this._client)
      return;
    for (let i = 0;i < examples.length; i += batchSize) {
      const batch = examples.slice(i, i + batchSize);
      await this._client.postV1projectsDatasetsByDatasetNameExamples(this.projectId, this.name, { examples: batch.map((e) => e.toJSON()) });
    }
  }
  async addFromJson(filePath, batchSize = 100) {
    const { readFile } = await import("fs/promises");
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    const examples = data.map((item) => {
      if (typeof item !== "object" || item === null) {
        throw new Error("Each item in the JSON array must be an object");
      }
      return Example.create(item);
    });
    await this.addExamples(examples, batchSize);
  }
  get length() {
    return this.examples.length;
  }
  [Symbol.iterator]() {
    return this.examples[Symbol.iterator]();
  }
  toString() {
    return `Dataset(name=${this.name}, examples=${this.examples.length})`;
  }
}

// src/datasets/DatasetFactory.ts
class DatasetFactory {
  _client;
  _projectId;
  _projectName;
  constructor(client2, projectId, projectName) {
    this._client = client2;
    this._projectId = projectId;
    this._projectName = projectName;
  }
  async get(name) {
    const projectId = this._expectProjectId();
    if (!projectId)
      return null;
    const response = await this._client.getV1projectsDatasetsByDatasetName(projectId, name);
    const datasetKind = response.dataset_kind ?? "example";
    const rawExamples = response.examples ?? [];
    const examples = rawExamples.map((e) => Example.from(e));
    return new Dataset({
      name,
      projectId,
      projectName: this._projectName,
      datasetKind,
      examples,
      client: this._client
    });
  }
  async create(name, options = {}) {
    const projectId = this._expectProjectId();
    if (!projectId)
      return null;
    const { examples = [], overwrite = false, batchSize = 100 } = options;
    await this._client.postV1projectsDatasets(projectId, {
      name,
      examples: [],
      dataset_kind: "example",
      overwrite
    });
    const dataset = new Dataset({
      name,
      projectId,
      projectName: this._projectName,
      examples,
      client: this._client
    });
    if (examples.length > 0) {
      await dataset.addExamples(examples, batchSize);
    }
    return dataset;
  }
  list() {
    const projectId = this._expectProjectId();
    if (!projectId)
      return Promise.resolve(null);
    return this._client.getV1projectsDatasets(projectId);
  }
  _expectProjectId() {
    if (!this._projectId) {
      Logger.error("Project ID is not resolved. Dataset operations require a valid project.");
      return null;
    }
    return this._projectId;
  }
}

// src/agent-judges/AgentJudgeFactory.ts
init_logger();

class AgentJudgeFactory {
  _client;
  _projectId;
  _projectName;
  constructor(client2, projectId, projectName) {
    this._client = client2;
    this._projectId = projectId;
    this._projectName = projectName;
  }
  async create(options) {
    const projectId = this._expectProjectId();
    if (!projectId)
      return null;
    const payload = {
      name: options.name,
      prompt: options.prompt,
      model: options.model,
      score_type: options.scoreType
    };
    if (options.description !== undefined)
      payload.description = options.description;
    if (options.judgeDescription !== undefined)
      payload.judge_description = options.judgeDescription;
    if (options.categories !== undefined)
      payload.categories = options.categories;
    if (options.minScore !== undefined)
      payload.min_score = options.minScore;
    if (options.maxScore !== undefined)
      payload.max_score = options.maxScore;
    const response = await this._client.postV1projectsJudges(projectId, payload);
    return {
      judgeId: response.judge_id,
      name: options.name,
      prompt: options.prompt,
      model: options.model,
      scoreType: options.scoreType,
      description: options.description ?? null,
      judgeDescription: options.judgeDescription ?? null,
      categories: options.categories ?? null,
      minScore: options.minScore ?? null,
      maxScore: options.maxScore ?? null,
      majorVersion: 0,
      minorVersion: 0
    };
  }
  async update(options) {
    const projectId = this._expectProjectId();
    if (!projectId)
      return null;
    const payload = {};
    if (options.prompt !== undefined)
      payload.prompt = options.prompt;
    if (options.model !== undefined)
      payload.model = options.model;
    if (options.scoreType !== undefined)
      payload.score_type = options.scoreType;
    if (options.description !== undefined)
      payload.description = options.description;
    if (options.judgeDescription !== undefined)
      payload.judge_description = options.judgeDescription;
    if (options.categories !== undefined)
      payload.categories = options.categories;
    if (options.minScore !== undefined)
      payload.min_score = options.minScore;
    if (options.maxScore !== undefined)
      payload.max_score = options.maxScore;
    if (options.sourceMajorVersion !== undefined)
      payload.source_major_version = options.sourceMajorVersion;
    if (options.sourceMinorVersion !== undefined)
      payload.source_minor_version = options.sourceMinorVersion;
    if (options.targetMajorVersion !== undefined)
      payload.target_major_version = options.targetMajorVersion;
    if (options.targetMinorVersion !== undefined)
      payload.target_minor_version = options.targetMinorVersion;
    const response = await this._client.patchV1projectsJudgesByJudgeId(projectId, options.judgeId, payload);
    return agentJudgeFromDetail(response);
  }
  _expectProjectId() {
    if (!this._projectId) {
      Logger.error("Project ID is not resolved. Agent judge operations require a valid project.");
      return null;
    }
    return this._projectId;
  }
}
function agentJudgeFromDetail(response) {
  const judge = response.judge;
  return {
    judgeId: judge.id,
    name: judge.name,
    prompt: judge.prompt ?? "",
    model: judge.model ?? "",
    scoreType: judge.score_type,
    description: judge.description ?? null,
    judgeDescription: judge.judge_description ?? null,
    categories: judge.categories ?? null,
    minScore: judge.min_score ?? null,
    maxScore: judge.max_score ?? null,
    majorVersion: judge.major_version ?? null,
    minorVersion: judge.minor_version ?? null
  };
}

// src/Judgeval.ts
class Judgeval {
  _client;
  _projectName;
  _projectId;
  constructor(client2, projectName, projectId) {
    this._client = client2;
    this._projectName = projectName;
    this._projectId = projectId;
  }
  static async create(config) {
    const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
    const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
    const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;
    if (!apiKey) {
      throw new Error("API key is required");
    }
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }
    if (!apiUrl) {
      throw new Error("API URL is required");
    }
    if (!config.projectName) {
      throw new Error("Project name is required");
    }
    const client2 = new JudgmentApiClient(apiUrl, apiKey, organizationId);
    let projectId = null;
    try {
      projectId = await resolveProjectId(client2, config.projectName);
    } catch {
      Logger.warning(`Project '${config.projectName}' not found. ` + "Some operations requiring project_id will be skipped.");
    }
    return new Judgeval(client2, config.projectName, projectId);
  }
  async offlineTracer(options) {
    const { OfflineTracer: OfflineTracer2 } = await Promise.resolve().then(() => (init_OfflineTracer(), exports_OfflineTracer));
    return OfflineTracer2.create({
      ...options,
      projectName: this._projectName,
      apiKey: this._client.getApiKey(),
      organizationId: this._client.getOrganizationId(),
      apiUrl: this._client.getBaseUrl()
    });
  }
  get datasets() {
    return new DatasetFactory(this._client, this._projectId, this._projectName);
  }
  get evaluation() {
    return new EvaluationFactory(this._client, this._projectId, this._projectName);
  }
  get agentJudges() {
    return new AgentJudgeFactory(this._client, this._projectId, this._projectName);
  }
}
// src/trace/index.ts
init_BaseTracer();
init_JudgmentSpanExporter();
init_NoOpSpanExporter();
init_JudgmentTracerProvider();
init_JudgmentSpanProcessor();
init_NoOpSpanProcessor();
init_OfflineJudgmentSpanProcessor();
init_JudgmentBaggageSpanProcessor();
init_JudgmentBaggagePropagator();
init_baggage();
init_propagation();
init_Tracer();
init_OfflineTracer();
// src/instrumentation/index.ts
init_runtime();

// src/instrumentation/llm/openai/index.ts
init_dont_throw();

// src/instrumentation/llm/openai/beta-chat-completions.ts
init_BaseTracer();
init_serializer();

// src/utils/wrappers/immutable-wrap-sync.ts
init_dont_throw();
// src/utils/wrappers/immutable-wrap-async.ts
init_dont_throw();
function immutableWrapAsync(fn, hooks = {}) {
  const {
    pre: preFn,
    post: postFn,
    error: errorFn,
    finally: finallyFn
  } = hooks;
  return async function wrapped(...args) {
    const ctx1 = preFn ? dontThrow("immutableWrapAsync.pre", () => preFn(...args)) : undefined;
    let finalCtx;
    try {
      const result = await fn.apply(this, args);
      if (postFn) {
        finalCtx = dontThrow("immutableWrapAsync.post", () => postFn(ctx1, result, args));
      }
      return result;
    } catch (err) {
      if (errorFn) {
        finalCtx = dontThrow("immutableWrapAsync.error", () => errorFn(ctx1, err, args));
      }
      throw err;
    } finally {
      if (finallyFn) {
        dontThrow("immutableWrapAsync.finally", () => {
          finallyFn(finalCtx);
        });
      }
    }
  };
}
// src/utils/wrappers/immutable-wrap-sync-iterator.ts
init_dont_throw();
// src/utils/wrappers/immutable-wrap-async-iterator.ts
init_dont_throw();
function immutableWrapAsyncIterator(fn, hooks = {}) {
  const {
    pre: preFn,
    yield: yieldFn,
    post: postFn,
    error: errorFn,
    finally: finallyFn
  } = hooks;
  return async function* wrapped(...args) {
    const ctx1 = preFn ? dontThrow("immutableWrapAsyncIterator.pre", () => preFn(...args)) : undefined;
    let finalCtx;
    try {
      for await (const value of fn(...args)) {
        if (yieldFn) {
          dontThrow("immutableWrapAsyncIterator.yield", () => {
            yieldFn(ctx1, value);
          });
        }
        yield value;
      }
      if (postFn) {
        finalCtx = dontThrow("immutableWrapAsyncIterator.post", () => postFn(ctx1));
      }
    } catch (err) {
      if (errorFn) {
        finalCtx = dontThrow("immutableWrapAsyncIterator.error", () => errorFn(ctx1, err));
      }
      throw err;
    } finally {
      if (finallyFn) {
        dontThrow("immutableWrapAsyncIterator.finally", () => {
          finallyFn(finalCtx);
        });
      }
    }
  };
}
// src/utils/wrappers/proxy-async-iterable.ts
function proxyAsyncIterable(target, hooks) {
  const original = target[Symbol.asyncIterator].bind(target);
  const wrapped = immutableWrapAsyncIterator(() => ({ [Symbol.asyncIterator]: original }), {
    yield: (_ctx, value) => {
      hooks.onYield(value);
    },
    post: () => {
      hooks.onDone();
    },
    error: (_ctx, err) => {
      hooks.onError(err);
    },
    finally: () => {
      hooks.onFinally();
    }
  });
  target[Symbol.asyncIterator] = () => wrapped();
}
// src/instrumentation/llm/openai/utils.ts
init_JudgmentAttributeKeys();
init_BaseTracer();
init_dont_throw();
init_serializer();
function recordChatUsage(span, usage) {
  dontThrow("recordChatUsage", () => {
    const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? 0;
    const sum = usage.prompt_tokens + usage.completion_tokens + cacheRead;
    BaseTracer.recordLLMMetadata({
      non_cached_input_tokens: sum > usage.total_tokens ? usage.prompt_tokens - cacheRead : usage.prompt_tokens,
      output_tokens: usage.completion_tokens || undefined,
      cache_read_input_tokens: cacheRead || undefined
    }, span);
    BaseTracer.setAttribute("judgment.usage.metadata" /* JUDGMENT_USAGE_METADATA */, safeStringify(usage), span);
  });
}

// src/instrumentation/llm/openai/beta-chat-completions.ts
function wrapChatCompletionsParse(client2) {
  client2.chat.completions.parse = immutableWrapAsync(client2.chat.completions.parse.bind(client2.chat.completions), {
    pre: (body) => {
      const span = BaseTracer.startSpan("OPENAI_API_CALL");
      BaseTracer.setSpanKind("llm", span);
      BaseTracer.recordLLMMetadata({ model: body.model }, span);
      BaseTracer.setInput(body, span);
      return span;
    },
    post: (span, result) => {
      if (!span)
        return;
      BaseTracer.setOutput(safeStringify(result), span);
      if (result.usage)
        recordChatUsage(span, result.usage);
      BaseTracer.recordLLMMetadata({ model: result.model }, span);
      return span;
    },
    error: (span, err) => {
      if (span)
        BaseTracer.setError(err, span);
      return span;
    },
    finally: (span) => {
      span?.end();
    }
  });
}

// src/instrumentation/llm/openai/chat-completions.ts
init_BaseTracer();
init_serializer();
function wrapChatCompletionsCreate(client2) {
  client2.chat.completions.create = immutableWrapAsync(client2.chat.completions.create.bind(client2.chat.completions), {
    pre: (body) => {
      if (body.stream)
        body.stream_options ??= { include_usage: true };
      const span = BaseTracer.startSpan("OPENAI_API_CALL");
      BaseTracer.setSpanKind("llm", span);
      BaseTracer.recordLLMMetadata({ model: body.model }, span);
      BaseTracer.setInput(body, span);
      return { span, proxied: false };
    },
    post: (ctx, result, args) => {
      if (!ctx)
        return;
      const { span } = ctx;
      if (args[0].stream) {
        const stream = result;
        let accumulatedContent = "";
        proxyAsyncIterable(stream, {
          onYield(chunk) {
            if (typeof chunk.choices[0]?.delta.content === "string") {
              accumulatedContent += chunk.choices[0].delta.content;
            }
            if (chunk.usage)
              recordChatUsage(span, chunk.usage);
          },
          onDone() {
            BaseTracer.setOutput(accumulatedContent, span);
          },
          onError(err) {
            BaseTracer.setError(err, span);
          },
          onFinally() {
            span.end();
          }
        });
        return { span, proxied: true };
      }
      const completion = result;
      BaseTracer.setOutput(safeStringify(completion), span);
      if (completion.usage)
        recordChatUsage(span, completion.usage);
      BaseTracer.recordLLMMetadata({ model: completion.model }, span);
      return ctx;
    },
    error: (ctx, err) => {
      if (ctx)
        BaseTracer.setError(err, ctx.span);
      return ctx;
    },
    finally: (ctx) => {
      if (ctx && !ctx.proxied)
        ctx.span.end();
    }
  });
}

// src/instrumentation/llm/openai/images.ts
init_JudgmentAttributeKeys();
init_BaseTracer();
init_dont_throw();
init_serializer();
var IMAGE_COMPLETED_TYPES = new Set([
  "image_generation.completed",
  "image_edit.completed"
]);
function recordUsage(span, usage) {
  dontThrow("images.recordUsage", () => {
    const inputDetails = "input_tokens_details" in usage ? usage.input_tokens_details : undefined;
    const imageInputTokens = inputDetails?.image_tokens ?? 0;
    BaseTracer.recordLLMMetadata({
      non_cached_input_tokens: inputDetails?.text_tokens ?? 0,
      output_tokens: usage.output_tokens || undefined
    }, span);
    if (imageInputTokens) {
      BaseTracer.setAttribute("judgment.usage.non_cached_input_image_tokens" /* JUDGMENT_USAGE_NON_CACHED_INPUT_IMAGE_TOKENS */, imageInputTokens, span);
    }
    if (usage.output_tokens) {
      BaseTracer.setAttribute("judgment.usage.output_image_tokens" /* JUDGMENT_USAGE_OUTPUT_IMAGE_TOKENS */, usage.output_tokens, span);
    }
    BaseTracer.setAttribute("judgment.usage.metadata" /* JUDGMENT_USAGE_METADATA */, safeStringify(usage), span);
  });
}
function wrapImagesGenerate(client2) {
  client2.images.generate = immutableWrapAsync(client2.images.generate.bind(client2.images), {
    pre: (body) => {
      const span = BaseTracer.startSpan("OPENAI_API_CALL");
      BaseTracer.setSpanKind("llm", span);
      BaseTracer.recordLLMMetadata({ model: body.model }, span);
      BaseTracer.setInput(body, span);
      return { span, proxied: false };
    },
    post: (ctx, result, args) => {
      if (!ctx)
        return;
      const { span } = ctx;
      if (args[0].stream) {
        const stream = result;
        let completionData;
        proxyAsyncIterable(stream, {
          onYield(chunk) {
            if (IMAGE_COMPLETED_TYPES.has(chunk.type)) {
              completionData = chunk;
              recordUsage(span, completionData.usage);
            }
          },
          onDone() {
            BaseTracer.setOutput(safeStringify(completionData ?? {}), span);
          },
          onError(err) {
            BaseTracer.setError(err, span);
          },
          onFinally() {
            span.end();
          }
        });
        return { span, proxied: true };
      }
      const imgResult = result;
      BaseTracer.setOutput(safeStringify(imgResult), span);
      if (imgResult.usage)
        recordUsage(span, imgResult.usage);
      return ctx;
    },
    error: (ctx, err) => {
      if (ctx)
        BaseTracer.setError(err, ctx.span);
      return ctx;
    },
    finally: (ctx) => {
      if (ctx && !ctx.proxied)
        ctx.span.end();
    }
  });
}

// src/instrumentation/llm/openai/responses.ts
init_JudgmentAttributeKeys();
init_BaseTracer();
init_dont_throw();
init_serializer();
function recordUsage2(span, usage) {
  dontThrow("responses.recordUsage", () => {
    const cacheRead = usage.input_tokens_details.cached_tokens;
    const sum = usage.input_tokens + usage.output_tokens + cacheRead;
    BaseTracer.recordLLMMetadata({
      non_cached_input_tokens: sum > usage.total_tokens ? usage.input_tokens - cacheRead : usage.input_tokens,
      output_tokens: usage.output_tokens || undefined,
      cache_read_input_tokens: cacheRead || undefined
    }, span);
    BaseTracer.setAttribute("judgment.usage.metadata" /* JUDGMENT_USAGE_METADATA */, safeStringify(usage), span);
  });
}
function wrapResponsesCreate(client2) {
  client2.responses.create = immutableWrapAsync(client2.responses.create.bind(client2.responses), {
    pre: (body) => {
      const span = BaseTracer.startSpan("OPENAI_API_CALL");
      BaseTracer.setSpanKind("llm", span);
      BaseTracer.recordLLMMetadata({ model: body.model }, span);
      BaseTracer.setInput(body, span);
      return { span, proxied: false };
    },
    post: (ctx, result, args) => {
      if (!ctx)
        return;
      const { span } = ctx;
      if (args[0].stream) {
        const stream = result;
        let accumulatedContent = "";
        proxyAsyncIterable(stream, {
          onYield(chunk) {
            if (chunk.type === "response.output_text.delta") {
              accumulatedContent += chunk.delta;
            }
            if (chunk.type === "response.completed") {
              const resp2 = chunk.response;
              if (resp2.usage)
                recordUsage2(span, resp2.usage);
              BaseTracer.recordLLMMetadata({ model: resp2.model }, span);
            }
          },
          onDone() {
            BaseTracer.setOutput(accumulatedContent, span);
          },
          onError(err) {
            BaseTracer.setError(err, span);
          },
          onFinally() {
            span.end();
          }
        });
        return { span, proxied: true };
      }
      const resp = result;
      BaseTracer.setOutput(safeStringify(resp), span);
      if (resp.usage)
        recordUsage2(span, resp.usage);
      if (typeof resp.model === "string") {
        BaseTracer.recordLLMMetadata({ model: resp.model }, span);
      }
      return ctx;
    },
    error: (ctx, err) => {
      if (ctx)
        BaseTracer.setError(err, ctx.span);
      return ctx;
    },
    finally: (ctx) => {
      if (ctx && !ctx.proxied)
        ctx.span.end();
    }
  });
}

// src/instrumentation/llm/openai/index.ts
function wrapOpenAI(client2) {
  dontThrow("wrapOpenAI", () => {
    wrapChatCompletionsCreate(client2);
    wrapChatCompletionsParse(client2);
    wrapResponsesCreate(client2);
    wrapImagesGenerate(client2);
  });
  return client2;
}

// src/instrumentation/index.ts
function wrap(client2) {
  return wrapOpenAI(client2);
}
setLLMWrapper((client2) => wrap(client2));
// src/data/index.ts
init_Example();
export {
  wrapOpenAI,
  wrap,
  exports_propagation as propagation,
  exports_baggage as baggage,
  Tracer,
  OfflineTracer,
  OfflineJudgmentSpanProcessor,
  NoOpSpanProcessor,
  NoOpSpanExporter,
  JudgmentTracerProvider,
  JudgmentSpanExporter,
  JudgmentBaggageSpanProcessor,
  JudgmentBaggagePropagator,
  Judgeval,
  Judge,
  Example,
  Evaluation,
  Dataset,
  BaseTracer,
  AgentJudgeFactory,
  ALLOW_ALL_BAGGAGE_KEYS
};

//# debugId=F93240563F6F40ED64756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2Vudi50cyIsICIuLi9zcmMvaW50ZXJuYWwvYXBpL2NsaWVudC50cyIsICIuLi9zcmMvdXRpbHMvbG9nZ2VyLnRzIiwgIi4uL3NyYy91dGlscy9yZXRyeS50cyIsICIuLi9zcmMvdXRpbHMvcmVzb2x2ZS1wcm9qZWN0LWlkLnRzIiwgIi4uL25vZGVfbW9kdWxlcy9waWNvY29sb3JzL3BpY29jb2xvcnMuanMiLCAiLi4vc3JjL2RhdGEvRXhhbXBsZS50cyIsICIuLi9zcmMvdXRpbHMvc2VyaWFsaXplci50cyIsICIuLi9zcmMvdmVyc2lvbi50cyIsICIuLi9zcmMvdHJhY2UvaW5zdHJ1bWVudGF0aW9uL090ZWxDb250ZXh0QnJpZGdlLnRzIiwgIi4uL3NyYy90cmFjZS9ydW50aW1lLnRzIiwgIi4uL3NyYy90cmFjZS9KdWRnbWVudFRyYWNlclByb3ZpZGVyLnRzIiwgIi4uL3NyYy91dGlscy9hbm5vdGF0ZS50cyIsICIuLi9zcmMvdXRpbHMvZG9udC10aHJvdy50cyIsICIuLi9zcmMvdXRpbHMvcmFuZG9tLXV1aWQudHMiLCAiLi4vc3JjL3RyYWNlL2JhZ2dhZ2UvY29uc3RhbnRzLnRzIiwgIi4uL3NyYy90cmFjZS9iYWdnYWdlL3V0aWxzLnRzIiwgIi4uL3NyYy90cmFjZS9iYWdnYWdlL0p1ZGdtZW50QmFnZ2FnZVByb3BhZ2F0b3IudHMiLCAiLi4vc3JjL3RyYWNlL2JhZ2dhZ2UvaW5kZXgudHMiLCAiLi4vc3JjL3RyYWNlL3Byb3BhZ2F0aW9uL2luZGV4LnRzIiwgIi4uL3NyYy90cmFjZS9CYXNlVHJhY2VyLnRzIiwgIi4uL3NyYy90cmFjZS9leHBvcnRlcnMvSnVkZ21lbnRTcGFuRXhwb3J0ZXIudHMiLCAiLi4vc3JjL3RyYWNlL2V4cG9ydGVycy9Ob09wU3BhbkV4cG9ydGVyLnRzIiwgIi4uL3NyYy90cmFjZS9wcm9jZXNzb3JzL0p1ZGdtZW50QmFnZ2FnZVNwYW5Qcm9jZXNzb3IudHMiLCAiLi4vc3JjL3RyYWNlL3Byb2Nlc3NvcnMvSnVkZ21lbnRTcGFuUHJvY2Vzc29yLnRzIiwgIi4uL3NyYy90cmFjZS9wcm9jZXNzb3JzL05vT3BTcGFuUHJvY2Vzc29yLnRzIiwgIi4uL3NyYy90cmFjZS9UcmFjZXIudHMiLCAiLi4vc3JjL3RyYWNlL3Byb2Nlc3NvcnMvT2ZmbGluZUp1ZGdtZW50U3BhblByb2Nlc3Nvci50cyIsICIuLi9zcmMvdHJhY2UvT2ZmbGluZVRyYWNlci50cyIsICIuLi9zcmMvSnVkZ2V2YWwudHMiLCAiLi4vc3JjL2p1ZGdlcy9KdWRnZS50cyIsICIuLi9zcmMvZXZhbHVhdGlvbi9FdmFsdWF0aW9uLnRzIiwgIi4uL3NyYy9ldmFsdWF0aW9uL0xvY2FsRXZhbHVhdG9yUnVubmVyLnRzIiwgIi4uL3NyYy9ldmFsdWF0aW9uL0V2YWx1YXRvclJ1bm5lci50cyIsICIuLi9zcmMvZXZhbHVhdGlvbi9Ib3N0ZWRFdmFsdWF0b3JSdW5uZXIudHMiLCAiLi4vc3JjL2V2YWx1YXRpb24vRXZhbHVhdGlvbkZhY3RvcnkudHMiLCAiLi4vc3JjL2RhdGFzZXRzL0RhdGFzZXRGYWN0b3J5LnRzIiwgIi4uL3NyYy9kYXRhc2V0cy9EYXRhc2V0LnRzIiwgIi4uL3NyYy9hZ2VudC1qdWRnZXMvQWdlbnRKdWRnZUZhY3RvcnkudHMiLCAiLi4vc3JjL3RyYWNlL2luZGV4LnRzIiwgIi4uL3NyYy9pbnN0cnVtZW50YXRpb24vaW5kZXgudHMiLCAiLi4vc3JjL2luc3RydW1lbnRhdGlvbi9sbG0vb3BlbmFpL2luZGV4LnRzIiwgIi4uL3NyYy9pbnN0cnVtZW50YXRpb24vbGxtL29wZW5haS9iZXRhLWNoYXQtY29tcGxldGlvbnMudHMiLCAiLi4vc3JjL3V0aWxzL3dyYXBwZXJzL2ltbXV0YWJsZS13cmFwLXN5bmMudHMiLCAiLi4vc3JjL3V0aWxzL3dyYXBwZXJzL2ltbXV0YWJsZS13cmFwLWFzeW5jLnRzIiwgIi4uL3NyYy91dGlscy93cmFwcGVycy9pbW11dGFibGUtd3JhcC1zeW5jLWl0ZXJhdG9yLnRzIiwgIi4uL3NyYy91dGlscy93cmFwcGVycy9pbW11dGFibGUtd3JhcC1hc3luYy1pdGVyYXRvci50cyIsICIuLi9zcmMvdXRpbHMvd3JhcHBlcnMvcHJveHktYXN5bmMtaXRlcmFibGUudHMiLCAiLi4vc3JjL2luc3RydW1lbnRhdGlvbi9sbG0vb3BlbmFpL3V0aWxzLnRzIiwgIi4uL3NyYy9pbnN0cnVtZW50YXRpb24vbGxtL29wZW5haS9jaGF0LWNvbXBsZXRpb25zLnRzIiwgIi4uL3NyYy9pbnN0cnVtZW50YXRpb24vbGxtL29wZW5haS9pbWFnZXMudHMiLCAiLi4vc3JjL2luc3RydW1lbnRhdGlvbi9sbG0vb3BlbmFpL3Jlc3BvbnNlcy50cyIsICIuLi9zcmMvZGF0YS9pbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJmdW5jdGlvbiBnZXRFbnZWYXIodmFyTmFtZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbDtcbmZ1bmN0aW9uIGdldEVudlZhcih2YXJOYW1lOiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogc3RyaW5nKTogc3RyaW5nO1xuZnVuY3Rpb24gZ2V0RW52VmFyKHZhck5hbWU6IHN0cmluZywgZGVmYXVsdFZhbHVlPzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IHZhbHVlID0gcHJvY2Vzcy5lbnZbdmFyTmFtZV07XG4gIGlmICghdmFsdWUpIHtcbiAgICByZXR1cm4gZGVmYXVsdFZhbHVlID8/IG51bGw7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5leHBvcnQgY29uc3QgSlVER01FTlRfQVBJX0tFWSA9IGdldEVudlZhcihcIkpVREdNRU5UX0FQSV9LRVlcIik7XG5leHBvcnQgY29uc3QgSlVER01FTlRfT1JHX0lEID0gZ2V0RW52VmFyKFwiSlVER01FTlRfT1JHX0lEXCIpO1xuZXhwb3J0IGNvbnN0IEpVREdNRU5UX0FQSV9VUkwgPSBnZXRFbnZWYXIoXG4gIFwiSlVER01FTlRfQVBJX1VSTFwiLFxuICBcImh0dHBzOi8vYXBpLmp1ZGdtZW50bGFicy5haVwiLFxuKTtcbmV4cG9ydCBjb25zdCBKVURHTUVOVF9MT0dfTEVWRUwgPSBnZXRFbnZWYXIoXCJKVURHTUVOVF9MT0dfTEVWRUxcIiwgXCJ3YXJuXCIpO1xuIiwKICAgICIvLyBBdXRvLWdlbmVyYXRlZCBieSBzY3JpcHRzL2dlbmVyYXRlLWNsaWVudC50c1xuLy8gRE8gTk9UIEVESVQgTUFOVUFMTFlcblxuaW1wb3J0IHR5cGUge1xuICBBZGRQcm9qZWN0UmVxdWVzdCxcbiAgQWRkUHJvamVjdFJlc3BvbnNlLFxuICBBZGRUb1J1bkV2YWxRdWV1ZUV4YW1wbGVzUmVzcG9uc2UsXG4gIEFkZFRvUnVuRXZhbFF1ZXVlVHJhY2VzUmVzcG9uc2UsXG4gIEFkZFRyYWNlVGFnc1JlcXVlc3QsXG4gIEFkZFRyYWNlVGFnc1Jlc3BvbnNlLFxuICBDcmVhdGVEYXRhc2V0UmVxdWVzdCxcbiAgQ3JlYXRlRGF0YXNldFJlc3BvbnNlLFxuICBDdXN0b21TY29yZXJFeGlzdHNSZXNwb25zZSxcbiAgRGVsZXRlUHJvamVjdFJlc3BvbnNlLFxuICBFMkVGZXRjaFNwYW5TY29yZVJlcXVlc3QsXG4gIEUyRUZldGNoU3BhblNjb3JlUmVzcG9uc2UsXG4gIEUyRUZldGNoVHJhY2VSZXNwb25zZSxcbiAgRTJFVHJhY2VzUGVyUHJvamVjdFJlc3BvbnNlLFxuICBFeGFtcGxlRXZhbHVhdGlvblJ1bixcbiAgRmV0Y2hFeHBlcmltZW50UnVuUmVzcG9uc2UsXG4gIEZldGNoUHJvbXB0UmVzcG9uc2UsXG4gIEZldGNoUHJvbXB0U2NvcmVyc1Jlc3BvbnNlLFxuICBHZXRQcm9tcHRWZXJzaW9uc1Jlc3BvbnNlLFxuICBJbnNlcnRFeGFtcGxlc1JlcXVlc3QsXG4gIEluc2VydEV4YW1wbGVzUmVzcG9uc2UsXG4gIEluc2VydFByb21wdFJlcXVlc3QsXG4gIEluc2VydFByb21wdFJlc3BvbnNlLFxuICBMb2dFdmFsUmVzdWx0c0V4YW1wbGVzUmVxdWVzdCxcbiAgTG9nRXZhbFJlc3VsdHNFeGFtcGxlc1Jlc3BvbnNlLFxuICBMb2dFdmFsUmVzdWx0c1JlcXVlc3QsXG4gIExvZ0V2YWxSZXN1bHRzUmVzcG9uc2UsXG4gIFB1bGxBbGxEYXRhc2V0c1Jlc3BvbnNlLFxuICBQdWxsRGF0YXNldFJlc3BvbnNlLFxuICBSZXNvbHZlUHJvamVjdFJlcXVlc3QsXG4gIFJlc29sdmVQcm9qZWN0UmVzcG9uc2UsXG4gIFNES0NyZWF0ZUFnZW50SnVkZ2VSZXF1ZXN0LFxuICBTREtDcmVhdGVBZ2VudEp1ZGdlUmVzcG9uc2UsXG4gIFNES1VwZGF0ZUFnZW50SnVkZ2VSZXF1ZXN0LFxuICBTREtVcGRhdGVBZ2VudEp1ZGdlUmVzcG9uc2UsXG4gIFNjb3JlckV4aXN0c1Jlc3BvbnNlLFxuICBUYWdQcm9tcHRSZXF1ZXN0LFxuICBUYWdQcm9tcHRSZXNwb25zZSxcbiAgVHJhY2VFdmFsdWF0aW9uUnVuLFxuICBVbnRhZ1Byb21wdFJlcXVlc3QsXG4gIFVudGFnUHJvbXB0UmVzcG9uc2UsXG4gIFVwbG9hZEN1c3RvbVNjb3JlclJlc3BvbnNlLFxufSBmcm9tIFwiLi9tb2RlbHNcIjtcblxuZXhwb3J0IGNsYXNzIEp1ZGdtZW50QXBpQ2xpZW50IHtcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XG4gIHByaXZhdGUgYXBpS2V5OiBzdHJpbmc7XG4gIHByaXZhdGUgb3JnYW5pemF0aW9uSWQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihiYXNlVXJsOiBzdHJpbmcsIGFwaUtleTogc3RyaW5nLCBvcmdhbml6YXRpb25JZDogc3RyaW5nKSB7XG4gICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcbiAgICB0aGlzLmFwaUtleSA9IGFwaUtleTtcbiAgICB0aGlzLm9yZ2FuaXphdGlvbklkID0gb3JnYW5pemF0aW9uSWQ7XG4gIH1cblxuICBnZXRCYXNlVXJsKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuYmFzZVVybDtcbiAgfVxuICBnZXRBcGlLZXkoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5hcGlLZXk7XG4gIH1cbiAgZ2V0T3JnYW5pemF0aW9uSWQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5vcmdhbml6YXRpb25JZDtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVxdWVzdDxUPihcbiAgICBtZXRob2Q6IHN0cmluZyxcbiAgICB1cmw6IHN0cmluZyxcbiAgICBib2R5PzogdW5rbm93bixcbiAgKTogUHJvbWlzZTxUPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLmFwaUtleX1gLFxuICAgICAgICBcIlgtT3JnYW5pemF0aW9uLUlkXCI6IHRoaXMub3JnYW5pemF0aW9uSWQsXG4gICAgICB9LFxuICAgICAgYm9keTogYm9keSAhPT0gdW5kZWZpbmVkID8gSlNPTi5zdHJpbmdpZnkoYm9keSkgOiB1bmRlZmluZWQsXG4gICAgfSk7XG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c306ICR7dGV4dH1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKSBhcyBUO1xuICB9XG5cbiAgYXN5bmMgcG9zdE90ZWxWMXRyYWNlcygpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBcIi9vdGVsL3YxL3RyYWNlc1wiO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwge30pO1xuICB9XG5cbiAgYXN5bmMgcG9zdE90ZWxWMW9mZmxpbmVUcmFjZXMoKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgXCIvb3RlbC92MS9vZmZsaW5lLXRyYWNlc1wiO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwge30pO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNSZXNvbHZlKFxuICAgIHBheWxvYWQ6IFJlc29sdmVQcm9qZWN0UmVxdWVzdCxcbiAgKTogUHJvbWlzZTxSZXNvbHZlUHJvamVjdFJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgXCIvdjEvcHJvamVjdHMvcmVzb2x2ZS9cIjtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHMoXG4gICAgcGF5bG9hZDogQWRkUHJvamVjdFJlcXVlc3QsXG4gICk6IFByb21pc2U8QWRkUHJvamVjdFJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgXCIvdjEvcHJvamVjdHNcIjtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZGVsZXRlVjFwcm9qZWN0cyhwcm9qZWN0SWQ6IHN0cmluZyk6IFByb21pc2U8RGVsZXRlUHJvamVjdFJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH1gO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJERUxFVEVcIiwgdXJsLCB7fSk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c0RhdGFzZXRzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IENyZWF0ZURhdGFzZXRSZXF1ZXN0LFxuICApOiBQcm9taXNlPENyZWF0ZURhdGFzZXRSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2RhdGFzZXRzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFwcm9qZWN0c0RhdGFzZXRzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICApOiBQcm9taXNlPFB1bGxBbGxEYXRhc2V0c1Jlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZGF0YXNldHNgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJHRVRcIiwgdXJsLCB1bmRlZmluZWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNEYXRhc2V0c0J5RGF0YXNldE5hbWVFeGFtcGxlcyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBkYXRhc2V0TmFtZTogc3RyaW5nLFxuICAgIHBheWxvYWQ6IEluc2VydEV4YW1wbGVzUmVxdWVzdCxcbiAgKTogUHJvbWlzZTxJbnNlcnRFeGFtcGxlc1Jlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIHRoaXMuYmFzZVVybCArXG4gICAgICBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9kYXRhc2V0cy8ke2RhdGFzZXROYW1lfS9leGFtcGxlc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFYxcHJvamVjdHNEYXRhc2V0c0J5RGF0YXNldE5hbWUoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgZGF0YXNldE5hbWU6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxQdWxsRGF0YXNldFJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2RhdGFzZXRzLyR7ZGF0YXNldE5hbWV9YDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiR0VUXCIsIHVybCwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzRXZhbHVhdGVFeGFtcGxlcyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBFeGFtcGxlRXZhbHVhdGlvblJ1bixcbiAgKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZXZhbHVhdGUvZXhhbXBsZXNgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c0V2YWx1YXRlVHJhY2VzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IFRyYWNlRXZhbHVhdGlvblJ1bixcbiAgKTogUHJvbWlzZTx1bmtub3duPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZXZhbHVhdGUvdHJhY2VzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNFdmFsUmVzdWx0cyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBMb2dFdmFsUmVzdWx0c1JlcXVlc3QsXG4gICk6IFByb21pc2U8TG9nRXZhbFJlc3VsdHNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2V2YWwtcmVzdWx0c2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzRXZhbFJlc3VsdHNFeGFtcGxlcyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBMb2dFdmFsUmVzdWx0c0V4YW1wbGVzUmVxdWVzdCxcbiAgKTogUHJvbWlzZTxMb2dFdmFsUmVzdWx0c0V4YW1wbGVzUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZXZhbC1yZXN1bHRzL2V4YW1wbGVzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFwcm9qZWN0c0V4cGVyaW1lbnRzQnlSdW5JZChcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBydW5JZDogc3RyaW5nLFxuICApOiBQcm9taXNlPEZldGNoRXhwZXJpbWVudFJ1blJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZXhwZXJpbWVudHMvJHtydW5JZH1gO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJHRVRcIiwgdXJsLCB1bmRlZmluZWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNFdmFsUXVldWVFeGFtcGxlcyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBFeGFtcGxlRXZhbHVhdGlvblJ1bixcbiAgKTogUHJvbWlzZTxBZGRUb1J1bkV2YWxRdWV1ZUV4YW1wbGVzUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9ldmFsLXF1ZXVlL2V4YW1wbGVzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNFdmFsUXVldWVUcmFjZXMoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogVHJhY2VFdmFsdWF0aW9uUnVuLFxuICApOiBQcm9taXNlPEFkZFRvUnVuRXZhbFF1ZXVlVHJhY2VzUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9ldmFsLXF1ZXVlL3RyYWNlc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFYxcHJvamVjdHNQcm9tcHRzQnlOYW1lKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBjb21taXRfaWQ/OiBzdHJpbmcsXG4gICAgdGFnPzogc3RyaW5nLFxuICApOiBQcm9taXNlPEZldGNoUHJvbXB0UmVzcG9uc2U+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgaWYgKGNvbW1pdF9pZCAhPT0gdW5kZWZpbmVkKSBwYXJhbXMuc2V0KFwiY29tbWl0X2lkXCIsIGNvbW1pdF9pZCk7XG4gICAgaWYgKHRhZyAhPT0gdW5kZWZpbmVkKSBwYXJhbXMuc2V0KFwidGFnXCIsIHRhZyk7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIHRoaXMuYmFzZVVybCArXG4gICAgICBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9wcm9tcHRzLyR7bmFtZX1gICtcbiAgICAgIChwYXJhbXMudG9TdHJpbmcoKSA/IFwiP1wiICsgcGFyYW1zLnRvU3RyaW5nKCkgOiBcIlwiKTtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiR0VUXCIsIHVybCwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzUHJvbXB0cyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBJbnNlcnRQcm9tcHRSZXF1ZXN0LFxuICApOiBQcm9taXNlPEluc2VydFByb21wdFJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vcHJvbXB0c2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzUHJvbXB0c0J5TmFtZVRhZ3MoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBheWxvYWQ6IFRhZ1Byb21wdFJlcXVlc3QsXG4gICk6IFByb21pc2U8VGFnUHJvbXB0UmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9wcm9tcHRzLyR7bmFtZX0vdGFnc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZVYxcHJvamVjdHNQcm9tcHRzQnlOYW1lVGFncyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogVW50YWdQcm9tcHRSZXF1ZXN0LFxuICApOiBQcm9taXNlPFVudGFnUHJvbXB0UmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9wcm9tcHRzLyR7bmFtZX0vdGFnc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkRFTEVURVwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFwcm9qZWN0c1Byb21wdHNCeU5hbWVWZXJzaW9ucyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICk6IFByb21pc2U8R2V0UHJvbXB0VmVyc2lvbnNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9XG4gICAgICB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9wcm9tcHRzLyR7bmFtZX0vdmVyc2lvbnNgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJHRVRcIiwgdXJsLCB1bmRlZmluZWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFwcm9qZWN0c1Njb3JlcnMoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgbmFtZXM/OiBzdHJpbmcsXG4gICAgaXNfdHJhY2U/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8RmV0Y2hQcm9tcHRTY29yZXJzUmVzcG9uc2U+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgaWYgKG5hbWVzICE9PSB1bmRlZmluZWQpIHBhcmFtcy5zZXQoXCJuYW1lc1wiLCBuYW1lcyk7XG4gICAgaWYgKGlzX3RyYWNlICE9PSB1bmRlZmluZWQpIHBhcmFtcy5zZXQoXCJpc190cmFjZVwiLCBpc190cmFjZSk7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIHRoaXMuYmFzZVVybCArXG4gICAgICBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9zY29yZXJzYCArXG4gICAgICAocGFyYW1zLnRvU3RyaW5nKCkgPyBcIj9cIiArIHBhcmFtcy50b1N0cmluZygpIDogXCJcIik7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkdFVFwiLCB1cmwsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBhc3luYyBnZXRWMXByb2plY3RzU2NvcmVyc0J5TmFtZUV4aXN0cyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICk6IFByb21pc2U8U2NvcmVyRXhpc3RzUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vc2NvcmVycy8ke25hbWV9L2V4aXN0c2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkdFVFwiLCB1cmwsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c1Njb3JlcnNDdXN0b20ocHJvamVjdElkOiBzdHJpbmcpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9zY29yZXJzL2N1c3RvbWA7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCB7fSk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c1Njb3JlcnNDdXN0b21CdW5kbGUoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICk6IFByb21pc2U8VXBsb2FkQ3VzdG9tU2NvcmVyUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vc2NvcmVycy9jdXN0b20vYnVuZGxlYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHt9KTtcbiAgfVxuXG4gIGFzeW5jIGdldFYxcHJvamVjdHNTY29yZXJzQ3VzdG9tQnlOYW1lRXhpc3RzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxDdXN0b21TY29yZXJFeGlzdHNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9XG4gICAgICB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9zY29yZXJzL2N1c3RvbS8ke25hbWV9L2V4aXN0c2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkdFVFwiLCB1cmwsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c1RyYWNlc0J5VHJhY2VJZFRhZ3MoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgdHJhY2VJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IEFkZFRyYWNlVGFnc1JlcXVlc3QsXG4gICk6IFByb21pc2U8QWRkVHJhY2VUYWdzUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vdHJhY2VzLyR7dHJhY2VJZH0vdGFnc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFYxZTJlRmV0Y2hUcmFjZUJ5UHJvamVjdE5hbWVCeVRyYWNlSWQoXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICB0cmFjZUlkOiBzdHJpbmcsXG4gICk6IFByb21pc2U8RTJFRmV0Y2hUcmFjZVJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9lMmVfZmV0Y2hfdHJhY2UvJHtwcm9qZWN0TmFtZX0vJHt0cmFjZUlkfWA7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkdFVFwiLCB1cmwsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBhc3luYyBnZXRWMWUyZVRyYWNlc1BlclByb2plY3QoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgbGltaXQ/OiBzdHJpbmcsXG4gICAgb2Zmc2V0Pzogc3RyaW5nLFxuICApOiBQcm9taXNlPEUyRVRyYWNlc1BlclByb2plY3RSZXNwb25zZT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICBpZiAobGltaXQgIT09IHVuZGVmaW5lZCkgcGFyYW1zLnNldChcImxpbWl0XCIsIGxpbWl0KTtcbiAgICBpZiAob2Zmc2V0ICE9PSB1bmRlZmluZWQpIHBhcmFtcy5zZXQoXCJvZmZzZXRcIiwgb2Zmc2V0KTtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICtcbiAgICAgIGAvdjEvZTJlX3RyYWNlc19wZXJfcHJvamVjdC8ke3Byb2plY3RJZH1gICtcbiAgICAgIChwYXJhbXMudG9TdHJpbmcoKSA/IFwiP1wiICsgcGFyYW1zLnRvU3RyaW5nKCkgOiBcIlwiKTtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiR0VUXCIsIHVybCwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMWUyZUZldGNoU3BhblNjb3JlKFxuICAgIHBheWxvYWQ6IEUyRUZldGNoU3BhblNjb3JlUmVxdWVzdCxcbiAgKTogUHJvbWlzZTxFMkVGZXRjaFNwYW5TY29yZVJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgXCIvdjEvZTJlX2ZldGNoX3NwYW5fc2NvcmUvXCI7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzSnVkZ2VzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IFNES0NyZWF0ZUFnZW50SnVkZ2VSZXF1ZXN0LFxuICApOiBQcm9taXNlPFNES0NyZWF0ZUFnZW50SnVkZ2VSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2p1ZGdlc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIHBhdGNoVjFwcm9qZWN0c0p1ZGdlc0J5SnVkZ2VJZChcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBqdWRnZUlkOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogU0RLVXBkYXRlQWdlbnRKdWRnZVJlcXVlc3QsXG4gICk6IFByb21pc2U8U0RLVXBkYXRlQWdlbnRKdWRnZVJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vanVkZ2VzLyR7anVkZ2VJZH1gO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQQVRDSFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG59XG4iLAogICAgInR5cGUgV3JpdGFibGVTdHJlYW1MaWtlID0ge1xuICBpc1RUWT86IGJvb2xlYW47XG4gIHdyaXRlPzogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZDtcbn07XG5cbnR5cGUgUHJvY2Vzc0xpa2UgPSB7XG4gIGVudj86IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHVuZGVmaW5lZD47XG4gIHN0ZGVycj86IFdyaXRhYmxlU3RyZWFtTGlrZTtcbiAgc3Rkb3V0PzogV3JpdGFibGVTdHJlYW1MaWtlO1xufTtcblxuZnVuY3Rpb24gZ2V0UHJvY2VzcygpOiBQcm9jZXNzTGlrZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiAoZ2xvYmFsVGhpcyBhcyB0eXBlb2YgZ2xvYmFsVGhpcyAmIHsgcHJvY2Vzcz86IFByb2Nlc3NMaWtlIH0pLnByb2Nlc3M7XG59XG5cbmZ1bmN0aW9uIGdldEVudlZhcihuYW1lOiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGdldFByb2Nlc3MoKT8uZW52Py5bbmFtZV0gPz8gZGVmYXVsdFZhbHVlO1xufVxuXG4vKipcbiAqIFNESyBsb2dnZXIgd2l0aCBjb25maWd1cmFibGUgbGV2ZWxzIGFuZCBjb2xvciBvdXRwdXQuXG4gKlxuICogTG9nIGxldmVsIGlzIGNvbnRyb2xsZWQgYnkgdGhlIGBKVURHTUVOVF9MT0dfTEVWRUxgIGVudmlyb25tZW50IHZhcmlhYmxlLlxuICogRGVmYXVsdHMgdG8gXCJ3YXJuXCIuIFN1cHBvcnRlZCBsZXZlbHM6IFwiZGVidWdcIiwgXCJpbmZvXCIsIFwid2FybmluZ1wiLCBcImVycm9yXCIsIFwiY3JpdGljYWxcIi5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcImp1ZGdldmFsXCI7XG4gKlxuICogTG9nZ2VyLnNldExldmVsKFwiZGVidWdcIik7XG4gKiBMb2dnZXIuaW5mbyhcIlRyYWNlciBpbml0aWFsaXplZFwiKTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUkVTRVQgPSBcIlxceDFiWzBtXCI7XG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJFRCA9IFwiXFx4MWJbMzFtXCI7XG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFlFTExPVyA9IFwiXFx4MWJbMzNtXCI7XG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEdSQVkgPSBcIlxceDFiWzkwbVwiO1xuXG4gIHB1YmxpYyBzdGF0aWMgTGV2ZWwgPSB7XG4gICAgREVCVUc6IDAsXG4gICAgSU5GTzogMSxcbiAgICBXQVJOSU5HOiAyLFxuICAgIEVSUk9SOiAzLFxuICAgIENSSVRJQ0FMOiA0LFxuICB9IGFzIGNvbnN0O1xuXG4gIHByaXZhdGUgc3RhdGljIGluaXRpYWxpemVkID0gZmFsc2U7XG4gIHByaXZhdGUgc3RhdGljIGxldmVsU2V0TWFudWFsbHkgPSBmYWxzZTtcbiAgcHJpdmF0ZSBzdGF0aWMgY3VycmVudExldmVsOiBudW1iZXIgPSBMb2dnZXIuTGV2ZWwuV0FSTklORztcbiAgcHJpdmF0ZSBzdGF0aWMgdXNlQ29sb3IgPSB0cnVlO1xuXG4gIHByaXZhdGUgc3RhdGljIGluaXRpYWxpemUoKTogdm9pZCB7XG4gICAgaWYgKCFMb2dnZXIuaW5pdGlhbGl6ZWQpIHtcbiAgICAgIGNvbnN0IHByb2MgPSBnZXRQcm9jZXNzKCk7XG4gICAgICBjb25zdCBub0NvbG9yID0gcHJvYz8uZW52Py5KVURHTUVOVF9OT19DT0xPUjtcbiAgICAgIExvZ2dlci51c2VDb2xvciA9ICFub0NvbG9yICYmIHByb2M/LnN0ZG91dD8uaXNUVFkgPT09IHRydWU7XG5cbiAgICAgIGlmICghTG9nZ2VyLmxldmVsU2V0TWFudWFsbHkpIHtcbiAgICAgICAgY29uc3QgbG9nTGV2ZWwgPSBnZXRFbnZWYXIoXCJKVURHTUVOVF9MT0dfTEVWRUxcIiwgXCJ3YXJuXCIpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChsb2dMZXZlbCkge1xuICAgICAgICAgIGNvbnN0IGxldmVsTWFwOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICAgICAgICAgICAgZGVidWc6IExvZ2dlci5MZXZlbC5ERUJVRyxcbiAgICAgICAgICAgIGluZm86IExvZ2dlci5MZXZlbC5JTkZPLFxuICAgICAgICAgICAgd2FybmluZzogTG9nZ2VyLkxldmVsLldBUk5JTkcsXG4gICAgICAgICAgICB3YXJuOiBMb2dnZXIuTGV2ZWwuV0FSTklORyxcbiAgICAgICAgICAgIGVycm9yOiBMb2dnZXIuTGV2ZWwuRVJST1IsXG4gICAgICAgICAgICBjcml0aWNhbDogTG9nZ2VyLkxldmVsLkNSSVRJQ0FMLFxuICAgICAgICAgIH07XG4gICAgICAgICAgTG9nZ2VyLmN1cnJlbnRMZXZlbCA9IGxldmVsTWFwW2xvZ0xldmVsXSA/PyBMb2dnZXIuTGV2ZWwuV0FSTklORztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBMb2dnZXIuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBTZXQgdGhlIG1pbmltdW0gbG9nIGxldmVsLiAqL1xuICBwdWJsaWMgc3RhdGljIHNldExldmVsKGxldmVsOiBudW1iZXIpOiB2b2lkIHtcbiAgICBMb2dnZXIuY3VycmVudExldmVsID0gbGV2ZWw7XG4gICAgTG9nZ2VyLmxldmVsU2V0TWFudWFsbHkgPSB0cnVlO1xuICB9XG5cbiAgLyoqIEVuYWJsZSBvciBkaXNhYmxlIGNvbG9yZWQgb3V0cHV0LiAqL1xuICBwdWJsaWMgc3RhdGljIHNldFVzZUNvbG9yKHVzZUNvbG9yOiBib29sZWFuKTogdm9pZCB7XG4gICAgTG9nZ2VyLnVzZUNvbG9yID0gdXNlQ29sb3I7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBsb2cobGV2ZWw6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgTG9nZ2VyLmluaXRpYWxpemUoKTtcblxuICAgIGlmIChsZXZlbCA8IExvZ2dlci5jdXJyZW50TGV2ZWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpXG4gICAgICAudG9JU09TdHJpbmcoKVxuICAgICAgLnJlcGxhY2UoXCJUXCIsIFwiIFwiKVxuICAgICAgLnN1YnN0cmluZygwLCAxOSk7XG4gICAgY29uc3QgbGV2ZWxOYW1lID1cbiAgICAgIE9iamVjdC5rZXlzKExvZ2dlci5MZXZlbCkuZmluZChcbiAgICAgICAgKGtleSkgPT4gTG9nZ2VyLkxldmVsW2tleSBhcyBrZXlvZiB0eXBlb2YgTG9nZ2VyLkxldmVsXSA9PT0gbGV2ZWwsXG4gICAgICApID8/IFwiVU5LTk9XTlwiO1xuICAgIGxldCBmb3JtYXR0ZWRNZXNzYWdlID0gYCR7dGltZXN0YW1wfSAtIGp1ZGdldmFsIC0gJHtsZXZlbE5hbWV9IC0gJHttZXNzYWdlfWA7XG5cbiAgICBpZiAoTG9nZ2VyLnVzZUNvbG9yKSB7XG4gICAgICBjb25zdCBjb2xvciA9XG4gICAgICAgIGxldmVsID09PSBMb2dnZXIuTGV2ZWwuREVCVUcgfHwgbGV2ZWwgPT09IExvZ2dlci5MZXZlbC5JTkZPXG4gICAgICAgICAgPyBMb2dnZXIuR1JBWVxuICAgICAgICAgIDogbGV2ZWwgPT09IExvZ2dlci5MZXZlbC5XQVJOSU5HXG4gICAgICAgICAgICA/IExvZ2dlci5ZRUxMT1dcbiAgICAgICAgICAgIDogTG9nZ2VyLlJFRDtcbiAgICAgIGZvcm1hdHRlZE1lc3NhZ2UgPSBgJHtjb2xvcn0ke2Zvcm1hdHRlZE1lc3NhZ2V9JHtMb2dnZXIuUkVTRVR9YDtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9jID0gZ2V0UHJvY2VzcygpO1xuICAgIGNvbnN0IG91dHB1dCA9IGxldmVsID49IExvZ2dlci5MZXZlbC5FUlJPUiA/IHByb2M/LnN0ZGVyciA6IHByb2M/LnN0ZG91dDtcbiAgICBpZiAob3V0cHV0Py53cml0ZSkge1xuICAgICAgb3V0cHV0LndyaXRlKGZvcm1hdHRlZE1lc3NhZ2UgKyBcIlxcblwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGV2ZWwgPj0gTG9nZ2VyLkxldmVsLkVSUk9SKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGZvcm1hdHRlZE1lc3NhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhmb3JtYXR0ZWRNZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICAvKiogTG9nIGEgZGVidWcgbWVzc2FnZS4gKi9cbiAgcHVibGljIHN0YXRpYyBkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBMb2dnZXIubG9nKExvZ2dlci5MZXZlbC5ERUJVRywgbWVzc2FnZSk7XG4gIH1cblxuICAvKiogTG9nIGFuIGluZm9ybWF0aW9uYWwgbWVzc2FnZS4gKi9cbiAgcHVibGljIHN0YXRpYyBpbmZvKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIExvZ2dlci5sb2coTG9nZ2VyLkxldmVsLklORk8sIG1lc3NhZ2UpO1xuICB9XG5cbiAgLyoqIExvZyBhIHdhcm5pbmcgbWVzc2FnZS4gKi9cbiAgcHVibGljIHN0YXRpYyB3YXJuaW5nKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIExvZ2dlci5sb2coTG9nZ2VyLkxldmVsLldBUk5JTkcsIG1lc3NhZ2UpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIExvZ2dlci5sb2coTG9nZ2VyLkxldmVsLldBUk5JTkcsIG1lc3NhZ2UpO1xuICB9XG5cbiAgLyoqIExvZyBhbiBlcnJvciBtZXNzYWdlLiAqL1xuICBwdWJsaWMgc3RhdGljIGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIExvZ2dlci5sb2coTG9nZ2VyLkxldmVsLkVSUk9SLCBtZXNzYWdlKTtcbiAgfVxuXG4gIC8qKiBMb2cgYSBjcml0aWNhbCBlcnJvciBtZXNzYWdlLiAqL1xuICBwdWJsaWMgc3RhdGljIGNyaXRpY2FsKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIExvZ2dlci5sb2coTG9nZ2VyLkxldmVsLkNSSVRJQ0FMLCBtZXNzYWdlKTtcbiAgfVxufVxuIiwKICAgICJleHBvcnQgaW50ZXJmYWNlIFJldHJ5Q29uZmlnIHtcbiAgLyoqIE1heGltdW0gbnVtYmVyIG9mIGF0dGVtcHRzLiBEZWZhdWx0cyB0byBgM2AuICovXG4gIG1heFJldHJpZXM/OiBudW1iZXI7XG4gIC8qKlxuICAgKiBGdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGJhY2tvZmYgZGVsYXkgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGVcbiAgICogZ2l2ZW4gYXR0ZW1wdC4gVGhlIGZpcnN0IGNhbGwgcmVjZWl2ZXMgYGl0ZXJhdGlvbiA9IDFgLlxuICAgKiBEZWZhdWx0cyB0byBhIGZsYXQgMTAwMCBtcy5cbiAgICovXG4gIGJhY2tvZmY/OiAoaXRlcmF0aW9uOiBudW1iZXIpID0+IG51bWJlcjtcbiAgLyoqIENhbGxlZCBhZnRlciBlYWNoIGZhaWxlZCBhdHRlbXB0LCBiZWZvcmUgc2xlZXBpbmcgZm9yIHRoZSBiYWNrb2ZmLiAqL1xuICBvblJldHJ5PzogKGF0dGVtcHQ6IG51bWJlciwgZXJyb3I6IHVua25vd24pID0+IHZvaWQ7XG59XG5cbi8qKlxuICogUmV0cnkgYSBmdW5jdGlvbiB1cCB0byBhIG1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHdpdGggY29uZmlndXJhYmxlXG4gKiBiYWNrb2ZmLlxuICpcbiAqIEBwYXJhbSBmbiAtIFRoZSBmdW5jdGlvbiB0byByZXRyeS5cbiAqIEBwYXJhbSBjb25maWcgLSBSZXRyeSBjb25maWd1cmF0aW9uLlxuICogICAtIGBtYXhSZXRyaWVzYCDigJQgbWF4aW11bSBudW1iZXIgb2YgYXR0ZW1wdHMgKGRlZmF1bHQ6IDMpLlxuICogICAtIGBiYWNrb2ZmYCDigJQgZGVsYXkgaW4gbXMgYmV0d2VlbiBhdHRlbXB0cyAoZGVmYXVsdDogZmxhdCAxMDAwIG1zKS5cbiAqICAgLSBgb25SZXRyeWAg4oCUIGludm9rZWQgd2l0aCBgKGF0dGVtcHQsIGVycm9yKWAgYWZ0ZXIgZWFjaCBmYWlsZWRcbiAqICAgICBhdHRlbXB0IChkZWZhdWx0OiBuby1vcCkuXG4gKiBAcmV0dXJucyBUaGUgcmVzb2x2ZWQgdmFsdWUgb2YgYGZuYC5cbiAqIEB0aHJvd3MgVGhlIGxhc3QgZXJyb3IgcmFpc2VkIGJ5IGBmbmAgaWYgaXQgZmFpbHMgb24gZXZlcnkgYXR0ZW1wdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJldHJ5PFQ+KFxuICBmbjogKCkgPT4gUHJvbWlzZTxUPixcbiAgY29uZmlnOiBSZXRyeUNvbmZpZyA9IHt9LFxuKTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IHsgbWF4UmV0cmllcyA9IDMsIGJhY2tvZmYgPSAoKSA9PiAxMDAwLCBvblJldHJ5IH0gPSBjb25maWc7XG5cbiAgZm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gbWF4UmV0cmllczsgYXR0ZW1wdCsrKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBmbigpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoYXR0ZW1wdCA9PT0gbWF4UmV0cmllcykge1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cblxuICAgICAgb25SZXRyeT8uKGF0dGVtcHQsIGVycm9yKTtcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIGJhY2tvZmYoYXR0ZW1wdCkpKTtcbiAgICB9XG4gIH1cblxuICAvLyBVbnJlYWNoYWJsZTogdGhlIGxvb3AgYWx3YXlzIGVpdGhlciByZXR1cm5zIG9yIHRocm93cy5cbiAgdGhyb3cgbmV3IEVycm9yKFwicmV0cnk6IGV4aGF1c3RlZCBhbGwgYXR0ZW1wdHNcIik7XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgSnVkZ21lbnRBcGlDbGllbnQgfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi9sb2dnZXJcIjtcbmltcG9ydCB7IHJldHJ5IH0gZnJvbSBcIi4vcmV0cnlcIjtcblxuY29uc3QgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuY29uc3QgaW5mbGlnaHQgPSBuZXcgTWFwPHN0cmluZywgUHJvbWlzZTxzdHJpbmc+PigpO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZVByb2plY3RJZChcbiAgY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudCxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGNhY2hlS2V5ID0gYG9yZzoke2NsaWVudC5nZXRPcmdhbml6YXRpb25JZCgpfTpwcm9qZWN0OiR7cHJvamVjdE5hbWV9YDtcbiAgY29uc3QgY2FjaGVkID0gY2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgaWYgKGNhY2hlZCkge1xuICAgIHJldHVybiBjYWNoZWQ7XG4gIH1cbiAgY29uc3QgcGVuZGluZyA9IGluZmxpZ2h0LmdldChjYWNoZUtleSk7XG4gIGlmIChwZW5kaW5nKSB7XG4gICAgcmV0dXJuIHBlbmRpbmc7XG4gIH1cbiAgY29uc3QgcmVxdWVzdCA9IChhc3luYyAoKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgICBMb2dnZXIuaW5mbyhgUmVzb2x2aW5nIHByb2plY3QgSUQgZm9yIHByb2plY3Q6ICR7cHJvamVjdE5hbWV9YCk7XG4gICAgY29uc3QgcHJvamVjdElkID0gYXdhaXQgcmV0cnkoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2xpZW50LnBvc3RWMXByb2plY3RzUmVzb2x2ZSh7XG4gICAgICAgICAgcHJvamVjdF9uYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGlkID0gcmVzcG9uc2UucHJvamVjdF9pZDtcbiAgICAgICAgaWYgKCFpZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvamVjdCBJRCBub3QgZm91bmQgZm9yIHByb2plY3Q6ICR7cHJvamVjdE5hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbWF4UmV0cmllczogMyxcbiAgICAgICAgYmFja29mZjogKGl0ZXJhdGlvbikgPT4gaXRlcmF0aW9uICogMTAwMCxcbiAgICAgICAgb25SZXRyeTogKGF0dGVtcHQsIGVycm9yKSA9PiB7XG4gICAgICAgICAgTG9nZ2VyLndhcm5pbmcoXG4gICAgICAgICAgICBgRmFpbGVkIHRvIHJlc29sdmUgcHJvamVjdCBJRCBmb3IgJyR7cHJvamVjdE5hbWV9JyAoYXR0ZW1wdCAke2F0dGVtcHR9KTogJHtTdHJpbmcoZXJyb3IpfWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgKTtcbiAgICBMb2dnZXIuaW5mbyhgUmVzb2x2ZWQgcHJvamVjdCBJRDogJHtwcm9qZWN0SWR9YCk7XG4gICAgY2FjaGUuc2V0KGNhY2hlS2V5LCBwcm9qZWN0SWQpO1xuICAgIHJldHVybiBwcm9qZWN0SWQ7XG4gIH0pKCk7XG4gIGluZmxpZ2h0LnNldChjYWNoZUtleSwgcmVxdWVzdCk7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IHJlcXVlc3Q7XG4gIH0gZmluYWxseSB7XG4gICAgaW5mbGlnaHQuZGVsZXRlKGNhY2hlS2V5KTtcbiAgfVxufVxuIiwKICAgICJsZXQgcCA9IHByb2Nlc3MgfHwge30sIGFyZ3YgPSBwLmFyZ3YgfHwgW10sIGVudiA9IHAuZW52IHx8IHt9XG5sZXQgaXNDb2xvclN1cHBvcnRlZCA9XG5cdCEoISFlbnYuTk9fQ09MT1IgfHwgYXJndi5pbmNsdWRlcyhcIi0tbm8tY29sb3JcIikpICYmXG5cdCghIWVudi5GT1JDRV9DT0xPUiB8fCBhcmd2LmluY2x1ZGVzKFwiLS1jb2xvclwiKSB8fCBwLnBsYXRmb3JtID09PSBcIndpbjMyXCIgfHwgKChwLnN0ZG91dCB8fCB7fSkuaXNUVFkgJiYgZW52LlRFUk0gIT09IFwiZHVtYlwiKSB8fCAhIWVudi5DSSlcblxubGV0IGZvcm1hdHRlciA9IChvcGVuLCBjbG9zZSwgcmVwbGFjZSA9IG9wZW4pID0+XG5cdGlucHV0ID0+IHtcblx0XHRsZXQgc3RyaW5nID0gXCJcIiArIGlucHV0LCBpbmRleCA9IHN0cmluZy5pbmRleE9mKGNsb3NlLCBvcGVuLmxlbmd0aClcblx0XHRyZXR1cm4gfmluZGV4ID8gb3BlbiArIHJlcGxhY2VDbG9zZShzdHJpbmcsIGNsb3NlLCByZXBsYWNlLCBpbmRleCkgKyBjbG9zZSA6IG9wZW4gKyBzdHJpbmcgKyBjbG9zZVxuXHR9XG5cbmxldCByZXBsYWNlQ2xvc2UgPSAoc3RyaW5nLCBjbG9zZSwgcmVwbGFjZSwgaW5kZXgpID0+IHtcblx0bGV0IHJlc3VsdCA9IFwiXCIsIGN1cnNvciA9IDBcblx0ZG8ge1xuXHRcdHJlc3VsdCArPSBzdHJpbmcuc3Vic3RyaW5nKGN1cnNvciwgaW5kZXgpICsgcmVwbGFjZVxuXHRcdGN1cnNvciA9IGluZGV4ICsgY2xvc2UubGVuZ3RoXG5cdFx0aW5kZXggPSBzdHJpbmcuaW5kZXhPZihjbG9zZSwgY3Vyc29yKVxuXHR9IHdoaWxlICh+aW5kZXgpXG5cdHJldHVybiByZXN1bHQgKyBzdHJpbmcuc3Vic3RyaW5nKGN1cnNvcilcbn1cblxubGV0IGNyZWF0ZUNvbG9ycyA9IChlbmFibGVkID0gaXNDb2xvclN1cHBvcnRlZCkgPT4ge1xuXHRsZXQgZiA9IGVuYWJsZWQgPyBmb3JtYXR0ZXIgOiAoKSA9PiBTdHJpbmdcblx0cmV0dXJuIHtcblx0XHRpc0NvbG9yU3VwcG9ydGVkOiBlbmFibGVkLFxuXHRcdHJlc2V0OiBmKFwiXFx4MWJbMG1cIiwgXCJcXHgxYlswbVwiKSxcblx0XHRib2xkOiBmKFwiXFx4MWJbMW1cIiwgXCJcXHgxYlsyMm1cIiwgXCJcXHgxYlsyMm1cXHgxYlsxbVwiKSxcblx0XHRkaW06IGYoXCJcXHgxYlsybVwiLCBcIlxceDFiWzIybVwiLCBcIlxceDFiWzIybVxceDFiWzJtXCIpLFxuXHRcdGl0YWxpYzogZihcIlxceDFiWzNtXCIsIFwiXFx4MWJbMjNtXCIpLFxuXHRcdHVuZGVybGluZTogZihcIlxceDFiWzRtXCIsIFwiXFx4MWJbMjRtXCIpLFxuXHRcdGludmVyc2U6IGYoXCJcXHgxYls3bVwiLCBcIlxceDFiWzI3bVwiKSxcblx0XHRoaWRkZW46IGYoXCJcXHgxYls4bVwiLCBcIlxceDFiWzI4bVwiKSxcblx0XHRzdHJpa2V0aHJvdWdoOiBmKFwiXFx4MWJbOW1cIiwgXCJcXHgxYlsyOW1cIiksXG5cblx0XHRibGFjazogZihcIlxceDFiWzMwbVwiLCBcIlxceDFiWzM5bVwiKSxcblx0XHRyZWQ6IGYoXCJcXHgxYlszMW1cIiwgXCJcXHgxYlszOW1cIiksXG5cdFx0Z3JlZW46IGYoXCJcXHgxYlszMm1cIiwgXCJcXHgxYlszOW1cIiksXG5cdFx0eWVsbG93OiBmKFwiXFx4MWJbMzNtXCIsIFwiXFx4MWJbMzltXCIpLFxuXHRcdGJsdWU6IGYoXCJcXHgxYlszNG1cIiwgXCJcXHgxYlszOW1cIiksXG5cdFx0bWFnZW50YTogZihcIlxceDFiWzM1bVwiLCBcIlxceDFiWzM5bVwiKSxcblx0XHRjeWFuOiBmKFwiXFx4MWJbMzZtXCIsIFwiXFx4MWJbMzltXCIpLFxuXHRcdHdoaXRlOiBmKFwiXFx4MWJbMzdtXCIsIFwiXFx4MWJbMzltXCIpLFxuXHRcdGdyYXk6IGYoXCJcXHgxYls5MG1cIiwgXCJcXHgxYlszOW1cIiksXG5cblx0XHRiZ0JsYWNrOiBmKFwiXFx4MWJbNDBtXCIsIFwiXFx4MWJbNDltXCIpLFxuXHRcdGJnUmVkOiBmKFwiXFx4MWJbNDFtXCIsIFwiXFx4MWJbNDltXCIpLFxuXHRcdGJnR3JlZW46IGYoXCJcXHgxYls0Mm1cIiwgXCJcXHgxYls0OW1cIiksXG5cdFx0YmdZZWxsb3c6IGYoXCJcXHgxYls0M21cIiwgXCJcXHgxYls0OW1cIiksXG5cdFx0YmdCbHVlOiBmKFwiXFx4MWJbNDRtXCIsIFwiXFx4MWJbNDltXCIpLFxuXHRcdGJnTWFnZW50YTogZihcIlxceDFiWzQ1bVwiLCBcIlxceDFiWzQ5bVwiKSxcblx0XHRiZ0N5YW46IGYoXCJcXHgxYls0Nm1cIiwgXCJcXHgxYls0OW1cIiksXG5cdFx0YmdXaGl0ZTogZihcIlxceDFiWzQ3bVwiLCBcIlxceDFiWzQ5bVwiKSxcblxuXHRcdGJsYWNrQnJpZ2h0OiBmKFwiXFx4MWJbOTBtXCIsIFwiXFx4MWJbMzltXCIpLFxuXHRcdHJlZEJyaWdodDogZihcIlxceDFiWzkxbVwiLCBcIlxceDFiWzM5bVwiKSxcblx0XHRncmVlbkJyaWdodDogZihcIlxceDFiWzkybVwiLCBcIlxceDFiWzM5bVwiKSxcblx0XHR5ZWxsb3dCcmlnaHQ6IGYoXCJcXHgxYls5M21cIiwgXCJcXHgxYlszOW1cIiksXG5cdFx0Ymx1ZUJyaWdodDogZihcIlxceDFiWzk0bVwiLCBcIlxceDFiWzM5bVwiKSxcblx0XHRtYWdlbnRhQnJpZ2h0OiBmKFwiXFx4MWJbOTVtXCIsIFwiXFx4MWJbMzltXCIpLFxuXHRcdGN5YW5CcmlnaHQ6IGYoXCJcXHgxYls5Nm1cIiwgXCJcXHgxYlszOW1cIiksXG5cdFx0d2hpdGVCcmlnaHQ6IGYoXCJcXHgxYls5N21cIiwgXCJcXHgxYlszOW1cIiksXG5cblx0XHRiZ0JsYWNrQnJpZ2h0OiBmKFwiXFx4MWJbMTAwbVwiLCBcIlxceDFiWzQ5bVwiKSxcblx0XHRiZ1JlZEJyaWdodDogZihcIlxceDFiWzEwMW1cIiwgXCJcXHgxYls0OW1cIiksXG5cdFx0YmdHcmVlbkJyaWdodDogZihcIlxceDFiWzEwMm1cIiwgXCJcXHgxYls0OW1cIiksXG5cdFx0YmdZZWxsb3dCcmlnaHQ6IGYoXCJcXHgxYlsxMDNtXCIsIFwiXFx4MWJbNDltXCIpLFxuXHRcdGJnQmx1ZUJyaWdodDogZihcIlxceDFiWzEwNG1cIiwgXCJcXHgxYls0OW1cIiksXG5cdFx0YmdNYWdlbnRhQnJpZ2h0OiBmKFwiXFx4MWJbMTA1bVwiLCBcIlxceDFiWzQ5bVwiKSxcblx0XHRiZ0N5YW5CcmlnaHQ6IGYoXCJcXHgxYlsxMDZtXCIsIFwiXFx4MWJbNDltXCIpLFxuXHRcdGJnV2hpdGVCcmlnaHQ6IGYoXCJcXHgxYlsxMDdtXCIsIFwiXFx4MWJbNDltXCIpLFxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlQ29sb3JzKClcbm1vZHVsZS5leHBvcnRzLmNyZWF0ZUNvbG9ycyA9IGNyZWF0ZUNvbG9yc1xuIiwKICAgICJpbXBvcnQgdHlwZSB7IEV4YW1wbGUgYXMgQVBJRXhhbXBsZSB9IGZyb20gXCIuLi9pbnRlcm5hbC9hcGkvbW9kZWxzL0V4YW1wbGVcIjtcblxuLyoqXG4gKiBUaGUgd2lyZSBmb3JtYXQgZm9yIGV4YW1wbGVzOiB0aGUgZml4ZWQgQVBJIGZpZWxkcyBwbHVzIGFyYml0cmFyeVxuICogdXNlci1kZWZpbmVkIHByb3BlcnRpZXMgKGlucHV0LCBhY3R1YWxfb3V0cHV0LCBldGMuKS5cbiAqL1xuZXhwb3J0IHR5cGUgRXhhbXBsZURpY3QgPSBBUElFeGFtcGxlICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbi8qKlxuICogQSBzaW5nbGUgZXZhbHVhdGlvbiBleGFtcGxlIHdpdGggZmxleGlibGUga2V5LXZhbHVlIHByb3BlcnRpZXMuXG4gKlxuICogVXNlIGBFeGFtcGxlLmNyZWF0ZSgpYCB0byBjb25zdHJ1Y3QgYW4gZXhhbXBsZSB3aXRoIGFyYml0cmFyeSBmaWVsZHNcbiAqIHN1Y2ggYXMgYGlucHV0YCwgYGFjdHVhbE91dHB1dGAsIGBleHBlY3RlZE91dHB1dGAsIGV0Yy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgZXhhbXBsZSA9IEV4YW1wbGUuY3JlYXRlKHtcbiAqICAgaW5wdXQ6IFwiV2hhdCBpcyB0aGUgY2FwaXRhbCBvZiBGcmFuY2U/XCIsXG4gKiAgIGFjdHVhbF9vdXRwdXQ6IFwiUGFyaXMgaXMgdGhlIGNhcGl0YWwgb2YgRnJhbmNlLlwiLFxuICogICBleHBlY3RlZF9vdXRwdXQ6IFwiUGFyaXNcIixcbiAqIH0pO1xuICpcbiAqIGV4YW1wbGUuZ2V0KFwiaW5wdXRcIik7IC8vIFwiV2hhdCBpcyB0aGUgY2FwaXRhbCBvZiBGcmFuY2U/XCJcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgRXhhbXBsZSB7XG4gIHJlYWRvbmx5IGV4YW1wbGVJZDogc3RyaW5nO1xuICByZWFkb25seSBjcmVhdGVkQXQ6IHN0cmluZztcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nIHwgbnVsbDtcbiAgcHJpdmF0ZSByZWFkb25seSBfcHJvcGVydGllczogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICBleGFtcGxlSWQ6IHN0cmluZyxcbiAgICBjcmVhdGVkQXQ6IHN0cmluZyxcbiAgICBuYW1lOiBzdHJpbmcgfCBudWxsLFxuICAgIHByb3BlcnRpZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICApIHtcbiAgICB0aGlzLmV4YW1wbGVJZCA9IGV4YW1wbGVJZDtcbiAgICB0aGlzLmNyZWF0ZWRBdCA9IGNyZWF0ZWRBdDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuX3Byb3BlcnRpZXMgPSBwcm9wZXJ0aWVzO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbiBleGFtcGxlIHdpdGggdGhlIGdpdmVuIHByb3BlcnRpZXMuXG4gICAqXG4gICAqIEFueSBrZXktdmFsdWUgcGFpcnMgcGFzc2VkIGluIGBwcm9wc2AgYmVjb21lIGFjY2Vzc2libGUgdmlhIGAuZ2V0KClgLlxuICAgKiBDb21tb24ga2V5czogYGlucHV0YCwgYGFjdHVhbF9vdXRwdXRgLCBgZXhwZWN0ZWRfb3V0cHV0YCwgYHJldHJpZXZhbF9jb250ZXh0YC5cbiAgICovXG4gIHN0YXRpYyBjcmVhdGUocHJvcHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge30pOiBFeGFtcGxlIHtcbiAgICByZXR1cm4gbmV3IEV4YW1wbGUoY3J5cHRvLnJhbmRvbVVVSUQoKSwgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLCBudWxsLCB7XG4gICAgICAuLi5wcm9wcyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKiBLbm93biBrZXlzIG9uIHRoZSBBUEkgRXhhbXBsZSBpbnRlcmZhY2UgdGhhdCBhcmUgbm90IHVzZXIgcHJvcGVydGllcy4gKi9cbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTUVUQV9LRVlTID0gbmV3IFNldChbXG4gICAgXCJleGFtcGxlX2lkXCIsXG4gICAgXCJjcmVhdGVkX2F0XCIsXG4gICAgXCJuYW1lXCIsXG4gICAgXCJ0cmFjZV9pZFwiLFxuICAgIFwic3Bhbl9pZFwiLFxuICAgIFwib2ZmbGluZV90cmFjZV9pZFwiLFxuICBdKTtcblxuICAvKipcbiAgICogUmVjb25zdHJ1Y3QgYW4gRXhhbXBsZSBmcm9tIGFuIEFQSSByZXNwb25zZSBkaWN0LlxuICAgKlxuICAgKiBTZXBhcmF0ZXMgdGhlIGZpeGVkIG1ldGFkYXRhIGZpZWxkcyAoYGV4YW1wbGVfaWRgLCBgY3JlYXRlZF9hdGAsIGBuYW1lYClcbiAgICogZnJvbSB1c2VyLWRlZmluZWQgcHJvcGVydGllcy5cbiAgICovXG4gIHN0YXRpYyBmcm9tKGRhdGE6IEV4YW1wbGVEaWN0KTogRXhhbXBsZSB7XG4gICAgY29uc3QgcHJvcGVydGllczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhkYXRhKSkge1xuICAgICAgaWYgKCFFeGFtcGxlLk1FVEFfS0VZUy5oYXMoa2V5KSkge1xuICAgICAgICBwcm9wZXJ0aWVzW2tleV0gPSAoZGF0YSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBFeGFtcGxlKFxuICAgICAgZGF0YS5leGFtcGxlX2lkID8/IFwiXCIsXG4gICAgICBkYXRhLmNyZWF0ZWRfYXQgPz8gXCJcIixcbiAgICAgIGRhdGEubmFtZSA/PyBudWxsLFxuICAgICAgcHJvcGVydGllcyxcbiAgICApO1xuICB9XG5cbiAgLyoqIEdldCBhIHByb3BlcnR5IGJ5IGtleS4gKi9cbiAgZ2V0KGtleTogc3RyaW5nKTogdW5rbm93biB7XG4gICAgcmV0dXJuIHRoaXMuX3Byb3BlcnRpZXNba2V5XTtcbiAgfVxuXG4gIC8qKiBDaGVjayBpZiBhIHByb3BlcnR5IGtleSBleGlzdHMuICovXG4gIGhhcyhrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBrZXkgaW4gdGhpcy5fcHJvcGVydGllcztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gYSBzaGFsbG93IGNvcHkgb2YgYWxsIGN1c3RvbSBwcm9wZXJ0aWVzLiAqL1xuICBnZXQgcHJvcGVydGllcygpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5fcHJvcGVydGllcyB9O1xuICB9XG5cbiAgLyoqIFNlcmlhbGl6ZSB0byB0aGUgQVBJIHdpcmUgZm9ybWF0LiAqL1xuICB0b0pTT04oKTogRXhhbXBsZURpY3Qge1xuICAgIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICBleGFtcGxlX2lkOiB0aGlzLmV4YW1wbGVJZCxcbiAgICAgIGNyZWF0ZWRfYXQ6IHRoaXMuY3JlYXRlZEF0LFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgIH07XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcHJvcGVydGllcykpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgfVxuICAgIC8vIHJlc3VsdCBzYXRpc2ZpZXMgRXhhbXBsZURpY3Qgc3RydWN0dXJhbGx5IOKAlCBleGFtcGxlX2lkIGFuZCBjcmVhdGVkX2F0XG4gICAgLy8gYXJlIGFsd2F5cyBwcmVzZW50IHN0cmluZ3MsIHBsdXMgYXJiaXRyYXJ5IGV4dHJhIGtleXMuXG4gICAgcmV0dXJuIHJlc3VsdCBhcyBFeGFtcGxlRGljdDtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi9sb2dnZXJcIjtcblxuZXhwb3J0IHR5cGUgU2VyaWFsaXplciA9IChvYmo6IHVua25vd24pID0+IHN0cmluZztcblxuZnVuY3Rpb24gY3JlYXRlQ2lyY3VsYXJSZXBsYWNlcigpOiAoXG4gIHRoaXM6IHVua25vd24sXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogdW5rbm93bixcbikgPT4gdW5rbm93biB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgV2Vha1NldDxvYmplY3Q+KCk7XG4gIHJldHVybiBmdW5jdGlvbiAoX2tleTogc3RyaW5nLCB2YWx1ZTogdW5rbm93bik6IHVua25vd24ge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYmlnaW50XCIpIHJldHVybiB2YWx1ZS50b1N0cmluZygpO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgIGlmIChzZWVuLmhhcyh2YWx1ZSkpIHJldHVybiBcIltDaXJjdWxhcl1cIjtcbiAgICAgIHNlZW4uYWRkKHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2FmZVN0cmluZ2lmeShvYmo6IHVua25vd24pOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KG9iaik7XG4gICAgaWYgKHR5cGVvZiByZXN1bHQgPT09IFwic3RyaW5nXCIpIHJldHVybiByZXN1bHQ7XG4gICAgcmV0dXJuIFN0cmluZyhyZXN1bHQpO1xuICB9IGNhdGNoIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gSlNPTi5zdHJpbmdpZnkob2JqLCBjcmVhdGVDaXJjdWxhclJlcGxhY2VyKCkpO1xuICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT09IFwic3RyaW5nXCIgPyByZXN1bHQgOiBTdHJpbmcob2JqKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBMb2dnZXIuZXJyb3IoYHNhZmVTdHJpbmdpZnkgZmFpbGVkOiAke2V9YCk7XG4gICAgICByZXR1cm4gU3RyaW5nKG9iaik7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2VyaWFsaXplcyBhbiBhdHRyaWJ1dGUgdG8gYW4gXCJBdHRyaWJ1dGVcIiBjb21wYXRpYmxlIHZhbHVlLiBQcmltaXRpdmVzIGFyZSByZXR1cm5lZCBhcyBpcywgb2JqZWN0cyBhcmUgc2VyaWFsaXplZCB1c2luZyB0aGUgcHJvdmlkZWQgc2VyaWFsaXplci5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gc2VyaWFsaXplLlxuICogQHBhcmFtIHNlcmlhbGl6ZXIgLSBUaGUgc2VyaWFsaXplciB0byB1c2UuXG4gKiBAcmV0dXJucyBBIHN0cmluZywgbnVtYmVyLCBvciBib29sZWFuIHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQXR0cmlidXRlKFxuICB2YWx1ZTogdW5rbm93bixcbiAgc2VyaWFsaXplcjogU2VyaWFsaXplcixcbik6IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4ge1xuICBpZiAoXG4gICAgdHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiIHx8XG4gICAgdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiIHx8XG4gICAgdHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIlxuICApXG4gICAgcmV0dXJuIHZhbHVlO1xuICByZXR1cm4gc2VyaWFsaXplcih2YWx1ZSk7XG59XG4iLAogICAgImltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vcGFja2FnZS5qc29uXCIgd2l0aCB7IHR5cGU6IFwianNvblwiIH07XG5cbmV4cG9ydCBjb25zdCBWRVJTSU9OID0gdmVyc2lvbjtcbiIsCiAgICAiaW1wb3J0IHtcbiAgUk9PVF9DT05URVhULFxuICBjb250ZXh0IGFzIG90ZWxDb250ZXh0LFxuICB0eXBlIENvbnRleHQsXG59IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB7IEFzeW5jTG9jYWxTdG9yYWdlIH0gZnJvbSBcImFzeW5jX2hvb2tzXCI7XG5cbnR5cGUgT1RlbENvbnRleHRBcGkgPSB0eXBlb2Ygb3RlbENvbnRleHQ7XG5cbmxldCBpbnN0YWxsZWQgPSBmYWxzZTtcbmxldCBnZXRKdWRnbWVudENvbnRleHQ6ICgoKSA9PiBDb250ZXh0KSB8IG51bGwgPSBudWxsO1xuXG5jb25zdCBnYXRlU3RvcmFnZSA9IG5ldyBBc3luY0xvY2FsU3RvcmFnZTxib29sZWFuPigpO1xuY29uc3QgYnJpZGdlQ29udGV4dFN0b3JhZ2UgPSBuZXcgQXN5bmNMb2NhbFN0b3JhZ2U8Q29udGV4dD4oKTtcblxuY29uc3Qgb3JpZ2luYWxBY3RpdmUgPSBvdGVsQ29udGV4dC5hY3RpdmUuYmluZChvdGVsQ29udGV4dCk7XG5jb25zdCBvcmlnaW5hbFdpdGggPSBvdGVsQ29udGV4dC53aXRoLmJpbmQob3RlbENvbnRleHQpO1xuY29uc3Qgb3JpZ2luYWxCaW5kID0gb3RlbENvbnRleHQuYmluZC5iaW5kKG90ZWxDb250ZXh0KTtcblxuZnVuY3Rpb24gaXNHYXRlRW5hYmxlZCgpOiBib29sZWFuIHtcbiAgcmV0dXJuIGdhdGVTdG9yYWdlLmdldFN0b3JlKCkgPT09IHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnN0YWxsT3RlbENvbnRleHRCcmlkZ2UoXG4gIGdldEN1cnJlbnRKdWRnbWVudENvbnRleHQ6ICgpID0+IENvbnRleHQsXG4pOiB2b2lkIHtcbiAgZ2V0SnVkZ21lbnRDb250ZXh0ID0gZ2V0Q3VycmVudEp1ZGdtZW50Q29udGV4dDtcbiAgaWYgKGluc3RhbGxlZCkgcmV0dXJuO1xuXG4gIGNvbnN0IGFwaSA9IG90ZWxDb250ZXh0IGFzIE9UZWxDb250ZXh0QXBpICYge1xuICAgIGFjdGl2ZTogKCkgPT4gQ29udGV4dDtcbiAgICB3aXRoOiA8QSBleHRlbmRzIHVua25vd25bXSwgRiBleHRlbmRzICguLi5hcmdzOiBBKSA9PiBSZXR1cm5UeXBlPEY+PihcbiAgICAgIGNvbnRleHQ6IENvbnRleHQsXG4gICAgICBmbjogRixcbiAgICAgIHRoaXNBcmc/OiBUaGlzUGFyYW1ldGVyVHlwZTxGPixcbiAgICAgIC4uLmFyZ3M6IEFcbiAgICApID0+IFJldHVyblR5cGU8Rj47XG4gICAgYmluZDogPFQ+KGNvbnRleHQ6IENvbnRleHQsIHRhcmdldDogVCkgPT4gVDtcbiAgfTtcblxuICBhcGkuYWN0aXZlID0gKCk6IENvbnRleHQgPT4ge1xuICAgIGlmICghaXNHYXRlRW5hYmxlZCgpKSByZXR1cm4gb3JpZ2luYWxBY3RpdmUoKTtcbiAgICBjb25zdCBicmlkZ2VkID0gYnJpZGdlQ29udGV4dFN0b3JhZ2UuZ2V0U3RvcmUoKTtcbiAgICBpZiAoYnJpZGdlZCkgcmV0dXJuIGJyaWRnZWQ7XG4gICAgcmV0dXJuIGdldEp1ZGdtZW50Q29udGV4dCA/IGdldEp1ZGdtZW50Q29udGV4dCgpIDogUk9PVF9DT05URVhUO1xuICB9O1xuXG4gIGFwaS53aXRoID0gKGNvbnRleHRWYWx1ZSwgZm4sIHRoaXNBcmcsIC4uLmFyZ3MpID0+IHtcbiAgICBpZiAoIWlzR2F0ZUVuYWJsZWQoKSlcbiAgICAgIHJldHVybiBvcmlnaW5hbFdpdGgoY29udGV4dFZhbHVlLCBmbiwgdGhpc0FyZywgLi4uYXJncyk7XG4gICAgcmV0dXJuIGJyaWRnZUNvbnRleHRTdG9yYWdlLnJ1bihjb250ZXh0VmFsdWUsICgpID0+XG4gICAgICBmbi5hcHBseSh0aGlzQXJnLCBhcmdzKSxcbiAgICApO1xuICB9O1xuXG4gIGFwaS5iaW5kID0gKGNvbnRleHRWYWx1ZSwgdGFyZ2V0KSA9PiB7XG4gICAgaWYgKCFpc0dhdGVFbmFibGVkKCkpIHJldHVybiBvcmlnaW5hbEJpbmQoY29udGV4dFZhbHVlLCB0YXJnZXQpO1xuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiB0YXJnZXQ7XG4gICAgY29uc3QgZm4gPSB0YXJnZXQgYXMgdW5rbm93biBhcyAoLi4uYXJnczogdW5rbm93bltdKSA9PiB1bmtub3duO1xuICAgIHJldHVybiAoKC4uLmFyZ3M6IHVua25vd25bXSkgPT5cbiAgICAgIGJyaWRnZUNvbnRleHRTdG9yYWdlLnJ1bihjb250ZXh0VmFsdWUsICgpID0+XG4gICAgICAgIGZuKC4uLmFyZ3MpLFxuICAgICAgKSkgYXMgdHlwZW9mIHRhcmdldDtcbiAgfTtcblxuICBpbnN0YWxsZWQgPSB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcnVuV2l0aE90ZWxCcmlkZ2VHYXRlPFQ+KGN0eDogQ29udGV4dCwgZm46ICgpID0+IFQpOiBUIHtcbiAgcmV0dXJuIGdhdGVTdG9yYWdlLnJ1bih0cnVlLCAoKSA9PiBicmlkZ2VDb250ZXh0U3RvcmFnZS5ydW4oY3R4LCBmbikpO1xufVxuIiwKICAgICJpbXBvcnQge1xuICBJTlZBTElEX1NQQU5fQ09OVEVYVCxcbiAgUk9PVF9DT05URVhULFxuICBTcGFuU3RhdHVzQ29kZSxcbiAgdHJhY2UsXG4gIHR5cGUgQ29udGV4dCxcbiAgdHlwZSBTcGFuLFxuICB0eXBlIFNwYW5Db250ZXh0LFxuICB0eXBlIFNwYW5PcHRpb25zLFxuICB0eXBlIFRyYWNlcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHR5cGUgeyBJbnN0cnVtZW50YXRpb24gfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvaW5zdHJ1bWVudGF0aW9uXCI7XG5pbXBvcnQgdHlwZSB7IEJhc2ljVHJhY2VyUHJvdmlkZXIgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB0eXBlIHsgSnVkZ21lbnRBcGlDbGllbnQgfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvbG9nZ2VyXCI7XG5pbXBvcnQgdHlwZSB7IFNlcmlhbGl6ZXIgfSBmcm9tIFwiLi4vdXRpbHMvc2VyaWFsaXplclwiO1xuaW1wb3J0IHR5cGUgeyBKdWRnbWVudFNwYW5FeHBvcnRlciB9IGZyb20gXCIuL2V4cG9ydGVycy9KdWRnbWVudFNwYW5FeHBvcnRlclwiO1xuaW1wb3J0IHR5cGUgeyBKdWRnbWVudFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi9wcm9jZXNzb3JzL0p1ZGdtZW50U3BhblByb2Nlc3NvclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlUnVudGltZVRyYWNlciB7XG4gIHByb2plY3ROYW1lOiBzdHJpbmcgfCBudWxsO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGFwaUtleTogc3RyaW5nIHwgbnVsbDtcbiAgb3JnYW5pemF0aW9uSWQ6IHN0cmluZyB8IG51bGw7XG4gIGFwaVVybDogc3RyaW5nIHwgbnVsbDtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZyB8IG51bGw7XG4gIHNlcmlhbGl6ZXI6IFNlcmlhbGl6ZXI7XG4gIF90cmFjZXJQcm92aWRlcjogQmFzaWNUcmFjZXJQcm92aWRlcjtcbiAgX2NsaWVudDogSnVkZ21lbnRBcGlDbGllbnQgfCBudWxsO1xuICBfZW5hYmxlTW9uaXRvcmluZzogYm9vbGVhbjtcbiAgc3VwcG9ydHNMaXZlSW5zdHJ1bWVudGF0aW9uOiBib29sZWFuO1xuICBnZXRTcGFuRXhwb3J0ZXIoKTogSnVkZ21lbnRTcGFuRXhwb3J0ZXI7XG4gIGdldFNwYW5Qcm9jZXNzb3IoKTogSnVkZ21lbnRTcGFuUHJvY2Vzc29yO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlUnVudGltZSB7XG4gIHJlZ2lzdGVyKHRyYWNlcjogVHJhY2VSdW50aW1lVHJhY2VyKTogdm9pZDtcbiAgZGVyZWdpc3Rlcih0cmFjZXI6IFRyYWNlUnVudGltZVRyYWNlcik6IHZvaWQ7XG4gIHNldEFjdGl2ZSh0cmFjZXI6IFRyYWNlUnVudGltZVRyYWNlcik6IGJvb2xlYW47XG4gIGdldEFjdGl2ZVRyYWNlcigpOiBUcmFjZVJ1bnRpbWVUcmFjZXIgfCBudWxsO1xuICBnZXRDdXJyZW50Q29udGV4dCgpOiBDb250ZXh0O1xuICBzZXRTcGFuKGN0eDogQ29udGV4dCwgc3BhbjogU3Bhbik6IENvbnRleHQ7XG4gIHdyYXBTcGFuQ29udGV4dChzcGFuQ29udGV4dDogU3BhbkNvbnRleHQpOiBTcGFuO1xuICBnZXRDdXJyZW50U3BhbigpOiBTcGFuIHwgdW5kZWZpbmVkO1xuICBnZXRUcmFjZXIoXG4gICAgaW5zdHJ1bWVudGluZ01vZHVsZU5hbWU6IHN0cmluZyxcbiAgICBpbnN0cnVtZW50aW5nTGlicmFyeVZlcnNpb24/OiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHsgc2NoZW1hVXJsPzogc3RyaW5nIH0sXG4gICk6IFRyYWNlcjtcbiAgYWRkSW5zdHJ1bWVudGF0aW9uKGluc3RydW1lbnRvcjogSW5zdHJ1bWVudGF0aW9uKTogdm9pZDtcbiAgdXNlU3BhbjxUPihcbiAgICBzcGFuOiBTcGFuLFxuICAgIGVuZE9uRXhpdDogYm9vbGVhbixcbiAgICByZWNvcmRFeGNlcHRpb246IGJvb2xlYW4sXG4gICAgc2V0U3RhdHVzT25FeGNlcHRpb246IGJvb2xlYW4sXG4gICAgZm46ICgpID0+IFQsXG4gICk6IFQ7XG4gIGF0dGFjaENvbnRleHQoY3R4OiBDb250ZXh0KTogdm9pZDtcbiAgd2l0aENvbnRleHQ8VD4oY3R4OiBDb250ZXh0LCBmbjogKCkgPT4gVCk6IFQ7XG4gIGZvcmNlRmx1c2goKTogUHJvbWlzZTx2b2lkPjtcbiAgc2h1dGRvd24oKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuY2xhc3MgTm9PcFRyYWNlciBpbXBsZW1lbnRzIFRyYWNlciB7XG4gIHN0YXJ0U3BhbigpOiBTcGFuIHtcbiAgICByZXR1cm4gdHJhY2Uud3JhcFNwYW5Db250ZXh0KElOVkFMSURfU1BBTl9DT05URVhUKTtcbiAgfVxuXG4gIHN0YXJ0QWN0aXZlU3BhbjxGIGV4dGVuZHMgKHNwYW46IFNwYW4pID0+IHVua25vd24+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBmbjogRixcbiAgKTogUmV0dXJuVHlwZTxGPjtcbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFNwYW5PcHRpb25zLFxuICAgIGZuOiBGLFxuICApOiBSZXR1cm5UeXBlPEY+O1xuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3Bhbk9wdGlvbnMsXG4gICAgY29udGV4dDogQ29udGV4dCxcbiAgICBmbjogRixcbiAgKTogUmV0dXJuVHlwZTxGPjtcbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgX25hbWU6IHN0cmluZyxcbiAgICAuLi5hcmdzOiBbRl0gfCBbU3Bhbk9wdGlvbnMsIEZdIHwgW1NwYW5PcHRpb25zLCBDb250ZXh0LCBGXVxuICApOiBSZXR1cm5UeXBlPEY+IHtcbiAgICBjb25zdCBmbiA9XG4gICAgICBhcmdzLmxlbmd0aCA9PT0gMSA/IGFyZ3NbMF0gOiBhcmdzLmxlbmd0aCA9PT0gMiA/IGFyZ3NbMV0gOiBhcmdzWzJdO1xuICAgIHJldHVybiBmbih0aGlzLnN0YXJ0U3BhbigpKSBhcyBSZXR1cm5UeXBlPEY+O1xuICB9XG59XG5cbmNvbnN0IG5vT3BUcmFjZXIgPSBuZXcgTm9PcFRyYWNlcigpO1xuXG5jb25zdCBub09wUnVudGltZTogVHJhY2VSdW50aW1lID0ge1xuICByZWdpc3RlcigpIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9LFxuICBkZXJlZ2lzdGVyKCkge1xuICAgIC8qIGVtcHR5ICovXG4gIH0sXG4gIHNldEFjdGl2ZSgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGdldEFjdGl2ZVRyYWNlcigpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgZ2V0Q3VycmVudENvbnRleHQoKSB7XG4gICAgcmV0dXJuIFJPT1RfQ09OVEVYVDtcbiAgfSxcbiAgc2V0U3BhbihjdHgsIHNwYW4pIHtcbiAgICByZXR1cm4gdHJhY2Uuc2V0U3BhbihjdHgsIHNwYW4pO1xuICB9LFxuICB3cmFwU3BhbkNvbnRleHQoc3BhbkNvbnRleHQpIHtcbiAgICByZXR1cm4gdHJhY2Uud3JhcFNwYW5Db250ZXh0KHNwYW5Db250ZXh0KTtcbiAgfSxcbiAgZ2V0Q3VycmVudFNwYW4oKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfSxcbiAgZ2V0VHJhY2VyKCkge1xuICAgIExvZ2dlci5kZWJ1ZyhcIk5vIGFjdGl2ZSB0cmFjZXIgcHJvdmlkZXIsIHJldHVybmluZyBOb09wVHJhY2VyXCIpO1xuICAgIHJldHVybiBub09wVHJhY2VyO1xuICB9LFxuICBhZGRJbnN0cnVtZW50YXRpb24oKSB7XG4gICAgTG9nZ2VyLndhcm5pbmcoXG4gICAgICBcIk5vIGFjdGl2ZSB0cmFjZXIgcHJvdmlkZXIuIEluc3RydW1lbnRhdGlvbiB3YXMgbm90IHJlZ2lzdGVyZWQuXCIsXG4gICAgKTtcbiAgfSxcbiAgdXNlU3BhbihzcGFuLCBlbmRPbkV4aXQsIHJlY29yZEV4Y2VwdGlvbiwgc2V0U3RhdHVzT25FeGNlcHRpb24sIGZuKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGZuKCk7XG4gICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgICAgLmNhdGNoKChleGM6IHVua25vd24pID0+IHtcbiAgICAgICAgICAgIGlmIChzcGFuLmlzUmVjb3JkaW5nKCkpIHtcbiAgICAgICAgICAgICAgaWYgKHJlY29yZEV4Y2VwdGlvbikgc3Bhbi5yZWNvcmRFeGNlcHRpb24oZXhjIGFzIEVycm9yKTtcbiAgICAgICAgICAgICAgaWYgKHNldFN0YXR1c09uRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyID0gZXhjIGFzIEVycm9yO1xuICAgICAgICAgICAgICAgIHNwYW4uc2V0U3RhdHVzKHtcbiAgICAgICAgICAgICAgICAgIGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZXJyLm5hbWV9OiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IGV4YztcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIGlmIChlbmRPbkV4aXQpIHNwYW4uZW5kKCk7XG4gICAgICAgICAgfSkgYXMgdHlwZW9mIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGlmIChlbmRPbkV4aXQpIHNwYW4uZW5kKCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGV4Yykge1xuICAgICAgaWYgKHNwYW4uaXNSZWNvcmRpbmcoKSkge1xuICAgICAgICBpZiAocmVjb3JkRXhjZXB0aW9uKSBzcGFuLnJlY29yZEV4Y2VwdGlvbihleGMgYXMgRXJyb3IpO1xuICAgICAgICBpZiAoc2V0U3RhdHVzT25FeGNlcHRpb24pIHtcbiAgICAgICAgICBjb25zdCBlcnIgPSBleGMgYXMgRXJyb3I7XG4gICAgICAgICAgc3Bhbi5zZXRTdGF0dXMoe1xuICAgICAgICAgICAgY29kZTogU3BhblN0YXR1c0NvZGUuRVJST1IsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlcnIubmFtZX06ICR7ZXJyLm1lc3NhZ2V9YCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGVuZE9uRXhpdCkgc3Bhbi5lbmQoKTtcbiAgICAgIHRocm93IGV4YztcbiAgICB9XG4gIH0sXG4gIGF0dGFjaENvbnRleHQoKSB7XG4gICAgLyogZW1wdHkgKi9cbiAgfSxcbiAgd2l0aENvbnRleHQoX2N0eCwgZm4pIHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSxcbiAgZm9yY2VGbHVzaCgpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH0sXG4gIHNodXRkb3duKCkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfSxcbn07XG5cbmxldCBydW50aW1lOiBUcmFjZVJ1bnRpbWUgfCBudWxsID0gbnVsbDtcbmxldCBsbG1XcmFwcGVyOiAoKGNsaWVudDogdW5rbm93bikgPT4gdW5rbm93bikgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIHNldFRyYWNlUnVudGltZShuZXh0UnVudGltZTogVHJhY2VSdW50aW1lKTogdm9pZCB7XG4gIHJ1bnRpbWUgPSBuZXh0UnVudGltZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRyYWNlUnVudGltZSgpOiBUcmFjZVJ1bnRpbWUge1xuICByZXR1cm4gcnVudGltZSA/PyBub09wUnVudGltZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldExMTVdyYXBwZXIod3JhcHBlcjogKGNsaWVudDogdW5rbm93bikgPT4gdW5rbm93bik6IHZvaWQge1xuICBsbG1XcmFwcGVyID0gd3JhcHBlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBMTE1DbGllbnQ8VD4oY2xpZW50OiBUKTogVCB7XG4gIGlmICghbGxtV3JhcHBlcikge1xuICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgXCJMTE0gY2xpZW50IGluc3RydW1lbnRhdGlvbiBpcyBub3QgYXZhaWxhYmxlIGZyb20gdGhpcyBlbnRyeXBvaW50LlwiLFxuICAgICk7XG4gICAgcmV0dXJuIGNsaWVudDtcbiAgfVxuICByZXR1cm4gbGxtV3JhcHBlcihjbGllbnQpIGFzIFQ7XG59XG4iLAogICAgImltcG9ydCB7XG4gIElOVkFMSURfU1BBTl9DT05URVhULFxuICBST09UX0NPTlRFWFQsXG4gIFNwYW5TdGF0dXNDb2RlLFxuICB0cmFjZSxcbiAgdHlwZSBDb250ZXh0LFxuICB0eXBlIFNwYW4sXG4gIHR5cGUgU3BhbkNvbnRleHQsXG4gIHR5cGUgU3Bhbk9wdGlvbnMsXG4gIHR5cGUgVHJhY2VyLFxuICB0eXBlIFRyYWNlclByb3ZpZGVyLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvYXBpXCI7XG5pbXBvcnQge1xuICByZWdpc3Rlckluc3RydW1lbnRhdGlvbnMsXG4gIHR5cGUgSW5zdHJ1bWVudGF0aW9uLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvaW5zdHJ1bWVudGF0aW9uXCI7XG5pbXBvcnQgeyBBc3luY0xvY2FsU3RvcmFnZSB9IGZyb20gXCJhc3luY19ob29rc1wiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2xvZ2dlclwiO1xuaW1wb3J0IHR5cGUgeyBCYXNlVHJhY2VyIH0gZnJvbSBcIi4vQmFzZVRyYWNlclwiO1xuaW1wb3J0IHtcbiAgaW5zdGFsbE90ZWxDb250ZXh0QnJpZGdlLFxuICBydW5XaXRoT3RlbEJyaWRnZUdhdGUsXG59IGZyb20gXCIuL2luc3RydW1lbnRhdGlvbi9PdGVsQ29udGV4dEJyaWRnZVwiO1xuaW1wb3J0IHsgc2V0VHJhY2VSdW50aW1lIH0gZnJvbSBcIi4vcnVudGltZVwiO1xuXG5jb25zdCBUUkFDRVJfTkFNRSA9IFwianVkZ2V2YWxcIjtcblxuY29uc3QgX2NvbnRleHRTdG9yYWdlID0gbmV3IEFzeW5jTG9jYWxTdG9yYWdlPENvbnRleHQ+KCk7XG5cbmNsYXNzIFByb3h5VHJhY2VyIGltcGxlbWVudHMgVHJhY2VyIHtcbiAgcHJpdmF0ZSBfcHJvdmlkZXI6IEp1ZGdtZW50VHJhY2VyUHJvdmlkZXI7XG5cbiAgY29uc3RydWN0b3IocHJvdmlkZXI6IEp1ZGdtZW50VHJhY2VyUHJvdmlkZXIpIHtcbiAgICB0aGlzLl9wcm92aWRlciA9IHByb3ZpZGVyO1xuICB9XG5cbiAgc3RhcnRTcGFuKG5hbWU6IHN0cmluZywgb3B0aW9ucz86IFNwYW5PcHRpb25zLCBjb250ZXh0PzogQ29udGV4dCk6IFNwYW4ge1xuICAgIGNvbnN0IGN0eCA9IGNvbnRleHQgPz8gdGhpcy5fcHJvdmlkZXIuZ2V0Q3VycmVudENvbnRleHQoKTtcbiAgICBjb25zdCBkZWxlZ2F0ZSA9IHRoaXMuX3Byb3ZpZGVyLl9nZXREZWxlZ2F0ZVRyYWNlcigpO1xuICAgIHJldHVybiBkZWxlZ2F0ZS5zdGFydFNwYW4obmFtZSwgb3B0aW9ucywgY3R4KTtcbiAgfVxuXG4gIHN0YXJ0QWN0aXZlU3BhbjxGIGV4dGVuZHMgKHNwYW46IFNwYW4pID0+IHVua25vd24+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBmbjogRixcbiAgKTogUmV0dXJuVHlwZTxGPjtcbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFNwYW5PcHRpb25zLFxuICAgIGZuOiBGLFxuICApOiBSZXR1cm5UeXBlPEY+O1xuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3Bhbk9wdGlvbnMsXG4gICAgY29udGV4dDogQ29udGV4dCxcbiAgICBmbjogRixcbiAgKTogUmV0dXJuVHlwZTxGPjtcbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIC4uLmFyZ3M6IFtGXSB8IFtTcGFuT3B0aW9ucywgRl0gfCBbU3Bhbk9wdGlvbnMsIENvbnRleHQsIEZdXG4gICk6IFJldHVyblR5cGU8Rj4ge1xuICAgIGxldCBvcHRpb25zOiBTcGFuT3B0aW9ucyA9IHt9O1xuICAgIGxldCBjb250ZXh0OiBDb250ZXh0ID0gdGhpcy5fcHJvdmlkZXIuZ2V0Q3VycmVudENvbnRleHQoKTtcbiAgICBsZXQgZm46IEY7XG5cbiAgICBpZiAoYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgIGZuID0gYXJnc1swXTtcbiAgICB9IGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgICBvcHRpb25zID0gYXJnc1swXTtcbiAgICAgIGZuID0gYXJnc1sxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IGFyZ3NbMF07XG4gICAgICBjb250ZXh0ID0gYXJnc1sxXTtcbiAgICAgIGZuID0gYXJnc1syXTtcbiAgICB9XG5cbiAgICBjb25zdCBzcGFuID0gdGhpcy5zdGFydFNwYW4obmFtZSwgb3B0aW9ucywgY29udGV4dCk7XG4gICAgcmV0dXJuIHRoaXMuX3Byb3ZpZGVyLnVzZVNwYW4oc3BhbiwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgKCkgPT5cbiAgICAgIGZuKHNwYW4pLFxuICAgICkgYXMgUmV0dXJuVHlwZTxGPjtcbiAgfVxufVxuXG5jbGFzcyBOb09wVHJhY2VyIGltcGxlbWVudHMgVHJhY2VyIHtcbiAgc3RhcnRTcGFuKCk6IFNwYW4ge1xuICAgIHJldHVybiB0cmFjZS53cmFwU3BhbkNvbnRleHQoSU5WQUxJRF9TUEFOX0NPTlRFWFQpO1xuICB9XG5cbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGZuOiBGLFxuICApOiBSZXR1cm5UeXBlPEY+O1xuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3Bhbk9wdGlvbnMsXG4gICAgZm46IEYsXG4gICk6IFJldHVyblR5cGU8Rj47XG4gIHN0YXJ0QWN0aXZlU3BhbjxGIGV4dGVuZHMgKHNwYW46IFNwYW4pID0+IHVua25vd24+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBTcGFuT3B0aW9ucyxcbiAgICBjb250ZXh0OiBDb250ZXh0LFxuICAgIGZuOiBGLFxuICApOiBSZXR1cm5UeXBlPEY+O1xuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBfbmFtZTogc3RyaW5nLFxuICAgIC4uLmFyZ3M6IFtGXSB8IFtTcGFuT3B0aW9ucywgRl0gfCBbU3Bhbk9wdGlvbnMsIENvbnRleHQsIEZdXG4gICk6IFJldHVyblR5cGU8Rj4ge1xuICAgIGNvbnN0IGZuID1cbiAgICAgIGFyZ3MubGVuZ3RoID09PSAxID8gYXJnc1swXSA6IGFyZ3MubGVuZ3RoID09PSAyID8gYXJnc1sxXSA6IGFyZ3NbMl07XG4gICAgcmV0dXJuIGZuKHRoaXMuc3RhcnRTcGFuKCkpIGFzIFJldHVyblR5cGU8Rj47XG4gIH1cbn1cblxuLyoqXG4gKiBHbG9iYWwgc2luZ2xldG9uIHRoYXQgbWFuYWdlcyB0cmFjZXIgcmVnaXN0cmF0aW9uIGFuZCBjb250ZXh0IHByb3BhZ2F0aW9uLlxuICpcbiAqIEFjdHMgYXMgYSBwcm94eSBUcmFjZXJQcm92aWRlciB0aGF0IGRlbGVnYXRlcyB0byB0aGUgY3VycmVudGx5IGFjdGl2ZVxuICogdHJhY2VyJ3MgdW5kZXJseWluZyBPcGVuVGVsZW1ldHJ5IHByb3ZpZGVyLlxuICovXG5leHBvcnQgY2xhc3MgSnVkZ21lbnRUcmFjZXJQcm92aWRlciBpbXBsZW1lbnRzIFRyYWNlclByb3ZpZGVyIHtcbiAgcHJpdmF0ZSBzdGF0aWMgX2luc3RhbmNlOiBKdWRnbWVudFRyYWNlclByb3ZpZGVyIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBfYWN0aXZlVHJhY2VyOiBCYXNlVHJhY2VyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX2luc3RydW1lbnRhdGlvbnM6IEluc3RydW1lbnRhdGlvbltdID0gW107XG4gIHByaXZhdGUgX25vT3BUcmFjZXI6IE5vT3BUcmFjZXI7XG4gIHByaXZhdGUgX3Byb3h5VHJhY2VyOiBQcm94eVRyYWNlcjtcbiAgcHJpdmF0ZSBfdHJhY2VycyA9IG5ldyBTZXQ8QmFzZVRyYWNlcj4oKTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX25vT3BUcmFjZXIgPSBuZXcgTm9PcFRyYWNlcigpO1xuICAgIHRoaXMuX3Byb3h5VHJhY2VyID0gbmV3IFByb3h5VHJhY2VyKHRoaXMpO1xuICAgIHNldFRyYWNlUnVudGltZSh0aGlzKTtcbiAgICBpbnN0YWxsT3RlbENvbnRleHRCcmlkZ2UoKCkgPT4gdGhpcy5nZXRDdXJyZW50Q29udGV4dCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHNpbmdsZXRvbiBKdWRnbWVudFRyYWNlclByb3ZpZGVyIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcmV0dXJucyBUaGUgZ2xvYmFsIHByb3ZpZGVyIGluc3RhbmNlLlxuICAgKi9cbiAgc3RhdGljIGdldEluc3RhbmNlKCk6IEp1ZGdtZW50VHJhY2VyUHJvdmlkZXIge1xuICAgIEp1ZGdtZW50VHJhY2VyUHJvdmlkZXIuX2luc3RhbmNlID8/PSBuZXcgSnVkZ21lbnRUcmFjZXJQcm92aWRlcigpO1xuICAgIHJldHVybiBKdWRnbWVudFRyYWNlclByb3ZpZGVyLl9pbnN0YW5jZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnN0YWxsIHRoZSBKdWRnbWVudFRyYWNlclByb3ZpZGVyIGFzIHRoZSBnbG9iYWwgdHJhY2VyIHByb3ZpZGVyLlxuICAgKiBUaGlzIGdlbmVyYWxseSBkb2VzIG5vdCBuZWVkIHRvIGJlIGNhbGxlZCAtIEp1ZGdldmFsIGF1dG9tYXRpY2FsbHkgdXNlcyB0aGlzIGZvciBhbGwgaXRzIG9ic2VydmFiaWxpdHkgZnVuY3Rpb25hbGl0eS5cbiAgICogT25seSB1c2UgdGhpcyBpZiB5b3Ugc3BlY2lmaWNhbGx5IHdhbnQgdG8gb3ZlcnJpZGUgdGhlIGdsb2JhbCB0cmFjZXIgcHJvdmlkZXIsIHdoaWNoIHdpbGwgZW5hYmxlIGFsbCBPcGVudGVsZW1ldHJ5IGNhcHR1cmVkIGluc3RydW1lbnRhdGlvbnMgdG8gZmxvdyB0aHJvdWdoIGp1ZGdldmFsLlxuICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBpbnN0YWxsYXRpb24gd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIHN0YXRpYyBpbnN0YWxsQXNHbG9iYWxUcmFjZXJQcm92aWRlcigpOiBib29sZWFuIHtcbiAgICBjb25zdCBpbnN0YW5jZSA9IEp1ZGdtZW50VHJhY2VyUHJvdmlkZXIuZ2V0SW5zdGFuY2UoKTtcbiAgICByZXR1cm4gdHJhY2Uuc2V0R2xvYmFsVHJhY2VyUHJvdmlkZXIoaW5zdGFuY2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgdHJhY2VyIHdpdGggdGhlIHByb3ZpZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdHJhY2VyIC0gVGhlIHRyYWNlciB0byByZWdpc3Rlci5cbiAgICovXG4gIHJlZ2lzdGVyKHRyYWNlcjogQmFzZVRyYWNlcik6IHZvaWQge1xuICAgIHRoaXMuX3RyYWNlcnMuYWRkKHRyYWNlcik7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgdHJhY2VyIGZyb20gdGhlIHByb3ZpZGVyLlxuICAgKlxuICAgKiBAcGFyYW0gdHJhY2VyIC0gVGhlIHRyYWNlciB0byBkZXJlZ2lzdGVyLlxuICAgKi9cbiAgZGVyZWdpc3Rlcih0cmFjZXI6IEJhc2VUcmFjZXIpOiB2b2lkIHtcbiAgICB0aGlzLl90cmFjZXJzLmRlbGV0ZSh0cmFjZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhIHRyYWNlciBhcyB0aGUgYWN0aXZlIHRyYWNlci5cbiAgICpcbiAgICogQ2Fubm90IGJlIGNhbGxlZCB3aGlsZSBhIHJvb3Qgc3BhbiBpcyBhY3RpdmUuXG4gICAqXG4gICAqIEBwYXJhbSB0cmFjZXIgLSBUaGUgdHJhY2VyIHRvIGFjdGl2YXRlLlxuICAgKiBAcmV0dXJucyBgdHJ1ZWAgaWYgYWN0aXZhdGlvbiBzdWNjZWVkZWQuXG4gICAqL1xuICBzZXRBY3RpdmUodHJhY2VyOiBCYXNlVHJhY2VyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgY3VycmVudFNwYW4gPSB0aGlzLmdldEN1cnJlbnRTcGFuKCk7XG4gICAgaWYgKGN1cnJlbnRTcGFuPy5pc1JlY29yZGluZygpKSB7XG4gICAgICBpZiAodHJhY2UuZ2V0U3Bhbih0aGlzLmdldEN1cnJlbnRDb250ZXh0KCkpID09PSBjdXJyZW50U3Bhbikge1xuICAgICAgICBMb2dnZXIuZXJyb3IoXG4gICAgICAgICAgXCJDYW5ub3Qgc2V0X2FjdGl2ZSgpIHdoaWxlIGEgcm9vdCBzcGFuIGlzIGFjdGl2ZS4gS2VlcGluZyBleGlzdGluZyB0cmFjZXIgcHJvdmlkZXIuXCIsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZWdpc3Rlcih0cmFjZXIpO1xuICAgIHRoaXMuX2FjdGl2ZVRyYWNlciA9IHRyYWNlcjtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnRseSBhY3RpdmUgdHJhY2VyLlxuICAgKlxuICAgKiBAcmV0dXJucyBUaGUgYWN0aXZlIHRyYWNlciwgb3IgYG51bGxgIGlmIG5vbmUuXG4gICAqL1xuICBnZXRBY3RpdmVUcmFjZXIoKTogQmFzZVRyYWNlciB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLl9hY3RpdmVUcmFjZXI7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjdXJyZW50IE9wZW5UZWxlbWV0cnkgY29udGV4dC5cbiAgICpcbiAgICogQHJldHVybnMgVGhlIGN1cnJlbnQgY29udGV4dC5cbiAgICovXG4gIGdldEN1cnJlbnRDb250ZXh0KCk6IENvbnRleHQge1xuICAgIHJldHVybiBfY29udGV4dFN0b3JhZ2UuZ2V0U3RvcmUoKSA/PyBST09UX0NPTlRFWFQ7XG4gIH1cblxuICAvKipcbiAgICogU2V0IGEgc3BhbiBvbiBhIGNvbnRleHQsIHJldHVybmluZyBhIG5ldyBjb250ZXh0LlxuICAgKi9cbiAgc2V0U3BhbihjdHg6IENvbnRleHQsIHNwYW46IFNwYW4pOiBDb250ZXh0IHtcbiAgICByZXR1cm4gdHJhY2Uuc2V0U3BhbihjdHgsIHNwYW4pO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyYXAgYSBTcGFuQ29udGV4dCBpbnRvIGEgbm9uLXJlY29yZGluZyBTcGFuLlxuICAgKi9cbiAgd3JhcFNwYW5Db250ZXh0KHNwYW5Db250ZXh0OiBTcGFuQ29udGV4dCk6IFNwYW4ge1xuICAgIHJldHVybiB0cmFjZS53cmFwU3BhbkNvbnRleHQoc3BhbkNvbnRleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgc3BhbiBmcm9tIHRoZSBjdXJyZW50IGNvbnRleHQuXG4gICAqXG4gICAqIEByZXR1cm5zIFRoZSBjdXJyZW50IHNwYW4sIG9yIGB1bmRlZmluZWRgIGlmIG5vbmUuXG4gICAqL1xuICBnZXRDdXJyZW50U3BhbigpOiBTcGFuIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBjdHggPSB0aGlzLmdldEN1cnJlbnRDb250ZXh0KCk7XG4gICAgcmV0dXJuIHRyYWNlLmdldFNwYW4oY3R4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIHRoZXJlIGlzIGFuIGFjdGl2ZSByb290IHNwYW4uXG4gICAqXG4gICAqIEByZXR1cm5zIGB0cnVlYCBpZiBhIHJvb3Qgc3BhbiBpcyBjdXJyZW50bHkgcmVjb3JkaW5nLlxuICAgKi9cbiAgaGFzQWN0aXZlUm9vdFNwYW4oKTogYm9vbGVhbiB7XG4gICAgY29uc3QgY3VycmVudFNwYW4gPSB0aGlzLmdldEN1cnJlbnRTcGFuKCk7XG4gICAgaWYgKCFjdXJyZW50U3Bhbj8uaXNSZWNvcmRpbmcoKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgX2dldERlbGVnYXRlVHJhY2VyKCk6IFRyYWNlciB7XG4gICAgY29uc3QgdHJhY2VyID0gdGhpcy5fYWN0aXZlVHJhY2VyO1xuICAgIGlmICghdHJhY2VyKSB7XG4gICAgICBMb2dnZXIuZGVidWcoXCJObyBhY3RpdmUgdHJhY2VyLCByZXR1cm5pbmcgTm9PcFRyYWNlclwiKTtcbiAgICAgIHJldHVybiB0aGlzLl9ub09wVHJhY2VyO1xuICAgIH1cbiAgICByZXR1cm4gdHJhY2VyLl90cmFjZXJQcm92aWRlci5nZXRUcmFjZXIoVFJBQ0VSX05BTUUpO1xuICB9XG5cbiAgZ2V0VHJhY2VyKFxuICAgIF9pbnN0cnVtZW50aW5nTW9kdWxlTmFtZTogc3RyaW5nLFxuICAgIF9pbnN0cnVtZW50aW5nTGlicmFyeVZlcnNpb24/OiBzdHJpbmcsXG4gICAgX29wdGlvbnM/OiB7IHNjaGVtYVVybD86IHN0cmluZyB9LFxuICApOiBUcmFjZXIge1xuICAgIHJldHVybiB0aGlzLl9wcm94eVRyYWNlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhbiBPcGVuVGVsZW1ldHJ5IGluc3RydW1lbnRhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGluc3RydW1lbnRvciAtIFRoZSBpbnN0cnVtZW50YXRpb24gdG8gYWRkLlxuICAgKi9cbiAgYWRkSW5zdHJ1bWVudGF0aW9uKGluc3RydW1lbnRvcjogSW5zdHJ1bWVudGF0aW9uKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIHJlZ2lzdGVySW5zdHJ1bWVudGF0aW9ucyh7XG4gICAgICAgIHRyYWNlclByb3ZpZGVyOiB0aGlzLFxuICAgICAgICBpbnN0cnVtZW50YXRpb25zOiBbaW5zdHJ1bWVudG9yXSxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5faW5zdHJ1bWVudGF0aW9ucy5wdXNoKGluc3RydW1lbnRvcik7XG4gICAgfSBjYXRjaCAoZXJyOiB1bmtub3duKSB7XG4gICAgICBMb2dnZXIuZXJyb3IoYEZhaWxlZCB0byBhZGQgaW5zdHJ1bWVudGF0aW9uOiAke1N0cmluZyhlcnIpfWApO1xuICAgIH1cbiAgfVxuXG4gIHVzZVNwYW48VD4oXG4gICAgc3BhbjogU3BhbixcbiAgICBlbmRPbkV4aXQ6IGJvb2xlYW4sXG4gICAgcmVjb3JkRXhjZXB0aW9uOiBib29sZWFuLFxuICAgIHNldFN0YXR1c09uRXhjZXB0aW9uOiBib29sZWFuLFxuICAgIGZuOiAoKSA9PiBULFxuICApOiBUIHtcbiAgICBjb25zdCBwcmV2Q3R4ID0gdGhpcy5nZXRDdXJyZW50Q29udGV4dCgpO1xuICAgIGNvbnN0IGN0eCA9IHRyYWNlLnNldFNwYW4ocHJldkN0eCwgc3Bhbik7XG4gICAgcmV0dXJuIF9jb250ZXh0U3RvcmFnZS5ydW4oY3R4LCAoKSA9PlxuICAgICAgcnVuV2l0aE90ZWxCcmlkZ2VHYXRlKGN0eCwgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGZuKCk7XG4gICAgICAgICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgICAgICAgICAgLmNhdGNoKChleGM6IHVua25vd24pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoc3Bhbi5pc1JlY29yZGluZygpKSB7XG4gICAgICAgICAgICAgICAgICBpZiAocmVjb3JkRXhjZXB0aW9uKSBzcGFuLnJlY29yZEV4Y2VwdGlvbihleGMgYXMgRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgaWYgKHNldFN0YXR1c09uRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVyciA9IGV4YyBhcyBFcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgc3Bhbi5zZXRTdGF0dXMoe1xuICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLFxuICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2Vyci5uYW1lfTogJHtlcnIubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgZXhjO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVuZE9uRXhpdCkgc3Bhbi5lbmQoKTtcbiAgICAgICAgICAgICAgfSkgYXMgVDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGVuZE9uRXhpdCkgc3Bhbi5lbmQoKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGNhdGNoIChleGMpIHtcbiAgICAgICAgICBpZiAoc3Bhbi5pc1JlY29yZGluZygpKSB7XG4gICAgICAgICAgICBpZiAocmVjb3JkRXhjZXB0aW9uKSBzcGFuLnJlY29yZEV4Y2VwdGlvbihleGMgYXMgRXJyb3IpO1xuICAgICAgICAgICAgaWYgKHNldFN0YXR1c09uRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVyciA9IGV4YyBhcyBFcnJvcjtcbiAgICAgICAgICAgICAgc3Bhbi5zZXRTdGF0dXMoe1xuICAgICAgICAgICAgICAgIGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2Vyci5uYW1lfTogJHtlcnIubWVzc2FnZX1gLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGVuZE9uRXhpdCkgc3Bhbi5lbmQoKTtcbiAgICAgICAgICB0aHJvdyBleGM7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBhdHRhY2hDb250ZXh0KGN0eDogQ29udGV4dCk6IHZvaWQge1xuICAgIF9jb250ZXh0U3RvcmFnZS5lbnRlcldpdGgoY3R4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSdW4gYGZuYCB3aXRoIGBjdHhgIGluc3RhbGxlZCBhcyB0aGUgYWN0aXZlIGNvbnRleHQgZm9yIHRoZVxuICAgKiBkdXJhdGlvbiBvZiB0aGUgY2FsbGJhY2suIFN5bmMgb3IgYXN5bmMuXG4gICAqL1xuICB3aXRoQ29udGV4dDxUPihjdHg6IENvbnRleHQsIGZuOiAoKSA9PiBUKTogVCB7XG4gICAgcmV0dXJuIF9jb250ZXh0U3RvcmFnZS5ydW4oY3R4LCAoKSA9PiBydW5XaXRoT3RlbEJyaWRnZUdhdGUoY3R4LCBmbikpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZsdXNoIGFsbCByZWdpc3RlcmVkIHRyYWNlcnMuXG4gICAqL1xuICBhc3luYyBmb3JjZUZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBBcnJheS5mcm9tKHRoaXMuX3RyYWNlcnMpLm1hcCgodCkgPT4gdC5fdHJhY2VyUHJvdmlkZXIuZm9yY2VGbHVzaCgpKSxcbiAgICApO1xuICAgIGZvciAoY29uc3QgciBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAoci5zdGF0dXMgPT09IFwicmVqZWN0ZWRcIikge1xuICAgICAgICBMb2dnZXIuZXJyb3IoYGZvcmNlRmx1c2ggZmFpbGVkOiAke1N0cmluZyhyLnJlYXNvbil9YCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNodXQgZG93biBhbGwgcmVnaXN0ZXJlZCB0cmFjZXJzIGFuZCBjbGVhciBzdGF0ZS5cbiAgICovXG4gIGFzeW5jIHNodXRkb3duKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBBcnJheS5mcm9tKHRoaXMuX3RyYWNlcnMpLm1hcCgodCkgPT4gdC5fdHJhY2VyUHJvdmlkZXIuc2h1dGRvd24oKSksXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IHIgb2YgcmVzdWx0cykge1xuICAgICAgaWYgKHIuc3RhdHVzID09PSBcInJlamVjdGVkXCIpIHtcbiAgICAgICAgTG9nZ2VyLmVycm9yKGBzaHV0ZG93biBmYWlsZWQ6ICR7U3RyaW5nKHIucmVhc29uKX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fYWN0aXZlVHJhY2VyID0gbnVsbDtcbiAgICB0aGlzLl90cmFjZXJzLmNsZWFyKCk7XG4gIH1cbn1cbiIsCiAgICAiLyogZXNsaW50LWRpc2FibGUgKi9cbi8vLyBBZG9wdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci5qcy9ibG9iL21hc3Rlci9zcmMvYXV0by9pbmplY3Rvci5qc1xuXG5jb25zdCBBUlJPV19BUkcgPSAvXihbXihdKz8pPT4vO1xuY29uc3QgRk5fQVJHUyA9IC9eW14oXSpcXChcXHMqKFteKV0qKVxcKS9tO1xuY29uc3QgRk5fQVJHX1NQTElUID0gLywvO1xuY29uc3QgRk5fQVJHID0gL15cXHMqKF8/KShcXFMrPylcXDFcXHMqJC87XG5jb25zdCBTVFJJUF9DT01NRU5UUyA9IC8oKFxcL1xcLy4qJCl8KFxcL1xcKltcXHNcXFNdKj9cXCpcXC8pKS9nbTtcblxuZnVuY3Rpb24gc3RyaW5naWZ5Rm4oZm46IEZ1bmN0aW9uKTogc3RyaW5nIHtcbiAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGZuKTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEFyZ3MoZm46IEZ1bmN0aW9uKTogUmVnRXhwTWF0Y2hBcnJheSB8IG51bGwge1xuICBjb25zdCBmblRleHQgPSBzdHJpbmdpZnlGbihmbikucmVwbGFjZShTVFJJUF9DT01NRU5UUywgXCJcIik7XG4gIHJldHVybiBmblRleHQubWF0Y2goQVJST1dfQVJHKSB8fCBmblRleHQubWF0Y2goRk5fQVJHUyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUZ1bmN0aW9uQXJncyhmbjogRnVuY3Rpb24pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGFyZ3MgPSBleHRyYWN0QXJncyhmbik7XG4gIGlmICghYXJncyB8fCAhYXJnc1sxXSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiBhcmdzWzFdXG4gICAgLnNwbGl0KEZOX0FSR19TUExJVClcbiAgICAubWFwKChhcmcpID0+IHtcbiAgICAgIGNvbnN0IG1hdGNoID0gYXJnLnJlcGxhY2UoRk5fQVJHLCAoYWxsLCB1bmRlcnNjb3JlLCBuYW1lKSA9PiBuYW1lKTtcbiAgICAgIHJldHVybiBtYXRjaC50cmltKCk7XG4gICAgfSlcbiAgICAuZmlsdGVyKChuYW1lKSA9PiBuYW1lLmxlbmd0aCA+IDApO1xufVxuIiwKICAgICJpbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi9sb2dnZXJcIjtcblxuLyoqXG4gKiBSdW4gYGZuYCBhbmQgc3dhbGxvdyBhbnkgdGhyb3duIGVycm9yLCBsb2dnaW5nIGl0IGluc3RlYWQuXG4gKlxuICogQHBhcmFtIG5hbWUgLSBOYW1lIHVzZWQgaW4gdGhlIGVycm9yIGxvZyAodHlwaWNhbGx5IGBcIkNsYXNzTmFtZS5tZXRob2RcImApLlxuICogQHBhcmFtIGZuIC0gRnVuY3Rpb24gdG8gaW52b2tlLlxuICogQHBhcmFtIGZhbGxiYWNrIC0gT3B0aW9uYWwgdmFsdWUgcmV0dXJuZWQgd2hlbiBgZm5gIHRocm93cy5cbiAqIEByZXR1cm5zIFRoZSByZXR1cm4gdmFsdWUgb2YgYGZuYCwgb3IgYGZhbGxiYWNrYCAob3IgYHVuZGVmaW5lZGApIG9uIGVycm9yLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZG9udFRocm93PFQ+KG5hbWU6IHN0cmluZywgZm46ICgpID0+IFQpOiBUIHwgdW5kZWZpbmVkO1xuZXhwb3J0IGZ1bmN0aW9uIGRvbnRUaHJvdzxUPihuYW1lOiBzdHJpbmcsIGZuOiAoKSA9PiBULCBmYWxsYmFjazogVCk6IFQ7XG5leHBvcnQgZnVuY3Rpb24gZG9udFRocm93PFQ+KFxuICBuYW1lOiBzdHJpbmcsXG4gIGZuOiAoKSA9PiBULFxuICBmYWxsYmFjaz86IFQsXG4pOiBUIHwgdW5kZWZpbmVkIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc3Qgc3RhY2sgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiBlcnIuc3RhY2sgPyBgXFxuJHtlcnIuc3RhY2t9YCA6IFwiXCI7XG4gICAgTG9nZ2VyLmVycm9yKFxuICAgICAgYFtDYXVnaHRdIEFuIGV4Y2VwdGlvbiB3YXMgcmFpc2VkIGluICR7bmFtZX06ICR7U3RyaW5nKGVycil9JHtzdGFja31gLFxuICAgICk7XG4gICAgcmV0dXJuIGZhbGxiYWNrO1xuICB9XG59XG4iLAogICAgImV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSYW5kb21VVUlEKCk6IHN0cmluZyB7XG4gIGNvbnN0IGNyeXB0b09iamVjdCA9IGdsb2JhbFRoaXMuY3J5cHRvO1xuICBpZiAodHlwZW9mIGNyeXB0b09iamVjdD8ucmFuZG9tVVVJRCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIGNyeXB0b09iamVjdC5yYW5kb21VVUlEKCk7XG4gIH1cblxuICBpZiAodHlwZW9mIGNyeXB0b09iamVjdD8uZ2V0UmFuZG9tVmFsdWVzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICBjcnlwdG9PYmplY3QuZ2V0UmFuZG9tVmFsdWVzKGJ5dGVzKTtcblxuICAgIGJ5dGVzWzZdID0gKGJ5dGVzWzZdICYgMHgwZikgfCAweDQwO1xuICAgIGJ5dGVzWzhdID0gKGJ5dGVzWzhdICYgMHgzZikgfCAweDgwO1xuXG4gICAgY29uc3QgaGV4ID0gQXJyYXkuZnJvbShieXRlcywgKGJ5dGUpID0+XG4gICAgICBieXRlLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCBcIjBcIiksXG4gICAgKS5qb2luKFwiXCIpO1xuXG4gICAgcmV0dXJuIFtcbiAgICAgIGhleC5zbGljZSgwLCA4KSxcbiAgICAgIGhleC5zbGljZSg4LCAxMiksXG4gICAgICBoZXguc2xpY2UoMTIsIDE2KSxcbiAgICAgIGhleC5zbGljZSgxNiwgMjApLFxuICAgICAgaGV4LnNsaWNlKDIwKSxcbiAgICBdLmpvaW4oXCItXCIpO1xuICB9XG5cbiAgcmV0dXJuIFwiMTAwMDAwMDAtMTAwMC00MDAwLTgwMDAtMTAwMDAwMDAwMDAwXCIucmVwbGFjZSgvWzAxOF0vZywgKGMpID0+XG4gICAgKFxuICAgICAgTnVtYmVyKGMpIF5cbiAgICAgIChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAyNTYpICYgKDE1ID4+IChOdW1iZXIoYykgLyA0KSkpXG4gICAgKS50b1N0cmluZygxNiksXG4gICk7XG59XG4iLAogICAgImV4cG9ydCBjb25zdCBCQUdHQUdFX0tFWV9QQUlSX1NFUEFSQVRPUiA9IFwiPVwiO1xuZXhwb3J0IGNvbnN0IEJBR0dBR0VfUFJPUEVSVElFU19TRVBBUkFUT1IgPSBcIjtcIjtcbmV4cG9ydCBjb25zdCBCQUdHQUdFX0lURU1TX1NFUEFSQVRPUiA9IFwiLFwiO1xuXG4vKiogTmFtZSBvZiB0aGUgSFRUUCBoZWFkZXIgdXNlZCB0byBwcm9wYWdhdGUgYmFnZ2FnZS4gKi9cbmV4cG9ydCBjb25zdCBCQUdHQUdFX0hFQURFUiA9IFwiYmFnZ2FnZVwiO1xuXG4vKiogTWF4aW11bSBudW1iZXIgb2YgbmFtZS12YWx1ZSBwYWlycyBhbGxvd2VkIGJ5IHRoZSBXM0MgQmFnZ2FnZSBzcGVjLiAqL1xuZXhwb3J0IGNvbnN0IEJBR0dBR0VfTUFYX05BTUVfVkFMVUVfUEFJUlMgPSAxODA7XG5cbi8qKiBNYXhpbXVtIG51bWJlciBvZiBieXRlcyBwZXIgYSBzaW5nbGUgbmFtZS12YWx1ZSBwYWlyIGFsbG93ZWQgYnkgdGhlIFczQyBCYWdnYWdlIHNwZWMuICovXG5leHBvcnQgY29uc3QgQkFHR0FHRV9NQVhfUEVSX05BTUVfVkFMVUVfUEFJUlMgPSA0MDk2O1xuXG4vKiogTWF4aW11bSB0b3RhbCBsZW5ndGggb2YgYWxsIG5hbWUtdmFsdWUgcGFpcnMgYWxsb3dlZCBieSB0aGUgVzNDIEJhZ2dhZ2Ugc3BlYy4gKi9cbmV4cG9ydCBjb25zdCBCQUdHQUdFX01BWF9UT1RBTF9MRU5HVEggPSA4MTkyO1xuIiwKICAgICJpbXBvcnQge1xuICB0eXBlIEJhZ2dhZ2UsXG4gIHR5cGUgQmFnZ2FnZUVudHJ5TWV0YWRhdGEsXG4gIGJhZ2dhZ2VFbnRyeU1ldGFkYXRhRnJvbVN0cmluZyxcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHtcbiAgQkFHR0FHRV9JVEVNU19TRVBBUkFUT1IsXG4gIEJBR0dBR0VfS0VZX1BBSVJfU0VQQVJBVE9SLFxuICBCQUdHQUdFX01BWF9UT1RBTF9MRU5HVEgsXG4gIEJBR0dBR0VfUFJPUEVSVElFU19TRVBBUkFUT1IsXG59IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuXG4vKipcbiAqIFNlcmlhbGl6ZSBhbiBhcnJheSBvZiBrZXk9dmFsdWUgcGFpcnMgaW50byBhIGJhZ2dhZ2UgaGVhZGVyIHN0cmluZyxcbiAqIGNhcHBpbmcgdGhlIHJlc3VsdCBhdCB7QGxpbmsgQkFHR0FHRV9NQVhfVE9UQUxfTEVOR1RIfS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUtleVBhaXJzKGtleVBhaXJzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiBrZXlQYWlycy5yZWR1Y2UoKGhWYWx1ZSwgY3VycmVudCkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gYCR7aFZhbHVlfSR7aFZhbHVlICE9PSBcIlwiID8gQkFHR0FHRV9JVEVNU19TRVBBUkFUT1IgOiBcIlwifSR7Y3VycmVudH1gO1xuICAgIHJldHVybiB2YWx1ZS5sZW5ndGggPiBCQUdHQUdFX01BWF9UT1RBTF9MRU5HVEggPyBoVmFsdWUgOiB2YWx1ZTtcbiAgfSwgXCJcIik7XG59XG5cbi8qKlxuICogQ29udmVydCBhIHtAbGluayBCYWdnYWdlfSBpbnRvIGFuIGFycmF5IG9mIGBrZXk9dmFsdWU7bWV0YWRhdGFgIHN0cmluZ3MsXG4gKiBVUkktZW5jb2RpbmcgZWFjaCBrZXkgYW5kIHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0S2V5UGFpcnMoYmFnZ2FnZTogQmFnZ2FnZSk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIGJhZ2dhZ2UuZ2V0QWxsRW50cmllcygpLm1hcCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgbGV0IGVudHJ5ID0gYCR7ZW5jb2RlVVJJQ29tcG9uZW50KGtleSl9PSR7ZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlLnZhbHVlKX1gO1xuICAgIGlmICh2YWx1ZS5tZXRhZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBlbnRyeSArPSBCQUdHQUdFX1BST1BFUlRJRVNfU0VQQVJBVE9SICsgdmFsdWUubWV0YWRhdGEudG9TdHJpbmcoKTtcbiAgICB9XG4gICAgcmV0dXJuIGVudHJ5O1xuICB9KTtcbn1cblxuLyoqIFBhcnNlIGEgc2luZ2xlIGBrZXk9dmFsdWU7bWV0YWRhdGFgIGJhZ2dhZ2UgbGlzdC1tZW1iZXIuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQYWlyS2V5VmFsdWUoXG4gIGVudHJ5OiBzdHJpbmcsXG4pOiB7IGtleTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nOyBtZXRhZGF0YT86IEJhZ2dhZ2VFbnRyeU1ldGFkYXRhIH0gfCB1bmRlZmluZWQge1xuICBjb25zdCB2YWx1ZVByb3BzID0gZW50cnkuc3BsaXQoQkFHR0FHRV9QUk9QRVJUSUVTX1NFUEFSQVRPUik7XG4gIGlmICh2YWx1ZVByb3BzLmxlbmd0aCA8PSAwKSByZXR1cm47XG4gIGNvbnN0IGtleVBhaXJQYXJ0ID0gdmFsdWVQcm9wcy5zaGlmdCgpO1xuICBpZiAoIWtleVBhaXJQYXJ0KSByZXR1cm47XG4gIGNvbnN0IHNlcGFyYXRvckluZGV4ID0ga2V5UGFpclBhcnQuaW5kZXhPZihCQUdHQUdFX0tFWV9QQUlSX1NFUEFSQVRPUik7XG4gIGlmIChzZXBhcmF0b3JJbmRleCA8PSAwKSByZXR1cm47XG4gIGNvbnN0IGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChcbiAgICBrZXlQYWlyUGFydC5zdWJzdHJpbmcoMCwgc2VwYXJhdG9ySW5kZXgpLnRyaW0oKSxcbiAgKTtcbiAgY29uc3QgdmFsdWUgPSBkZWNvZGVVUklDb21wb25lbnQoXG4gICAga2V5UGFpclBhcnQuc3Vic3RyaW5nKHNlcGFyYXRvckluZGV4ICsgMSkudHJpbSgpLFxuICApO1xuICBsZXQgbWV0YWRhdGE6IEJhZ2dhZ2VFbnRyeU1ldGFkYXRhIHwgdW5kZWZpbmVkO1xuICBpZiAodmFsdWVQcm9wcy5sZW5ndGggPiAwKSB7XG4gICAgbWV0YWRhdGEgPSBiYWdnYWdlRW50cnlNZXRhZGF0YUZyb21TdHJpbmcoXG4gICAgICB2YWx1ZVByb3BzLmpvaW4oQkFHR0FHRV9QUk9QRVJUSUVTX1NFUEFSQVRPUiksXG4gICAgKTtcbiAgfVxuICByZXR1cm4geyBrZXksIHZhbHVlLCBtZXRhZGF0YSB9O1xufVxuIiwKICAgICJpbXBvcnQge1xuICB0eXBlIEJhZ2dhZ2VFbnRyeSxcbiAgdHlwZSBDb250ZXh0LFxuICB0eXBlIFRleHRNYXBHZXR0ZXIsXG4gIHR5cGUgVGV4dE1hcFByb3BhZ2F0b3IsXG4gIHR5cGUgVGV4dE1hcFNldHRlcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHsgaXNUcmFjaW5nU3VwcHJlc3NlZCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9jb3JlXCI7XG5pbXBvcnQge1xuICBCQUdHQUdFX0hFQURFUixcbiAgQkFHR0FHRV9JVEVNU19TRVBBUkFUT1IsXG4gIEJBR0dBR0VfTUFYX05BTUVfVkFMVUVfUEFJUlMsXG4gIEJBR0dBR0VfTUFYX1BFUl9OQU1FX1ZBTFVFX1BBSVJTLFxufSBmcm9tIFwiLi9jb25zdGFudHNcIjtcbmltcG9ydCB7IGNyZWF0ZUJhZ2dhZ2UsIGdldEJhZ2dhZ2UsIHNldEJhZ2dhZ2UgfSBmcm9tIFwiLi9pbmRleFwiO1xuaW1wb3J0IHsgZ2V0S2V5UGFpcnMsIHBhcnNlUGFpcktleVZhbHVlLCBzZXJpYWxpemVLZXlQYWlycyB9IGZyb20gXCIuL3V0aWxzXCI7XG5cbi8qKlxuICogUHJvcGFnYXRlcyB7QGxpbmsgQmFnZ2FnZX0gdGhyb3VnaCB0aGUgVzNDIGBiYWdnYWdlYCBoZWFkZXIuXG4gKlxuICogSW1wbGVtZW50cyB0aGUgVzNDIEJhZ2dhZ2Ugc3BlY2lmaWNhdGlvbjogaHR0cHM6Ly93M2MuZ2l0aHViLmlvL2JhZ2dhZ2UvXG4gKi9cbmV4cG9ydCBjbGFzcyBKdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yIGltcGxlbWVudHMgVGV4dE1hcFByb3BhZ2F0b3Ige1xuICBpbmplY3QoY29udGV4dDogQ29udGV4dCwgY2FycmllcjogdW5rbm93biwgc2V0dGVyOiBUZXh0TWFwU2V0dGVyKTogdm9pZCB7XG4gICAgY29uc3QgYmFnZ2FnZSA9IGdldEJhZ2dhZ2UoY29udGV4dCk7XG4gICAgaWYgKCFiYWdnYWdlIHx8IGlzVHJhY2luZ1N1cHByZXNzZWQoY29udGV4dCkpIHJldHVybjtcbiAgICBjb25zdCBrZXlQYWlycyA9IGdldEtleVBhaXJzKGJhZ2dhZ2UpXG4gICAgICAuZmlsdGVyKChwYWlyKSA9PiBwYWlyLmxlbmd0aCA8PSBCQUdHQUdFX01BWF9QRVJfTkFNRV9WQUxVRV9QQUlSUylcbiAgICAgIC5zbGljZSgwLCBCQUdHQUdFX01BWF9OQU1FX1ZBTFVFX1BBSVJTKTtcbiAgICBjb25zdCBoZWFkZXJWYWx1ZSA9IHNlcmlhbGl6ZUtleVBhaXJzKGtleVBhaXJzKTtcbiAgICBpZiAoaGVhZGVyVmFsdWUubGVuZ3RoID4gMCkge1xuICAgICAgc2V0dGVyLnNldChjYXJyaWVyLCBCQUdHQUdFX0hFQURFUiwgaGVhZGVyVmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIGV4dHJhY3QoY29udGV4dDogQ29udGV4dCwgY2FycmllcjogdW5rbm93biwgZ2V0dGVyOiBUZXh0TWFwR2V0dGVyKTogQ29udGV4dCB7XG4gICAgY29uc3QgaGVhZGVyVmFsdWUgPSBnZXR0ZXIuZ2V0KGNhcnJpZXIsIEJBR0dBR0VfSEVBREVSKTtcbiAgICBjb25zdCBiYWdnYWdlU3RyaW5nID0gQXJyYXkuaXNBcnJheShoZWFkZXJWYWx1ZSlcbiAgICAgID8gaGVhZGVyVmFsdWUuam9pbihCQUdHQUdFX0lURU1TX1NFUEFSQVRPUilcbiAgICAgIDogaGVhZGVyVmFsdWU7XG4gICAgaWYgKCFiYWdnYWdlU3RyaW5nKSByZXR1cm4gY29udGV4dDtcbiAgICBjb25zdCBiYWdnYWdlOiBSZWNvcmQ8c3RyaW5nLCBCYWdnYWdlRW50cnk+ID0ge307XG4gICAgaWYgKGJhZ2dhZ2VTdHJpbmcubGVuZ3RoID09PSAwKSByZXR1cm4gY29udGV4dDtcbiAgICBjb25zdCBwYWlycyA9IGJhZ2dhZ2VTdHJpbmcuc3BsaXQoQkFHR0FHRV9JVEVNU19TRVBBUkFUT1IpO1xuICAgIHBhaXJzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICBjb25zdCBrZXlQYWlyID0gcGFyc2VQYWlyS2V5VmFsdWUoZW50cnkpO1xuICAgICAgaWYgKGtleVBhaXIpIHtcbiAgICAgICAgY29uc3QgYmFnZ2FnZUVudHJ5OiBCYWdnYWdlRW50cnkgPSB7IHZhbHVlOiBrZXlQYWlyLnZhbHVlIH07XG4gICAgICAgIGlmIChrZXlQYWlyLm1ldGFkYXRhKSB7XG4gICAgICAgICAgYmFnZ2FnZUVudHJ5Lm1ldGFkYXRhID0ga2V5UGFpci5tZXRhZGF0YTtcbiAgICAgICAgfVxuICAgICAgICBiYWdnYWdlW2tleVBhaXIua2V5XSA9IGJhZ2dhZ2VFbnRyeTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoT2JqZWN0LmVudHJpZXMoYmFnZ2FnZSkubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gY29udGV4dDtcbiAgICB9XG4gICAgcmV0dXJuIHNldEJhZ2dhZ2UoY29udGV4dCwgY3JlYXRlQmFnZ2FnZShiYWdnYWdlKSk7XG4gIH1cblxuICBmaWVsZHMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBbQkFHR0FHRV9IRUFERVJdO1xuICB9XG59XG4iLAogICAgImltcG9ydCB7XG4gIHR5cGUgQmFnZ2FnZSxcbiAgdHlwZSBDb250ZXh0LFxuICBjcmVhdGVDb250ZXh0S2V5LFxuICBwcm9wYWdhdGlvbixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHsgZ2V0VHJhY2VSdW50aW1lIH0gZnJvbSBcIi4uL3J1bnRpbWVcIjtcblxuLyoqXG4gKiBKdWRnbWVudCBiYWdnYWdlIHN0b3JlLiBCYWdnYWdlIGlzIGEgc2V0IG9mIGtleS12YWx1ZSBwYWlycyBhdHRhY2hlZFxuICogdG8gYSB7QGxpbmsgQ29udGV4dH0gYW5kIGF1dG9tYXRpY2FsbHkgcHJvcGFnYXRlZCB0byBjaGlsZCBzcGFucyBhbmRcbiAqIHRvIGRvd25zdHJlYW0gc2VydmljZXMgdGhyb3VnaCB0aGUgYGJhZ2dhZ2VgIEhUVFAgaGVhZGVyLlxuICovXG5cbi8qKiBDcmVhdGUgYSBuZXcge0BsaW5rIEJhZ2dhZ2V9LCBvcHRpb25hbGx5IHByZS1wb3B1bGF0ZWQgd2l0aCBlbnRyaWVzLiAqL1xuZXhwb3J0IGNvbnN0IGNyZWF0ZUJhZ2dhZ2UgPSBwcm9wYWdhdGlvbi5jcmVhdGVCYWdnYWdlLmJpbmQocHJvcGFnYXRpb24pO1xuXG5jb25zdCBCQUdHQUdFX0tFWSA9IGNyZWF0ZUNvbnRleHRLZXkoXCJiYWdnYWdlXCIpO1xuXG4vKiogUmV0cmlldmUgdGhlIGJhZ2dhZ2UgYXR0YWNoZWQgdG8gdGhlIGdpdmVuIGNvbnRleHQuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmFnZ2FnZShjb250ZXh0OiBDb250ZXh0KTogQmFnZ2FnZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBjb250ZXh0LmdldFZhbHVlKEJBR0dBR0VfS0VZKSBhcyBCYWdnYWdlIHwgdW5kZWZpbmVkO1xufVxuXG4vKiogUmV0cmlldmUgdGhlIGJhZ2dhZ2UgYXR0YWNoZWQgdG8gdGhlIGFjdGl2ZSBjb250ZXh0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEFjdGl2ZUJhZ2dhZ2UoKTogQmFnZ2FnZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBnZXRCYWdnYWdlKGdldFRyYWNlUnVudGltZSgpLmdldEN1cnJlbnRDb250ZXh0KCkpO1xufVxuXG4vKiogQXR0YWNoIGEgYmFnZ2FnZSB0byB0aGUgZ2l2ZW4gY29udGV4dCwgcmV0dXJuaW5nIGEgbmV3IGNvbnRleHQuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0QmFnZ2FnZShjb250ZXh0OiBDb250ZXh0LCBiYWdnYWdlOiBCYWdnYWdlKTogQ29udGV4dCB7XG4gIHJldHVybiBjb250ZXh0LnNldFZhbHVlKEJBR0dBR0VfS0VZLCBiYWdnYWdlKTtcbn1cblxuLyoqIFJlbW92ZSB0aGUgYmFnZ2FnZSBhdHRhY2hlZCB0byB0aGUgZ2l2ZW4gY29udGV4dCwgcmV0dXJuaW5nIGEgbmV3IGNvbnRleHQuICovXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlQmFnZ2FnZShjb250ZXh0OiBDb250ZXh0KTogQ29udGV4dCB7XG4gIHJldHVybiBjb250ZXh0LmRlbGV0ZVZhbHVlKEJBR0dBR0VfS0VZKTtcbn1cblxuZXhwb3J0IHsgYmFnZ2FnZUVudHJ5TWV0YWRhdGFGcm9tU3RyaW5nIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuZXhwb3J0IHR5cGUge1xuICBCYWdnYWdlLFxuICBCYWdnYWdlRW50cnksXG4gIEJhZ2dhZ2VFbnRyeU1ldGFkYXRhLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvYXBpXCI7XG5cbmV4cG9ydCB7IEp1ZGdtZW50QmFnZ2FnZVByb3BhZ2F0b3IgfSBmcm9tIFwiLi9KdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yXCI7XG4iLAogICAgImltcG9ydCB7XG4gIHR5cGUgQ29udGV4dCxcbiAgZGVmYXVsdFRleHRNYXBHZXR0ZXIsXG4gIGRlZmF1bHRUZXh0TWFwU2V0dGVyLFxuICB0eXBlIFRleHRNYXBHZXR0ZXIsXG4gIHR5cGUgVGV4dE1hcFByb3BhZ2F0b3IsXG4gIHR5cGUgVGV4dE1hcFNldHRlcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHtcbiAgQ29tcG9zaXRlUHJvcGFnYXRvcixcbiAgVzNDVHJhY2VDb250ZXh0UHJvcGFnYXRvcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2NvcmVcIjtcbmltcG9ydCB7IGRvbnRUaHJvdyB9IGZyb20gXCIuLi8uLi91dGlscy9kb250LXRocm93XCI7XG5pbXBvcnQgeyBKdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yIH0gZnJvbSBcIi4uL2JhZ2dhZ2UvSnVkZ21lbnRCYWdnYWdlUHJvcGFnYXRvclwiO1xuaW1wb3J0IHsgZ2V0VHJhY2VSdW50aW1lIH0gZnJvbSBcIi4uL3J1bnRpbWVcIjtcblxuLyoqXG4gKiBJbmplY3QgYW5kIGV4dHJhY3QgdHJhY2UgY29udGV4dCBhbmQgYmFnZ2FnZSBhY3Jvc3Mgc2VydmljZVxuICogYm91bmRhcmllcyB0aHJvdWdoIGEgY29tcG9zaXRlIFczQyBUcmFjZUNvbnRleHQgKyBCYWdnYWdlIHByb3BhZ2F0b3IuXG4gKi9cblxubGV0IF9nbG9iYWxUZXh0bWFwOiBUZXh0TWFwUHJvcGFnYXRvciA9IG5ldyBDb21wb3NpdGVQcm9wYWdhdG9yKHtcbiAgcHJvcGFnYXRvcnM6IFtcbiAgICBuZXcgVzNDVHJhY2VDb250ZXh0UHJvcGFnYXRvcigpLFxuICAgIG5ldyBKdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yKCksXG4gIF0sXG59KTtcblxuLyoqIFJldHVybiB0aGUgYWN0aXZlIGNvbXBvc2l0ZSBwcm9wYWdhdG9yIChXM0MgVHJhY2VDb250ZXh0ICsgSnVkZ21lbnQgQmFnZ2FnZSkuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0R2xvYmFsVGV4dG1hcCgpOiBUZXh0TWFwUHJvcGFnYXRvciB7XG4gIHJldHVybiBfZ2xvYmFsVGV4dG1hcDtcbn1cblxuLyoqIFJlcGxhY2UgdGhlIGdsb2JhbCB0ZXh0LW1hcCBwcm9wYWdhdG9yLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldEdsb2JhbFRleHRtYXAocHJvcGFnYXRvcjogVGV4dE1hcFByb3BhZ2F0b3IpOiB2b2lkIHtcbiAgX2dsb2JhbFRleHRtYXAgPSBwcm9wYWdhdG9yO1xufVxuXG5mdW5jdGlvbiBfcmVzb2x2ZUNvbnRleHQoY29udGV4dD86IENvbnRleHQpOiBDb250ZXh0IHtcbiAgaWYgKGNvbnRleHQgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGNvbnRleHQ7XG4gIHJldHVybiBnZXRUcmFjZVJ1bnRpbWUoKS5nZXRDdXJyZW50Q29udGV4dCgpO1xufVxuXG4vKipcbiAqIEluamVjdCB0cmFjZSBjb250ZXh0IGFuZCBiYWdnYWdlIGludG8gYW4gb3V0Z29pbmcgY2FycmllciAoZS5nLiBIVFRQXG4gKiBoZWFkZXJzKS5cbiAqXG4gKiBDYWxsIHRoaXMgYmVmb3JlIG1ha2luZyBhbiBvdXRib3VuZCBIVFRQIHJlcXVlc3QgdG8gcHJvcGFnYXRlIHRoZVxuICogY3VycmVudCB0cmFjZSBhY3Jvc3Mgc2VydmljZSBib3VuZGFyaWVzLlxuICpcbiAqIEBwYXJhbSBjYXJyaWVyIC0gQSBtdXRhYmxlIG9iamVjdCB0byB3cml0ZSBwcm9wYWdhdGlvbiBoZWFkZXJzIGludG8uXG4gKiBAcGFyYW0gY29udGV4dCAtIFRoZSBjb250ZXh0IHRvIGluamVjdC4gRGVmYXVsdHMgdG8gdGhlIGN1cnJlbnRcbiAqICAgSnVkZ21lbnQgY29udGV4dC5cbiAqIEBwYXJhbSBzZXR0ZXIgLSBTdHJhdGVneSBmb3Igd3JpdGluZyB2YWx1ZXMgaW50byB0aGUgY2Fycmllci5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICogcHJvcGFnYXRpb24uaW5qZWN0KGhlYWRlcnMpO1xuICogYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5leGFtcGxlLmNvbVwiLCB7IGhlYWRlcnMgfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluamVjdDxDYXJyaWVyPihcbiAgY2FycmllcjogQ2FycmllcixcbiAgY29udGV4dD86IENvbnRleHQsXG4gIHNldHRlcjogVGV4dE1hcFNldHRlcjxDYXJyaWVyPiA9IGRlZmF1bHRUZXh0TWFwU2V0dGVyIGFzIFRleHRNYXBTZXR0ZXI8Q2Fycmllcj4sXG4pOiB2b2lkIHtcbiAgZG9udFRocm93KFwicHJvcGFnYXRpb24uaW5qZWN0XCIsICgpID0+IHtcbiAgICBnZXRHbG9iYWxUZXh0bWFwKCkuaW5qZWN0KF9yZXNvbHZlQ29udGV4dChjb250ZXh0KSwgY2Fycmllciwgc2V0dGVyKTtcbiAgfSk7XG59XG5cbi8qKlxuICogRXh0cmFjdCB0cmFjZSBjb250ZXh0IGFuZCBiYWdnYWdlIGZyb20gYW4gaW5jb21pbmcgY2Fycmllci5cbiAqXG4gKiBMb3ctbGV2ZWwgcHJpbWl0aXZlIOKAlCBtb3N0IGNhbGxlcnMgc2hvdWxkIHVzZVxuICoge0BsaW5rIFRyYWNlci5jb250aW51ZVRyYWNlfSBpbnN0ZWFkLCB3aGljaCBleHRyYWN0cyBhbmQgaW5zdGFsbHMgdGhlXG4gKiBjb250ZXh0IGluIG9uZSBzdGVwLlxuICpcbiAqIEBwYXJhbSBjYXJyaWVyIC0gQSBtYXBwaW5nIGNvbnRhaW5pbmcgcHJvcGFnYXRpb24gaGVhZGVycyAoZS5nLlxuICogICBgcmVxdWVzdC5oZWFkZXJzYCkuXG4gKiBAcGFyYW0gY29udGV4dCAtIEJhc2UgY29udGV4dCB0byBtZXJnZSBpbnRvLiBEZWZhdWx0cyB0byB0aGUgY3VycmVudFxuICogICBhY3RpdmUgY29udGV4dC5cbiAqIEBwYXJhbSBnZXR0ZXIgLSBTdHJhdGVneSBmb3IgcmVhZGluZyB2YWx1ZXMgZnJvbSB0aGUgY2Fycmllci5cbiAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBDb250ZXh0fSB3aXRoIHRoZSBleHRyYWN0ZWQgdHJhY2UgYW5kIGJhZ2dhZ2VcbiAqICAgZGF0YS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3Q8Q2Fycmllcj4oXG4gIGNhcnJpZXI6IENhcnJpZXIsXG4gIGNvbnRleHQ/OiBDb250ZXh0LFxuICBnZXR0ZXI6IFRleHRNYXBHZXR0ZXI8Q2Fycmllcj4gPSBkZWZhdWx0VGV4dE1hcEdldHRlciBhcyBUZXh0TWFwR2V0dGVyPENhcnJpZXI+LFxuKTogQ29udGV4dCB7XG4gIGNvbnN0IGJhc2UgPSBfcmVzb2x2ZUNvbnRleHQoY29udGV4dCk7XG4gIHJldHVybiBkb250VGhyb3c8Q29udGV4dD4oXG4gICAgXCJwcm9wYWdhdGlvbi5leHRyYWN0XCIsXG4gICAgKCkgPT4gZ2V0R2xvYmFsVGV4dG1hcCgpLmV4dHJhY3QoYmFzZSwgY2FycmllciwgZ2V0dGVyKSxcbiAgICBiYXNlLFxuICApO1xufVxuIiwKICAgICJpbXBvcnQge1xuICB0eXBlIEF0dHJpYnV0ZXMsXG4gIHR5cGUgQ29udGV4dCxcbiAgSU5WQUxJRF9TUEFOX0NPTlRFWFQsXG4gIHR5cGUgU3BhbixcbiAgU3BhblN0YXR1c0NvZGUsXG4gIHR5cGUgVHJhY2VyLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvYXBpXCI7XG5pbXBvcnQgdHlwZSB7IEluc3RydW1lbnRhdGlvbiB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9pbnN0cnVtZW50YXRpb25cIjtcbmltcG9ydCB0eXBlIHtcbiAgQmFzaWNUcmFjZXJQcm92aWRlcixcbiAgU2FtcGxlcixcbiAgU3BhbkxpbWl0cyxcbiAgU3BhblByb2Nlc3Nvcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Nkay10cmFjZS1iYXNlXCI7XG5pbXBvcnQgeyBBdHRyaWJ1dGVLZXlzLCBJbnRlcm5hbEF0dHJpYnV0ZUtleXMgfSBmcm9tIFwiLi4vSnVkZ21lbnRBdHRyaWJ1dGVLZXlzXCI7XG5pbXBvcnQgeyBKdWRnbWVudEFwaUNsaWVudCB9IGZyb20gXCIuLi9pbnRlcm5hbC9hcGlcIjtcbmltcG9ydCB0eXBlIHsgUGVuZGluZ0V2YWxQYXlsb2FkIH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9tb2RlbHMvUGVuZGluZ0V2YWxQYXlsb2FkXCI7XG5pbXBvcnQgeyBwYXJzZUZ1bmN0aW9uQXJncyB9IGZyb20gXCIuLi91dGlscy9hbm5vdGF0ZVwiO1xuaW1wb3J0IHsgZG9udFRocm93IH0gZnJvbSBcIi4uL3V0aWxzL2RvbnQtdGhyb3dcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuLi91dGlscy9sb2dnZXJcIjtcbmltcG9ydCB7IGNyZWF0ZVJhbmRvbVVVSUQgfSBmcm9tIFwiLi4vdXRpbHMvcmFuZG9tLXV1aWRcIjtcbmltcG9ydCB7XG4gIHNhZmVTdHJpbmdpZnksXG4gIHNlcmlhbGl6ZUF0dHJpYnV0ZSxcbiAgU2VyaWFsaXplcixcbn0gZnJvbSBcIi4uL3V0aWxzL3NlcmlhbGl6ZXJcIjtcbmltcG9ydCB7IE1heWJlIH0gZnJvbSBcIi4uL3V0aWxzL3R5cGUtaGVscGVyc1wiO1xuaW1wb3J0IHsgY3JlYXRlQmFnZ2FnZSwgZ2V0QmFnZ2FnZSwgc2V0QmFnZ2FnZSB9IGZyb20gXCIuL2JhZ2dhZ2VcIjtcbmltcG9ydCB7IGV4dHJhY3QgfSBmcm9tIFwiLi9wcm9wYWdhdGlvblwiO1xuaW1wb3J0IHR5cGUgeyBKdWRnbWVudFNwYW5FeHBvcnRlciB9IGZyb20gXCIuL2V4cG9ydGVycy9KdWRnbWVudFNwYW5FeHBvcnRlclwiO1xuaW1wb3J0IHR5cGUgeyBKdWRnbWVudFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi9wcm9jZXNzb3JzL0p1ZGdtZW50U3BhblByb2Nlc3NvclwiO1xuaW1wb3J0IHsgZ2V0VHJhY2VSdW50aW1lLCB0eXBlIFRyYWNlUnVudGltZSwgd3JhcExMTUNsaWVudCB9IGZyb20gXCIuL3J1bnRpbWVcIjtcblxuY29uc3QgVFJBQ0VSX05BTUUgPSBcImp1ZGdldmFsXCI7XG5cbi8qKlxuICogTWV0YWRhdGEgYWJvdXQgYW4gTExNIGNhbGwgdG8gcmVjb3JkIG9uIGEgc3Bhbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBMTE1NZXRhZGF0YSB7XG4gIC8qKiBNb2RlbCBuYW1lIChlLmcuIFwiZ3B0LTRvXCIpLiAqL1xuICBtb2RlbD86IE1heWJlPHN0cmluZz47XG4gIC8qKiBQcm92aWRlciBuYW1lIChlLmcuIFwib3BlbmFpXCIpLiAqL1xuICBwcm92aWRlcj86IE1heWJlPHN0cmluZz47XG4gIC8qKiBOdW1iZXIgb2Ygbm9uLWNhY2hlZCBpbnB1dCB0b2tlbnMuICovXG4gIG5vbl9jYWNoZWRfaW5wdXRfdG9rZW5zPzogTWF5YmU8bnVtYmVyPjtcbiAgLyoqIE51bWJlciBvZiBvdXRwdXQgdG9rZW5zLiAqL1xuICBvdXRwdXRfdG9rZW5zPzogTWF5YmU8bnVtYmVyPjtcbiAgLyoqIE51bWJlciBvZiBjYWNoZS1yZWFkIGlucHV0IHRva2Vucy4gKi9cbiAgY2FjaGVfcmVhZF9pbnB1dF90b2tlbnM/OiBNYXliZTxudW1iZXI+O1xuICAvKiogTnVtYmVyIG9mIGNhY2hlLWNyZWF0aW9uIGlucHV0IHRva2Vucy4gKi9cbiAgY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zPzogTWF5YmU8bnVtYmVyPjtcbiAgLyoqIFRvdGFsIGNvc3QgaW4gVVNELiAqL1xuICB0b3RhbF9jb3N0X3VzZD86IE1heWJlPG51bWJlcj47XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3Ige0BsaW5rIEJhc2VUcmFjZXIub2JzZXJ2ZX0uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgT2JzZXJ2ZU9wdGlvbnMge1xuICAvKiogVGhlIHNwYW4ga2luZCAoZS5nLiBgXCJsbG1cImAsIGBcInRvb2xcImAsIGBcInNwYW5cImApLiBEZWZhdWx0cyB0byBgXCJzcGFuXCJgLiAqL1xuICBzcGFuVHlwZT86IHN0cmluZztcbiAgLyoqIEN1c3RvbSBzcGFuIG5hbWUuIERlZmF1bHRzIHRvIHRoZSB3cmFwcGVkIGZ1bmN0aW9uJ3MgbmFtZS4gKi9cbiAgc3Bhbk5hbWU/OiBzdHJpbmc7XG4gIC8qKiBXaGV0aGVyIHRvIHJlY29yZCBmdW5jdGlvbiBpbnB1dHMgYXMgYSBzcGFuIGF0dHJpYnV0ZS4gRGVmYXVsdHMgdG8gYHRydWVgLiAqL1xuICByZWNvcmRJbnB1dD86IGJvb2xlYW47XG4gIC8qKiBXaGV0aGVyIHRvIHJlY29yZCBmdW5jdGlvbiBvdXRwdXRzIGFzIGEgc3BhbiBhdHRyaWJ1dGUuIERlZmF1bHRzIHRvIGB0cnVlYC4gKi9cbiAgcmVjb3JkT3V0cHV0PzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIElmIGB0cnVlYCwgcnVuIHRoZSBmdW5jdGlvbiBpbiBhIGZyZXNoIGxpbmtlZCB0cmFjZSBpbnN0ZWFkIG9mIGFzIGFcbiAgICogY2hpbGQgb2YgdGhlIGN1cnJlbnQgdHJhY2UsIHdoZW4gYW4gYWN0aXZlIHBhcmVudCBzcGFuIGV4aXN0cy5cbiAgICogRGVmYXVsdHMgdG8gYGZhbHNlYC5cbiAgICovXG4gIGZvcms/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIE9wdGlvbnMgZm9yIHtAbGluayBCYXNlVHJhY2VyLmFzeW5jRXZhbHVhdGV9LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFzeW5jRXZhbHVhdGVPcHRpb25zIHtcbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGhvc3RlZCBqdWRnZS9zY29yZXIgKGUuZy4gYFwiZmFpdGhmdWxuZXNzXCJgLFxuICAgKiBgXCJhbnN3ZXJfcmVsZXZhbmN5XCJgKS5cbiAgICovXG4gIGp1ZGdlOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBPcHRpb25hbCBkaWN0IHdpdGggZXZhbHVhdGlvbiBkYXRhLiBLZXlzIGxpa2UgYGlucHV0YCwgYGFjdHVhbF9vdXRwdXRgLFxuICAgKiBgZXhwZWN0ZWRfb3V0cHV0YCwgYW5kIGByZXRyaWV2YWxfY29udGV4dGAgYXJlIGNvbW1vbmx5IHVzZWQuXG4gICAqL1xuICBleGFtcGxlPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciBpbml0aWFsaXppbmcgYSBUcmFjZXIuXG4gKlxuICogQ3JlZGVudGlhbHMgYXJlIHJlc29sdmVkIGluIG9yZGVyOiBleHBsaWNpdCBhcmd1bWVudHMgZmlyc3QsIHRoZW5cbiAqIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUcmFjZXJDb25maWcge1xuICAvKiogWW91ciBKdWRnbWVudCBwcm9qZWN0IG5hbWUuIFJlcXVpcmVkIGZvciBzcGFuIGV4cG9ydC4gKi9cbiAgcHJvamVjdE5hbWU/OiBzdHJpbmc7XG4gIC8qKiBKdWRnbWVudCBBUEkga2V5LiBEZWZhdWx0cyB0byBgSlVER01FTlRfQVBJX0tFWWAgZW52IHZhci4gKi9cbiAgYXBpS2V5Pzogc3RyaW5nO1xuICAvKiogSnVkZ21lbnQgb3JnYW5pemF0aW9uIElELiBEZWZhdWx0cyB0byBgSlVER01FTlRfT1JHX0lEYCBlbnYgdmFyLiAqL1xuICBvcmdhbml6YXRpb25JZD86IHN0cmluZztcbiAgLyoqIEp1ZGdtZW50IEFQSSBVUkwuIERlZmF1bHRzIHRvIGBKVURHTUVOVF9BUElfVVJMYCBlbnYgdmFyLiAqL1xuICBhcGlVcmw/OiBzdHJpbmc7XG4gIC8qKiBEZXBsb3ltZW50IGVudmlyb25tZW50IG5hbWUgKGUuZy4gXCJwcm9kdWN0aW9uXCIpLiAqL1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgLyoqIFdoZXRoZXIgdG8gYXV0b21hdGljYWxseSBzZXQgdGhpcyB0cmFjZXIgYXMgYWN0aXZlLiBEZWZhdWx0cyB0byBgdHJ1ZWAuICovXG4gIHNldEFjdGl2ZT86IGJvb2xlYW47XG4gIC8qKiBDdXN0b20gc2VyaWFsaXphdGlvbiBmdW5jdGlvbiBmb3Igc3BhbiBhdHRyaWJ1dGUgdmFsdWVzLiAqL1xuICBzZXJpYWxpemVyPzogKHZhbHVlOiB1bmtub3duKSA9PiBzdHJpbmc7XG4gIC8qKiBBZGRpdGlvbmFsIE9wZW5UZWxlbWV0cnkgcmVzb3VyY2UgYXR0cmlidXRlcy4gKi9cbiAgcmVzb3VyY2VBdHRyaWJ1dGVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgLyoqIEN1c3RvbSBPcGVuVGVsZW1ldHJ5IHNhbXBsZXIuIERlZmF1bHRzIHRvIHRoZSBTREsncyBkZWZhdWx0LiAqL1xuICBzYW1wbGVyPzogU2FtcGxlcjtcbiAgLyoqIEN1c3RvbSBPcGVuVGVsZW1ldHJ5IHNwYW4gbGltaXRzIChhdHRyaWJ1dGUvZXZlbnQvbGluayBjYXBzKS4gKi9cbiAgc3BhbkxpbWl0cz86IFNwYW5MaW1pdHM7XG4gIC8qKiBBZGRpdGlvbmFsIHNwYW4gcHJvY2Vzc29ycyB0byByZWdpc3RlciBhbG9uZ3NpZGUgSnVkZ21lbnQncyBvd24gcHJvY2Vzc29yLiAqL1xuICBzcGFuUHJvY2Vzc29ycz86IFNwYW5Qcm9jZXNzb3JbXTtcbn1cblxuLyoqXG4gKiBBYnN0cmFjdCBiYXNlIGZvciBhbGwgSnVkZ21lbnQgdHJhY2Vycy5cbiAqXG4gKiBQcm92aWRlcyB0aGUgY29yZSB0cmFjaW5nIHN1cmZhY2U6IHNwYW4gY3JlYXRpb24sIGF0dHJpYnV0ZSByZWNvcmRpbmcsXG4gKiB0aGUgYG9ic2VydmVgIGRlY29yYXRvciwgY29udGV4dCBwcm9wYWdhdGlvbiBmb3IgY3VzdG9tZXIvc2Vzc2lvbiBJRHMsXG4gKiB0YWdnaW5nLCBhbmQgYXN5bmMgZXZhbHVhdGlvbiBkaXNwYXRjaC5cbiAqIENvbmNyZXRlIHN1YmNsYXNzZXMgc3VwcGx5IHRoZSBPVGVsIFRyYWNlclByb3ZpZGVyLCBleHBvcnRlciwgYW5kXG4gKiBwcm9jZXNzb3Igd2lyaW5nLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVRyYWNlciB7XG4gIHByb2plY3ROYW1lOiBzdHJpbmcgfCBudWxsO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGFwaUtleTogc3RyaW5nIHwgbnVsbDtcbiAgb3JnYW5pemF0aW9uSWQ6IHN0cmluZyB8IG51bGw7XG4gIGFwaVVybDogc3RyaW5nIHwgbnVsbDtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZyB8IG51bGw7XG4gIHNlcmlhbGl6ZXI6IFNlcmlhbGl6ZXI7XG4gIF90cmFjZXJQcm92aWRlcjogQmFzaWNUcmFjZXJQcm92aWRlcjtcbiAgX2NsaWVudDogSnVkZ21lbnRBcGlDbGllbnQgfCBudWxsO1xuICBfZW5hYmxlTW9uaXRvcmluZzogYm9vbGVhbjtcblxuICByZWFkb25seSBzdXBwb3J0c0xpdmVJbnN0cnVtZW50YXRpb246IGJvb2xlYW4gPSB0cnVlO1xuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuICAvLyAgSW5pdGlhbGl6YXRpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcgfCBudWxsLFxuICAgIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbCxcbiAgICBhcGlLZXk6IHN0cmluZyB8IG51bGwsXG4gICAgb3JnYW5pemF0aW9uSWQ6IHN0cmluZyB8IG51bGwsXG4gICAgYXBpVXJsOiBzdHJpbmcgfCBudWxsLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcgfCBudWxsLFxuICAgIHNlcmlhbGl6ZXI6IFNlcmlhbGl6ZXIsXG4gICAgdHJhY2VyUHJvdmlkZXI6IEJhc2ljVHJhY2VyUHJvdmlkZXIsXG4gICAgY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudCB8IG51bGwsXG4gICAgZW5hYmxlTW9uaXRvcmluZzogYm9vbGVhbixcbiAgKSB7XG4gICAgdGhpcy5wcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lO1xuICAgIHRoaXMucHJvamVjdElkID0gcHJvamVjdElkO1xuICAgIHRoaXMuYXBpS2V5ID0gYXBpS2V5O1xuICAgIHRoaXMub3JnYW5pemF0aW9uSWQgPSBvcmdhbml6YXRpb25JZDtcbiAgICB0aGlzLmFwaVVybCA9IGFwaVVybDtcbiAgICB0aGlzLmVudmlyb25tZW50ID0gZW52aXJvbm1lbnQ7XG4gICAgdGhpcy5zZXJpYWxpemVyID0gc2VyaWFsaXplcjtcbiAgICB0aGlzLl90cmFjZXJQcm92aWRlciA9IHRyYWNlclByb3ZpZGVyO1xuICAgIHRoaXMuX2NsaWVudCA9IGNsaWVudDtcbiAgICB0aGlzLl9lbmFibGVNb25pdG9yaW5nID0gZW5hYmxlTW9uaXRvcmluZztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgdGhpcyB0cmFjZXIgYXMgdGhlIGFjdGl2ZSB0cmFjZXIgaW4gdGhlIGdsb2JhbCBwcm92aWRlci5cbiAgICpcbiAgICogQHJldHVybnMgYHRydWVgIGlmIGFjdGl2YXRpb24gc3VjY2VlZGVkLCBgZmFsc2VgIGlmIGEgcm9vdCBzcGFuIGlzIGFjdGl2ZS5cbiAgICovXG4gIHNldEFjdGl2ZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZ2V0VHJhY2VSdW50aW1lKCkuc2V0QWN0aXZlKHRoaXMpO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBBYnN0cmFjdCBMaWZlY3ljbGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICBhYnN0cmFjdCBnZXRTcGFuUHJvY2Vzc29yKCk6IEp1ZGdtZW50U3BhblByb2Nlc3NvcjtcbiAgYWJzdHJhY3QgZ2V0U3BhbkV4cG9ydGVyKCk6IEp1ZGdtZW50U3BhbkV4cG9ydGVyO1xuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuICAvLyAgSW50ZXJuYWwgSGVscGVycyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG5cbiAgcHJpdmF0ZSBzdGF0aWMgX2dldFByb3h5UHJvdmlkZXIoKTogVHJhY2VSdW50aW1lIHtcbiAgICByZXR1cm4gZ2V0VHJhY2VSdW50aW1lKCk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBfZ2V0U2VyaWFsaXplcigpOiBTZXJpYWxpemVyIHtcbiAgICBjb25zdCB0cmFjZXIgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCkuZ2V0QWN0aXZlVHJhY2VyKCk7XG4gICAgcmV0dXJuIHRyYWNlcj8uc2VyaWFsaXplciA/PyBzYWZlU3RyaW5naWZ5O1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgX2dldEN1cnJlbnRUcmFjZUFuZFNwYW5JZCgpOiBbc3RyaW5nLCBzdHJpbmddIHwgbnVsbCB7XG4gICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgY29uc3QgY3VycmVudFNwYW4gPSBwcm94eS5nZXRDdXJyZW50U3BhbigpO1xuICAgIGlmICghY3VycmVudFNwYW4/LmlzUmVjb3JkaW5nKCkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGN0eCA9IGN1cnJlbnRTcGFuLnNwYW5Db250ZXh0KCk7XG4gICAgaWYgKCFjdHgudHJhY2VJZCB8fCAhKGN0eC50cmFjZUZsYWdzICYgMHgwMSkpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBbY3R4LnRyYWNlSWQsIGN0eC5zcGFuSWRdO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgX2VtaXRQYXJ0aWFsKCk6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkJhc2VUcmFjZXIuX2VtaXRQYXJ0aWFsXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHRyYWNlciA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKS5nZXRBY3RpdmVUcmFjZXIoKTtcbiAgICAgIGlmICghdHJhY2VyIHx8ICF0cmFjZXIuc3VwcG9ydHNMaXZlSW5zdHJ1bWVudGF0aW9uKSByZXR1cm47XG4gICAgICB0cmFjZXIuZ2V0U3BhblByb2Nlc3NvcigpLmVtaXRQYXJ0aWFsKCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYyBBUEk6IFNwYW4gQWNjZXNzICYgTGlmZWN5Y2xlICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnRseSBhY3RpdmUgc3Bhbi5cbiAgICpcbiAgICogQHJldHVybnMgVGhlIGFjdGl2ZSBzcGFuLCBvciBgdW5kZWZpbmVkYCBpZiBub25lLlxuICAgKi9cbiAgc3RhdGljIGdldEN1cnJlbnRTcGFuKCk6IFNwYW4gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHByb3h5ID0gQmFzZVRyYWNlci5fZ2V0UHJveHlQcm92aWRlcigpO1xuICAgIHJldHVybiBwcm94eS5nZXRDdXJyZW50U3BhbigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZsdXNoIGFsbCBwZW5kaW5nIHNwYW5zIHRvIHRoZSBleHBvcnQgZW5kcG9pbnQuXG4gICAqXG4gICAqIENhbGwgdGhpcyBiZWZvcmUgeW91ciBwcm9jZXNzIGV4aXRzIHRvIGVuc3VyZSBhbGwgc3BhbnMgYXJlIHNlbnQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogYXdhaXQgVHJhY2VyLmZvcmNlRmx1c2goKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgZm9yY2VGbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICBhd2FpdCBwcm94eS5mb3JjZUZsdXNoKCk7XG4gIH1cblxuICAvKipcbiAgICogU2h1dCBkb3duIHRoZSB0cmFjZXIgYW5kIGZsdXNoIGFueSBwZW5kaW5nIGRhdGEuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogYXdhaXQgVHJhY2VyLnNodXRkb3duKCk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGFzeW5jIHNodXRkb3duKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHByb3h5ID0gQmFzZVRyYWNlci5fZ2V0UHJveHlQcm92aWRlcigpO1xuICAgIGF3YWl0IHByb3h5LnNodXRkb3duKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYW4gT3BlblRlbGVtZXRyeSBpbnN0cnVtZW50YXRpb24gdG8gY2FwdHVyZSBzcGFucyBhdXRvbWF0aWNhbGx5LlxuICAgKlxuICAgKiBAcGFyYW0gaW5zdHJ1bWVudG9yIC0gVGhlIE9wZW5UZWxlbWV0cnkgaW5zdHJ1bWVudGF0aW9uIHRvIHJlZ2lzdGVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGltcG9ydCB7IE9wZW5BSUluc3RydW1lbnRhdGlvbiB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9pbnN0cnVtZW50YXRpb24tb3BlbmFpXCI7XG4gICAqIFRyYWNlci5yZWdpc3Rlck9URUxJbnN0cnVtZW50YXRpb24obmV3IE9wZW5BSUluc3RydW1lbnRhdGlvbigpKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgcmVnaXN0ZXJPVEVMSW5zdHJ1bWVudGF0aW9uKGluc3RydW1lbnRvcjogSW5zdHJ1bWVudGF0aW9uKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiQmFzZVRyYWNlci5yZWdpc3Rlck9URUxJbnN0cnVtZW50YXRpb25cIiwgKCkgPT4ge1xuICAgICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgICBwcm94eS5hZGRJbnN0cnVtZW50YXRpb24oaW5zdHJ1bWVudG9yKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcmFwIGEgc3VwcG9ydGVkIExMTSBjbGllbnQgdG8gYWRkIGF1dG9tYXRpYyB0cmFjaW5nLlxuICAgKlxuICAgKiBDdXJyZW50bHkgc3VwcG9ydHMgT3BlbkFJIGNsaWVudHMuIFRoZSBjbGllbnQgaXMgaW5zdHJ1bWVudGVkXG4gICAqIGluLXBsYWNlIGFuZCByZXR1cm5lZC5cbiAgICpcbiAgICogQHBhcmFtIGNsaWVudCAtIEFuIExMTSBjbGllbnQgaW5zdGFuY2UgKGUuZy4gYG5ldyBPcGVuQUkoKWApLlxuICAgKiBAcmV0dXJucyBUaGUgc2FtZSBjbGllbnQgaW5zdGFuY2UsIGluc3RydW1lbnRlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBpbXBvcnQgT3BlbkFJIGZyb20gXCJvcGVuYWlcIjtcbiAgICpcbiAgICogY29uc3QgY2xpZW50ID0gVHJhY2VyLndyYXAobmV3IE9wZW5BSSgpKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgd3JhcDxUPihjbGllbnQ6IFQpOiBUIHtcbiAgICByZXR1cm4gd3JhcExMTUNsaWVudChjbGllbnQpO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBTdGF0aWM6IFNwYW4gQ3JlYXRpb24gKE9URUwtbGlrZSBzaWduYXR1cmVzKSAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICAvKipcbiAgICogR2V0IHRoZSB1bmRlcmx5aW5nIE9wZW5UZWxlbWV0cnkgVHJhY2VyIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcmV0dXJucyBUaGUgT3BlblRlbGVtZXRyeSBgVHJhY2VyYC5cbiAgICovXG4gIHN0YXRpYyBnZXRPVEVMVHJhY2VyKCk6IFRyYWNlciB7XG4gICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgcmV0dXJuIHByb3h5LmdldFRyYWNlcihUUkFDRVJfTkFNRSk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBuZXcgc3BhbiB3aXRob3V0IHNldHRpbmcgaXQgYXMgYWN0aXZlLlxuICAgKlxuICAgKiAqKk1vc3QgdXNlcnMgc2hvdWxkIHByZWZlciB7QGxpbmsgb2JzZXJ2ZX0gb3Ige0BsaW5rIHdpdGh9KiosIHdoaWNoXG4gICAqIGhhbmRsZSBhY3RpdmF0aW9uLCBlcnJvciByZWNvcmRpbmcsIGFuZCBzcGFuIGVuZGluZyBhdXRvbWF0aWNhbGx5LlxuICAgKiBVc2UgdGhpcyBvbmx5IHdoZW4geW91IG5lZWQgbG93LWxldmVsIGNvbnRyb2wgb3ZlciB0aGUgc3BhbiBsaWZlY3ljbGUuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIC0gVGhlIHNwYW4gbmFtZS5cbiAgICogQHBhcmFtIGF0dHJpYnV0ZXMgLSBPcHRpb25hbCBzcGFuIGF0dHJpYnV0ZXMuXG4gICAqIEByZXR1cm5zIFRoZSBjcmVhdGVkIHNwYW4uXG4gICAqL1xuICBzdGF0aWMgc3RhcnRTcGFuKG5hbWU6IHN0cmluZywgYXR0cmlidXRlcz86IEF0dHJpYnV0ZXMpOiBTcGFuIHtcbiAgICBjb25zdCBzcGFuID0gQmFzZVRyYWNlci5nZXRPVEVMVHJhY2VyKCkuc3RhcnRTcGFuKG5hbWUsIHsgYXR0cmlidXRlcyB9KTtcbiAgICBCYXNlVHJhY2VyLl9lbWl0UGFydGlhbCgpO1xuICAgIHJldHVybiBzcGFuO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEgbmV3IGFjdGl2ZSBzcGFuIGFuZCBydW4gYSBmdW5jdGlvbiB3aXRoaW4gaXQuXG4gICAqXG4gICAqIFRoZSBzcGFuIGlzIGF1dG9tYXRpY2FsbHkgZW5kZWQgd2hlbiB0aGUgZnVuY3Rpb24gY29tcGxldGVzLlxuICAgKlxuICAgKiAqKk1vc3QgdXNlcnMgc2hvdWxkIHByZWZlciB7QGxpbmsgb2JzZXJ2ZX0gb3Ige0BsaW5rIHdpdGh9KiosIHdoaWNoXG4gICAqIGFkZGl0aW9uYWxseSByZWNvcmQgaW5wdXRzL291dHB1dHMgYW5kIGNhcHR1cmUgZXJyb3JzIGF1dG9tYXRpY2FsbHkuXG4gICAqIFVzZSB0aGlzIG9ubHkgd2hlbiB5b3UgbmVlZCBsb3ctbGV2ZWwgY29udHJvbCBvdmVyIHRoZSBzcGFuIGxpZmVjeWNsZS5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgLSBTcGFuIG9wdGlvbnMuIGBuYW1lYCBpcyByZXF1aXJlZDsgYGF0dHJpYnV0ZXNgIGlzIG9wdGlvbmFsLlxuICAgKiBAcGFyYW0gZm4gLSBGdW5jdGlvbiB0byBleGVjdXRlIHdpdGhpbiB0aGUgc3BhbiBjb250ZXh0LlxuICAgKiBAcmV0dXJucyBUaGUgcmV0dXJuIHZhbHVlIG9mIGBmbmAuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogVHJhY2VyLnN0YXJ0QWN0aXZlU3Bhbih7IG5hbWU6IFwiZmV0Y2gtdXNlclwiIH0sIChzcGFuKSA9PiB7XG4gICAqICAgLy8gLi4uXG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBzdGFydEFjdGl2ZVNwYW48VD4oXG4gICAgb3B0aW9uczogeyBuYW1lOiBzdHJpbmc7IGF0dHJpYnV0ZXM/OiBBdHRyaWJ1dGVzIH0sXG4gICAgZm46IChzcGFuOiBTcGFuKSA9PiBULFxuICApOiBUIHtcbiAgICBjb25zdCB7IG5hbWUsIGF0dHJpYnV0ZXMgfSA9IG9wdGlvbnM7XG4gICAgcmV0dXJuIEJhc2VUcmFjZXIuZ2V0T1RFTFRyYWNlcigpLnN0YXJ0QWN0aXZlU3BhbihcbiAgICAgIG5hbWUsXG4gICAgICB7IGF0dHJpYnV0ZXMgfSxcbiAgICAgIChzcGFuKSA9PiB7XG4gICAgICAgIEJhc2VUcmFjZXIuX2VtaXRQYXJ0aWFsKCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gZm4oc3Bhbik7XG4gICAgICAgICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIFByb21pc2U8dW5rbm93bj4pLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICBzcGFuLmVuZCgpO1xuICAgICAgICAgICAgfSkgYXMgVDtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3Bhbi5lbmQoKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgc3Bhbi5lbmQoKTtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYzogU3BhbiBIZWxwZXJzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuYW1lZCBzcGFuLCBleGVjdXRlIGEgZnVuY3Rpb24sIGFuZCBoYW5kbGUgZXJyb3JzLlxuICAgKlxuICAgKiBFcnJvcnMgYXJlIHJlY29yZGVkIG9uIHRoZSBzcGFuIGFuZCByZS10aHJvd24uXG4gICAqXG4gICAqIEBwYXJhbSBzcGFuTmFtZSAtIFRoZSBzcGFuIG5hbWUuXG4gICAqIEBwYXJhbSBmbiAtIEZ1bmN0aW9uIHRvIGV4ZWN1dGUgd2l0aGluIHRoZSBzcGFuLlxuICAgKiBAcmV0dXJucyBUaGUgcmV0dXJuIHZhbHVlIG9mIGBmbmAuXG4gICAqL1xuICBzdGF0aWMgc3BhbjxUPihzcGFuTmFtZTogc3RyaW5nLCBmbjogKHNwYW46IFNwYW4pID0+IFQpOiBUIHtcbiAgICByZXR1cm4gQmFzZVRyYWNlci5zdGFydEFjdGl2ZVNwYW4oeyBuYW1lOiBzcGFuTmFtZSB9LCAoc3BhbikgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZm4oc3Bhbik7XG4gICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdC5jYXRjaCgoZTogdW5rbm93bikgPT4ge1xuICAgICAgICAgICAgc3Bhbi5zZXRTdGF0dXMoeyBjb2RlOiBTcGFuU3RhdHVzQ29kZS5FUlJPUiwgbWVzc2FnZTogU3RyaW5nKGUpIH0pO1xuICAgICAgICAgICAgc3Bhbi5yZWNvcmRFeGNlcHRpb24oZSBhcyBFcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgIH0pIGFzIFQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgc3Bhbi5zZXRTdGF0dXMoeyBjb2RlOiBTcGFuU3RhdHVzQ29kZS5FUlJPUiwgbWVzc2FnZTogU3RyaW5nKGUpIH0pO1xuICAgICAgICBzcGFuLnJlY29yZEV4Y2VwdGlvbihlIGFzIEVycm9yKTtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbGlhcyBmb3Ige0BsaW5rIHNwYW59LiBDcmVhdGUgYSBuYW1lZCBzcGFuIGFuZCBleGVjdXRlIGEgZnVuY3Rpb24gd2l0aGluIGl0LlxuICAgKlxuICAgKiBAcGFyYW0gc3Bhbk5hbWUgLSBUaGUgc3BhbiBuYW1lLlxuICAgKiBAcGFyYW0gZm4gLSBGdW5jdGlvbiB0byBleGVjdXRlIHdpdGhpbiB0aGUgc3Bhbi5cbiAgICogQHJldHVybnMgVGhlIHJldHVybiB2YWx1ZSBvZiBgZm5gLlxuICAgKi9cbiAgc3RhdGljIHdpdGg8VD4oc3Bhbk5hbWU6IHN0cmluZywgZm46IChzcGFuOiBTcGFuKSA9PiBUKTogVCB7XG4gICAgcmV0dXJuIEJhc2VUcmFjZXIuc3BhbihzcGFuTmFtZSwgZm4pO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnRpbnVlIGEgZGlzdHJpYnV0ZWQgdHJhY2UgZnJvbSBhbiB1cHN0cmVhbSBzZXJ2aWNlLlxuICAgKlxuICAgKiBFeHRyYWN0cyBXM0MgdHJhY2UgY29udGV4dCBhbmQgYmFnZ2FnZSBmcm9tIGBjYXJyaWVyYCBhbmQgaW5zdGFsbHNcbiAgICogaXQgYXMgdGhlIGFjdGl2ZSBjb250ZXh0IGZvciB0aGUgZHVyYXRpb24gb2YgYGZuYC4gQW55IHNwYW4gc3RhcnRlZFxuICAgKiBpbnNpZGUg4oCUIGluY2x1ZGluZyBgQFRyYWNlci5vYnNlcnZlYC13cmFwcGVkIGZ1bmN0aW9ucyBhbmRcbiAgICogYFRyYWNlci53aXRoYCBibG9ja3Mg4oCUIGJlY29tZXMgYSBjaGlsZCBvZiB0aGUgdXBzdHJlYW0gcGFyZW50LFxuICAgKiBzdGl0Y2hpbmcgeW91ciBzZXJ2aWNlIGludG8gdGhlIGNhbGxlcidzIHRyYWNlLlxuICAgKlxuICAgKiBVc2UgdGhpcyBhdCB0aGUgZW50cnkgcG9pbnQgb2YgYW4gaW5ib3VuZCByZXF1ZXN0IChIVFRQIGhhbmRsZXIsXG4gICAqIG1lc3NhZ2UgcXVldWUgY29uc3VtZXIsIFJQQyBkaXNwYXRjaGVyLCBldGMuKSB0byBqb2luIGEgdHJhY2VcbiAgICogc3RhcnRlZCBieSB0aGUgdXBzdHJlYW0gY2FsbGVyLiBJZiB0aGUgY2FycmllciBjb250YWlucyBubyB0cmFjZVxuICAgKiBjb250ZXh0LCBgZm5gIHN0aWxsIHJ1bnMgbm9ybWFsbHkgd2l0aCBhIGZyZXNoIGNvbnRleHQuXG4gICAqXG4gICAqIEBwYXJhbSBjYXJyaWVyIC0gQSBtYXBwaW5nIGNvbnRhaW5pbmcgcHJvcGFnYXRpb24gaGVhZGVycy4gVHlwaWNhbGx5XG4gICAqICAgYHJlcS5oZWFkZXJzYCBmcm9tIE5vZGUncyBgaHR0cGAvRXhwcmVzcy9GYXN0aWZ5LCBidXQgYW55IGRpY3Qtc2hhcGVkXG4gICAqICAgb2JqZWN0IHdpdGggbG93ZXJjYXNlIGtleXMgd29ya3MgKHF1ZXVlIGF0dHJpYnV0ZXMsIExhbWJkYSBldmVudFxuICAgKiAgIGhlYWRlcnMsIFJQQyBtZXRhZGF0YSwgZXRjLikuXG4gICAqIEBwYXJhbSBmbiAtIEZ1bmN0aW9uIHRvIHJ1biBpbnNpZGUgdGhlIGV4dHJhY3RlZCBjb250ZXh0LiBSZWNlaXZlc1xuICAgKiAgIHRoZSBleHRyYWN0ZWQge0BsaW5rIENvbnRleHR9IGFzIGl0cyBhcmd1bWVudDsgbW9zdCBjYWxsZXJzIGlnbm9yZVxuICAgKiAgIGl0LiBTeW5jIG9yIGFzeW5jLlxuICAgKiBAcmV0dXJucyBUaGUgcmV0dXJuIHZhbHVlIG9mIGBmbmAuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogaW1wb3J0IHsgVHJhY2VyIH0gZnJvbSBcImp1ZGdldmFsXCI7XG4gICAqXG4gICAqIGNvbnN0IGhhbmRsZSA9IFRyYWNlci5vYnNlcnZlKGFzeW5jIChwYXlsb2FkOiB1bmtub3duKSA9PiB7XG4gICAqICAgLy8gLi4uIHlvdXIgYWdlbnQgbG9naWMgLi4uXG4gICAqIH0pO1xuICAgKlxuICAgKiAvLyBFeHByZXNzIC8gTm9kZSBodHRwIGhhbmRsZXI6XG4gICAqIGFwcC5wb3N0KFwiL3J1blwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICogICBhd2FpdCBUcmFjZXIuY29udGludWVUcmFjZShyZXEuaGVhZGVycywgYXN5bmMgKCkgPT4ge1xuICAgKiAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlKHJlcS5ib2R5KTtcbiAgICogICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAqICAgfSk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogUHJvcGFnYXRpbmcgaW4gdGhlIG9wcG9zaXRlIGRpcmVjdGlvbiAob3V0Ym91bmQpOlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGltcG9ydCB7IHByb3BhZ2F0aW9uIH0gZnJvbSBcImp1ZGdldmFsXCI7XG4gICAqXG4gICAqIGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICogcHJvcGFnYXRpb24uaW5qZWN0KGhlYWRlcnMpO1xuICAgKiBhd2FpdCBmZXRjaChkb3duc3RyZWFtVXJsLCB7IGhlYWRlcnMsIG1ldGhvZDogXCJQT1NUXCIsIGJvZHkgfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGNvbnRpbnVlVHJhY2U8VD4oY2Fycmllcjogb2JqZWN0LCBmbjogKGN0eDogQ29udGV4dCkgPT4gVCk6IFQge1xuICAgIGNvbnN0IHByb3h5ID0gQmFzZVRyYWNlci5fZ2V0UHJveHlQcm92aWRlcigpO1xuICAgIGNvbnN0IGN0eCA9IGV4dHJhY3QoY2Fycmllcik7XG4gICAgcmV0dXJuIHByb3h5LndpdGhDb250ZXh0KGN0eCwgKCkgPT4gZm4oY3R4KSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYyBBUEk6IE9ic2VydmF0aW9uIERlY29yYXRvciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBXcmFwIGEgZnVuY3Rpb24gdG8gYXV0b21hdGljYWxseSBjcmVhdGUgc3BhbnMgYW5kIHJlY29yZCBpbnB1dHMvb3V0cHV0cy5cbiAgICpcbiAgICogQ2FuIGJlIGNhbGxlZCB3aXRoIGEgZnVuY3Rpb24gdG8gd3JhcCBpdCBkaXJlY3RseSwgb3Igd2l0aCBqdXN0IG9wdGlvbnNcbiAgICogdG8gZ2V0IGEgZGVjb3JhdG9yIChlLmcuIGZvciBUQzM5IGRlY29yYXRvciBzeW50YXgpLlxuICAgKlxuICAgKiBAcGFyYW0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byB3cmFwLiBPbWl0IHRvIGdldCBhIGRlY29yYXRvci5cbiAgICogQHBhcmFtIG9wdGlvbnMgLSBPcHRpb25hbCBvYnNlcnZhdGlvbiBvcHRpb25zLlxuICAgKiBAcmV0dXJucyBUaGUgd3JhcHBlZCBmdW5jdGlvbiwgb3IgYSBkZWNvcmF0b3IgaWYgYGZ1bmNgIGlzIG9taXR0ZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogLy8gRGlyZWN0IHdyYXBwaW5nXG4gICAqIGNvbnN0IHRyYWNlZCA9IFRyYWNlci5vYnNlcnZlKFxuICAgKiAgIGFzeW5jIChxdWVyeTogc3RyaW5nKSA9PiBzZWFyY2gocXVlcnkpLFxuICAgKiAgIHsgc3BhblR5cGU6IFwidG9vbFwiIH0sXG4gICAqICk7XG4gICAqXG4gICAqIC8vIERlY29yYXRvciBmb3JtXG4gICAqIGNsYXNzIEFnZW50IHtcbiAgICogICBcXEBUcmFjZXIub2JzZXJ2ZSh7IHNwYW5UeXBlOiBcImxsbVwiIH0pXG4gICAqICAgYXN5bmMgY2hhdChpbnB1dDogc3RyaW5nKSB7IC4uLiB9XG4gICAqIH1cbiAgICpcbiAgICogLy8gRm9yayBpbnRvIGEgbGlua2VkIHRyYWNlXG4gICAqIGNvbnN0IGRlbGVnYXRlID0gVHJhY2VyLm9ic2VydmUocnVuU3Vic3lzdGVtLCB7XG4gICAqICAgc3BhblR5cGU6IFwiYWdlbnRcIixcbiAgICogICBmb3JrOiB0cnVlLFxuICAgKiB9KTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgb2JzZXJ2ZTxUQXJncyBleHRlbmRzIHVua25vd25bXSwgVFJldHVybj4oXG4gICAgZnVuYzogKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuLFxuICAgIG9wdGlvbnM/OiBPYnNlcnZlT3B0aW9ucyxcbiAgKTogKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuO1xuICBzdGF0aWMgb2JzZXJ2ZShcbiAgICBvcHRpb25zPzogT2JzZXJ2ZU9wdGlvbnMsXG4gICk6IDxUQXJncyBleHRlbmRzIHVua25vd25bXSwgVFJldHVybj4oXG4gICAgZnVuYzogKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuLFxuICAgIGNvbnRleHQ/OiB1bmtub3duLFxuICApID0+ICguLi5hcmdzOiBUQXJncykgPT4gVFJldHVybjtcbiAgc3RhdGljIG9ic2VydmU8VEFyZ3MgZXh0ZW5kcyB1bmtub3duW10sIFRSZXR1cm4+KFxuICAgIGZ1bmNPck9wdGlvbnM/OiAoKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuKSB8IE9ic2VydmVPcHRpb25zLFxuICAgIG9wdGlvbnM/OiBPYnNlcnZlT3B0aW9ucyxcbiAgKTpcbiAgICB8ICgoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm4pXG4gICAgfCAoKGZ1bmM6ICguLi5hcmdzOiBUQXJncykgPT4gVFJldHVybikgPT4gKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuKSB7XG4gICAgbGV0IGZ1bmM6ICgoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm4pIHwgdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgZnVuY09yT3B0aW9ucyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBmdW5jID0gZnVuY09yT3B0aW9ucztcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IGZ1bmNPck9wdGlvbnM7XG4gICAgfVxuICAgIGNvbnN0IHtcbiAgICAgIHNwYW5UeXBlID0gXCJzcGFuXCIsXG4gICAgICBzcGFuTmFtZSxcbiAgICAgIHJlY29yZElucHV0ID0gdHJ1ZSxcbiAgICAgIHJlY29yZE91dHB1dCA9IHRydWUsXG4gICAgICBmb3JrID0gZmFsc2UsXG4gICAgfSA9IG9wdGlvbnMgPz8ge307XG4gICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgY29uc3QgZGVjb3JhdG9yID0gKFxuICAgICAgaW5uZXJGdW5jOiAoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm4sXG4gICAgKTogKCguLi5hcmdzOiBUQXJncykgPT4gVFJldHVybikgPT4ge1xuICAgICAgY29uc3QgbmFtZSA9IHNwYW5OYW1lID8/IGlubmVyRnVuYy5uYW1lO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0aGlzOiB1bmtub3duLCAuLi5hcmdzOiBUQXJncyk6IFRSZXR1cm4ge1xuICAgICAgICBjb25zdCBvdGVsVHJhY2VyID0gcHJveHkuZ2V0VHJhY2VyKFRSQUNFUl9OQU1FKTtcblxuICAgICAgICBjb25zdCBzaG91bGRGb3JrID1cbiAgICAgICAgICBmb3JrICYmXG4gICAgICAgICAgcHJveHkuZ2V0QWN0aXZlVHJhY2VyKCkgIT09IG51bGwgJiZcbiAgICAgICAgICBwcm94eS5nZXRDdXJyZW50U3BhbigpPy5pc1JlY29yZGluZygpID09PSB0cnVlO1xuXG4gICAgICAgIGlmIChzaG91bGRGb3JrKSB7XG4gICAgICAgICAgY29uc3Qgc2VyaWFsaXplciA9IEJhc2VUcmFjZXIuX2dldFNlcmlhbGl6ZXIoKTtcblxuICAgICAgICAgIC8vIEludm9jYXRpb24gc3BhbiDigJQgY2hpbGQgb2YgY3VycmVudCB0cmFjZVxuICAgICAgICAgIGNvbnN0IGludm9jYXRpb25TcGFuID0gb3RlbFRyYWNlci5zdGFydFNwYW4obmFtZSk7XG4gICAgICAgICAgY29uc3QgaW52b2NhdGlvbkN0eCA9IGludm9jYXRpb25TcGFuLnNwYW5Db250ZXh0KCk7XG4gICAgICAgICAgaWYgKHNwYW5UeXBlKSB7XG4gICAgICAgICAgICBpbnZvY2F0aW9uU3Bhbi5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfU1BBTl9LSU5ELFxuICAgICAgICAgICAgICBzcGFuVHlwZSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTGlua2VkLXJvb3Qgc3BhbiDigJQgcm9vdCBvZiBhIG5ldyB0cmFjZVxuICAgICAgICAgIGNvbnN0IGxpbmtlZFJvb3RBdHRyczogQXR0cmlidXRlcyA9IHtcbiAgICAgICAgICAgIFtBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX0xJTktfU09VUkNFX1RSQUNFX0lEXTpcbiAgICAgICAgICAgICAgaW52b2NhdGlvbkN0eC50cmFjZUlkLFxuICAgICAgICAgICAgW0F0dHJpYnV0ZUtleXMuSlVER01FTlRfTElOS19TT1VSQ0VfU1BBTl9JRF06IGludm9jYXRpb25DdHguc3BhbklkLFxuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKHNwYW5UeXBlKSB7XG4gICAgICAgICAgICBsaW5rZWRSb290QXR0cnNbQXR0cmlidXRlS2V5cy5KVURHTUVOVF9TUEFOX0tJTkRdID0gc3BhblR5cGU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFyZW50bGVzc0N0eCA9IHByb3h5LnNldFNwYW4oXG4gICAgICAgICAgICBwcm94eS5nZXRDdXJyZW50Q29udGV4dCgpLFxuICAgICAgICAgICAgcHJveHkud3JhcFNwYW5Db250ZXh0KElOVkFMSURfU1BBTl9DT05URVhUKSxcbiAgICAgICAgICApO1xuICAgICAgICAgIGNvbnN0IGxpbmtlZFJvb3QgPSBvdGVsVHJhY2VyLnN0YXJ0U3BhbihcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICB7IGF0dHJpYnV0ZXM6IGxpbmtlZFJvb3RBdHRycyB9LFxuICAgICAgICAgICAgcGFyZW50bGVzc0N0eCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGNvbnN0IGxpbmtlZFJvb3RDdHggPSBsaW5rZWRSb290LnNwYW5Db250ZXh0KCk7XG4gICAgICAgICAgaW52b2NhdGlvblNwYW4uc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9MSU5LX1RBUkdFVF9UUkFDRV9JRCxcbiAgICAgICAgICAgIGxpbmtlZFJvb3RDdHgudHJhY2VJZCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGludm9jYXRpb25TcGFuLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfTElOS19UQVJHRVRfU1BBTl9JRCxcbiAgICAgICAgICAgIGxpbmtlZFJvb3RDdHguc3BhbklkLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBjb25zdCBlbmRCb3RoID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgbGlua2VkUm9vdC5lbmQoKTtcbiAgICAgICAgICAgIGludm9jYXRpb25TcGFuLmVuZCgpO1xuICAgICAgICAgIH07XG4gICAgICAgICAgY29uc3QgcmVjb3JkRXJyb3JPbkJvdGggPSAoZTogdW5rbm93bik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBzIG9mIFtsaW5rZWRSb290LCBpbnZvY2F0aW9uU3Bhbl0pIHtcbiAgICAgICAgICAgICAgcy5yZWNvcmRFeGNlcHRpb24oZSBhcyBFcnJvcik7XG4gICAgICAgICAgICAgIHMuc2V0U3RhdHVzKHtcbiAgICAgICAgICAgICAgICBjb2RlOiBTcGFuU3RhdHVzQ29kZS5FUlJPUixcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBTdHJpbmcoZSksXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgY29uc3QgcmVjb3JkT3V0cHV0T25Cb3RoID0gKHZhbHVlOiB1bmtub3duKTogdm9pZCA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZXJpYWxpemVkID0gc2VyaWFsaXplQXR0cmlidXRlKHZhbHVlLCBzZXJpYWxpemVyKTtcbiAgICAgICAgICAgIGxpbmtlZFJvb3Quc2V0QXR0cmlidXRlKEF0dHJpYnV0ZUtleXMuSlVER01FTlRfT1VUUFVULCBzZXJpYWxpemVkKTtcbiAgICAgICAgICAgIGludm9jYXRpb25TcGFuLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9PVVRQVVQsXG4gICAgICAgICAgICAgIHNlcmlhbGl6ZWQsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAocmVjb3JkSW5wdXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZWRJbnB1dCA9IHNlcmlhbGl6ZUF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgZ2V0SW5wdXRzKGlubmVyRnVuYywgYXJncyksXG4gICAgICAgICAgICAgIHNlcmlhbGl6ZXIsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgbGlua2VkUm9vdC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfSU5QVVQsXG4gICAgICAgICAgICAgIHNlcmlhbGl6ZWRJbnB1dCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpbnZvY2F0aW9uU3Bhbi5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfSU5QVVQsXG4gICAgICAgICAgICAgIHNlcmlhbGl6ZWRJbnB1dCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIEJhc2VUcmFjZXIuX2VtaXRQYXJ0aWFsKCk7XG5cbiAgICAgICAgICByZXR1cm4gcHJveHkudXNlU3BhbihsaW5rZWRSb290LCBmYWxzZSwgZmFsc2UsIGZhbHNlLCAoKTogVFJldHVybiA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBpbm5lckZ1bmMuY2FsbCh0aGlzLCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBQcm9taXNlPHVua25vd24+KVxuICAgICAgICAgICAgICAgICAgLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVjb3JkT3V0cHV0KSByZWNvcmRPdXRwdXRPbkJvdGgocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcyBhcyBUUmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZTogdW5rbm93bikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZWNvcmRFcnJvck9uQm90aChlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAuZmluYWxseShlbmRCb3RoKSBhcyBUUmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChyZWNvcmRPdXRwdXQpIHJlY29yZE91dHB1dE9uQm90aChyZXN1bHQpO1xuICAgICAgICAgICAgICBlbmRCb3RoKCk7XG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHJlY29yZEVycm9yT25Cb3RoKGUpO1xuICAgICAgICAgICAgICBlbmRCb3RoKCk7XG4gICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3RlbFRyYWNlci5zdGFydEFjdGl2ZVNwYW4obmFtZSwgKHNwYW4pID0+IHtcbiAgICAgICAgICBpZiAoc3BhblR5cGUpIHtcbiAgICAgICAgICAgIHNwYW4uc2V0QXR0cmlidXRlKEF0dHJpYnV0ZUtleXMuSlVER01FTlRfU1BBTl9LSU5ELCBzcGFuVHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocmVjb3JkSW5wdXQpIHtcbiAgICAgICAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9JTlBVVCxcbiAgICAgICAgICAgICAgICBzZXJpYWxpemVBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICBnZXRJbnB1dHMoaW5uZXJGdW5jLCBhcmdzKSxcbiAgICAgICAgICAgICAgICAgIEJhc2VUcmFjZXIuX2dldFNlcmlhbGl6ZXIoKSxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgQmFzZVRyYWNlci5fZW1pdFBhcnRpYWwoKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGlubmVyRnVuYy5jYWxsKHRoaXMsIC4uLmFyZ3MpO1xuXG4gICAgICAgICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBQcm9taXNlPHVua25vd24+KVxuICAgICAgICAgICAgICAgIC50aGVuKChyZXMpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChyZWNvcmRPdXRwdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9PVVRQVVQsXG4gICAgICAgICAgICAgICAgICAgICAgc2VyaWFsaXplQXR0cmlidXRlKHJlcywgQmFzZVRyYWNlci5fZ2V0U2VyaWFsaXplcigpKSxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJldHVybiByZXMgYXMgVFJldHVybjtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZTogdW5rbm93bikgPT4ge1xuICAgICAgICAgICAgICAgICAgc3Bhbi5yZWNvcmRFeGNlcHRpb24oZSBhcyBFcnJvcik7XG4gICAgICAgICAgICAgICAgICBzcGFuLnNldFN0YXR1cyh7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBTdHJpbmcoZSksXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBzcGFuLmVuZCgpO1xuICAgICAgICAgICAgICAgIH0pIGFzIFRSZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZWNvcmRPdXRwdXQpIHtcbiAgICAgICAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9PVVRQVVQsXG4gICAgICAgICAgICAgICAgc2VyaWFsaXplQXR0cmlidXRlKHJlc3VsdCwgQmFzZVRyYWNlci5fZ2V0U2VyaWFsaXplcigpKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNwYW4uZW5kKCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHNwYW4ucmVjb3JkRXhjZXB0aW9uKGUgYXMgRXJyb3IpO1xuICAgICAgICAgICAgc3Bhbi5zZXRTdGF0dXMoeyBjb2RlOiBTcGFuU3RhdHVzQ29kZS5FUlJPUiwgbWVzc2FnZTogU3RyaW5nKGUpIH0pO1xuICAgICAgICAgICAgc3Bhbi5lbmQoKTtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgfTtcblxuICAgIGlmICghZnVuYykgcmV0dXJuIGRlY29yYXRvcjtcbiAgICByZXR1cm4gZGVjb3JhdG9yKGZ1bmMpO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBJbnRlcm5hbDogcmVzb2x2ZSB0YXJnZXQgc3BhbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICBwcml2YXRlIHN0YXRpYyBfcmVzb2x2ZVNwYW4oc3Bhbj86IFNwYW4pOiBTcGFuIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoc3BhbikgcmV0dXJuIHNwYW47XG4gICAgcmV0dXJuIEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKS5nZXRDdXJyZW50U3BhbigpO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBTdGF0aWM6IFNwYW4gS2luZCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICAvKipcbiAgICogU2V0IHRoZSBraW5kIG9mIGEgc3Bhbi5cbiAgICpcbiAgICogQHBhcmFtIGtpbmQgLSBUaGUgc3BhbiBraW5kIChlLmcuIFwibGxtXCIsIFwidG9vbFwiLCBcInNwYW5cIikuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKi9cbiAgc3RhdGljIHNldFNwYW5LaW5kKGtpbmQ6IHN0cmluZyk6IHZvaWQ7XG4gIHN0YXRpYyBzZXRTcGFuS2luZChraW5kOiBzdHJpbmcsIHNwYW46IFNwYW4pOiB2b2lkO1xuICBzdGF0aWMgc2V0U3BhbktpbmQoa2luZDogc3RyaW5nLCBzcGFuPzogU3Bhbik6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkJhc2VUcmFjZXIuc2V0U3BhbktpbmRcIiwgKCkgPT4ge1xuICAgICAgaWYgKCFraW5kKSByZXR1cm47XG4gICAgICBjb25zdCB0YXJnZXQgPSBCYXNlVHJhY2VyLl9yZXNvbHZlU3BhbihzcGFuKTtcbiAgICAgIGlmICh0YXJnZXQ/LmlzUmVjb3JkaW5nKCkpIHtcbiAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZShBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1NQQU5fS0lORCwga2luZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBjdXJyZW50IHNwYW4ga2luZCB0byBcImxsbVwiLlxuICAgKi9cbiAgc3RhdGljIHNldExMTVNwYW4oKTogdm9pZCB7XG4gICAgQmFzZVRyYWNlci5zZXRTcGFuS2luZChcImxsbVwiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgdGhlIGN1cnJlbnQgc3BhbiBraW5kIHRvIFwidG9vbFwiLlxuICAgKi9cbiAgc3RhdGljIHNldFRvb2xTcGFuKCk6IHZvaWQge1xuICAgIEJhc2VUcmFjZXIuc2V0U3BhbktpbmQoXCJ0b29sXCIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgY3VycmVudCBzcGFuIGtpbmQgdG8gXCJzcGFuXCIuXG4gICAqL1xuICBzdGF0aWMgc2V0R2VuZXJhbFNwYW4oKTogdm9pZCB7XG4gICAgQmFzZVRyYWNlci5zZXRTcGFuS2luZChcInNwYW5cIik7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYzogU3BhbiBBdHRyaWJ1dGUgT3BlcmF0aW9ucyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBTZXQgYSBzaW5nbGUgYXR0cmlidXRlIG9uIGEgc3Bhbi5cbiAgICpcbiAgICogQHBhcmFtIGtleSAtIFRoZSBhdHRyaWJ1dGUga2V5LlxuICAgKiBAcGFyYW0gdmFsdWUgLSBUaGUgYXR0cmlidXRlIHZhbHVlICh3aWxsIGJlIHNlcmlhbGl6ZWQpLlxuICAgKiBAcGFyYW0gc3BhbiAtIFRhcmdldCBzcGFuLiBEZWZhdWx0cyB0byB0aGUgY3VycmVudCBhY3RpdmUgc3Bhbi5cbiAgICovXG4gIHN0YXRpYyBzZXRBdHRyaWJ1dGUoa2V5OiBzdHJpbmcsIHZhbHVlOiB1bmtub3duKTogdm9pZDtcbiAgc3RhdGljIHNldEF0dHJpYnV0ZShrZXk6IHN0cmluZywgdmFsdWU6IHVua25vd24sIHNwYW46IFNwYW4pOiB2b2lkO1xuICBzdGF0aWMgc2V0QXR0cmlidXRlKGtleTogc3RyaW5nLCB2YWx1ZTogdW5rbm93biwgc3Bhbj86IFNwYW4pOiB2b2lkIHtcbiAgICBkb250VGhyb3coXCJCYXNlVHJhY2VyLnNldEF0dHJpYnV0ZVwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBCYXNlVHJhY2VyLl9yZXNvbHZlU3BhbihzcGFuKTtcbiAgICAgIGlmICghdGFyZ2V0Py5pc1JlY29yZGluZygpKSByZXR1cm47XG4gICAgICBpZiAoIWtleSB8fCB2YWx1ZSA9PSBudWxsKSByZXR1cm47XG4gICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKFxuICAgICAgICBrZXksXG4gICAgICAgIHNlcmlhbGl6ZUF0dHJpYnV0ZSh2YWx1ZSwgQmFzZVRyYWNlci5fZ2V0U2VyaWFsaXplcigpKSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IG11bHRpcGxlIGF0dHJpYnV0ZXMgb24gYSBzcGFuLlxuICAgKlxuICAgKiBAcGFyYW0gYXR0cmlidXRlcyAtIEtleS12YWx1ZSBwYWlycyB0byBzZXQuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKi9cbiAgc3RhdGljIHNldEF0dHJpYnV0ZXMoYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiB2b2lkO1xuICBzdGF0aWMgc2V0QXR0cmlidXRlcyhhdHRyaWJ1dGVzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgc3BhbjogU3Bhbik6IHZvaWQ7XG4gIHN0YXRpYyBzZXRBdHRyaWJ1dGVzKGF0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBzcGFuPzogU3Bhbik6IHZvaWQge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJpYnV0ZXMpKSB7XG4gICAgICBpZiAoc3BhbikgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSwgc3Bhbik7XG4gICAgICBlbHNlIEJhc2VUcmFjZXIuc2V0QXR0cmlidXRlKGtleSwgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgdGhlIGlucHV0IGRhdGEgb24gYSBzcGFuLlxuICAgKlxuICAgKiBAcGFyYW0gaW5wdXREYXRhIC0gVGhlIGlucHV0IGRhdGEgdG8gcmVjb3JkLlxuICAgKiBAcGFyYW0gc3BhbiAtIFRhcmdldCBzcGFuLiBEZWZhdWx0cyB0byB0aGUgY3VycmVudCBhY3RpdmUgc3Bhbi5cbiAgICovXG4gIHN0YXRpYyBzZXRJbnB1dChpbnB1dERhdGE6IHVua25vd24pOiB2b2lkO1xuICBzdGF0aWMgc2V0SW5wdXQoaW5wdXREYXRhOiB1bmtub3duLCBzcGFuOiBTcGFuKTogdm9pZDtcbiAgc3RhdGljIHNldElucHV0KGlucHV0RGF0YTogdW5rbm93biwgc3Bhbj86IFNwYW4pOiB2b2lkIHtcbiAgICBpZiAoc3BhbilcbiAgICAgIEJhc2VUcmFjZXIuc2V0QXR0cmlidXRlKEF0dHJpYnV0ZUtleXMuSlVER01FTlRfSU5QVVQsIGlucHV0RGF0YSwgc3Bhbik7XG4gICAgZWxzZSBCYXNlVHJhY2VyLnNldEF0dHJpYnV0ZShBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX0lOUFVULCBpbnB1dERhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgb3V0cHV0IGRhdGEgb24gYSBzcGFuLlxuICAgKlxuICAgKiBAcGFyYW0gb3V0cHV0RGF0YSAtIFRoZSBvdXRwdXQgZGF0YSB0byByZWNvcmQuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKi9cbiAgc3RhdGljIHNldE91dHB1dChvdXRwdXREYXRhOiB1bmtub3duKTogdm9pZDtcbiAgc3RhdGljIHNldE91dHB1dChvdXRwdXREYXRhOiB1bmtub3duLCBzcGFuOiBTcGFuKTogdm9pZDtcbiAgc3RhdGljIHNldE91dHB1dChvdXRwdXREYXRhOiB1bmtub3duLCBzcGFuPzogU3Bhbik6IHZvaWQge1xuICAgIGlmIChzcGFuKVxuICAgICAgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoQXR0cmlidXRlS2V5cy5KVURHTUVOVF9PVVRQVVQsIG91dHB1dERhdGEsIHNwYW4pO1xuICAgIGVsc2UgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoQXR0cmlidXRlS2V5cy5KVURHTUVOVF9PVVRQVVQsIG91dHB1dERhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY29yZCBhbiBlcnJvciBvbiBhIHNwYW4uXG4gICAqXG4gICAqIFNldHMgdGhlIHNwYW4gc3RhdHVzIHRvIEVSUk9SIGFuZCByZWNvcmRzIHRoZSBleGNlcHRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBlcnJvciAtIFRoZSBlcnJvciB0byByZWNvcmQuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKi9cbiAgc3RhdGljIHNldEVycm9yKGVycm9yOiB1bmtub3duKTogdm9pZDtcbiAgc3RhdGljIHNldEVycm9yKGVycm9yOiB1bmtub3duLCBzcGFuOiBTcGFuKTogdm9pZDtcbiAgc3RhdGljIHNldEVycm9yKGVycm9yOiB1bmtub3duLCBzcGFuPzogU3Bhbik6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkJhc2VUcmFjZXIuc2V0RXJyb3JcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gQmFzZVRyYWNlci5fcmVzb2x2ZVNwYW4oc3Bhbik7XG4gICAgICBpZiAoIXRhcmdldD8uaXNSZWNvcmRpbmcoKSkgcmV0dXJuO1xuICAgICAgdGFyZ2V0LnJlY29yZEV4Y2VwdGlvbihlcnJvciBhcyBFcnJvcik7XG4gICAgICB0YXJnZXQuc2V0U3RhdHVzKHsgY29kZTogU3BhblN0YXR1c0NvZGUuRVJST1IsIG1lc3NhZ2U6IFN0cmluZyhlcnJvcikgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVjb3JkIExMTSB1c2FnZSBtZXRhZGF0YSBvbiBhIHNwYW4uXG4gICAqXG4gICAqIEBwYXJhbSBtZXRhZGF0YSAtIExMTSBtZXRhZGF0YSBpbmNsdWRpbmcgbW9kZWwsIHByb3ZpZGVyLCBhbmQgdG9rZW4gY291bnRzLlxuICAgKiBAcGFyYW0gc3BhbiAtIFRhcmdldCBzcGFuLiBEZWZhdWx0cyB0byB0aGUgY3VycmVudCBhY3RpdmUgc3Bhbi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBUcmFjZXIucmVjb3JkTExNTWV0YWRhdGEoe1xuICAgKiAgIG1vZGVsOiBcImdwdC00b1wiLFxuICAgKiAgIHByb3ZpZGVyOiBcIm9wZW5haVwiLFxuICAgKiAgIG91dHB1dF90b2tlbnM6IDE1MCxcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIHJlY29yZExMTU1ldGFkYXRhKG1ldGFkYXRhOiBMTE1NZXRhZGF0YSk6IHZvaWQ7XG4gIHN0YXRpYyByZWNvcmRMTE1NZXRhZGF0YShtZXRhZGF0YTogTExNTWV0YWRhdGEsIHNwYW46IFNwYW4pOiB2b2lkO1xuICBzdGF0aWMgcmVjb3JkTExNTWV0YWRhdGEobWV0YWRhdGE6IExMTU1ldGFkYXRhLCBzcGFuPzogU3Bhbik6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkJhc2VUcmFjZXIucmVjb3JkTExNTWV0YWRhdGFcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gQmFzZVRyYWNlci5fcmVzb2x2ZVNwYW4oc3Bhbik7XG4gICAgICBpZiAoIXRhcmdldD8uaXNSZWNvcmRpbmcoKSkgcmV0dXJuO1xuXG4gICAgICBpZiAodHlwZW9mIG1ldGFkYXRhLm1vZGVsID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9MTE1fTU9ERUxfTkFNRSxcbiAgICAgICAgICBtZXRhZGF0YS5tb2RlbCxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBtZXRhZGF0YS5wcm92aWRlciA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKFxuICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfTExNX1BST1ZJREVSLFxuICAgICAgICAgIG1ldGFkYXRhLnByb3ZpZGVyLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIG1ldGFkYXRhLm5vbl9jYWNoZWRfaW5wdXRfdG9rZW5zID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9VU0FHRV9OT05fQ0FDSEVEX0lOUFVUX1RPS0VOUyxcbiAgICAgICAgICBtZXRhZGF0YS5ub25fY2FjaGVkX2lucHV0X3Rva2VucyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgbWV0YWRhdGEub3V0cHV0X3Rva2VucyA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKFxuICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVNBR0VfT1VUUFVUX1RPS0VOUyxcbiAgICAgICAgICBtZXRhZGF0YS5vdXRwdXRfdG9rZW5zLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBtZXRhZGF0YS5jYWNoZV9yZWFkX2lucHV0X3Rva2VucyA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKFxuICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVNBR0VfQ0FDSEVfUkVBRF9JTlBVVF9UT0tFTlMsXG4gICAgICAgICAgbWV0YWRhdGEuY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG1ldGFkYXRhLmNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKFxuICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVNBR0VfQ0FDSEVfQ1JFQVRJT05fSU5QVVRfVE9LRU5TLFxuICAgICAgICAgIG1ldGFkYXRhLmNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgbWV0YWRhdGEudG90YWxfY29zdF91c2QgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZShcbiAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1VTQUdFX1RPVEFMX0NPU1RfVVNELFxuICAgICAgICAgIG1ldGFkYXRhLnRvdGFsX2Nvc3RfdXNkLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBTdGF0aWM6IENvbnRleHQgUHJvcGFnYXRpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICAvKipcbiAgICogU2V0IGEga2V5IG9uIHRoZSBjdXJyZW50IHNwYW4gYW5kIG9uIGJhZ2dhZ2Ugc28gaXQgcHJvcGFnYXRlcyB0byBhbGxcbiAgICogY2hpbGQgc3BhbnMuIEFsc28gcmVhdHRhY2hlcyB0aGUgY3VycmVudCBjb250ZXh0IHRvIHRoZSB1cGRhdGVkIG9uZS5cbiAgICovXG4gIHByaXZhdGUgc3RhdGljIF9zZXRQcm9wYWdhdGluZ0JhZ2dhZ2VLZXkoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBkb250VGhyb3coXCJCYXNlVHJhY2VyLl9zZXRQcm9wYWdhdGluZ0JhZ2dhZ2VLZXlcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgICBjb25zdCBjdXJyZW50U3BhbiA9IHByb3h5LmdldEN1cnJlbnRTcGFuKCk7XG4gICAgICBpZiAoIWN1cnJlbnRTcGFuPy5pc1JlY29yZGluZygpKSByZXR1cm47XG4gICAgICBjdXJyZW50U3Bhbi5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSk7XG4gICAgICBjb25zdCBjdHggPSBwcm94eS5nZXRDdXJyZW50Q29udGV4dCgpO1xuICAgICAgY29uc3QgYmFnZ2FnZSA9IChnZXRCYWdnYWdlKGN0eCkgPz8gY3JlYXRlQmFnZ2FnZSgpKS5zZXRFbnRyeShrZXksIHtcbiAgICAgICAgdmFsdWUsXG4gICAgICB9KTtcbiAgICAgIHByb3h5LmF0dGFjaENvbnRleHQoc2V0QmFnZ2FnZShjdHgsIGJhZ2dhZ2UpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgdGhlIGN1c3RvbWVyIElEIG9uIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKlxuICAgKiBUaGUgSUQgaXMgYXV0b21hdGljYWxseSBwcm9wYWdhdGVkIHRvIGFsbCBjaGlsZCBzcGFucyB2aWEgYmFnZ2FnZS5cbiAgICogVGhpcyBtZXRob2QgYWx3YXlzIHRhcmdldHMgdGhlIGFjdGl2ZSBzcGFuIGJlY2F1c2UgaXQgbW9kaWZpZXNcbiAgICogdGhlIGFjdGl2ZSBjb250ZXh0J3MgYmFnZ2FnZSBmb3IgcHJvcGFnYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBjdXN0b21lcklkIC0gVGhlIGN1c3RvbWVyIGlkZW50aWZpZXIuXG4gICAqL1xuICBzdGF0aWMgc2V0Q3VzdG9tZXJJZChjdXN0b21lcklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBCYXNlVHJhY2VyLl9zZXRQcm9wYWdhdGluZ0JhZ2dhZ2VLZXkoXG4gICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX0NVU1RPTUVSX0lELFxuICAgICAgY3VzdG9tZXJJZCxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgY3VzdG9tZXIgdXNlciBJRCBvbiB0aGUgY3VycmVudCBhY3RpdmUgc3Bhbi5cbiAgICpcbiAgICogVGhlIElEIGlzIGF1dG9tYXRpY2FsbHkgcHJvcGFnYXRlZCB0byBhbGwgY2hpbGQgc3BhbnMgdmlhIGJhZ2dhZ2UuXG4gICAqIFRoaXMgbWV0aG9kIGFsd2F5cyB0YXJnZXRzIHRoZSBhY3RpdmUgc3BhbiBiZWNhdXNlIGl0IG1vZGlmaWVzXG4gICAqIHRoZSBhY3RpdmUgY29udGV4dCdzIGJhZ2dhZ2UgZm9yIHByb3BhZ2F0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gY3VzdG9tZXJVc2VySWQgLSBUaGUgY3VzdG9tZXIgdXNlciBpZGVudGlmaWVyLlxuICAgKi9cbiAgc3RhdGljIHNldEN1c3RvbWVyVXNlcklkKGN1c3RvbWVyVXNlcklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBCYXNlVHJhY2VyLl9zZXRQcm9wYWdhdGluZ0JhZ2dhZ2VLZXkoXG4gICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX0NVU1RPTUVSX1VTRVJfSUQsXG4gICAgICBjdXN0b21lclVzZXJJZCxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgc2Vzc2lvbiBJRCBvbiB0aGUgY3VycmVudCBhY3RpdmUgc3Bhbi5cbiAgICpcbiAgICogVGhlIElEIGlzIGF1dG9tYXRpY2FsbHkgcHJvcGFnYXRlZCB0byBhbGwgY2hpbGQgc3BhbnMgdmlhIGJhZ2dhZ2UuXG4gICAqIFRoaXMgbWV0aG9kIGFsd2F5cyB0YXJnZXRzIHRoZSBhY3RpdmUgc3BhbiBiZWNhdXNlIGl0IG1vZGlmaWVzXG4gICAqIHRoZSBhY3RpdmUgY29udGV4dCdzIGJhZ2dhZ2UgZm9yIHByb3BhZ2F0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gc2Vzc2lvbklkIC0gVGhlIHNlc3Npb24gaWRlbnRpZmllci5cbiAgICovXG4gIHN0YXRpYyBzZXRTZXNzaW9uSWQoc2Vzc2lvbklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBCYXNlVHJhY2VyLl9zZXRQcm9wYWdhdGluZ0JhZ2dhZ2VLZXkoXG4gICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1NFU1NJT05fSUQsXG4gICAgICBzZXNzaW9uSWQsXG4gICAgKTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuICAvLyAgU3RhdGljOiBUYWdzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG5cbiAgLyoqXG4gICAqIEFkZCB0YWdzIHRvIHRoZSBjdXJyZW50IHRyYWNlLlxuICAgKlxuICAgKiBAcGFyYW0gdGFncyAtIEEgc2luZ2xlIHRhZyBzdHJpbmcgb3IgYW4gYXJyYXkgb2YgdGFnIHN0cmluZ3MuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogVHJhY2VyLnRhZyhcInByb2R1Y3Rpb25cIik7XG4gICAqIFRyYWNlci50YWcoW1wiaW1wb3J0YW50XCIsIFwiY3VzdG9tZXItZmFjaW5nXCJdKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgdGFnKHRhZ3M6IHN0cmluZyB8IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiQmFzZVRyYWNlci50YWdcIiwgKCkgPT4ge1xuICAgICAgaWYgKCF0YWdzIHx8IChBcnJheS5pc0FycmF5KHRhZ3MpICYmIHRhZ3MubGVuZ3RoID09PSAwKSkgcmV0dXJuO1xuICAgICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgICBjb25zdCB0cmFjZXIgPSBwcm94eS5nZXRBY3RpdmVUcmFjZXIoKTtcbiAgICAgIGlmICghdHJhY2VyPy5wcm9qZWN0SWQgfHwgIXRyYWNlci5fY2xpZW50KSByZXR1cm47XG4gICAgICBpZiAoIXRyYWNlci5zdXBwb3J0c0xpdmVJbnN0cnVtZW50YXRpb24pIHJldHVybjtcbiAgICAgIGNvbnN0IGlkcyA9IEJhc2VUcmFjZXIuX2dldEN1cnJlbnRUcmFjZUFuZFNwYW5JZCgpO1xuICAgICAgaWYgKCFpZHMpIHJldHVybjtcbiAgICAgIGNvbnN0IFt0cmFjZUlkXSA9IGlkcztcbiAgICAgIGNvbnN0IHRhZ0FycmF5ID0gQXJyYXkuaXNBcnJheSh0YWdzKSA/IHRhZ3MgOiBbdGFnc107XG4gICAgICB0cmFjZXIuX2NsaWVudFxuICAgICAgICAucG9zdFYxcHJvamVjdHNUcmFjZXNCeVRyYWNlSWRUYWdzKHRyYWNlci5wcm9qZWN0SWQsIHRyYWNlSWQsIHtcbiAgICAgICAgICB0YWdzOiB0YWdBcnJheSxcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKChlcnI6IHVua25vd24pID0+IHtcbiAgICAgICAgICBMb2dnZXIuZXJyb3IoYHRhZyBmYWlsZWQ6ICR7U3RyaW5nKGVycil9YCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBTdGF0aWMgQVBJOiBBc3luYyBFdmFsdWF0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICAvKipcbiAgICogVHJpZ2dlciBhbiBhc3luY2hyb25vdXMgc2VydmVyLXNpZGUgZXZhbHVhdGlvbiBvbiBhIHNwYW4uXG4gICAqXG4gICAqIFRoZSBldmFsdWF0aW9uIGlzIHF1ZXVlZCBhbmQgcHJvY2Vzc2VkIHNlcnZlci1zaWRlIGJ5IHRoZSBKdWRnbWVudFxuICAgKiBwbGF0Zm9ybSBhZnRlciB0aGUgc3BhbiBlbmRzLiBVc2UgdGhpcyB0byBzY29yZSBsaXZlIHRyYWZmaWNcbiAgICogd2l0aG91dCBibG9ja2luZyB5b3VyIGFwcGxpY2F0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIEV2YWx1YXRpb24gb3B0aW9ucy4gYGp1ZGdlYCBpcyByZXF1aXJlZDsgYGV4YW1wbGVgXG4gICAqICAgaXMgb3B0aW9uYWwgZXZhbHVhdGlvbiBkYXRhLlxuICAgKiBAcGFyYW0gc3BhbiAtIFRhcmdldCBzcGFuLiBEZWZhdWx0cyB0byB0aGUgY3VycmVudCBhY3RpdmUgc3Bhbi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBUcmFjZXIuYXN5bmNFdmFsdWF0ZSh7XG4gICAqICAganVkZ2U6IFwiYW5zd2VyX3JlbGV2YW5jeVwiLFxuICAgKiAgIGV4YW1wbGU6IHtcbiAgICogICAgIGlucHV0OiBcIldoYXQgaXMgQUk/XCIsXG4gICAqICAgICBhY3R1YWxfb3V0cHV0OiByZXNwb25zZSxcbiAgICogICB9LFxuICAgKiB9KTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgYXN5bmNFdmFsdWF0ZShvcHRpb25zOiBBc3luY0V2YWx1YXRlT3B0aW9ucyk6IHZvaWQ7XG4gIHN0YXRpYyBhc3luY0V2YWx1YXRlKG9wdGlvbnM6IEFzeW5jRXZhbHVhdGVPcHRpb25zLCBzcGFuOiBTcGFuKTogdm9pZDtcbiAgc3RhdGljIGFzeW5jRXZhbHVhdGUob3B0aW9uczogQXN5bmNFdmFsdWF0ZU9wdGlvbnMsIHNwYW4/OiBTcGFuKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiQmFzZVRyYWNlci5hc3luY0V2YWx1YXRlXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHsganVkZ2UsIGV4YW1wbGUgfSA9IG9wdGlvbnM7XG4gICAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICAgIGNvbnN0IHRyYWNlciA9IHByb3h5LmdldEFjdGl2ZVRyYWNlcigpO1xuICAgICAgaWYgKCF0cmFjZXI/LnByb2plY3RJZCkgcmV0dXJuO1xuICAgICAgaWYgKCF0cmFjZXIuc3VwcG9ydHNMaXZlSW5zdHJ1bWVudGF0aW9uKSByZXR1cm47XG4gICAgICBjb25zdCB0YXJnZXQgPSBCYXNlVHJhY2VyLl9yZXNvbHZlU3BhbihzcGFuKTtcbiAgICAgIGlmICghdGFyZ2V0Py5pc1JlY29yZGluZygpKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NvciA9IHRyYWNlci5nZXRTcGFuUHJvY2Vzc29yKCk7XG4gICAgICBjb25zdCBjdHggPSB0YXJnZXQuc3BhbkNvbnRleHQoKTtcblxuICAgICAgY29uc3QgaWR4ID0gcHJvY2Vzc29yLnN0YXRlSW5jcihcbiAgICAgICAgY3R4LFxuICAgICAgICBJbnRlcm5hbEF0dHJpYnV0ZUtleXMuUEVORElOR19FVkFMU19DT1VOVCxcbiAgICAgICk7XG4gICAgICBjb25zdCBwYXlsb2FkOiBQZW5kaW5nRXZhbFBheWxvYWQgPSB7XG4gICAgICAgIHByb2plY3RfaWQ6IHRyYWNlci5wcm9qZWN0SWQsXG4gICAgICAgIGV2YWxfbmFtZTogYGFzeW5jX2V2YWx1YXRlXyR7anVkZ2V9XyR7aWR4fWAsXG4gICAgICAgIGp1ZGdlczogW3sgbmFtZToganVkZ2UgfV0sXG4gICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgLi4uZXhhbXBsZSxcbiAgICAgICAgICAgIGV4YW1wbGVfaWQ6IGNyZWF0ZVJhbmRvbVVVSUQoKSxcbiAgICAgICAgICAgIGNyZWF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHRyYWNlX2lkOiBjdHgudHJhY2VJZCxcbiAgICAgICAgICAgIHNwYW5faWQ6IGN0eC5zcGFuSWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgaXNfb2ZmbGluZTogZmFsc2UsXG4gICAgICAgIGlzX2JlaGF2aW9yOiBmYWxzZSxcbiAgICAgIH07XG4gICAgICBjb25zdCB1cGRhdGVkID0gcHJvY2Vzc29yLnN0YXRlQXBwZW5kPFBlbmRpbmdFdmFsUGF5bG9hZD4oXG4gICAgICAgIGN0eCxcbiAgICAgICAgSW50ZXJuYWxBdHRyaWJ1dGVLZXlzLlBFTkRJTkdfRVZBTFMsXG4gICAgICAgIHBheWxvYWQsXG4gICAgICApO1xuXG4gICAgICAvLyBSYXcgc2V0QXR0cmlidXRlIOKAlCB2YWx1ZSBpcyBhbHJlYWR5IEpTT04tc3RyaW5naWZpZWQsIEJhc2VUcmFjZXIuc2V0QXR0cmlidXRlIHdvdWxkIGRvdWJsZS1zZXJpYWxpemUuXG4gICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKFxuICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1BFTkRJTkdfVFJBQ0VfRVZBTCxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkodXBkYXRlZCksXG4gICAgICApO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldElucHV0czxUQXJncyBleHRlbmRzIHVua25vd25bXT4oXG4gIGY6ICguLi5hcmdzOiBUQXJncykgPT4gdW5rbm93bixcbiAgYXJnczogVEFyZ3MsXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgcGFyYW1OYW1lcyA9IHBhcnNlRnVuY3Rpb25BcmdzKGYpXG4gICAgICAubWFwKChwYXJhbSkgPT5cbiAgICAgICAgcGFyYW1cbiAgICAgICAgICAucmVwbGFjZSgvXlxcLlxcLlxcLi8sIFwiXCIpXG4gICAgICAgICAgLnNwbGl0KFwiPVwiKVswXVxuICAgICAgICAgIC50cmltKCksXG4gICAgICApXG4gICAgICAuZmlsdGVyKChwYXJhbSkgPT4gcGFyYW0ubGVuZ3RoID4gMCk7XG4gICAgY29uc3QgaW5wdXRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICAgIHBhcmFtTmFtZXMuZm9yRWFjaCgobmFtZSwgaW5kZXgpID0+IHtcbiAgICAgIGlmIChpbmRleCA8IGFyZ3MubGVuZ3RoKSB7XG4gICAgICAgIGlucHV0c1tuYW1lXSA9IGFyZ3NbaW5kZXhdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBpbnB1dHM7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB7fTtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IEV4cG9ydFJlc3VsdCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9jb3JlXCI7XG5pbXBvcnQgeyBPVExQVHJhY2VFeHBvcnRlciB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9leHBvcnRlci10cmFjZS1vdGxwLWh0dHBcIjtcbmltcG9ydCB0eXBlIHsgUmVhZGFibGVTcGFuLCBTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuLi8uLi91dGlscy9sb2dnZXJcIjtcblxuLyoqXG4gKiBTcGFuIGV4cG9ydGVyIHRoYXQgc2VuZHMgdHJhY2VzIHRvIHRoZSBKdWRnbWVudCBwbGF0Zm9ybSB2aWEgT1RMUCBIVFRQLlxuICpcbiAqIFdyYXBzIHRoZSBPcGVuVGVsZW1ldHJ5IE9UTFAgdHJhY2UgZXhwb3J0ZXIgd2l0aCBKdWRnbWVudC1zcGVjaWZpY1xuICogYXV0aGVudGljYXRpb24gaGVhZGVycy5cbiAqL1xuZXhwb3J0IGNsYXNzIEp1ZGdtZW50U3BhbkV4cG9ydGVyIGltcGxlbWVudHMgU3BhbkV4cG9ydGVyIHtcbiAgcHJvdGVjdGVkIF9kZWxlZ2F0ZTogT1RMUFRyYWNlRXhwb3J0ZXIgfCBudWxsO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgSnVkZ21lbnRTcGFuRXhwb3J0ZXIuXG4gICAqXG4gICAqIEBwYXJhbSBlbmRwb2ludCAtIFRoZSBPVExQIEhUVFAgZW5kcG9pbnQgVVJMLlxuICAgKiBAcGFyYW0gYXBpS2V5IC0gSnVkZ21lbnQgQVBJIGtleSBmb3IgYXV0aGVudGljYXRpb24uXG4gICAqIEBwYXJhbSBvcmdhbml6YXRpb25JZCAtIEp1ZGdtZW50IG9yZ2FuaXphdGlvbiBJRC5cbiAgICogQHBhcmFtIHByb2plY3RJZCAtIEp1ZGdtZW50IHByb2plY3QgSUQuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbmRwb2ludDogc3RyaW5nLFxuICAgIGFwaUtleTogc3RyaW5nLFxuICAgIG9yZ2FuaXphdGlvbklkOiBzdHJpbmcsXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICkge1xuICAgIGlmICghZW5kcG9pbnQpIHtcbiAgICAgIHRoaXMuX2RlbGVnYXRlID0gbnVsbDtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fZGVsZWdhdGUgPSBuZXcgT1RMUFRyYWNlRXhwb3J0ZXIoe1xuICAgICAgdXJsOiBlbmRwb2ludCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgICBcIlgtT3JnYW5pemF0aW9uLUlkXCI6IG9yZ2FuaXphdGlvbklkLFxuICAgICAgICBcIlgtUHJvamVjdC1JZFwiOiBwcm9qZWN0SWQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4cG9ydCBhIGJhdGNoIG9mIHNwYW5zLlxuICAgKlxuICAgKiBAcGFyYW0gc3BhbnMgLSBUaGUgc3BhbnMgdG8gZXhwb3J0LlxuICAgKiBAcGFyYW0gcmVzdWx0Q2FsbGJhY2sgLSBDYWxsYmFjayBpbnZva2VkIHdpdGggdGhlIGV4cG9ydCByZXN1bHQuXG4gICAqL1xuICBleHBvcnQoXG4gICAgc3BhbnM6IFJlYWRhYmxlU3BhbltdLFxuICAgIHJlc3VsdENhbGxiYWNrOiAocmVzdWx0OiBFeHBvcnRSZXN1bHQpID0+IHZvaWQsXG4gICk6IHZvaWQge1xuICAgIExvZ2dlci5pbmZvKGBFeHBvcnRlZCAke3NwYW5zLmxlbmd0aH0gc3BhbnNgKTtcbiAgICB0aGlzLl9kZWxlZ2F0ZT8uZXhwb3J0KHNwYW5zLCByZXN1bHRDYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogU2h1dCBkb3duIHRoZSBleHBvcnRlci5cbiAgICovXG4gIHNodXRkb3duKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZT8uc2h1dGRvd24oKSA/PyBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGbHVzaCBhbnkgcGVuZGluZyBleHBvcnRzLlxuICAgKi9cbiAgZm9yY2VGbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5fZGVsZWdhdGU/LmZvcmNlRmx1c2goKSA/PyBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBFeHBvcnRSZXN1bHRDb2RlLCB0eXBlIEV4cG9ydFJlc3VsdCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9jb3JlXCI7XG5pbXBvcnQgdHlwZSB7IFJlYWRhYmxlU3BhbiB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9zZGstdHJhY2UtYmFzZVwiO1xuaW1wb3J0IHsgSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi9KdWRnbWVudFNwYW5FeHBvcnRlclwiO1xuXG4vKipcbiAqIEEgbm8tb3Agc3BhbiBleHBvcnRlciB0aGF0IGRpc2NhcmRzIGFsbCBzcGFucy5cbiAqXG4gKiBVc2VkIHdoZW4gbW9uaXRvcmluZyBpcyBkaXNhYmxlZCBvciBjcmVkZW50aWFscyBhcmUgbWlzc2luZy5cbiAqL1xuZXhwb3J0IGNsYXNzIE5vT3BTcGFuRXhwb3J0ZXIgZXh0ZW5kcyBKdWRnbWVudFNwYW5FeHBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIpO1xuICB9XG5cbiAgb3ZlcnJpZGUgZXhwb3J0KFxuICAgIF9zcGFuczogUmVhZGFibGVTcGFuW10sXG4gICAgcmVzdWx0Q2FsbGJhY2s6IChyZXN1bHQ6IEV4cG9ydFJlc3VsdCkgPT4gdm9pZCxcbiAgKTogdm9pZCB7XG4gICAgcmVzdWx0Q2FsbGJhY2soeyBjb2RlOiBFeHBvcnRSZXN1bHRDb2RlLlNVQ0NFU1MgfSk7XG4gIH1cblxuICBvdmVycmlkZSBzaHV0ZG93bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBvdmVycmlkZSBmb3JjZUZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IENvbnRleHQgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvYXBpXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFJlYWRhYmxlU3BhbixcbiAgU3BhbixcbiAgU3BhblByb2Nlc3Nvcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Nkay10cmFjZS1iYXNlXCI7XG5pbXBvcnQgeyBnZXRCYWdnYWdlIH0gZnJvbSBcIi4uL2JhZ2dhZ2VcIjtcblxuLyoqXG4gKiBQcmVkaWNhdGUgdGhhdCBkZWNpZGVzIHdoaWNoIGJhZ2dhZ2Uga2V5cyBhcmUgcHJvcGFnYXRlZCB0byBzcGFuXG4gKiBhdHRyaWJ1dGVzLlxuICovXG5leHBvcnQgdHlwZSBCYWdnYWdlS2V5UHJlZGljYXRlID0gKGJhZ2dhZ2VLZXk6IHN0cmluZykgPT4gYm9vbGVhbjtcblxuLyoqIERlZmF1bHQgcHJlZGljYXRlIHRoYXQgYWxsb3dzIGV2ZXJ5IGJhZ2dhZ2Uga2V5LiAqL1xuZXhwb3J0IGNvbnN0IEFMTE9XX0FMTF9CQUdHQUdFX0tFWVM6IEJhZ2dhZ2VLZXlQcmVkaWNhdGUgPSAoKSA9PiB0cnVlO1xuXG4vKipcbiAqIFNwYW4gcHJvY2Vzc29yIHRoYXQgY29waWVzIGJhZ2dhZ2UgZW50cmllcyBvbnRvIHNwYW4gYXR0cmlidXRlcyBhdFxuICogc3BhbiBzdGFydC4gVXNlIGBrZXlQcmVkaWNhdGVgIHRvIGNvbnRyb2wgd2hpY2gga2V5cyBhcmUgcHJvcGFnYXRlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgcHJvY2Vzc29yID0gbmV3IEp1ZGdtZW50QmFnZ2FnZVNwYW5Qcm9jZXNzb3IoXG4gKiAgIChrZXkpID0+IGtleS5zdGFydHNXaXRoKFwianVkZ21lbnQuXCIpLFxuICogKTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgSnVkZ21lbnRCYWdnYWdlU3BhblByb2Nlc3NvciBpbXBsZW1lbnRzIFNwYW5Qcm9jZXNzb3Ige1xuICBwcml2YXRlIF9rZXlQcmVkaWNhdGU6IEJhZ2dhZ2VLZXlQcmVkaWNhdGU7XG5cbiAgY29uc3RydWN0b3Ioa2V5UHJlZGljYXRlOiBCYWdnYWdlS2V5UHJlZGljYXRlID0gQUxMT1dfQUxMX0JBR0dBR0VfS0VZUykge1xuICAgIHRoaXMuX2tleVByZWRpY2F0ZSA9IGtleVByZWRpY2F0ZTtcbiAgfVxuXG4gIC8qKiBDb3B5IG1hdGNoaW5nIGJhZ2dhZ2UgZW50cmllcyBmcm9tIHRoZSBwYXJlbnQgY29udGV4dCBvbnRvIHRoZSBzcGFuLiAqL1xuICBvblN0YXJ0KHNwYW46IFNwYW4sIHBhcmVudENvbnRleHQ6IENvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyaWVzID0gZ2V0QmFnZ2FnZShwYXJlbnRDb250ZXh0KT8uZ2V0QWxsRW50cmllcygpID8/IFtdO1xuICAgIGZvciAoY29uc3QgW2tleSwgZW50cnldIG9mIGVudHJpZXMpIHtcbiAgICAgIGlmICh0aGlzLl9rZXlQcmVkaWNhdGUoa2V5KSkge1xuICAgICAgICBzcGFuLnNldEF0dHJpYnV0ZShrZXksIGVudHJ5LnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKiogTm8tb3AuICovXG4gIG9uRW5kKF9zcGFuOiBSZWFkYWJsZVNwYW4pOiB2b2lkIHtcbiAgICAvKiBuby1vcCAqL1xuICB9XG5cbiAgLyoqIE5vLW9wLiAqL1xuICBmb3JjZUZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIC8qKiBOby1vcC4gKi9cbiAgc2h1dGRvd24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHtcbiAgQXR0cmlidXRlcyxcbiAgQ29udGV4dCxcbiAgSHJUaW1lLFxuICBTcGFuQ29udGV4dCxcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHtcbiAgQmF0Y2hTcGFuUHJvY2Vzc29yLFxuICB0eXBlIFJlYWRhYmxlU3BhbixcbiAgdHlwZSBTcGFuLFxuICB0eXBlIFNwYW5FeHBvcnRlcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Nkay10cmFjZS1iYXNlXCI7XG5pbXBvcnQge1xuICBBdHRyaWJ1dGVLZXlzLFxuICBJbnRlcm5hbEF0dHJpYnV0ZUtleXMsXG59IGZyb20gXCIuLi8uLi9KdWRnbWVudEF0dHJpYnV0ZUtleXNcIjtcbmltcG9ydCB7IGRvbnRUaHJvdyB9IGZyb20gXCIuLi8uLi91dGlscy9kb250LXRocm93XCI7XG5pbXBvcnQgdHlwZSB7IEJhc2VUcmFjZXIgfSBmcm9tIFwiLi4vQmFzZVRyYWNlclwiO1xuaW1wb3J0IHsgZ2V0VHJhY2VSdW50aW1lIH0gZnJvbSBcIi4uL3J1bnRpbWVcIjtcbmltcG9ydCB7IEp1ZGdtZW50QmFnZ2FnZVNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi9KdWRnbWVudEJhZ2dhZ2VTcGFuUHJvY2Vzc29yXCI7XG5cbnR5cGUgU3BhbktleSA9IGAke3N0cmluZ306JHtzdHJpbmd9YDtcblxuZnVuY3Rpb24gbWFrZVNwYW5LZXkoY3R4OiBTcGFuQ29udGV4dCk6IFNwYW5LZXkge1xuICByZXR1cm4gYCR7Y3R4LnRyYWNlSWR9OiR7Y3R4LnNwYW5JZH1gO1xufVxuXG5mdW5jdGlvbiBpc1plcm9IclRpbWUoaHJUaW1lOiBIclRpbWUpOiBib29sZWFuIHtcbiAgcmV0dXJuIGhyVGltZVswXSA9PT0gMCAmJiBoclRpbWVbMV0gPT09IDA7XG59XG5cbi8qKlxuICogU3BhbiBwcm9jZXNzb3IgdGhhdCBtYW5hZ2VzIHNwYW4gbGlmZWN5Y2xlLCBzdGF0ZSwgYW5kIGJhdGNoZWQgZXhwb3J0XG4gKiB0byB0aGUgSnVkZ21lbnQgcGxhdGZvcm0uIFN1cHBvcnRzIHBlci1zcGFuIHN0YXRlIChjb3VudGVycywgbGlzdHMpLFxuICogcGFydGlhbC1zcGFuIGVtaXNzaW9uIGZvciBzdHJlYW1pbmcgdXBkYXRlcywgYW5kIGJhZ2dhZ2UgcHJvcGFnYXRpb25cbiAqIG9udG8gY2hpbGQgc3BhbnMuXG4gKlxuICogQ3JlYXRlZCBhdXRvbWF0aWNhbGx5IGJ5IGBUcmFjZXIuaW5pdCgpYC4gVXNlIGl0IGRpcmVjdGx5IG9ubHkgd2hlblxuICogYnVpbGRpbmcgYSBjdXN0b20gdHJhY2luZyBwaXBlbGluZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEp1ZGdtZW50U3BhblByb2Nlc3NvciBleHRlbmRzIEJhdGNoU3BhblByb2Nlc3NvciB7XG4gIHRyYWNlcjogQmFzZVRyYWNlciB8IG51bGw7XG4gIHByaXZhdGUgX3N0YXRlID0gbmV3IE1hcDxTcGFuS2V5LCBNYXA8c3RyaW5nLCB1bmtub3duPj4oKTtcbiAgcHJpdmF0ZSBfc3BhbkZpbmFsaXplcnM6IEZpbmFsaXphdGlvblJlZ2lzdHJ5PFNwYW5LZXk+O1xuICBwcml2YXRlIF9iYWdnYWdlUHJvY2Vzc29yOiBKdWRnbWVudEJhZ2dhZ2VTcGFuUHJvY2Vzc29yO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHRyYWNlcjogQmFzZVRyYWNlciB8IG51bGwsXG4gICAgZXhwb3J0ZXI6IFNwYW5FeHBvcnRlcixcbiAgICBjb25maWc/OiB7XG4gICAgICBtYXhRdWV1ZVNpemU/OiBudW1iZXI7XG4gICAgICBzY2hlZHVsZWREZWxheU1pbGxpcz86IG51bWJlcjtcbiAgICAgIG1heEV4cG9ydEJhdGNoU2l6ZT86IG51bWJlcjtcbiAgICAgIGV4cG9ydFRpbWVvdXRNaWxsaXM/OiBudW1iZXI7XG4gICAgfSxcbiAgKSB7XG4gICAgc3VwZXIoZXhwb3J0ZXIsIGNvbmZpZyk7XG4gICAgdGhpcy50cmFjZXIgPSB0cmFjZXI7XG4gICAgdGhpcy5fc3BhbkZpbmFsaXplcnMgPSBuZXcgRmluYWxpemF0aW9uUmVnaXN0cnk8U3BhbktleT4oKHNwYW5LZXkpID0+IHtcbiAgICAgIHRoaXMuX2NsZWFudXBTcGFuU3RhdGUoc3BhbktleSk7XG4gICAgfSk7XG4gICAgdGhpcy5fYmFnZ2FnZVByb2Nlc3NvciA9IG5ldyBKdWRnbWVudEJhZ2dhZ2VTcGFuUHJvY2Vzc29yKCk7XG4gIH1cblxuICBwcml2YXRlIF9jbGVhbnVwU3BhblN0YXRlKHNwYW5LZXk6IFNwYW5LZXkpOiB2b2lkIHtcbiAgICB0aGlzLl9zdGF0ZS5kZWxldGUoc3BhbktleSk7XG4gIH1cblxuICBwcml2YXRlIF9yZWdpc3RlclNwYW4oc3BhbjogU3Bhbik6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IHNwYW4uc3BhbkNvbnRleHQoKTtcbiAgICBpZiAoIWN0eC50cmFjZUlkIHx8ICFjdHguc3BhbklkKSByZXR1cm47XG4gICAgY29uc3Qgc3BhbktleSA9IG1ha2VTcGFuS2V5KGN0eCk7XG4gICAgLy8gUmVnaXN0ZXJzIHRoZSBsaXZlIFNwYW4gb2JqZWN0IHdpdGggdGhlIEdDOyBpZiBpdCBpcyBldmVyXG4gICAgLy8gY29sbGVjdGVkIHdpdGhvdXQgZ29pbmcgdGhyb3VnaCBgb25FbmRgLCBjbGVhbnVwIHN0aWxsIHJ1bnMuXG4gICAgdGhpcy5fc3BhbkZpbmFsaXplcnMucmVnaXN0ZXIoc3Bhbiwgc3BhbktleSk7XG4gIH1cblxuICAvKiogU3RvcmUgYSB2YWx1ZSBpbiB0aGUgbXV0YWJsZSBzdGF0ZSBmb3IgYSBzcGFuLiAqL1xuICBzdGF0ZVNldChzcGFuQ29udGV4dDogU3BhbkNvbnRleHQsIGtleTogc3RyaW5nLCB2YWx1ZTogdW5rbm93bik6IHZvaWQge1xuICAgIGNvbnN0IHNwYW5LZXkgPSBtYWtlU3BhbktleShzcGFuQ29udGV4dCk7XG4gICAgbGV0IGF0dHJzID0gdGhpcy5fc3RhdGUuZ2V0KHNwYW5LZXkpO1xuICAgIGlmICghYXR0cnMpIHtcbiAgICAgIGF0dHJzID0gbmV3IE1hcCgpO1xuICAgICAgdGhpcy5fc3RhdGUuc2V0KHNwYW5LZXksIGF0dHJzKTtcbiAgICB9XG4gICAgYXR0cnMuc2V0KGtleSwgdmFsdWUpO1xuICB9XG5cbiAgLyoqIFJldHJpZXZlIGEgdmFsdWUgZnJvbSB0aGUgbXV0YWJsZSBzdGF0ZSBmb3IgYSBzcGFuLiAqL1xuICBzdGF0ZUdldDxUPihzcGFuQ29udGV4dDogU3BhbkNvbnRleHQsIGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IFQpOiBUIHtcbiAgICBjb25zdCBzcGFuS2V5ID0gbWFrZVNwYW5LZXkoc3BhbkNvbnRleHQpO1xuICAgIGNvbnN0IGF0dHJzID0gdGhpcy5fc3RhdGUuZ2V0KHNwYW5LZXkpO1xuICAgIGlmICghYXR0cnM/LmhhcyhrZXkpKSByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgIHJldHVybiBhdHRycy5nZXQoa2V5KSBhcyBUO1xuICB9XG5cbiAgLyoqIEF0b21pY2FsbHkgaW5jcmVtZW50IGEgY291bnRlci4gUmV0dXJucyB0aGUgdmFsdWUgYmVmb3JlIGluY3JlbWVudC4gKi9cbiAgc3RhdGVJbmNyKHNwYW5Db250ZXh0OiBTcGFuQ29udGV4dCwga2V5OiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGNvbnN0IHNwYW5LZXkgPSBtYWtlU3BhbktleShzcGFuQ29udGV4dCk7XG4gICAgbGV0IGF0dHJzID0gdGhpcy5fc3RhdGUuZ2V0KHNwYW5LZXkpO1xuICAgIGlmICghYXR0cnMpIHtcbiAgICAgIGF0dHJzID0gbmV3IE1hcCgpO1xuICAgICAgdGhpcy5fc3RhdGUuc2V0KHNwYW5LZXksIGF0dHJzKTtcbiAgICB9XG4gICAgY29uc3Qgc3RvcmVkID0gYXR0cnMuZ2V0KGtleSk7XG4gICAgY29uc3QgcHJldiA9IHR5cGVvZiBzdG9yZWQgPT09IFwibnVtYmVyXCIgPyBzdG9yZWQgOiAwO1xuICAgIGF0dHJzLnNldChrZXksIHByZXYgKyAxKTtcbiAgICByZXR1cm4gcHJldjtcbiAgfVxuXG4gIC8qKiBBdG9taWNhbGx5IGFwcGVuZCB0byBhIGxpc3QuIFJldHVybnMgdGhlIG5ldyBsaXN0LiAqL1xuICBzdGF0ZUFwcGVuZDxUPihzcGFuQ29udGV4dDogU3BhbkNvbnRleHQsIGtleTogc3RyaW5nLCBpdGVtOiBUKTogVFtdIHtcbiAgICBjb25zdCBzcGFuS2V5ID0gbWFrZVNwYW5LZXkoc3BhbkNvbnRleHQpO1xuICAgIGxldCBhdHRycyA9IHRoaXMuX3N0YXRlLmdldChzcGFuS2V5KTtcbiAgICBpZiAoIWF0dHJzKSB7XG4gICAgICBhdHRycyA9IG5ldyBNYXAoKTtcbiAgICAgIHRoaXMuX3N0YXRlLnNldChzcGFuS2V5LCBhdHRycyk7XG4gICAgfVxuICAgIGNvbnN0IHN0b3JlZCA9IGF0dHJzLmdldChrZXkpO1xuICAgIGNvbnN0IGxpc3Q6IFRbXSA9IEFycmF5LmlzQXJyYXkoc3RvcmVkKVxuICAgICAgPyBbLi4uKHN0b3JlZCBhcyBUW10pLCBpdGVtXVxuICAgICAgOiBbaXRlbV07XG4gICAgYXR0cnMuc2V0KGtleSwgbGlzdCk7XG4gICAgcmV0dXJuIGxpc3Q7XG4gIH1cblxuICBwcml2YXRlIF9lbWl0U3BhbihzcGFuOiBSZWFkYWJsZVNwYW4sIGlzUGFydGlhbCA9IGZhbHNlKTogdm9pZCB7XG4gICAgY29uc3QgY3R4ID0gc3Bhbi5zcGFuQ29udGV4dCgpO1xuICAgIGlmICghY3R4LnRyYWNlSWQpIHJldHVybjtcbiAgICBjb25zdCBjdXJySWQgPSB0aGlzLnN0YXRlSW5jcihjdHgsIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVBEQVRFX0lEKTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBBdHRyaWJ1dGVzID0ge1xuICAgICAgLi4uc3Bhbi5hdHRyaWJ1dGVzLFxuICAgICAgW0F0dHJpYnV0ZUtleXMuSlVER01FTlRfVVBEQVRFX0lEXTogY3VycklkLFxuICAgIH07XG5cbiAgICBpZiAoaXNQYXJ0aWFsKSB7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWR5bmFtaWMtZGVsZXRlXG4gICAgICBkZWxldGUgYXR0cmlidXRlc1tBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1BFTkRJTkdfVFJBQ0VfRVZBTF07XG4gICAgfVxuXG4gICAgY29uc3QgZW1pdHRlZFNwYW4gPSBPYmplY3QuY3JlYXRlKHNwYW4pIGFzIFJlYWRhYmxlU3BhbjtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZW1pdHRlZFNwYW4sIFwiYXR0cmlidXRlc1wiLCB7XG4gICAgICB2YWx1ZTogYXR0cmlidXRlcyxcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICB9KTtcbiAgICBjb25zdCBlbmRUaW1lID0gaXNaZXJvSHJUaW1lKHNwYW4uZW5kVGltZSkgPyBzcGFuLnN0YXJ0VGltZSA6IHNwYW4uZW5kVGltZTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZW1pdHRlZFNwYW4sIFwiZW5kVGltZVwiLCB7XG4gICAgICB2YWx1ZTogZW5kVGltZSxcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIHN1cGVyLm9uRW5kKGVtaXR0ZWRTcGFuKTtcbiAgfVxuXG4gIC8qKiBFeHBvcnQgdGhlIGN1cnJlbnQgc3BhbidzIGluLXByb2dyZXNzIHN0YXRlIGZvciBzdHJlYW1pbmcgdXBkYXRlcy4gKi9cbiAgZW1pdFBhcnRpYWwoKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiSnVkZ21lbnRTcGFuUHJvY2Vzc29yLmVtaXRQYXJ0aWFsXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHNwYW4gPSBnZXRUcmFjZVJ1bnRpbWUoKS5nZXRDdXJyZW50U3BhbigpO1xuICAgICAgaWYgKCFzcGFuPy5pc1JlY29yZGluZygpKSByZXR1cm47XG4gICAgICBjb25zdCBjdHggPSBzcGFuLnNwYW5Db250ZXh0KCk7XG4gICAgICBpZiAoIWN0eC50cmFjZUlkKSByZXR1cm47XG4gICAgICBpZiAoXG4gICAgICAgIHRoaXMuc3RhdGVHZXQ8Ym9vbGVhbj4oXG4gICAgICAgICAgY3R4LFxuICAgICAgICAgIEludGVybmFsQXR0cmlidXRlS2V5cy5ESVNBQkxFX1BBUlRJQUxfRU1JVCxcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2VtaXRTcGFuKHNwYW4gYXMgdW5rbm93biBhcyBSZWFkYWJsZVNwYW4sIHRydWUpO1xuICAgIH0pO1xuICB9XG5cbiAgb25TdGFydChzcGFuOiBTcGFuLCBwYXJlbnRDb250ZXh0OiBDb250ZXh0KTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiSnVkZ21lbnRTcGFuUHJvY2Vzc29yLm9uU3RhcnRcIiwgKCkgPT4ge1xuICAgICAgdGhpcy5fYmFnZ2FnZVByb2Nlc3Nvci5vblN0YXJ0KHNwYW4sIHBhcmVudENvbnRleHQpO1xuICAgICAgdGhpcy5fcmVnaXN0ZXJTcGFuKHNwYW4pO1xuICAgIH0pO1xuICB9XG5cbiAgb25FbmQoc3BhbjogUmVhZGFibGVTcGFuKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiSnVkZ21lbnRTcGFuUHJvY2Vzc29yLm9uRW5kXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IGN0eCA9IHNwYW4uc3BhbkNvbnRleHQoKTtcbiAgICAgIGlmICghY3R4LnRyYWNlSWQpIHtcbiAgICAgICAgc3VwZXIub25FbmQoc3Bhbik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHNwYW5LZXkgPSBtYWtlU3BhbktleShjdHgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaXNDYW5jZWxsZWQgPSB0aGlzLnN0YXRlR2V0PGJvb2xlYW4+KFxuICAgICAgICAgIGN0eCxcbiAgICAgICAgICBJbnRlcm5hbEF0dHJpYnV0ZUtleXMuQ0FOQ0VMTEVELFxuICAgICAgICAgIGZhbHNlLFxuICAgICAgICApO1xuICAgICAgICBpZiAoIWlzQ2FuY2VsbGVkKSB7XG4gICAgICAgICAgdGhpcy5fZW1pdFNwYW4oc3Bhbik7XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHRoaXMuX2NsZWFudXBTcGFuU3RhdGUoc3BhbktleSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBDb250ZXh0LCBTcGFuQ29udGV4dCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB0eXBlIHsgUmVhZGFibGVTcGFuLCBTcGFuIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Nkay10cmFjZS1iYXNlXCI7XG5pbXBvcnQgeyBOb09wU3BhbkV4cG9ydGVyIH0gZnJvbSBcIi4uL2V4cG9ydGVycy9Ob09wU3BhbkV4cG9ydGVyXCI7XG5pbXBvcnQgeyBKdWRnbWVudFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi9KdWRnbWVudFNwYW5Qcm9jZXNzb3JcIjtcblxuLyoqXG4gKiBBIG5vLW9wIHNwYW4gcHJvY2Vzc29yIHRoYXQgZGlzY2FyZHMgYWxsIHNwYW5zLlxuICpcbiAqIFVzZWQgd2hlbiBtb25pdG9yaW5nIGlzIGRpc2FibGVkIG9yIGNyZWRlbnRpYWxzIGFyZSBtaXNzaW5nLlxuICovXG5leHBvcnQgY2xhc3MgTm9PcFNwYW5Qcm9jZXNzb3IgZXh0ZW5kcyBKdWRnbWVudFNwYW5Qcm9jZXNzb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihudWxsLCBuZXcgTm9PcFNwYW5FeHBvcnRlcigpKTtcbiAgfVxuXG4gIG9uU3RhcnQoX3NwYW46IFNwYW4sIF9wYXJlbnRDb250ZXh0OiBDb250ZXh0KTogdm9pZCB7XG4gICAgLyogZW1wdHkgKi9cbiAgfVxuXG4gIG9uRW5kKF9zcGFuOiBSZWFkYWJsZVNwYW4pOiB2b2lkIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9XG5cbiAgc2h1dGRvd24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgZm9yY2VGbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBlbWl0UGFydGlhbCgpOiB2b2lkIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9XG5cbiAgc3RhdGVTZXQoX3NwYW5Db250ZXh0OiBTcGFuQ29udGV4dCwgX2tleTogc3RyaW5nLCBfdmFsdWU6IHVua25vd24pOiB2b2lkIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9XG5cbiAgc3RhdGVHZXQ8VD4oX3NwYW5Db250ZXh0OiBTcGFuQ29udGV4dCwgX2tleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IFQpOiBUIHtcbiAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICB9XG5cbiAgc3RhdGVJbmNyKF9zcGFuQ29udGV4dDogU3BhbkNvbnRleHQsIF9rZXk6IHN0cmluZyk6IG51bWJlciB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBzdGF0ZUFwcGVuZDxUPihfc3BhbkNvbnRleHQ6IFNwYW5Db250ZXh0LCBfa2V5OiBzdHJpbmcsIGl0ZW06IFQpOiBUW10ge1xuICAgIHJldHVybiBbaXRlbV07XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHtcbiAgZGVmYXVsdFJlc291cmNlLFxuICByZXNvdXJjZUZyb21BdHRyaWJ1dGVzLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvcmVzb3VyY2VzXCI7XG5pbXBvcnQgeyBOb2RlVHJhY2VyUHJvdmlkZXIgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLW5vZGVcIjtcbmltcG9ydCB7IEpVREdNRU5UX0FQSV9LRVksIEpVREdNRU5UX0FQSV9VUkwsIEpVREdNRU5UX09SR19JRCB9IGZyb20gXCIuLi9lbnZcIjtcbmltcG9ydCB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaVwiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2xvZ2dlclwiO1xuaW1wb3J0IHsgcmVzb2x2ZVByb2plY3RJZCB9IGZyb20gXCIuLi91dGlscy9yZXNvbHZlLXByb2plY3QtaWRcIjtcbmltcG9ydCB7IHNhZmVTdHJpbmdpZnkgfSBmcm9tIFwiLi4vdXRpbHMvc2VyaWFsaXplclwiO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gXCIuLi92ZXJzaW9uXCI7XG5pbXBvcnQgdHlwZSB7IFRyYWNlckNvbmZpZyB9IGZyb20gXCIuL0Jhc2VUcmFjZXJcIjtcbmltcG9ydCB7IEJhc2VUcmFjZXIgfSBmcm9tIFwiLi9CYXNlVHJhY2VyXCI7XG5pbXBvcnQgeyBKdWRnbWVudFRyYWNlclByb3ZpZGVyIH0gZnJvbSBcIi4vSnVkZ21lbnRUcmFjZXJQcm92aWRlclwiO1xuaW1wb3J0IHsgSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi9leHBvcnRlcnMvSnVkZ21lbnRTcGFuRXhwb3J0ZXJcIjtcbmltcG9ydCB7IE5vT3BTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi9leHBvcnRlcnMvTm9PcFNwYW5FeHBvcnRlclwiO1xuaW1wb3J0IHsgSnVkZ21lbnRTcGFuUHJvY2Vzc29yIH0gZnJvbSBcIi4vcHJvY2Vzc29ycy9KdWRnbWVudFNwYW5Qcm9jZXNzb3JcIjtcbmltcG9ydCB7IE5vT3BTcGFuUHJvY2Vzc29yIH0gZnJvbSBcIi4vcHJvY2Vzc29ycy9Ob09wU3BhblByb2Nlc3NvclwiO1xuXG4vKipcbiAqIENvbmNyZXRlIHRyYWNlciBpbXBsZW1lbnRhdGlvbiBmb3IgTm9kZS5qcyBhcHBsaWNhdGlvbnMuXG4gKlxuICogVXNlIGBUcmFjZXIuaW5pdCgpYCB0byBjcmVhdGUgYW5kIGFjdGl2YXRlIGEgbmV3IHRyYWNlci4gVGhpcyBzZXRzIHVwXG4gKiBPcGVuVGVsZW1ldHJ5IHNwYW4gcHJvY2Vzc2luZyBhbmQgZXhwb3J0IHRvIHRoZSBKdWRnbWVudCBwbGF0Zm9ybS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgVHJhY2VyIH0gZnJvbSBcImp1ZGdldmFsXCI7XG4gKlxuICogY29uc3QgdHJhY2VyID0gYXdhaXQgVHJhY2VyLmluaXQoeyBwcm9qZWN0TmFtZTogXCJteS1wcm9qZWN0XCIgfSk7XG4gKlxuICogY29uc3QgdHJhY2VkID0gVHJhY2VyLm9ic2VydmUoYXN5bmMgKGlucHV0OiBzdHJpbmcpID0+IHtcbiAqICAgcmV0dXJuIGF3YWl0IHByb2Nlc3NJbnB1dChpbnB1dCk7XG4gKiB9KTtcbiAqXG4gKiBhd2FpdCB0cmFjZWQoXCJoZWxsb1wiKTtcbiAqIGF3YWl0IFRyYWNlci5mb3JjZUZsdXNoKCk7XG4gKiBhd2FpdCBUcmFjZXIuc2h1dGRvd24oKTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgVHJhY2VyIGV4dGVuZHMgQmFzZVRyYWNlciB7XG4gIHByaXZhdGUgX3NwYW5FeHBvcnRlcjogSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfc3BhblByb2Nlc3NvcjogSnVkZ21lbnRTcGFuUHJvY2Vzc29yIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcgfCBudWxsLFxuICAgIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbCxcbiAgICBhcGlLZXk6IHN0cmluZyB8IG51bGwsXG4gICAgb3JnYW5pemF0aW9uSWQ6IHN0cmluZyB8IG51bGwsXG4gICAgYXBpVXJsOiBzdHJpbmcgfCBudWxsLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcgfCBudWxsLFxuICAgIHNlcmlhbGl6ZXI6ICh2OiB1bmtub3duKSA9PiBzdHJpbmcsXG4gICAgdHJhY2VyUHJvdmlkZXI6IE5vZGVUcmFjZXJQcm92aWRlcixcbiAgICBjbGllbnQ6IEp1ZGdtZW50QXBpQ2xpZW50IHwgbnVsbCxcbiAgICBlbmFibGVNb25pdG9yaW5nOiBib29sZWFuLFxuICApIHtcbiAgICBzdXBlcihcbiAgICAgIHByb2plY3ROYW1lLFxuICAgICAgcHJvamVjdElkLFxuICAgICAgYXBpS2V5LFxuICAgICAgb3JnYW5pemF0aW9uSWQsXG4gICAgICBhcGlVcmwsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIHNlcmlhbGl6ZXIsXG4gICAgICB0cmFjZXJQcm92aWRlcixcbiAgICAgIGNsaWVudCxcbiAgICAgIGVuYWJsZU1vbml0b3JpbmcsXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW5kIGFjdGl2YXRlIGEgbmV3IFRyYWNlci5cbiAgICpcbiAgICogVGhpcyBpcyB0aGUgcmVjb21tZW5kZWQgd2F5IHRvIGluaXRpYWxpemUgdHJhY2luZy4gQ3JlZGVudGlhbHMgYXJlXG4gICAqIHJlYWQgZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgaWYgbm90IHByb3ZpZGVkIGV4cGxpY2l0bHkuXG4gICAqXG4gICAqIEBwYXJhbSBjb25maWcgLSBUcmFjZXIgY29uZmlndXJhdGlvbiBvcHRpb25zLlxuICAgKiBAcmV0dXJucyBBIGNvbmZpZ3VyZWQgYW5kIGFjdGl2YXRlZCBgVHJhY2VyYCBpbnN0YW5jZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBjb25zdCB0cmFjZXIgPSBhd2FpdCBUcmFjZXIuaW5pdCh7XG4gICAqICAgcHJvamVjdE5hbWU6IFwibXktcHJvamVjdFwiLFxuICAgKiAgIGVudmlyb25tZW50OiBcInByb2R1Y3Rpb25cIixcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGluaXQoY29uZmlnOiBUcmFjZXJDb25maWcgPSB7fSk6IFByb21pc2U8VHJhY2VyPiB7XG4gICAgY29uc3QgYXBpS2V5ID0gY29uZmlnLmFwaUtleSA/PyBKVURHTUVOVF9BUElfS0VZO1xuICAgIGNvbnN0IG9yZ2FuaXphdGlvbklkID0gY29uZmlnLm9yZ2FuaXphdGlvbklkID8/IEpVREdNRU5UX09SR19JRDtcbiAgICBjb25zdCBhcGlVcmwgPSBjb25maWcuYXBpVXJsID8/IEpVREdNRU5UX0FQSV9VUkw7XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb25maWcucHJvamVjdE5hbWUgPz8gbnVsbDtcbiAgICBjb25zdCBzZXJpYWxpemVyID0gY29uZmlnLnNlcmlhbGl6ZXIgPz8gc2FmZVN0cmluZ2lmeTtcblxuICAgIGxldCBlbmFibGVNb25pdG9yaW5nID0gdHJ1ZTtcblxuICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgICBcInByb2plY3RfbmFtZSBub3QgcHJvdmlkZWQuIFRyYWNlciB3aWxsIG5vdCBleHBvcnQgc3BhbnMuXCIsXG4gICAgICApO1xuICAgICAgZW5hYmxlTW9uaXRvcmluZyA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoIWFwaUtleSkge1xuICAgICAgTG9nZ2VyLndhcm5pbmcoXCJhcGlfa2V5IG5vdCBwcm92aWRlZC4gVHJhY2VyIHdpbGwgbm90IGV4cG9ydCBzcGFucy5cIik7XG4gICAgICBlbmFibGVNb25pdG9yaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIGlmICghb3JnYW5pemF0aW9uSWQpIHtcbiAgICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgICBcIm9yZ2FuaXphdGlvbl9pZCBub3QgcHJvdmlkZWQuIFRyYWNlciB3aWxsIG5vdCBleHBvcnQgc3BhbnMuXCIsXG4gICAgICApO1xuICAgICAgZW5hYmxlTW9uaXRvcmluZyA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoIWFwaVVybCkge1xuICAgICAgTG9nZ2VyLndhcm5pbmcoXCJhcGlfdXJsIG5vdCBwcm92aWRlZC4gVHJhY2VyIHdpbGwgbm90IGV4cG9ydCBzcGFucy5cIik7XG4gICAgICBlbmFibGVNb25pdG9yaW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgbGV0IGNsaWVudDogSnVkZ21lbnRBcGlDbGllbnQgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgcHJvamVjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgIGlmIChlbmFibGVNb25pdG9yaW5nICYmIHByb2plY3ROYW1lICYmIGFwaUtleSAmJiBvcmdhbml6YXRpb25JZCAmJiBhcGlVcmwpIHtcbiAgICAgIGNsaWVudCA9IG5ldyBKdWRnbWVudEFwaUNsaWVudChhcGlVcmwsIGFwaUtleSwgb3JnYW5pemF0aW9uSWQpO1xuICAgICAgcHJvamVjdElkID0gYXdhaXQgcmVzb2x2ZVByb2plY3RJZChjbGllbnQsIHByb2plY3ROYW1lKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgIGlmICghcHJvamVjdElkKSB7XG4gICAgICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgICAgIGBQcm9qZWN0ICcke3Byb2plY3ROYW1lfScgbm90IGZvdW5kLiBUcmFjZXIgd2lsbCBub3QgZXhwb3J0IHNwYW5zLmAsXG4gICAgICAgICk7XG4gICAgICAgIGVuYWJsZU1vbml0b3JpbmcgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZXNvdXJjZUF0dHJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgXCJzZXJ2aWNlLm5hbWVcIjogcHJvamVjdE5hbWUgPz8gXCJ1bmtub3duXCIsXG4gICAgICBcInRlbGVtZXRyeS5zZGsubmFtZVwiOiBcImp1ZGdldmFsXCIsXG4gICAgICBcInRlbGVtZXRyeS5zZGsudmVyc2lvblwiOiBWRVJTSU9OLFxuICAgIH07XG4gICAgaWYgKGNvbmZpZy5lbnZpcm9ubWVudCkge1xuICAgICAgcmVzb3VyY2VBdHRyc1tcImRlcGxveW1lbnQuZW52aXJvbm1lbnRcIl0gPSBjb25maWcuZW52aXJvbm1lbnQ7XG4gICAgfVxuICAgIGlmIChjb25maWcucmVzb3VyY2VBdHRyaWJ1dGVzKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHJlc291cmNlQXR0cnMsIGNvbmZpZy5yZXNvdXJjZUF0dHJpYnV0ZXMpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc291cmNlID0gZGVmYXVsdFJlc291cmNlKCkubWVyZ2UoXG4gICAgICByZXNvdXJjZUZyb21BdHRyaWJ1dGVzKHJlc291cmNlQXR0cnMpLFxuICAgICk7XG5cbiAgICBjb25zdCB0cmFjZXJQcm92aWRlciA9IG5ldyBOb2RlVHJhY2VyUHJvdmlkZXIoe1xuICAgICAgcmVzb3VyY2UsXG4gICAgICBzYW1wbGVyOiBjb25maWcuc2FtcGxlcixcbiAgICAgIHNwYW5MaW1pdHM6IGNvbmZpZy5zcGFuTGltaXRzLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdHJhY2VyID0gbmV3IFRyYWNlcihcbiAgICAgIHByb2plY3ROYW1lLFxuICAgICAgcHJvamVjdElkLFxuICAgICAgYXBpS2V5LFxuICAgICAgb3JnYW5pemF0aW9uSWQsXG4gICAgICBhcGlVcmwsXG4gICAgICBjb25maWcuZW52aXJvbm1lbnQgPz8gbnVsbCxcbiAgICAgIHNlcmlhbGl6ZXIsXG4gICAgICB0cmFjZXJQcm92aWRlcixcbiAgICAgIGNsaWVudCxcbiAgICAgIGVuYWJsZU1vbml0b3JpbmcsXG4gICAgKTtcblxuICAgIGlmIChlbmFibGVNb25pdG9yaW5nKSB7XG4gICAgICBjb25zdCBwcm92aWRlcldpdGhQcm9jZXNzb3IgPSBuZXcgTm9kZVRyYWNlclByb3ZpZGVyKHtcbiAgICAgICAgcmVzb3VyY2UsXG4gICAgICAgIHNhbXBsZXI6IGNvbmZpZy5zYW1wbGVyLFxuICAgICAgICBzcGFuTGltaXRzOiBjb25maWcuc3BhbkxpbWl0cyxcbiAgICAgICAgc3BhblByb2Nlc3NvcnM6IFtcbiAgICAgICAgICB0cmFjZXIuZ2V0U3BhblByb2Nlc3NvcigpLFxuICAgICAgICAgIC4uLihjb25maWcuc3BhblByb2Nlc3NvcnMgPz8gW10pLFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgICB0cmFjZXIuX3RyYWNlclByb3ZpZGVyID0gcHJvdmlkZXJXaXRoUHJvY2Vzc29yO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3h5ID0gSnVkZ21lbnRUcmFjZXJQcm92aWRlci5nZXRJbnN0YW5jZSgpO1xuICAgIHByb3h5LnJlZ2lzdGVyKHRyYWNlcik7XG5cbiAgICBpZiAoY29uZmlnLnNldEFjdGl2ZSA/PyB0cnVlKSB7XG4gICAgICB0cmFjZXIuc2V0QWN0aXZlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRyYWNlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgb3IgY3JlYXRlIHRoZSBzcGFuIGV4cG9ydGVyIGZvciB0aGlzIHRyYWNlci5cbiAgICpcbiAgICogQHJldHVybnMgVGhlIHNwYW4gZXhwb3J0ZXIgaW5zdGFuY2UuXG4gICAqL1xuICBnZXRTcGFuRXhwb3J0ZXIoKTogSnVkZ21lbnRTcGFuRXhwb3J0ZXIge1xuICAgIGlmICh0aGlzLl9zcGFuRXhwb3J0ZXIpIHJldHVybiB0aGlzLl9zcGFuRXhwb3J0ZXI7XG5cbiAgICBpZiAoXG4gICAgICAhdGhpcy5fZW5hYmxlTW9uaXRvcmluZyB8fFxuICAgICAgIXRoaXMucHJvamVjdElkIHx8XG4gICAgICAhdGhpcy5hcGlLZXkgfHxcbiAgICAgICF0aGlzLm9yZ2FuaXphdGlvbklkIHx8XG4gICAgICAhdGhpcy5hcGlVcmxcbiAgICApIHtcbiAgICAgIHRoaXMuX3NwYW5FeHBvcnRlciA9IG5ldyBOb09wU3BhbkV4cG9ydGVyKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGVuZHBvaW50ID0gdGhpcy5hcGlVcmwuZW5kc1dpdGgoXCIvXCIpXG4gICAgICAgID8gdGhpcy5hcGlVcmwgKyBcIm90ZWwvdjEvdHJhY2VzXCJcbiAgICAgICAgOiB0aGlzLmFwaVVybCArIFwiL290ZWwvdjEvdHJhY2VzXCI7XG4gICAgICB0aGlzLl9zcGFuRXhwb3J0ZXIgPSBuZXcgSnVkZ21lbnRTcGFuRXhwb3J0ZXIoXG4gICAgICAgIGVuZHBvaW50LFxuICAgICAgICB0aGlzLmFwaUtleSxcbiAgICAgICAgdGhpcy5vcmdhbml6YXRpb25JZCxcbiAgICAgICAgdGhpcy5wcm9qZWN0SWQsXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3BhbkV4cG9ydGVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBvciBjcmVhdGUgdGhlIHNwYW4gcHJvY2Vzc29yIGZvciB0aGlzIHRyYWNlci5cbiAgICpcbiAgICogQHJldHVybnMgVGhlIHNwYW4gcHJvY2Vzc29yIGluc3RhbmNlLlxuICAgKi9cbiAgZ2V0U3BhblByb2Nlc3NvcigpOiBKdWRnbWVudFNwYW5Qcm9jZXNzb3Ige1xuICAgIGlmICh0aGlzLl9zcGFuUHJvY2Vzc29yKSByZXR1cm4gdGhpcy5fc3BhblByb2Nlc3NvcjtcblxuICAgIGlmICghdGhpcy5fZW5hYmxlTW9uaXRvcmluZykge1xuICAgICAgdGhpcy5fc3BhblByb2Nlc3NvciA9IG5ldyBOb09wU3BhblByb2Nlc3NvcigpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zcGFuUHJvY2Vzc29yID0gbmV3IEp1ZGdtZW50U3BhblByb2Nlc3NvcihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5nZXRTcGFuRXhwb3J0ZXIoKSxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zcGFuUHJvY2Vzc29yO1xuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgUmVhZGFibGVTcGFuLCBTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB7IEV4YW1wbGUgfSBmcm9tIFwiLi4vLi4vZGF0YS9FeGFtcGxlXCI7XG5pbXBvcnQgdHlwZSB7IEJhc2VUcmFjZXIgfSBmcm9tIFwiLi4vQmFzZVRyYWNlclwiO1xuaW1wb3J0IHsgSnVkZ21lbnRTcGFuUHJvY2Vzc29yIH0gZnJvbSBcIi4vSnVkZ21lbnRTcGFuUHJvY2Vzc29yXCI7XG5cbi8qKlxuICogU3BhbiBwcm9jZXNzb3IgdXNlZCBieSBgT2ZmbGluZVRyYWNlcmAuXG4gKlxuICogRXh0ZW5kcyBgSnVkZ21lbnRTcGFuUHJvY2Vzc29yYCAoc28gaXQgaW5oZXJpdHMgYmF0Y2hlZCBleHBvcnQsIHNwYW5cbiAqIHN0YXRlLCBhbmQgcGFydGlhbC1lbWl0IHN1cHBvcnQpIGFuZCBhZGRpdGlvbmFsbHkgYXBwZW5kcyBhIG5ld1xuICogYEV4YW1wbGVgIHRvIHRoZSBjYWxsZXItc3VwcGxpZWQgYGRhdGFzZXRgIGxpc3Qgd2hlbmV2ZXIgYSAqcm9vdCpcbiAqIHNwYW4gZW5kcy4gRWFjaCBlbWl0dGVkIGV4YW1wbGUgY2FycmllcyB0aGUgYG9mZmxpbmVfdHJhY2VfaWRgIG9mXG4gKiB0aGUgdHJhY2UgcGx1cyBhbnkgc3RhdGljIGBleGFtcGxlRmllbGRzYCBjb25maWd1cmVkIGF0IGluaXQgdGltZS5cbiAqL1xuZXhwb3J0IGNsYXNzIE9mZmxpbmVKdWRnbWVudFNwYW5Qcm9jZXNzb3IgZXh0ZW5kcyBKdWRnbWVudFNwYW5Qcm9jZXNzb3Ige1xuICBwcml2YXRlIHJlYWRvbmx5IF9kYXRhc2V0OiBFeGFtcGxlW107XG4gIHByaXZhdGUgcmVhZG9ubHkgX2V4YW1wbGVGaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBwcml2YXRlIHJlYWRvbmx5IF9zZWVuVHJhY2VJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICB0cmFjZXI6IEJhc2VUcmFjZXIsXG4gICAgZXhwb3J0ZXI6IFNwYW5FeHBvcnRlcixcbiAgICBvcHRpb25zOiB7XG4gICAgICBkYXRhc2V0OiBFeGFtcGxlW107XG4gICAgICBleGFtcGxlRmllbGRzPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgfSxcbiAgKSB7XG4gICAgc3VwZXIodHJhY2VyLCBleHBvcnRlcik7XG4gICAgdGhpcy5fZGF0YXNldCA9IG9wdGlvbnMuZGF0YXNldDtcbiAgICB0aGlzLl9leGFtcGxlRmllbGRzID0geyAuLi4ob3B0aW9ucy5leGFtcGxlRmllbGRzID8/IHt9KSB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfbWF5YmVDcmVhdGVFeGFtcGxlKHNwYW46IFJlYWRhYmxlU3Bhbik6IHZvaWQge1xuICAgIGlmIChzcGFuLnBhcmVudFNwYW5Db250ZXh0KSByZXR1cm47XG4gICAgY29uc3QgY3R4ID0gc3Bhbi5zcGFuQ29udGV4dCgpO1xuICAgIGlmICghY3R4Py50cmFjZUlkKSByZXR1cm47XG5cbiAgICBpZiAodGhpcy5fc2VlblRyYWNlSWRzLmhhcyhjdHgudHJhY2VJZCkpIHJldHVybjtcbiAgICB0aGlzLl9zZWVuVHJhY2VJZHMuYWRkKGN0eC50cmFjZUlkKTtcblxuICAgIGNvbnN0IGV4YW1wbGUgPSBFeGFtcGxlLmNyZWF0ZSh7XG4gICAgICAuLi50aGlzLl9leGFtcGxlRmllbGRzLFxuICAgICAgb2ZmbGluZV90cmFjZV9pZDogY3R4LnRyYWNlSWQsXG4gICAgfSk7XG4gICAgdGhpcy5fZGF0YXNldC5wdXNoKGV4YW1wbGUpO1xuICB9XG5cbiAgb25FbmQoc3BhbjogUmVhZGFibGVTcGFuKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX21heWJlQ3JlYXRlRXhhbXBsZShzcGFuKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc3VwZXIub25FbmQoc3Bhbik7XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB7XG4gIGRlZmF1bHRSZXNvdXJjZSxcbiAgcmVzb3VyY2VGcm9tQXR0cmlidXRlcyxcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Jlc291cmNlc1wiO1xuaW1wb3J0IHR5cGUgeyBTYW1wbGVyLCBTcGFuTGltaXRzIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Nkay10cmFjZS1iYXNlXCI7XG5pbXBvcnQgeyB0eXBlIFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB7IE5vZGVUcmFjZXJQcm92aWRlciB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9zZGstdHJhY2Utbm9kZVwiO1xuaW1wb3J0IHR5cGUgeyBFeGFtcGxlIH0gZnJvbSBcIi4uL2RhdGEvRXhhbXBsZVwiO1xuaW1wb3J0IHsgSlVER01FTlRfQVBJX0tFWSwgSlVER01FTlRfQVBJX1VSTCwgSlVER01FTlRfT1JHX0lEIH0gZnJvbSBcIi4uL2VudlwiO1xuaW1wb3J0IHsgSnVkZ21lbnRBcGlDbGllbnQgfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpXCI7XG5pbXBvcnQgeyByZXNvbHZlUHJvamVjdElkIH0gZnJvbSBcIi4uL3V0aWxzL3Jlc29sdmUtcHJvamVjdC1pZFwiO1xuaW1wb3J0IHsgc2FmZVN0cmluZ2lmeSB9IGZyb20gXCIuLi91dGlscy9zZXJpYWxpemVyXCI7XG5pbXBvcnQgeyBWRVJTSU9OIH0gZnJvbSBcIi4uL3ZlcnNpb25cIjtcbmltcG9ydCB7IEp1ZGdtZW50VHJhY2VyUHJvdmlkZXIgfSBmcm9tIFwiLi9KdWRnbWVudFRyYWNlclByb3ZpZGVyXCI7XG5pbXBvcnQgeyBUcmFjZXIgfSBmcm9tIFwiLi9UcmFjZXJcIjtcbmltcG9ydCB7IEp1ZGdtZW50U3BhbkV4cG9ydGVyIH0gZnJvbSBcIi4vZXhwb3J0ZXJzL0p1ZGdtZW50U3BhbkV4cG9ydGVyXCI7XG5pbXBvcnQgeyBPZmZsaW5lSnVkZ21lbnRTcGFuUHJvY2Vzc29yIH0gZnJvbSBcIi4vcHJvY2Vzc29ycy9PZmZsaW5lSnVkZ21lbnRTcGFuUHJvY2Vzc29yXCI7XG5cbmNvbnN0IE9GRkxJTkVfVFJBQ0VTX1BBVEggPSBcIm90ZWwvdjEvb2ZmbGluZS10cmFjZXNcIjtcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIGZvciBgT2ZmbGluZVRyYWNlci5jcmVhdGUoKWAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgT2ZmbGluZVRyYWNlckNvbmZpZyB7XG4gIC8qKiBMaXN0IHRoYXQgcmVjZWl2ZXMgYW4gYEV4YW1wbGVgIGZvciBlYWNoIGNvbXBsZXRlZCByb290IHNwYW4uICovXG4gIGRhdGFzZXQ6IEV4YW1wbGVbXTtcbiAgLyoqXG4gICAqIEZpZWxkcyBpbmNsdWRlZCBvbiBldmVyeSBgRXhhbXBsZWAgaW4gYGRhdGFzZXRgXG4gICAqIChlLmcuIGB7IGlucHV0OiAuLi4sIGdvbGRlbk91dHB1dDogLi4uIH1gKS5cbiAgICovXG4gIGV4YW1wbGVGaWVsZHM/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgLyoqIFlvdXIgSnVkZ21lbnQgcHJvamVjdCBuYW1lLiBSZXF1aXJlZC4gKi9cbiAgcHJvamVjdE5hbWU/OiBzdHJpbmc7XG4gIC8qKiBKdWRnbWVudCBBUEkga2V5LiBEZWZhdWx0cyB0byBgSlVER01FTlRfQVBJX0tFWWAgZW52IHZhci4gKi9cbiAgYXBpS2V5Pzogc3RyaW5nO1xuICAvKiogSnVkZ21lbnQgb3JnYW5pemF0aW9uIElELiBEZWZhdWx0cyB0byBgSlVER01FTlRfT1JHX0lEYCBlbnYgdmFyLiAqL1xuICBvcmdhbml6YXRpb25JZD86IHN0cmluZztcbiAgLyoqIEp1ZGdtZW50IEFQSSBVUkwuIERlZmF1bHRzIHRvIGBKVURHTUVOVF9BUElfVVJMYCBlbnYgdmFyLiAqL1xuICBhcGlVcmw/OiBzdHJpbmc7XG4gIC8qKiBEZXBsb3ltZW50IGVudmlyb25tZW50IG5hbWUgKGUuZy4gXCJwcm9kdWN0aW9uXCIpLiAqL1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgLyoqIFdoZXRoZXIgdG8gc2V0IHRoaXMgdHJhY2VyIGFzIGFjdGl2ZS4gRGVmYXVsdHMgdG8gYHRydWVgLiAqL1xuICBzZXRBY3RpdmU/OiBib29sZWFuO1xuICAvKiogQ3VzdG9tIHNlcmlhbGl6YXRpb24gZnVuY3Rpb24gZm9yIHNwYW4gYXR0cmlidXRlIHZhbHVlcy4gKi9cbiAgc2VyaWFsaXplcj86ICh2YWx1ZTogdW5rbm93bikgPT4gc3RyaW5nO1xuICAvKiogQWRkaXRpb25hbCBPcGVuVGVsZW1ldHJ5IHJlc291cmNlIGF0dHJpYnV0ZXMuICovXG4gIHJlc291cmNlQXR0cmlidXRlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKiBDdXN0b20gT3BlblRlbGVtZXRyeSBzYW1wbGVyLiAqL1xuICBzYW1wbGVyPzogU2FtcGxlcjtcbiAgLyoqIEN1c3RvbSBPcGVuVGVsZW1ldHJ5IHNwYW4gbGltaXRzLiAqL1xuICBzcGFuTGltaXRzPzogU3BhbkxpbWl0cztcbiAgLyoqIEFkZGl0aW9uYWwgT3BlblRlbGVtZXRyeSBzcGFuIHByb2Nlc3NvcnMuICovXG4gIHNwYW5Qcm9jZXNzb3JzPzogU3BhblByb2Nlc3NvcltdO1xufVxuXG4vKipcbiAqIFRyYWNlciBmb3Igb2ZmbGluZSAvIGV4cGVyaW1lbnQtc3R5bGUgcnVucy5cbiAqXG4gKiBCZWhhdmVzIGxpa2UgYFRyYWNlcmAgZm9yIHNwYW4gY3JlYXRpb24gYW5kIGBAVHJhY2VyLm9ic2VydmVgLCB3aXRoXG4gKiB0d28gZGlmZmVyZW5jZXM6XG4gKlxuICogKiBTcGFucyBhcmUgcHVzaGVkIHRvIHRoZSBwcm9qZWN0J3MgKm9mZmxpbmUqIE9UTFAgZW5kcG9pbnQgYW5kIHN0b3JlZFxuICogICBpbiB0aGUgYG9mZmxpbmVfb3RlbF90cmFjZXNgIENsaWNrSG91c2UgdGFibGUuIFRoZXkgZG8gKipub3QqKiBhcHBlYXJcbiAqICAgb24gdGhlIGxpdmUgbW9uaXRvcmluZyBwYWdlLlxuICogKiBFYWNoIGNvbXBsZXRlZCByb290IHNwYW4gcHJvZHVjZXMgYSBuZXcgYEV4YW1wbGVgIHRoYXQgaXMgYXBwZW5kZWRcbiAqICAgdG8gdGhlIGNhbGxlci1zdXBwbGllZCBgZGF0YXNldGAgbGlzdC4gVGhlIGV4YW1wbGUgY2FycmllcyB0aGVcbiAqICAgYG9mZmxpbmVfdHJhY2VfaWRgIG9mIHRoZSBvZmZsaW5lIHRyYWNlIHBsdXMgYW55IHN0YXRpY1xuICogICBgZXhhbXBsZUZpZWxkc2AgY29uZmlndXJlZCBhdCBpbml0IHRpbWUuXG4gKlxuICogVW5saWtlIGBUcmFjZXJgLCBgT2ZmbGluZVRyYWNlcmAgcmVxdWlyZXMgYWxsIGNyZWRlbnRpYWxzIHVwZnJvbnQgYW5kXG4gKiB0aHJvd3MgaWYgYW55IGFyZSBtaXNzaW5nIOKAlCB0aGVyZSBpcyBubyBuby1vcCBmYWxsYmFjay4gUHJlZmVyXG4gKiBganVkZ2V2YWwub2ZmbGluZVRyYWNlcih7IC4uLiB9KWAgb3ZlciBjYWxsaW5nIGBPZmZsaW5lVHJhY2VyLmNyZWF0ZWBcbiAqIGRpcmVjdGx5IHNvIGNyZWRlbnRpYWxzIGFyZSByZXVzZWQgZnJvbSB0aGUgYWN0aXZlIGBKdWRnZXZhbGAgY2xpZW50LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBKdWRnZXZhbCwgdHlwZSBFeGFtcGxlIH0gZnJvbSBcImp1ZGdldmFsXCI7XG4gKlxuICogY29uc3QganVkZ2V2YWwgPSBhd2FpdCBKdWRnZXZhbC5jcmVhdGUoeyBwcm9qZWN0TmFtZTogXCJteS1wcm9qZWN0XCIgfSk7XG4gKiBjb25zdCBkYXRhc2V0OiBFeGFtcGxlW10gPSBbXTtcbiAqIGNvbnN0IHRyYWNlciA9IGF3YWl0IGp1ZGdldmFsLm9mZmxpbmVUcmFjZXIoe1xuICogICBkYXRhc2V0LFxuICogICBleGFtcGxlRmllbGRzOiB7IGlucHV0OiBcIldoYXQgaXMgMisyP1wiLCBleHBlY3RlZF9vdXRwdXQ6IFwiNFwiIH0sXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgT2ZmbGluZVRyYWNlciBleHRlbmRzIFRyYWNlciB7XG4gIHJlYWRvbmx5IHN1cHBvcnRzTGl2ZUluc3RydW1lbnRhdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX29mZmxpbmVBcGlVcmw6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBfb2ZmbGluZUFwaUtleTogc3RyaW5nO1xuICBwcml2YXRlIHJlYWRvbmx5IF9vZmZsaW5lT3JnYW5pemF0aW9uSWQ6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBfb2ZmbGluZVByb2plY3RJZDogc3RyaW5nO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX2RhdGFzZXQ6IEV4YW1wbGVbXTtcbiAgcHJpdmF0ZSByZWFkb25seSBfZXhhbXBsZUZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbiAgcHJpdmF0ZSBfb2ZmbGluZVNwYW5FeHBvcnRlcjogSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfb2ZmbGluZVNwYW5Qcm9jZXNzb3I6IE9mZmxpbmVKdWRnbWVudFNwYW5Qcm9jZXNzb3IgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKGFyZ3M6IHtcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICAgIHByb2plY3RJZDogc3RyaW5nO1xuICAgIGFwaUtleTogc3RyaW5nO1xuICAgIG9yZ2FuaXphdGlvbklkOiBzdHJpbmc7XG4gICAgYXBpVXJsOiBzdHJpbmc7XG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyB8IG51bGw7XG4gICAgc2VyaWFsaXplcjogKHZhbHVlOiB1bmtub3duKSA9PiBzdHJpbmc7XG4gICAgdHJhY2VyUHJvdmlkZXI6IE5vZGVUcmFjZXJQcm92aWRlcjtcbiAgICBjbGllbnQ6IEp1ZGdtZW50QXBpQ2xpZW50O1xuICAgIGRhdGFzZXQ6IEV4YW1wbGVbXTtcbiAgICBleGFtcGxlRmllbGRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgfSkge1xuICAgIHN1cGVyKFxuICAgICAgYXJncy5wcm9qZWN0TmFtZSxcbiAgICAgIGFyZ3MucHJvamVjdElkLFxuICAgICAgYXJncy5hcGlLZXksXG4gICAgICBhcmdzLm9yZ2FuaXphdGlvbklkLFxuICAgICAgYXJncy5hcGlVcmwsXG4gICAgICBhcmdzLmVudmlyb25tZW50LFxuICAgICAgYXJncy5zZXJpYWxpemVyLFxuICAgICAgYXJncy50cmFjZXJQcm92aWRlcixcbiAgICAgIGFyZ3MuY2xpZW50LFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHRoaXMuX29mZmxpbmVBcGlVcmwgPSBhcmdzLmFwaVVybDtcbiAgICB0aGlzLl9vZmZsaW5lQXBpS2V5ID0gYXJncy5hcGlLZXk7XG4gICAgdGhpcy5fb2ZmbGluZU9yZ2FuaXphdGlvbklkID0gYXJncy5vcmdhbml6YXRpb25JZDtcbiAgICB0aGlzLl9vZmZsaW5lUHJvamVjdElkID0gYXJncy5wcm9qZWN0SWQ7XG4gICAgdGhpcy5fZGF0YXNldCA9IGFyZ3MuZGF0YXNldDtcbiAgICB0aGlzLl9leGFtcGxlRmllbGRzID0gYXJncy5leGFtcGxlRmllbGRzO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbmQgYWN0aXZhdGUgYSBuZXcgYE9mZmxpbmVUcmFjZXJgLlxuICAgKlxuICAgKiBAdGhyb3dzIEVycm9yIGlmIGBwcm9qZWN0TmFtZWAsIGBhcGlLZXlgLCBgb3JnYW5pemF0aW9uSWRgLCBvclxuICAgKiAgIGBhcGlVcmxgIGNhbm5vdCBiZSByZXNvbHZlZCAoZXhwbGljaXQgYXJnIG9yIGVudiB2YXIpLCBvciBpZiB0aGVcbiAgICogICBwcm9qZWN0IGNhbm5vdCBiZSBmb3VuZCBvbiB0aGUgYmFja2VuZC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGUoY29uZmlnOiBPZmZsaW5lVHJhY2VyQ29uZmlnKTogUHJvbWlzZTxPZmZsaW5lVHJhY2VyPiB7XG4gICAgY29uc3QgYXBpS2V5ID0gY29uZmlnLmFwaUtleSA/PyBKVURHTUVOVF9BUElfS0VZO1xuICAgIGNvbnN0IG9yZ2FuaXphdGlvbklkID0gY29uZmlnLm9yZ2FuaXphdGlvbklkID8/IEpVREdNRU5UX09SR19JRDtcbiAgICBjb25zdCBhcGlVcmwgPSBjb25maWcuYXBpVXJsID8/IEpVREdNRU5UX0FQSV9VUkw7XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb25maWcucHJvamVjdE5hbWU7XG4gICAgY29uc3Qgc2VyaWFsaXplciA9IGNvbmZpZy5zZXJpYWxpemVyID8/IHNhZmVTdHJpbmdpZnk7XG5cbiAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJwcm9qZWN0TmFtZSBpcyByZXF1aXJlZCBmb3IgT2ZmbGluZVRyYWNlclwiKTtcbiAgICB9XG4gICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImFwaUtleSBpcyByZXF1aXJlZCBmb3IgT2ZmbGluZVRyYWNlclwiKTtcbiAgICB9XG4gICAgaWYgKCFvcmdhbml6YXRpb25JZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwib3JnYW5pemF0aW9uSWQgaXMgcmVxdWlyZWQgZm9yIE9mZmxpbmVUcmFjZXJcIik7XG4gICAgfVxuICAgIGlmICghYXBpVXJsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcGlVcmwgaXMgcmVxdWlyZWQgZm9yIE9mZmxpbmVUcmFjZXJcIik7XG4gICAgfVxuXG4gICAgY29uc3QgY2xpZW50ID0gbmV3IEp1ZGdtZW50QXBpQ2xpZW50KGFwaVVybCwgYXBpS2V5LCBvcmdhbml6YXRpb25JZCk7XG4gICAgbGV0IHByb2plY3RJZDogc3RyaW5nO1xuICAgIHRyeSB7XG4gICAgICBwcm9qZWN0SWQgPSBhd2FpdCByZXNvbHZlUHJvamVjdElkKGNsaWVudCwgcHJvamVjdE5hbWUpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgUHJvamVjdCAnJHtwcm9qZWN0TmFtZX0nIG5vdCBmb3VuZDsgY2Fubm90IHN0YXJ0IE9mZmxpbmVUcmFjZXI6ICR7U3RyaW5nKGVycil9YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb3VyY2VBdHRyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIFwic2VydmljZS5uYW1lXCI6IHByb2plY3ROYW1lLFxuICAgICAgXCJ0ZWxlbWV0cnkuc2RrLm5hbWVcIjogXCJqdWRnZXZhbFwiLFxuICAgICAgXCJ0ZWxlbWV0cnkuc2RrLnZlcnNpb25cIjogVkVSU0lPTixcbiAgICAgIFwianVkZ21lbnQub2ZmbGluZVwiOiBcInRydWVcIixcbiAgICB9O1xuICAgIGlmIChjb25maWcuZW52aXJvbm1lbnQpIHtcbiAgICAgIHJlc291cmNlQXR0cnNbXCJkZXBsb3ltZW50LmVudmlyb25tZW50XCJdID0gY29uZmlnLmVudmlyb25tZW50O1xuICAgIH1cbiAgICBpZiAoY29uZmlnLnJlc291cmNlQXR0cmlidXRlcykge1xuICAgICAgT2JqZWN0LmFzc2lnbihyZXNvdXJjZUF0dHJzLCBjb25maWcucmVzb3VyY2VBdHRyaWJ1dGVzKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNvdXJjZSA9IGRlZmF1bHRSZXNvdXJjZSgpLm1lcmdlKFxuICAgICAgcmVzb3VyY2VGcm9tQXR0cmlidXRlcyhyZXNvdXJjZUF0dHJzKSxcbiAgICApO1xuXG4gICAgY29uc3QgdHJhY2VyID0gbmV3IE9mZmxpbmVUcmFjZXIoe1xuICAgICAgcHJvamVjdE5hbWUsXG4gICAgICBwcm9qZWN0SWQsXG4gICAgICBhcGlLZXksXG4gICAgICBvcmdhbml6YXRpb25JZCxcbiAgICAgIGFwaVVybCxcbiAgICAgIGVudmlyb25tZW50OiBjb25maWcuZW52aXJvbm1lbnQgPz8gbnVsbCxcbiAgICAgIHNlcmlhbGl6ZXIsXG4gICAgICB0cmFjZXJQcm92aWRlcjogbmV3IE5vZGVUcmFjZXJQcm92aWRlcih7IHJlc291cmNlIH0pLFxuICAgICAgY2xpZW50LFxuICAgICAgZGF0YXNldDogY29uZmlnLmRhdGFzZXQsXG4gICAgICBleGFtcGxlRmllbGRzOiB7IC4uLihjb25maWcuZXhhbXBsZUZpZWxkcyA/PyB7fSkgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHByb3ZpZGVyV2l0aFByb2Nlc3NvciA9IG5ldyBOb2RlVHJhY2VyUHJvdmlkZXIoe1xuICAgICAgcmVzb3VyY2UsXG4gICAgICBzYW1wbGVyOiBjb25maWcuc2FtcGxlcixcbiAgICAgIHNwYW5MaW1pdHM6IGNvbmZpZy5zcGFuTGltaXRzLFxuICAgICAgc3BhblByb2Nlc3NvcnM6IFtcbiAgICAgICAgdHJhY2VyLmdldFNwYW5Qcm9jZXNzb3IoKSxcbiAgICAgICAgLi4uKGNvbmZpZy5zcGFuUHJvY2Vzc29ycyA/PyBbXSksXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHRyYWNlci5fdHJhY2VyUHJvdmlkZXIgPSBwcm92aWRlcldpdGhQcm9jZXNzb3I7XG5cbiAgICBjb25zdCBwcm94eSA9IEp1ZGdtZW50VHJhY2VyUHJvdmlkZXIuZ2V0SW5zdGFuY2UoKTtcbiAgICBwcm94eS5yZWdpc3Rlcih0cmFjZXIpO1xuXG4gICAgaWYgKGNvbmZpZy5zZXRBY3RpdmUgPz8gdHJ1ZSkge1xuICAgICAgdHJhY2VyLnNldEFjdGl2ZSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0cmFjZXI7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBvZmZsaW5lIHNwYW4gZXhwb3J0ZXIgZm9yIHRoaXMgdHJhY2VyLlxuICAgKlxuICAgKiBUYXJnZXRzIHRoZSBwcm9qZWN0J3Mgb2ZmbGluZSBPVExQIGVuZHBvaW50LiBDcmVkZW50aWFscyBhcmVcbiAgICogZ3VhcmFudGVlZCBwcmVzZW50ICh2YWxpZGF0ZWQgaW4gYGNyZWF0ZWApLlxuICAgKi9cbiAgZ2V0U3BhbkV4cG9ydGVyKCk6IEp1ZGdtZW50U3BhbkV4cG9ydGVyIHtcbiAgICBpZiAodGhpcy5fb2ZmbGluZVNwYW5FeHBvcnRlcikgcmV0dXJuIHRoaXMuX29mZmxpbmVTcGFuRXhwb3J0ZXI7XG4gICAgY29uc3QgYmFzZSA9IHRoaXMuX29mZmxpbmVBcGlVcmwuZW5kc1dpdGgoXCIvXCIpXG4gICAgICA/IHRoaXMuX29mZmxpbmVBcGlVcmwgKyBPRkZMSU5FX1RSQUNFU19QQVRIXG4gICAgICA6IHRoaXMuX29mZmxpbmVBcGlVcmwgKyBcIi9cIiArIE9GRkxJTkVfVFJBQ0VTX1BBVEg7XG4gICAgdGhpcy5fb2ZmbGluZVNwYW5FeHBvcnRlciA9IG5ldyBKdWRnbWVudFNwYW5FeHBvcnRlcihcbiAgICAgIGJhc2UsXG4gICAgICB0aGlzLl9vZmZsaW5lQXBpS2V5LFxuICAgICAgdGhpcy5fb2ZmbGluZU9yZ2FuaXphdGlvbklkLFxuICAgICAgdGhpcy5fb2ZmbGluZVByb2plY3RJZCxcbiAgICApO1xuICAgIHJldHVybiB0aGlzLl9vZmZsaW5lU3BhbkV4cG9ydGVyO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgb2ZmbGluZSBzcGFuIHByb2Nlc3NvciBmb3IgdGhpcyB0cmFjZXIuICovXG4gIGdldFNwYW5Qcm9jZXNzb3IoKTogT2ZmbGluZUp1ZGdtZW50U3BhblByb2Nlc3NvciB7XG4gICAgaWYgKHRoaXMuX29mZmxpbmVTcGFuUHJvY2Vzc29yKSByZXR1cm4gdGhpcy5fb2ZmbGluZVNwYW5Qcm9jZXNzb3I7XG4gICAgdGhpcy5fb2ZmbGluZVNwYW5Qcm9jZXNzb3IgPSBuZXcgT2ZmbGluZUp1ZGdtZW50U3BhblByb2Nlc3NvcihcbiAgICAgIHRoaXMsXG4gICAgICB0aGlzLmdldFNwYW5FeHBvcnRlcigpLFxuICAgICAge1xuICAgICAgICBkYXRhc2V0OiB0aGlzLl9kYXRhc2V0LFxuICAgICAgICBleGFtcGxlRmllbGRzOiB0aGlzLl9leGFtcGxlRmllbGRzLFxuICAgICAgfSxcbiAgICApO1xuICAgIHJldHVybiB0aGlzLl9vZmZsaW5lU3BhblByb2Nlc3NvcjtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBKVURHTUVOVF9BUElfS0VZLCBKVURHTUVOVF9BUElfVVJMLCBKVURHTUVOVF9PUkdfSUQgfSBmcm9tIFwiLi9lbnZcIjtcbmltcG9ydCB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4vaW50ZXJuYWwvYXBpXCI7XG5pbXBvcnQgeyByZXNvbHZlUHJvamVjdElkIH0gZnJvbSBcIi4vdXRpbHMvcmVzb2x2ZS1wcm9qZWN0LWlkXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi91dGlscy9sb2dnZXJcIjtcbmltcG9ydCB7IEV2YWx1YXRpb25GYWN0b3J5IH0gZnJvbSBcIi4vZXZhbHVhdGlvbi9FdmFsdWF0aW9uRmFjdG9yeVwiO1xuaW1wb3J0IHsgRGF0YXNldEZhY3RvcnkgfSBmcm9tIFwiLi9kYXRhc2V0cy9EYXRhc2V0RmFjdG9yeVwiO1xuaW1wb3J0IHsgQWdlbnRKdWRnZUZhY3RvcnkgfSBmcm9tIFwiLi9hZ2VudC1qdWRnZXMvQWdlbnRKdWRnZUZhY3RvcnlcIjtcbmltcG9ydCB0eXBlIHsgT2ZmbGluZVRyYWNlciwgT2ZmbGluZVRyYWNlckNvbmZpZyB9IGZyb20gXCIuL3RyYWNlL09mZmxpbmVUcmFjZXJcIjtcblxuLyoqXG4gKiBPcHRpb25zIGZvciB7QGxpbmsgSnVkZ2V2YWwub2ZmbGluZVRyYWNlcn0uXG4gKiBDcmVkZW50aWFscyBhbmQgYHByb2plY3ROYW1lYCBhcmUgdGFrZW4gZnJvbSB0aGUgcGFyZW50IGBKdWRnZXZhbGAgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCB0eXBlIEp1ZGdldmFsT2ZmbGluZVRyYWNlck9wdGlvbnMgPSBPbWl0PFxuICBPZmZsaW5lVHJhY2VyQ29uZmlnLFxuICBcInByb2plY3ROYW1lXCIgfCBcImFwaUtleVwiIHwgXCJvcmdhbml6YXRpb25JZFwiIHwgXCJhcGlVcmxcIlxuPjtcblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBKdWRnZXZhbCBjbGllbnQuXG4gKlxuICogQ3JlZGVudGlhbHMgYXJlIHJlc29sdmVkIGluIG9yZGVyOiBleHBsaWNpdCBhcmd1bWVudHMgZmlyc3QsIHRoZW5cbiAqIGVudmlyb25tZW50IHZhcmlhYmxlcyBgSlVER01FTlRfQVBJX0tFWWAsIGBKVURHTUVOVF9PUkdfSURgLCBhbmRcbiAqIGBKVURHTUVOVF9BUElfVVJMYC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBKdWRnZXZhbENvbmZpZyB7XG4gIC8qKiBUaGUgcHJvamVjdCBuYW1lIG9uIHRoZSBKdWRnbWVudCBwbGF0Zm9ybS4gKi9cbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgLyoqIEp1ZGdtZW50IEFQSSBrZXkuIERlZmF1bHRzIHRvIGBKVURHTUVOVF9BUElfS0VZYCBlbnYgdmFyLiAqL1xuICBhcGlLZXk/OiBzdHJpbmc7XG4gIC8qKiBKdWRnbWVudCBvcmdhbml6YXRpb24gSUQuIERlZmF1bHRzIHRvIGBKVURHTUVOVF9PUkdfSURgIGVudiB2YXIuICovXG4gIG9yZ2FuaXphdGlvbklkPzogc3RyaW5nO1xuICAvKiogSnVkZ21lbnQgQVBJIFVSTC4gRGVmYXVsdHMgdG8gYEpVREdNRU5UX0FQSV9VUkxgIGVudiB2YXIuICovXG4gIGFwaVVybD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaGUgbWFpbiBlbnRyeSBwb2ludCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgSnVkZ21lbnQgcGxhdGZvcm0uXG4gKlxuICogYEp1ZGdldmFsYCBjb25uZWN0cyB0byB5b3VyIEp1ZGdtZW50IHByb2plY3QgYW5kIGdpdmVzIHlvdSBhY2Nlc3MgdG9cbiAqIGV2YWx1YXRpb24sIGRhdGFzZXRzLCBhbmQgbW9uaXRvcmluZyB0aHJvdWdoIHRoZSBKdWRnbWVudCBwbGF0Zm9ybS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgSnVkZ2V2YWwgfSBmcm9tIFwianVkZ2V2YWxcIjtcbiAqXG4gKiBjb25zdCBjbGllbnQgPSBhd2FpdCBKdWRnZXZhbC5jcmVhdGUoeyBwcm9qZWN0TmFtZTogXCJteS1wcm9qZWN0XCIgfSk7XG4gKiBgYGBcbiAqXG4gKiBAdGhyb3dzIEVycm9yIGlmIGFueSByZXF1aXJlZCBjcmVkZW50aWFsIGlzIG1pc3NpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBKdWRnZXZhbCB7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2NsaWVudDogSnVkZ21lbnRBcGlDbGllbnQ7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3Byb2plY3ROYW1lOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3Byb2plY3RJZDogc3RyaW5nIHwgbnVsbDtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgIGNsaWVudDogSnVkZ21lbnRBcGlDbGllbnQsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGwsXG4gICkge1xuICAgIHRoaXMuX2NsaWVudCA9IGNsaWVudDtcbiAgICB0aGlzLl9wcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lO1xuICAgIHRoaXMuX3Byb2plY3RJZCA9IHByb2plY3RJZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgSnVkZ2V2YWwgY2xpZW50IGluc3RhbmNlLlxuICAgKlxuICAgKiBSZXNvbHZlcyB0aGUgYHByb2plY3ROYW1lYCB0byBhIGBwcm9qZWN0SWRgIHZpYSB0aGUgSnVkZ21lbnQgQVBJLlxuICAgKlxuICAgKiBAcGFyYW0gY29uZmlnIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zLiBDcmVkZW50aWFscyBkZWZhdWx0IHRvIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAgICogQHJldHVybnMgQSBuZXcgYEp1ZGdldmFsYCBpbnN0YW5jZS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBjb25zdCBjbGllbnQgPSBhd2FpdCBKdWRnZXZhbC5jcmVhdGUoe1xuICAgKiAgIHByb2plY3ROYW1lOiBcIm15LXByb2plY3RcIixcbiAgICogICBhcGlLZXk6IFwiPHlvdXItYXBpLWtleT5cIixcbiAgICogICBvcmdhbml6YXRpb25JZDogXCI8eW91ci1vcmdhbml6YXRpb24taWQ+XCIsXG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGUoY29uZmlnOiBKdWRnZXZhbENvbmZpZyk6IFByb21pc2U8SnVkZ2V2YWw+IHtcbiAgICBjb25zdCBhcGlLZXkgPSBjb25maWcuYXBpS2V5ID8/IEpVREdNRU5UX0FQSV9LRVk7XG4gICAgY29uc3Qgb3JnYW5pemF0aW9uSWQgPSBjb25maWcub3JnYW5pemF0aW9uSWQgPz8gSlVER01FTlRfT1JHX0lEO1xuICAgIGNvbnN0IGFwaVVybCA9IGNvbmZpZy5hcGlVcmwgPz8gSlVER01FTlRfQVBJX1VSTDtcblxuICAgIGlmICghYXBpS2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBUEkga2V5IGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIW9yZ2FuaXphdGlvbklkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPcmdhbml6YXRpb24gSUQgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmICghYXBpVXJsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBUEkgVVJMIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIWNvbmZpZy5wcm9qZWN0TmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUHJvamVjdCBuYW1lIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGNsaWVudCA9IG5ldyBKdWRnbWVudEFwaUNsaWVudChhcGlVcmwsIGFwaUtleSwgb3JnYW5pemF0aW9uSWQpO1xuICAgIGxldCBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICBwcm9qZWN0SWQgPSBhd2FpdCByZXNvbHZlUHJvamVjdElkKGNsaWVudCwgY29uZmlnLnByb2plY3ROYW1lKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgICBgUHJvamVjdCAnJHtjb25maWcucHJvamVjdE5hbWV9JyBub3QgZm91bmQuIGAgK1xuICAgICAgICAgIFwiU29tZSBvcGVyYXRpb25zIHJlcXVpcmluZyBwcm9qZWN0X2lkIHdpbGwgYmUgc2tpcHBlZC5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBKdWRnZXZhbChjbGllbnQsIGNvbmZpZy5wcm9qZWN0TmFtZSwgcHJvamVjdElkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW5kIGFjdGl2YXRlIGFuIGBPZmZsaW5lVHJhY2VyYCBmb3IgdGhpcyBwcm9qZWN0LlxuICAgKlxuICAgKiBSZXVzZXMgdGhlIGNyZWRlbnRpYWxzIHN1cHBsaWVkIHRvIHRoaXMgYEp1ZGdldmFsYCBpbnN0YW5jZS4gRWFjaFxuICAgKiBjb21wbGV0ZWQgcm9vdCBzcGFuIGFwcGVuZHMgYW4gYEV4YW1wbGVgIHRvIGBkYXRhc2V0YCwgY2FycnlpbmdcbiAgICogdGhlIG9mZmxpbmUgdHJhY2UgaWQgYW5kIHRoZSBzdGF0aWMgYGV4YW1wbGVGaWVsZHNgLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGNvbnN0IGp1ZGdldmFsID0gYXdhaXQgSnVkZ2V2YWwuY3JlYXRlKHsgcHJvamVjdE5hbWU6IFwibXktcHJvamVjdFwiIH0pO1xuICAgKiBjb25zdCBkYXRhc2V0OiBFeGFtcGxlW10gPSBbXTtcbiAgICogY29uc3QgdHJhY2VyID0gYXdhaXQganVkZ2V2YWwub2ZmbGluZVRyYWNlcih7XG4gICAqICAgZGF0YXNldCxcbiAgICogICBleGFtcGxlRmllbGRzOiB7IGlucHV0OiBpdGVtLmlucHV0LCBnb2xkZW5fb3V0cHV0OiBpdGVtLmdvbGRlbk91dHB1dCB9LFxuICAgKiB9KTtcbiAgICogYGBgXG4gICAqL1xuICBhc3luYyBvZmZsaW5lVHJhY2VyKFxuICAgIG9wdGlvbnM6IEp1ZGdldmFsT2ZmbGluZVRyYWNlck9wdGlvbnMsXG4gICk6IFByb21pc2U8T2ZmbGluZVRyYWNlcj4ge1xuICAgIGNvbnN0IHsgT2ZmbGluZVRyYWNlciB9ID0gYXdhaXQgaW1wb3J0KFwiLi90cmFjZS9PZmZsaW5lVHJhY2VyXCIpO1xuICAgIHJldHVybiBPZmZsaW5lVHJhY2VyLmNyZWF0ZSh7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgcHJvamVjdE5hbWU6IHRoaXMuX3Byb2plY3ROYW1lLFxuICAgICAgYXBpS2V5OiB0aGlzLl9jbGllbnQuZ2V0QXBpS2V5KCksXG4gICAgICBvcmdhbml6YXRpb25JZDogdGhpcy5fY2xpZW50LmdldE9yZ2FuaXphdGlvbklkKCksXG4gICAgICBhcGlVcmw6IHRoaXMuX2NsaWVudC5nZXRCYXNlVXJsKCksXG4gICAgfSk7XG4gIH1cblxuICAvKiogQWNjZXNzIGRhdGFzZXQgbWFuYWdlbWVudCAoY3JlYXRlLCBnZXQsIGxpc3QpLiAqL1xuICBnZXQgZGF0YXNldHMoKTogRGF0YXNldEZhY3Rvcnkge1xuICAgIHJldHVybiBuZXcgRGF0YXNldEZhY3RvcnkodGhpcy5fY2xpZW50LCB0aGlzLl9wcm9qZWN0SWQsIHRoaXMuX3Byb2plY3ROYW1lKTtcbiAgfVxuXG4gIC8qKiBBY2Nlc3MgZXZhbHVhdGlvbiAoY3JlYXRlIGV2YWx1YXRpb24gcnVucykuICovXG4gIGdldCBldmFsdWF0aW9uKCk6IEV2YWx1YXRpb25GYWN0b3J5IHtcbiAgICByZXR1cm4gbmV3IEV2YWx1YXRpb25GYWN0b3J5KFxuICAgICAgdGhpcy5fY2xpZW50LFxuICAgICAgdGhpcy5fcHJvamVjdElkLFxuICAgICAgdGhpcy5fcHJvamVjdE5hbWUsXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBNYW5hZ2UgQWdlbnQgSnVkZ2VzIChwcm9tcHQtYmFzZWQgc2NvcmVycykgb24gdGhlIHBsYXRmb3JtLiAqL1xuICBnZXQgYWdlbnRKdWRnZXMoKTogQWdlbnRKdWRnZUZhY3Rvcnkge1xuICAgIHJldHVybiBuZXcgQWdlbnRKdWRnZUZhY3RvcnkoXG4gICAgICB0aGlzLl9jbGllbnQsXG4gICAgICB0aGlzLl9wcm9qZWN0SWQsXG4gICAgICB0aGlzLl9wcm9qZWN0TmFtZSxcbiAgICApO1xuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgRXhhbXBsZSB9IGZyb20gXCIuLi9kYXRhL0V4YW1wbGVcIjtcbmltcG9ydCB0eXBlIHsgQmFzZVJlc3BvbnNlIH0gZnJvbSBcIi4vcmVzcG9uc2VzXCI7XG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgYnVpbGRpbmcgY3VzdG9tIGV2YWx1YXRpb24gc2NvcmVycy5cbiAqXG4gKiBTdWJjbGFzcyBgSnVkZ2VgIGFuZCBpbXBsZW1lbnQgdGhlIGBzY29yZWAgbWV0aG9kIHRvIGNyZWF0ZSB5b3VyIG93blxuICogZXZhbHVhdGlvbiBsb2dpYy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY2xhc3MgQ29udGFpbnNBbnN3ZXIgZXh0ZW5kcyBKdWRnZTxCaW5hcnlSZXNwb25zZT4ge1xuICogICBhc3luYyBzY29yZShkYXRhOiBFeGFtcGxlKTogUHJvbWlzZTxCaW5hcnlSZXNwb25zZT4ge1xuICogICAgIGNvbnN0IGV4cGVjdGVkID0gKGRhdGEuZ2V0KFwiZXhwZWN0ZWRfb3V0cHV0XCIpIGFzIHN0cmluZykudG9Mb3dlckNhc2UoKTtcbiAqICAgICBjb25zdCBhY3R1YWwgPSAoZGF0YS5nZXQoXCJhY3R1YWxfb3V0cHV0XCIpIGFzIHN0cmluZykudG9Mb3dlckNhc2UoKTtcbiAqICAgICByZXR1cm4ge1xuICogICAgICAgdmFsdWU6IGFjdHVhbC5pbmNsdWRlcyhleHBlY3RlZCksXG4gKiAgICAgICByZWFzb246IGFjdHVhbC5pbmNsdWRlcyhleHBlY3RlZCkgPyBcIkZvdW5kXCIgOiBcIk5vdCBmb3VuZFwiLFxuICogICAgIH07XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSnVkZ2U8UiBleHRlbmRzIEJhc2VSZXNwb25zZSA9IEJhc2VSZXNwb25zZT4ge1xuICAvKiogRXZhbHVhdGUgYSBzaW5nbGUgZXhhbXBsZSBhbmQgcmV0dXJuIGEgc2NvcmUuICovXG4gIGFic3RyYWN0IHNjb3JlKGRhdGE6IEV4YW1wbGUpOiBQcm9taXNlPFI+O1xufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9jbGllbnRcIjtcbmltcG9ydCB0eXBlIHsgRXhhbXBsZSB9IGZyb20gXCIuLi9kYXRhL0V4YW1wbGVcIjtcbmltcG9ydCB0eXBlIHsgU2NvcmluZ1Jlc3VsdCB9IGZyb20gXCIuLi9kYXRhL1Njb3JpbmdSZXN1bHRcIjtcbmltcG9ydCB7IEp1ZGdlIH0gZnJvbSBcIi4uL2p1ZGdlcy9KdWRnZVwiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2xvZ2dlclwiO1xuaW1wb3J0IHsgTG9jYWxFdmFsdWF0b3JSdW5uZXIgfSBmcm9tIFwiLi9Mb2NhbEV2YWx1YXRvclJ1bm5lclwiO1xuaW1wb3J0IHsgSG9zdGVkRXZhbHVhdG9yUnVubmVyIH0gZnJvbSBcIi4vSG9zdGVkRXZhbHVhdG9yUnVubmVyXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXZhbHVhdGlvblJ1bk9wdGlvbnMge1xuICAvKiogVGhlIGV4YW1wbGVzIHRvIGV2YWx1YXRlLiAqL1xuICBleGFtcGxlczogRXhhbXBsZVtdO1xuICAvKipcbiAgICogSG9zdGVkIHNjb3JlciBuYW1lcyAoc3RyaW5ncyBsaWtlIGBcImZhaXRoZnVsbmVzc1wiYCkgKipvcioqXG4gICAqIGN1c3RvbSBgSnVkZ2VgIGluc3RhbmNlcy4gQ2Fubm90IG1peCBib3RoLlxuICAgKi9cbiAgc2NvcmVyczogc3RyaW5nW10gfCBKdWRnZVtdO1xuICAvKiogQSBuYW1lIGZvciB0aGlzIHJ1biwgdmlzaWJsZSBpbiB0aGUgZGFzaGJvYXJkLiAqL1xuICBldmFsUnVuTmFtZTogc3RyaW5nO1xuICAvKipcbiAgICogSWYgdHJ1ZSwgdGhyb3dzIGFuIGVycm9yIHdoZW4gYW55IHNjb3JlciBmYWlscyBpdHMgdGhyZXNob2xkLlxuICAgKiBVc2VmdWwgaW4gQ0kvQ0QgcGlwZWxpbmVzLlxuICAgKi9cbiAgYXNzZXJ0VGVzdD86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBNYXhpbXVtIHNlY29uZHMgdG8gd2FpdCBmb3IgaG9zdGVkIHNjb3JlciByZXN1bHRzIGJlZm9yZSB0aW1pbmcgb3V0LlxuICAgKiBAZGVmYXVsdCAzMDBcbiAgICovXG4gIHRpbWVvdXRTZWNvbmRzPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIFNjb3JlIGEgYmF0Y2ggb2YgZXhhbXBsZXMgdXNpbmcgaG9zdGVkIHNjb3JlcnMgb3IgY3VzdG9tIGp1ZGdlcy5cbiAqXG4gKiBUd28gbW9kZXMgYXJlIHN1cHBvcnRlZDpcbiAqXG4gKiAtICoqSG9zdGVkIHNjb3JlcnMqKiDigJQgcGFzcyBzY29yZXIgbmFtZXMgYXMgc3RyaW5ncyAoZS5nLlxuICogICBgXCJmYWl0aGZ1bG5lc3NcImAsIGBcImFuc3dlcl9yZWxldmFuY3lcImApLiBFdmFsdWF0aW9uIHJ1bnMgc2VydmVyLXNpZGVcbiAqICAgb24gdGhlIEp1ZGdtZW50IHBsYXRmb3JtLlxuICogLSAqKkN1c3RvbSBqdWRnZXMqKiDigJQgcGFzcyB7QGxpbmsgSnVkZ2V9IHN1YmNsYXNzIGluc3RhbmNlcyBmb3JcbiAqICAgaW4tcHJvY2VzcyBldmFsdWF0aW9uIHdpdGggeW91ciBvd24gc2NvcmluZyBsb2dpYy5cbiAqXG4gKiBDcmVhdGUgYW4gYEV2YWx1YXRpb25gIHZpYSBgY2xpZW50LmV2YWx1YXRpb24uY3JlYXRlKClgLCB0aGVuIGNhbGxcbiAqIGAucnVuKClgIHRvIGV4ZWN1dGUgc2NvcmVycyBhZ2FpbnN0IHlvdXIgZXhhbXBsZXMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGV2YWx1YXRpb24gPSBjbGllbnQuZXZhbHVhdGlvbi5jcmVhdGUoKTtcbiAqIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBldmFsdWF0aW9uLnJ1bih7XG4gKiAgIGV4YW1wbGVzLFxuICogICBzY29yZXJzOiBbXCJmYWl0aGZ1bG5lc3NcIiwgXCJhbnN3ZXJfcmVsZXZhbmN5XCJdLFxuICogICBldmFsUnVuTmFtZTogXCJuaWdodGx5LWV2YWxcIixcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBFdmFsdWF0aW9uIHtcbiAgcHJpdmF0ZSByZWFkb25seSBfbG9jYWw6IExvY2FsRXZhbHVhdG9yUnVubmVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9ob3N0ZWQ6IEhvc3RlZEV2YWx1YXRvclJ1bm5lcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjbGllbnQ6IEp1ZGdtZW50QXBpQ2xpZW50LFxuICAgIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbCxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICApIHtcbiAgICB0aGlzLl9sb2NhbCA9IG5ldyBMb2NhbEV2YWx1YXRvclJ1bm5lcihjbGllbnQsIHByb2plY3RJZCwgcHJvamVjdE5hbWUpO1xuICAgIHRoaXMuX2hvc3RlZCA9IG5ldyBIb3N0ZWRFdmFsdWF0b3JSdW5uZXIoY2xpZW50LCBwcm9qZWN0SWQsIHByb2plY3ROYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSdW4gc2NvcmVycyBhZ2FpbnN0IHlvdXIgZXhhbXBsZXMgYW5kIHJldHVybiByZXN1bHRzLlxuICAgKlxuICAgKiBQYXNzICoqZWl0aGVyKiogaG9zdGVkIHNjb3JlciBuYW1lcyAoc3RyaW5ncykgKipvcioqIGN1c3RvbSB7QGxpbmsgSnVkZ2V9XG4gICAqIGluc3RhbmNlcy4gTWl4aW5nIGJvdGggaW4gb25lIGNhbGwgaXMgbm90IHN1cHBvcnRlZC5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgLSBFdmFsdWF0aW9uIGNvbmZpZ3VyYXRpb24gaW5jbHVkaW5nIGV4YW1wbGVzLCBzY29yZXJzLCBhbmQgcnVuIG5hbWUuXG4gICAqIEByZXR1cm5zIEEgbGlzdCBvZiB7QGxpbmsgU2NvcmluZ1Jlc3VsdH0gb2JqZWN0cywgb25lIHBlciBleGFtcGxlLlxuICAgKi9cbiAgcnVuKG9wdGlvbnM6IEV2YWx1YXRpb25SdW5PcHRpb25zKTogUHJvbWlzZTxTY29yaW5nUmVzdWx0W10+IHtcbiAgICBjb25zdCB7XG4gICAgICBleGFtcGxlcyxcbiAgICAgIHNjb3JlcnMsXG4gICAgICBldmFsUnVuTmFtZSxcbiAgICAgIGFzc2VydFRlc3QgPSBmYWxzZSxcbiAgICAgIHRpbWVvdXRTZWNvbmRzID0gMzAwLFxuICAgIH0gPSBvcHRpb25zO1xuXG4gICAgY29uc3QgaG9zdGVkU2NvcmVycyA9IHNjb3JlcnMuZmlsdGVyKFxuICAgICAgKHMpOiBzIGlzIHN0cmluZyA9PiB0eXBlb2YgcyA9PT0gXCJzdHJpbmdcIixcbiAgICApO1xuICAgIGNvbnN0IGxvY2FsU2NvcmVycyA9IHNjb3JlcnMuZmlsdGVyKChzKTogcyBpcyBKdWRnZSA9PiBzIGluc3RhbmNlb2YgSnVkZ2UpO1xuXG4gICAgaWYgKGxvY2FsU2NvcmVycy5sZW5ndGggPiAwICYmIGhvc3RlZFNjb3JlcnMubGVuZ3RoID4gMCkge1xuICAgICAgTG9nZ2VyLmVycm9yKFxuICAgICAgICBcIlJ1bm5pbmcgYm90aCBsb2NhbCBhbmQgaG9zdGVkIHNjb3JlcnMgaXMgbm90IHN1cHBvcnRlZC4gXCIgK1xuICAgICAgICAgIFwiUGxlYXNlIHJ1biB5b3VyIGV2YWx1YXRpb24gd2l0aCBlaXRoZXIgbG9jYWwgb3IgaG9zdGVkIHNjb3JlcnMsIGJ1dCBub3QgYm90aC5cIixcbiAgICAgICk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgICB9XG4gICAgaWYgKGxvY2FsU2NvcmVycy5sZW5ndGggPT09IDAgJiYgaG9zdGVkU2NvcmVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIExvZ2dlci5lcnJvcihcbiAgICAgICAgXCJObyB2YWxpZCBsb2NhbCBvciBob3N0ZWQgc2NvcmVycyBwcm92aWRlZC4gXCIgK1xuICAgICAgICAgIFwiUGxlYXNlIHByb3ZpZGUgYXQgbGVhc3Qgb25lIGxvY2FsIG9yIGhvc3RlZCBzY29yZXIuXCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG4gICAgfVxuXG4gICAgaWYgKGxvY2FsU2NvcmVycy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbG9jYWwucnVuKFxuICAgICAgICBleGFtcGxlcyxcbiAgICAgICAgbG9jYWxTY29yZXJzLFxuICAgICAgICBldmFsUnVuTmFtZSxcbiAgICAgICAgYXNzZXJ0VGVzdCxcbiAgICAgICAgdGltZW91dFNlY29uZHMsXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9ob3N0ZWQucnVuKFxuICAgICAgZXhhbXBsZXMsXG4gICAgICBob3N0ZWRTY29yZXJzLFxuICAgICAgZXZhbFJ1bk5hbWUsXG4gICAgICBhc3NlcnRUZXN0LFxuICAgICAgdGltZW91dFNlY29uZHMsXG4gICAgKTtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgcGMgZnJvbSBcInBpY29jb2xvcnNcIjtcbmltcG9ydCB0eXBlIHsgRXhhbXBsZUV2YWx1YXRpb25SdW4gfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpL21vZGVscy9FeGFtcGxlRXZhbHVhdGlvblJ1blwiO1xuaW1wb3J0IHR5cGUgeyBMb2NhbFNjb3JlclJlc3VsdCB9IGZyb20gXCIuLi9pbnRlcm5hbC9hcGkvbW9kZWxzL0xvY2FsU2NvcmVyUmVzdWx0XCI7XG5pbXBvcnQgdHlwZSB7IEV4YW1wbGUgfSBmcm9tIFwiLi4vZGF0YS9FeGFtcGxlXCI7XG5pbXBvcnQgdHlwZSB7IEp1ZGdlIH0gZnJvbSBcIi4uL2p1ZGdlcy9KdWRnZVwiO1xuaW1wb3J0IHR5cGUgeyBCYXNlUmVzcG9uc2UgfSBmcm9tIFwiLi4vanVkZ2VzL3Jlc3BvbnNlc1wiO1xuaW1wb3J0IHsgRXZhbHVhdG9yUnVubmVyIH0gZnJvbSBcIi4vRXZhbHVhdG9yUnVubmVyXCI7XG5cbmludGVyZmFjZSBTY29yZXJKb2JSZXN1bHQge1xuICBleGFtcGxlSWR4OiBudW1iZXI7XG4gIHNjb3JlcjogSnVkZ2U7XG4gIHJlc3VsdDogQmFzZVJlc3BvbnNlIHwgbnVsbDtcbiAgZXJyb3I6IHN0cmluZyB8IG51bGw7XG59XG5cbi8qKlxuICogRXZhbHVhdGlvbiBydW5uZXIgZm9yIGN1c3RvbSAoaW4tcHJvY2Vzcykgc2NvcmVycy5cbiAqXG4gKiBSdW5zIGFsbCB7QGxpbmsgSnVkZ2V9IGluc3RhbmNlcyBsb2NhbGx5IGFnYWluc3QgdGhlIHByb3ZpZGVkIGV4YW1wbGVzLFxuICogcG9zdHMgcmVzdWx0cyB0byB0aGUgSnVkZ21lbnQgcGxhdGZvcm0sIHRoZW4gcG9sbHMgZm9yIGZpbmFsaXplZCBzY29yZXMuXG4gKiBVc2VkIGludGVybmFsbHkgYnkge0BsaW5rIEV2YWx1YXRpb259LlxuICovXG5leHBvcnQgY2xhc3MgTG9jYWxFdmFsdWF0b3JSdW5uZXIgZXh0ZW5kcyBFdmFsdWF0b3JSdW5uZXI8SnVkZ2U+IHtcbiAgcHJvdGVjdGVkIF9idWlsZFBheWxvYWQoXG4gICAgZXZhbElkOiBzdHJpbmcsXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgZXZhbFJ1bk5hbWU6IHN0cmluZyxcbiAgICBjcmVhdGVkQXQ6IHN0cmluZyxcbiAgICBleGFtcGxlczogRXhhbXBsZVtdLFxuICAgIF9zY29yZXJzOiBKdWRnZVtdLFxuICApOiBFeGFtcGxlRXZhbHVhdGlvblJ1biB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBldmFsSWQsXG4gICAgICBwcm9qZWN0X2lkOiBwcm9qZWN0SWQsXG4gICAgICBldmFsX25hbWU6IGV2YWxSdW5OYW1lLFxuICAgICAgY3JlYXRlZF9hdDogY3JlYXRlZEF0LFxuICAgICAgZXhhbXBsZXM6IGV4YW1wbGVzLm1hcCgoZSkgPT4gZS50b0pTT04oKSksXG4gICAgICBqdWRnbWVudF9zY29yZXJzOiBbXSxcbiAgICAgIGN1c3RvbV9zY29yZXJzOiBbXSxcbiAgICB9O1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIF9zdWJtaXQoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgX2V2YWxJZDogc3RyaW5nLFxuICAgIGV4YW1wbGVzOiBFeGFtcGxlW10sXG4gICAgc2NvcmVyczogSnVkZ2VbXSxcbiAgICBwYXlsb2FkOiBFeGFtcGxlRXZhbHVhdGlvblJ1bixcbiAgKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3Qgam9iczogUHJvbWlzZTxTY29yZXJKb2JSZXN1bHQ+W10gPSBleGFtcGxlcy5mbGF0TWFwKFxuICAgICAgKGV4YW1wbGUsIGV4YW1wbGVJZHgpID0+XG4gICAgICAgIHNjb3JlcnMubWFwKChzY29yZXIpID0+XG4gICAgICAgICAgc2NvcmVyXG4gICAgICAgICAgICAuc2NvcmUoZXhhbXBsZSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAocmVzdWx0KTogU2NvcmVySm9iUmVzdWx0ID0+ICh7XG4gICAgICAgICAgICAgICAgZXhhbXBsZUlkeCxcbiAgICAgICAgICAgICAgICBzY29yZXIsXG4gICAgICAgICAgICAgICAgcmVzdWx0LFxuICAgICAgICAgICAgICAgIGVycm9yOiBudWxsLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5jYXRjaChcbiAgICAgICAgICAgICAgKGVycjogdW5rbm93bik6IFNjb3JlckpvYlJlc3VsdCA9PiAoe1xuICAgICAgICAgICAgICAgIGV4YW1wbGVJZHgsXG4gICAgICAgICAgICAgICAgc2NvcmVyLFxuICAgICAgICAgICAgICAgIHJlc3VsdDogbnVsbCxcbiAgICAgICAgICAgICAgICBlcnJvcjogU3RyaW5nKGVyciksXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgKSxcbiAgICApO1xuXG4gICAgY29uc3Qgam9iUmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKGpvYnMpO1xuICAgIGNvbnN0IGVsYXBzZWQgPSAoKERhdGUubm93KCkgLSBzdGFydFRpbWUpIC8gMTAwMCkudG9GaXhlZCgxKTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGAke3BjLmdyZWVuKFwiXFx1MjcxM1wiKX0gU2NvcmluZyBjb21wbGV0ZWQgaW4gJHtwYy5ib2xkKGAke2VsYXBzZWR9c2ApfWAsXG4gICAgKTtcblxuICAgIC8vIEdyb3VwIGJ5IGV4YW1wbGUgaW5kZXhcbiAgICBjb25zdCBieUV4YW1wbGUgPSBuZXcgTWFwPG51bWJlciwgU2NvcmVySm9iUmVzdWx0W10+KCk7XG4gICAgZm9yIChjb25zdCBqciBvZiBqb2JSZXN1bHRzKSB7XG4gICAgICBsZXQgbGlzdCA9IGJ5RXhhbXBsZS5nZXQoanIuZXhhbXBsZUlkeCk7XG4gICAgICBpZiAoIWxpc3QpIHtcbiAgICAgICAgbGlzdCA9IFtdO1xuICAgICAgICBieUV4YW1wbGUuc2V0KGpyLmV4YW1wbGVJZHgsIGxpc3QpO1xuICAgICAgfVxuICAgICAgbGlzdC5wdXNoKGpyKTtcbiAgICB9XG5cbiAgICBjb25zdCBhcGlSZXN1bHRzOiBMb2NhbFNjb3JlclJlc3VsdFtdID0gZXhhbXBsZXMubWFwKChleGFtcGxlLCBpKSA9PiB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gYnlFeGFtcGxlLmdldChpKSA/PyBbXTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNjb3JlcnNfZGF0YTogZW50cmllcy5tYXAoKGpyKSA9PiB7XG4gICAgICAgICAgaWYgKGpyLmVycm9yICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzY29yZXJfbmFtZToganIuc2NvcmVyLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICAgICAgICAgIHZhbHVlOiAwLFxuICAgICAgICAgICAgICByZWFzb246IFwiXCIsXG4gICAgICAgICAgICAgIGVycm9yOiBqci5lcnJvcixcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHIgPSBqci5yZXN1bHQhO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzY29yZXJfbmFtZToganIuc2NvcmVyLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICAgICAgICB2YWx1ZTogci52YWx1ZSxcbiAgICAgICAgICAgIHJlYXNvbjogci5yZWFzb24sXG4gICAgICAgICAgICAuLi4oci5jaXRhdGlvbnMgJiYge1xuICAgICAgICAgICAgICBjaXRhdGlvbnM6IHIuY2l0YXRpb25zLm1hcCgoYykgPT4gKHtcbiAgICAgICAgICAgICAgICBzcGFuX2lkOiBjLnNwYW5JZCxcbiAgICAgICAgICAgICAgICBzcGFuX2F0dHJpYnV0ZTogYy5zcGFuQXR0cmlidXRlLFxuICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9O1xuICAgICAgICB9KSxcbiAgICAgICAgZGF0YV9vYmplY3Q6IGV4YW1wbGUudG9KU09OKCksXG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5fY2xpZW50LnBvc3RWMXByb2plY3RzRXZhbFJlc3VsdHNFeGFtcGxlcyhwcm9qZWN0SWQsIHtcbiAgICAgIHJlc3VsdHM6IGFwaVJlc3VsdHMsXG4gICAgICBydW46IHBheWxvYWQsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gZXhhbXBsZXMubGVuZ3RoO1xuICB9XG59XG4iLAogICAgImltcG9ydCBwYyBmcm9tIFwicGljb2NvbG9yc1wiO1xuaW1wb3J0IHR5cGUgeyBKdWRnbWVudEFwaUNsaWVudCB9IGZyb20gXCIuLi9pbnRlcm5hbC9hcGkvY2xpZW50XCI7XG5pbXBvcnQgdHlwZSB7IEV4YW1wbGVFdmFsdWF0aW9uUnVuIH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9tb2RlbHMvRXhhbXBsZUV2YWx1YXRpb25SdW5cIjtcbmltcG9ydCB0eXBlIHsgRXhwZXJpbWVudFJ1bkl0ZW0gfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpL21vZGVscy9FeHBlcmltZW50UnVuSXRlbVwiO1xuaW1wb3J0IHR5cGUgeyBFeGFtcGxlIH0gZnJvbSBcIi4uL2RhdGEvRXhhbXBsZVwiO1xuaW1wb3J0IHR5cGUgeyBTY29yaW5nUmVzdWx0IH0gZnJvbSBcIi4uL2RhdGEvU2NvcmluZ1Jlc3VsdFwiO1xuaW1wb3J0IHR5cGUgeyBKdWRnZSB9IGZyb20gXCIuLi9qdWRnZXMvSnVkZ2VcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuLi91dGlscy9sb2dnZXJcIjtcblxuY29uc3QgUE9MTF9JTlRFUlZBTF9NUyA9IDIwMDA7XG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBmb3IgZXZhbHVhdGlvbiBydW5uZXJzLlxuICpcbiAqIFByb3ZpZGVzIHRoZSBzaGFyZWQgcnVuIC0+IHBvbGwgLT4gZGlzcGxheSBmbG93LlxuICogU3ViY2xhc3NlcyBpbXBsZW1lbnQgYF9idWlsZFBheWxvYWRgIGFuZCBgX3N1Ym1pdGAgZm9yIGxvY2FsIHZzIGhvc3RlZCBtb2RlLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXZhbHVhdG9yUnVubmVyPFMgZXh0ZW5kcyBzdHJpbmcgfCBKdWRnZT4ge1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX2NsaWVudDogSnVkZ21lbnRBcGlDbGllbnQ7XG4gIHByb3RlY3RlZCByZWFkb25seSBfcHJvamVjdElkOiBzdHJpbmcgfCBudWxsO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX3Byb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudCxcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGwsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgKSB7XG4gICAgdGhpcy5fY2xpZW50ID0gY2xpZW50O1xuICAgIHRoaXMuX3Byb2plY3RJZCA9IHByb2plY3RJZDtcbiAgICB0aGlzLl9wcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFic3RyYWN0IF9idWlsZFBheWxvYWQoXG4gICAgZXZhbElkOiBzdHJpbmcsXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgZXZhbFJ1bk5hbWU6IHN0cmluZyxcbiAgICBjcmVhdGVkQXQ6IHN0cmluZyxcbiAgICBleGFtcGxlczogRXhhbXBsZVtdLFxuICAgIHNjb3JlcnM6IFNbXSxcbiAgKTogRXhhbXBsZUV2YWx1YXRpb25SdW47XG5cbiAgcHJvdGVjdGVkIGFic3RyYWN0IF9zdWJtaXQoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgZXZhbElkOiBzdHJpbmcsXG4gICAgZXhhbXBsZXM6IEV4YW1wbGVbXSxcbiAgICBzY29yZXJzOiBTW10sXG4gICAgcGF5bG9hZDogRXhhbXBsZUV2YWx1YXRpb25SdW4sXG4gICk6IFByb21pc2U8bnVtYmVyPjtcblxuICBwcm90ZWN0ZWQgYXN5bmMgX3BvbGwoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgZXZhbElkOiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRDb3VudDogbnVtYmVyLFxuICAgIHRpbWVvdXRTZWNvbmRzOiBudW1iZXIsXG4gICk6IFByb21pc2U8eyByZXN1bHRzOiBFeHBlcmltZW50UnVuSXRlbVtdOyB1cmw6IHN0cmluZyB9PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBlbGFwc2VkID0gKERhdGUubm93KCkgLSBzdGFydFRpbWUpIC8gMTAwMDtcbiAgICAgIGlmIChlbGFwc2VkID4gdGltZW91dFNlY29uZHMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdmFsdWF0aW9uIHRpbWVkIG91dCBhZnRlciAke3RpbWVvdXRTZWNvbmRzfXNgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLl9jbGllbnQuZ2V0VjFwcm9qZWN0c0V4cGVyaW1lbnRzQnlSdW5JZChcbiAgICAgICAgcHJvamVjdElkLFxuICAgICAgICBldmFsSWQsXG4gICAgICApO1xuICAgICAgY29uc3QgcmVzdWx0c0RhdGEgPSByZXNwb25zZS5yZXN1bHRzID8/IFtdO1xuICAgICAgY29uc3QgY29tcGxldGVkID0gcmVzdWx0c0RhdGEubGVuZ3RoO1xuXG4gICAgICBpZiAoY29tcGxldGVkID49IGV4cGVjdGVkQ291bnQpIHtcbiAgICAgICAgY29uc3QgdXJsID0gcmVzcG9uc2UudWlfcmVzdWx0c191cmwgPz8gXCJGYWlsZWQgdG8gZ2V0IFVJIHJlc3VsdHMgVVJMXCI7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGAke3BjLmdyZWVuKFwiXFx1MjcxM1wiKX0gRXZhbHMgY29tcGxldGVkIGFuZCBzYXZlZCBpbiAke3BjLmJvbGQoYCR7ZWxhcHNlZC50b0ZpeGVkKDEpfXNgKX1gLFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4geyByZXN1bHRzOiByZXN1bHRzRGF0YSwgdXJsIH07XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIFBPTExfSU5URVJWQUxfTVMpKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgX2Rpc3BsYXlSZXN1bHRzKFxuICAgIGV4YW1wbGVzOiBFeGFtcGxlW10sXG4gICAgcmVzdWx0c0RhdGE6IEV4cGVyaW1lbnRSdW5JdGVtW10sXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgYXNzZXJ0VGVzdDogYm9vbGVhbixcbiAgKTogU2NvcmluZ1Jlc3VsdFtdIHtcbiAgICBjb25zdCByZXN1bHRzOiBTY29yaW5nUmVzdWx0W10gPSBbXTtcbiAgICBsZXQgcGFzc2VkID0gMDtcbiAgICBsZXQgZmFpbGVkID0gMDtcblxuICAgIGNvbnNvbGUubG9nKCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHNEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZXMgPSByZXN1bHRzRGF0YVtpXTtcbiAgICAgIGNvbnN0IHN1Y2Nlc3MgPSByZXMuc2NvcmVycy5ldmVyeSgocykgPT4gQm9vbGVhbihzLnN1Y2Nlc3MpKTtcblxuICAgICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgcGFzc2VkKys7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGAke3BjLmdyZWVuKFwiXFx1MjcxM1wiKX0gRXhhbXBsZSAke2kgKyAxfTogJHtwYy5ncmVlbihcIlBBU1NFRFwiKX1gLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmFpbGVkKys7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGAke3BjLnJlZChcIlxcdTI3MTdcIil9IEV4YW1wbGUgJHtpICsgMX06ICR7cGMucmVkKFwiRkFJTEVEXCIpfWAsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgcyBvZiByZXMuc2NvcmVycykge1xuICAgICAgICBjb25zdCBzY29yZVN0ciA9IHMuc2NvcmUgIT09IG51bGwgPyBzLnNjb3JlLnRvRml4ZWQoMykgOiBcIk4vQVwiO1xuICAgICAgICBjb25zdCBjb2xvcmVkID0gcy5zdWNjZXNzID8gcGMuZ3JlZW4oc2NvcmVTdHIpIDogcGMucmVkKHNjb3JlU3RyKTtcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYCAgJHtwYy5kaW0oYCR7cy5uYW1lfTpgKX0gJHtjb2xvcmVkfSAke3BjLmRpbShgKHRocmVzaG9sZDogJHtzLnRocmVzaG9sZH0pYCl9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0cy5wdXNoKHsgc3VjY2Vzcywgc2NvcmVyczogcmVzLnNjb3JlcnMsIGV4YW1wbGU6IGV4YW1wbGVzW2ldIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCk7XG4gICAgaWYgKHBhc3NlZCA9PT0gcmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgJHtwYy5ib2xkKHBjLmdyZWVuKFwiXFx1MjcxMyBBbGwgdGVzdHMgcGFzc2VkIVwiKSl9ICgke3Bhc3NlZH0vJHtyZXN1bHRzLmxlbmd0aH0pYCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgJHtwYy5ib2xkKHBjLnllbGxvdyhcIlxcdTI2QTAgUmVzdWx0czpcIikpfSAke3BjLmdyZWVuKGAke3Bhc3NlZH0gcGFzc2VkYCl9IHwgJHtwYy5yZWQoYCR7ZmFpbGVkfSBmYWlsZWRgKX1gLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc29sZS5sb2coYCR7cGMuZGltKFwiVmlldyBmdWxsIGRldGFpbHM6XCIpfSAke3BjLnVuZGVybGluZSh1cmwpfWApO1xuICAgIGNvbnNvbGUubG9nKCk7XG5cbiAgICBpZiAoYXNzZXJ0VGVzdCAmJiByZXN1bHRzLnNvbWUoKHIpID0+ICFyLnN1Y2Nlc3MpKSB7XG4gICAgICBjb25zdCBsaW5lcyA9IFtcbiAgICAgICAgYEV2YWx1YXRpb24gZmFpbGVkOiAke2ZhaWxlZH0vJHtyZXN1bHRzLmxlbmd0aH0gZXhhbXBsZXMgZmFpbGVkYCxcbiAgICAgIF07XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKCFyZXN1bHRzW2ldLnN1Y2Nlc3MpIHtcbiAgICAgICAgICBsaW5lcy5wdXNoKGAgIEV4YW1wbGUgJHtpICsgMX06YCk7XG4gICAgICAgICAgZm9yIChjb25zdCBzIG9mIHJlc3VsdHNbaV0uc2NvcmVycykge1xuICAgICAgICAgICAgaWYgKCFzLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChcbiAgICAgICAgICAgICAgICBgICAgICR7cy5uYW1lfTogJHtzLnNjb3JlICE9PSBudWxsID8gcy5zY29yZS50b0ZpeGVkKDMpIDogXCJOL0FcIn0gKHRocmVzaG9sZDogJHtzLnRocmVzaG9sZH0pYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgaWYgKHMucmVhc29uKSBsaW5lcy5wdXNoKGAgICAgICAke3MucmVhc29ufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGxpbmVzLmpvaW4oXCJcXG5cIikpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgYXN5bmMgcnVuKFxuICAgIGV4YW1wbGVzOiBFeGFtcGxlW10sXG4gICAgc2NvcmVyczogU1tdLFxuICAgIGV2YWxSdW5OYW1lOiBzdHJpbmcsXG4gICAgYXNzZXJ0VGVzdDogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHRpbWVvdXRTZWNvbmRzOiBudW1iZXIgPSAzMDAsXG4gICk6IFByb21pc2U8U2NvcmluZ1Jlc3VsdFtdPiB7XG4gICAgaWYgKCF0aGlzLl9wcm9qZWN0SWQpIHtcbiAgICAgIExvZ2dlci5lcnJvcihcbiAgICAgICAgXCJQcm9qZWN0IElEIGlzIG5vdCByZXNvbHZlZC4gRXZhbHVhdGlvbiByZXF1aXJlcyBhIHZhbGlkIHByb2plY3QuXCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBjb25zdCBwcm9qZWN0SWQgPSB0aGlzLl9wcm9qZWN0SWQ7XG4gICAgY29uc3QgZXZhbElkID0gY3J5cHRvLnJhbmRvbVVVSUQoKTtcbiAgICBjb25zdCBjcmVhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICBjb25zb2xlLmxvZygpO1xuICAgIGNvbnNvbGUubG9nKHBjLmJvbGQocGMuY3lhbihcIlN0YXJ0aW5nIEV2YWx1YXRpb25cIikpKTtcbiAgICBjb25zb2xlLmxvZyhgJHtwYy5kaW0oXCJSdW46XCIpfSAke2V2YWxSdW5OYW1lfWApO1xuICAgIGNvbnNvbGUubG9nKGAke3BjLmRpbShcIlByb2plY3Q6XCIpfSAke3RoaXMuX3Byb2plY3ROYW1lfWApO1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYCR7cGMuZGltKFwiRXhhbXBsZXM6XCIpfSAke2V4YW1wbGVzLmxlbmd0aH0gfCAke3BjLmRpbShcIlNjb3JlcnM6XCIpfSAke3Njb3JlcnMubGVuZ3RofWAsXG4gICAgKTtcbiAgICBjb25zb2xlLmxvZygpO1xuXG4gICAgY29uc3QgcGF5bG9hZCA9IHRoaXMuX2J1aWxkUGF5bG9hZChcbiAgICAgIGV2YWxJZCxcbiAgICAgIHByb2plY3RJZCxcbiAgICAgIGV2YWxSdW5OYW1lLFxuICAgICAgY3JlYXRlZEF0LFxuICAgICAgZXhhbXBsZXMsXG4gICAgICBzY29yZXJzLFxuICAgICk7XG5cbiAgICBjb25zdCBleHBlY3RlZENvdW50ID0gYXdhaXQgdGhpcy5fc3VibWl0KFxuICAgICAgcHJvamVjdElkLFxuICAgICAgZXZhbElkLFxuICAgICAgZXhhbXBsZXMsXG4gICAgICBzY29yZXJzLFxuICAgICAgcGF5bG9hZCxcbiAgICApO1xuXG4gICAgY29uc3QgeyByZXN1bHRzOiByZXN1bHRzRGF0YSwgdXJsIH0gPSBhd2FpdCB0aGlzLl9wb2xsKFxuICAgICAgcHJvamVjdElkLFxuICAgICAgZXZhbElkLFxuICAgICAgZXhwZWN0ZWRDb3VudCxcbiAgICAgIHRpbWVvdXRTZWNvbmRzLFxuICAgICk7XG5cbiAgICByZXR1cm4gdGhpcy5fZGlzcGxheVJlc3VsdHMoZXhhbXBsZXMsIHJlc3VsdHNEYXRhLCB1cmwsIGFzc2VydFRlc3QpO1xuICB9XG59XG4iLAogICAgImltcG9ydCBwYyBmcm9tIFwicGljb2NvbG9yc1wiO1xuaW1wb3J0IHR5cGUgeyBFeGFtcGxlRXZhbHVhdGlvblJ1biB9IGZyb20gXCIuLi9pbnRlcm5hbC9hcGkvbW9kZWxzL0V4YW1wbGVFdmFsdWF0aW9uUnVuXCI7XG5pbXBvcnQgdHlwZSB7IEV4YW1wbGUgfSBmcm9tIFwiLi4vZGF0YS9FeGFtcGxlXCI7XG5pbXBvcnQgeyBFdmFsdWF0b3JSdW5uZXIgfSBmcm9tIFwiLi9FdmFsdWF0b3JSdW5uZXJcIjtcblxuLyoqXG4gKiBFdmFsdWF0aW9uIHJ1bm5lciBmb3IgaG9zdGVkIChzZXJ2ZXItc2lkZSkgc2NvcmVycy5cbiAqXG4gKiBTdWJtaXRzIHNjb3JlciBuYW1lcyB0byB0aGUgSnVkZ21lbnQgcGxhdGZvcm0ncyBldmFsdWF0aW9uIHF1ZXVlXG4gKiBhbmQgcG9sbHMgZm9yIHJlc3VsdHMuIFVzZWQgaW50ZXJuYWxseSBieSB7QGxpbmsgRXZhbHVhdGlvbn0uXG4gKi9cbmV4cG9ydCBjbGFzcyBIb3N0ZWRFdmFsdWF0b3JSdW5uZXIgZXh0ZW5kcyBFdmFsdWF0b3JSdW5uZXI8c3RyaW5nPiB7XG4gIHByb3RlY3RlZCBfYnVpbGRQYXlsb2FkKFxuICAgIGV2YWxJZDogc3RyaW5nLFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIGV2YWxSdW5OYW1lOiBzdHJpbmcsXG4gICAgY3JlYXRlZEF0OiBzdHJpbmcsXG4gICAgZXhhbXBsZXM6IEV4YW1wbGVbXSxcbiAgICBzY29yZXJzOiBzdHJpbmdbXSxcbiAgKTogRXhhbXBsZUV2YWx1YXRpb25SdW4ge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogZXZhbElkLFxuICAgICAgcHJvamVjdF9pZDogcHJvamVjdElkLFxuICAgICAgZXZhbF9uYW1lOiBldmFsUnVuTmFtZSxcbiAgICAgIGNyZWF0ZWRfYXQ6IGNyZWF0ZWRBdCxcbiAgICAgIGV4YW1wbGVzOiBleGFtcGxlcy5tYXAoKGUpID0+IGUudG9KU09OKCkpLFxuICAgICAganVkZ21lbnRfc2NvcmVyczogc2NvcmVycy5tYXAoKG5hbWUpID0+ICh7IG5hbWUgfSkpLFxuICAgICAgY3VzdG9tX3Njb3JlcnM6IFtdLFxuICAgIH07XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX3N1Ym1pdChcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBfZXZhbElkOiBzdHJpbmcsXG4gICAgZXhhbXBsZXM6IEV4YW1wbGVbXSxcbiAgICBfc2NvcmVyczogc3RyaW5nW10sXG4gICAgcGF5bG9hZDogRXhhbXBsZUV2YWx1YXRpb25SdW4sXG4gICk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgYXdhaXQgdGhpcy5fY2xpZW50LnBvc3RWMXByb2plY3RzRXZhbFF1ZXVlRXhhbXBsZXMocHJvamVjdElkLCBwYXlsb2FkKTtcbiAgICBjb25zb2xlLmxvZyhgJHtwYy5ncmVlbihcIlxcdTI3MTNcIil9IEV2YWx1YXRpb24gc3VibWl0dGVkYCk7XG4gICAgcmV0dXJuIGV4YW1wbGVzLmxlbmd0aDtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9jbGllbnRcIjtcbmltcG9ydCB7IEV2YWx1YXRpb24gfSBmcm9tIFwiLi9FdmFsdWF0aW9uXCI7XG5cbi8qKlxuICogQ3JlYXRlcyB7QGxpbmsgRXZhbHVhdGlvbn0gaW5zdGFuY2VzIGZvciBydW5uaW5nIGJhdGNoIHNjb3JpbmcuXG4gKlxuICogQWNjZXNzIHZpYSBgY2xpZW50LmV2YWx1YXRpb25gLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBldmFsdWF0aW9uID0gY2xpZW50LmV2YWx1YXRpb24uY3JlYXRlKCk7XG4gKiBjb25zdCByZXN1bHRzID0gYXdhaXQgZXZhbHVhdGlvbi5ydW4oeyBleGFtcGxlcywgc2NvcmVycywgZXZhbFJ1bk5hbWU6IFwibXktZXZhbFwiIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBFdmFsdWF0aW9uRmFjdG9yeSB7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2NsaWVudDogSnVkZ21lbnRBcGlDbGllbnQ7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3Byb2plY3RJZDogc3RyaW5nIHwgbnVsbDtcbiAgcHJpdmF0ZSByZWFkb25seSBfcHJvamVjdE5hbWU6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjbGllbnQ6IEp1ZGdtZW50QXBpQ2xpZW50LFxuICAgIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbCxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICApIHtcbiAgICB0aGlzLl9jbGllbnQgPSBjbGllbnQ7XG4gICAgdGhpcy5fcHJvamVjdElkID0gcHJvamVjdElkO1xuICAgIHRoaXMuX3Byb2plY3ROYW1lID0gcHJvamVjdE5hbWU7XG4gIH1cblxuICAvKiogQ3JlYXRlIGEgbmV3IGBFdmFsdWF0aW9uYCBib3VuZCB0byB0aGUgY3VycmVudCBwcm9qZWN0LiAqL1xuICBjcmVhdGUoKTogRXZhbHVhdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBFdmFsdWF0aW9uKHRoaXMuX2NsaWVudCwgdGhpcy5fcHJvamVjdElkLCB0aGlzLl9wcm9qZWN0TmFtZSk7XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBKdWRnbWVudEFwaUNsaWVudCB9IGZyb20gXCIuLi9pbnRlcm5hbC9hcGkvY2xpZW50XCI7XG5pbXBvcnQgdHlwZSB7IERhdGFzZXRJbmZvIH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9tb2RlbHMvRGF0YXNldEluZm9cIjtcbmltcG9ydCB7IEV4YW1wbGUsIHR5cGUgRXhhbXBsZURpY3QgfSBmcm9tIFwiLi4vZGF0YS9FeGFtcGxlXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBEYXRhc2V0IH0gZnJvbSBcIi4vRGF0YXNldFwiO1xuXG4vKipcbiAqIENyZWF0ZXMsIHJldHJpZXZlcywgYW5kIGxpc3RzIGRhdGFzZXRzIGluIHlvdXIgcHJvamVjdC5cbiAqXG4gKiBBY2Nlc3MgdmlhIGBjbGllbnQuZGF0YXNldHNgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBkYXRhc2V0cyA9IGF3YWl0IGNsaWVudC5kYXRhc2V0cy5saXN0KCk7XG4gKiBjb25zdCBkYXRhc2V0ID0gYXdhaXQgY2xpZW50LmRhdGFzZXRzLmdldChcImdvbGRlbi1zZXRcIik7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIERhdGFzZXRGYWN0b3J5IHtcbiAgcHJpdmF0ZSByZWFkb25seSBfY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudDtcbiAgcHJpdmF0ZSByZWFkb25seSBfcHJvamVjdElkOiBzdHJpbmcgfCBudWxsO1xuICBwcml2YXRlIHJlYWRvbmx5IF9wcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNsaWVudDogSnVkZ21lbnRBcGlDbGllbnQsXG4gICAgcHJvamVjdElkOiBzdHJpbmcgfCBudWxsLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICkge1xuICAgIHRoaXMuX2NsaWVudCA9IGNsaWVudDtcbiAgICB0aGlzLl9wcm9qZWN0SWQgPSBwcm9qZWN0SWQ7XG4gICAgdGhpcy5fcHJvamVjdE5hbWUgPSBwcm9qZWN0TmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBhIGRhdGFzZXQgYnkgbmFtZSwgaW5jbHVkaW5nIGFsbCBpdHMgZXhhbXBsZXMuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIC0gVGhlIGRhdGFzZXQgbmFtZS5cbiAgICogQHJldHVybnMgVGhlIGRhdGFzZXQgd2l0aCBhbGwgZXhhbXBsZXMgaHlkcmF0ZWQsIG9yIGBudWxsYCBpZiB0aGUgcHJvamVjdCBpcyB1bnJlc29sdmVkLlxuICAgKi9cbiAgYXN5bmMgZ2V0KG5hbWU6IHN0cmluZyk6IFByb21pc2U8RGF0YXNldCB8IG51bGw+IHtcbiAgICBjb25zdCBwcm9qZWN0SWQgPSB0aGlzLl9leHBlY3RQcm9qZWN0SWQoKTtcbiAgICBpZiAoIXByb2plY3RJZCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuX2NsaWVudC5nZXRWMXByb2plY3RzRGF0YXNldHNCeURhdGFzZXROYW1lKFxuICAgICAgcHJvamVjdElkLFxuICAgICAgbmFtZSxcbiAgICApO1xuXG4gICAgY29uc3QgZGF0YXNldEtpbmQgPSByZXNwb25zZS5kYXRhc2V0X2tpbmQgPz8gXCJleGFtcGxlXCI7XG4gICAgLy8gVGhlIEFQSSByZXR1cm5zIGV4YW1wbGVzIHdpdGggYXJiaXRyYXJ5IHVzZXIgcHJvcGVydGllcyBiZXlvbmQgdGhlXG4gICAgLy8gdHlwZWQgRXhhbXBsZSBpbnRlcmZhY2Ug4oCUIGNhc3QgdG8gRXhhbXBsZURpY3QgdG8gcmVmbGVjdCB0aGUgcmVhbCBzaGFwZS5cbiAgICBjb25zdCByYXdFeGFtcGxlcyA9IChyZXNwb25zZS5leGFtcGxlcyA/PyBbXSkgYXMgRXhhbXBsZURpY3RbXTtcbiAgICBjb25zdCBleGFtcGxlcyA9IHJhd0V4YW1wbGVzLm1hcCgoZSkgPT4gRXhhbXBsZS5mcm9tKGUpKTtcblxuICAgIHJldHVybiBuZXcgRGF0YXNldCh7XG4gICAgICBuYW1lLFxuICAgICAgcHJvamVjdElkLFxuICAgICAgcHJvamVjdE5hbWU6IHRoaXMuX3Byb2plY3ROYW1lLFxuICAgICAgZGF0YXNldEtpbmQsXG4gICAgICBleGFtcGxlcyxcbiAgICAgIGNsaWVudDogdGhpcy5fY2xpZW50LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBkYXRhc2V0LCBvcHRpb25hbGx5IHByZS1wb3B1bGF0ZWQgd2l0aCBleGFtcGxlcy5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgLSBUaGUgZGF0YXNldCBuYW1lLlxuICAgKiBAcGFyYW0gb3B0aW9ucy5leGFtcGxlcyAtIEV4YW1wbGVzIHRvIHVwbG9hZCBhZnRlciBjcmVhdGlvbi5cbiAgICogQHBhcmFtIG9wdGlvbnMub3ZlcndyaXRlIC0gSWYgYHRydWVgLCBvdmVyd3JpdGUgYW4gZXhpc3RpbmcgZGF0YXNldCB3aXRoIHRoZSBzYW1lIG5hbWUuXG4gICAqIEBwYXJhbSBvcHRpb25zLmJhdGNoU2l6ZSAtIE51bWJlciBvZiBleGFtcGxlcyBwZXIgYmF0Y2ggdXBsb2FkIHJlcXVlc3QuIERlZmF1bHRzIHRvIDEwMC5cbiAgICogQHJldHVybnMgVGhlIG5ld2x5IGNyZWF0ZWQgZGF0YXNldCwgb3IgYG51bGxgIGlmIHRoZSBwcm9qZWN0IGlzIHVucmVzb2x2ZWQuXG4gICAqL1xuICBhc3luYyBjcmVhdGUoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgIGV4YW1wbGVzPzogRXhhbXBsZVtdO1xuICAgICAgb3ZlcndyaXRlPzogYm9vbGVhbjtcbiAgICAgIGJhdGNoU2l6ZT86IG51bWJlcjtcbiAgICB9ID0ge30sXG4gICk6IFByb21pc2U8RGF0YXNldCB8IG51bGw+IHtcbiAgICBjb25zdCBwcm9qZWN0SWQgPSB0aGlzLl9leHBlY3RQcm9qZWN0SWQoKTtcbiAgICBpZiAoIXByb2plY3RJZCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCB7IGV4YW1wbGVzID0gW10sIG92ZXJ3cml0ZSA9IGZhbHNlLCBiYXRjaFNpemUgPSAxMDAgfSA9IG9wdGlvbnM7XG5cbiAgICBhd2FpdCB0aGlzLl9jbGllbnQucG9zdFYxcHJvamVjdHNEYXRhc2V0cyhwcm9qZWN0SWQsIHtcbiAgICAgIG5hbWUsXG4gICAgICBleGFtcGxlczogW10sXG4gICAgICBkYXRhc2V0X2tpbmQ6IFwiZXhhbXBsZVwiLFxuICAgICAgb3ZlcndyaXRlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGF0YXNldCA9IG5ldyBEYXRhc2V0KHtcbiAgICAgIG5hbWUsXG4gICAgICBwcm9qZWN0SWQsXG4gICAgICBwcm9qZWN0TmFtZTogdGhpcy5fcHJvamVjdE5hbWUsXG4gICAgICBleGFtcGxlcyxcbiAgICAgIGNsaWVudDogdGhpcy5fY2xpZW50LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4YW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGF3YWl0IGRhdGFzZXQuYWRkRXhhbXBsZXMoZXhhbXBsZXMsIGJhdGNoU2l6ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGFzZXQ7XG4gIH1cblxuICAvKipcbiAgICogTGlzdCBhbGwgZGF0YXNldHMgaW4gdGhlIHByb2plY3QuXG4gICAqXG4gICAqIEByZXR1cm5zIEFuIGFycmF5IG9mIGRhdGFzZXQgbWV0YWRhdGEsIG9yIGBudWxsYCBpZiB0aGUgcHJvamVjdCBpcyB1bnJlc29sdmVkLlxuICAgKi9cbiAgbGlzdCgpOiBQcm9taXNlPERhdGFzZXRJbmZvW10gfCBudWxsPiB7XG4gICAgY29uc3QgcHJvamVjdElkID0gdGhpcy5fZXhwZWN0UHJvamVjdElkKCk7XG4gICAgaWYgKCFwcm9qZWN0SWQpIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cbiAgICByZXR1cm4gdGhpcy5fY2xpZW50LmdldFYxcHJvamVjdHNEYXRhc2V0cyhwcm9qZWN0SWQpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZXhwZWN0UHJvamVjdElkKCk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICghdGhpcy5fcHJvamVjdElkKSB7XG4gICAgICBMb2dnZXIuZXJyb3IoXG4gICAgICAgIFwiUHJvamVjdCBJRCBpcyBub3QgcmVzb2x2ZWQuIERhdGFzZXQgb3BlcmF0aW9ucyByZXF1aXJlIGEgdmFsaWQgcHJvamVjdC5cIixcbiAgICAgICk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3Byb2plY3RJZDtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9jbGllbnRcIjtcbmltcG9ydCB7IEV4YW1wbGUgfSBmcm9tIFwiLi4vZGF0YS9FeGFtcGxlXCI7XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIHtAbGluayBFeGFtcGxlfSBvYmplY3RzIHN0b3JlZCBvbiB0aGUgSnVkZ21lbnQgcGxhdGZvcm0uXG4gKlxuICogRGF0YXNldHMgYXJlIHJldHJpZXZlZCB2aWEge0BsaW5rIERhdGFzZXRGYWN0b3J5LmdldH0gb3IgY3JlYXRlZCB2aWFcbiAqIHtAbGluayBEYXRhc2V0RmFjdG9yeS5jcmVhdGV9LiBPbmNlIG9idGFpbmVkLCB5b3UgY2FuIGl0ZXJhdGUgb3ZlclxuICogdGhlIGV4YW1wbGVzIGRpcmVjdGx5LCBvciBhZGQgbmV3IG9uZXMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGRhdGFzZXQgPSBhd2FpdCBjbGllbnQuZGF0YXNldHMuZ2V0KFwiZ29sZGVuLXNldFwiKTtcbiAqIGZvciAoY29uc3QgZXhhbXBsZSBvZiBkYXRhc2V0KSB7XG4gKiAgIGNvbnNvbGUubG9nKGV4YW1wbGUuZ2V0KFwiaW5wdXRcIikpO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBEYXRhc2V0IHtcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICByZWFkb25seSBwcm9qZWN0SWQ6IHN0cmluZztcbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgZGF0YXNldEtpbmQ6IHN0cmluZztcbiAgcmVhZG9ubHkgZXhhbXBsZXM6IEV4YW1wbGVbXTtcbiAgcHJpdmF0ZSByZWFkb25seSBfY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudCB8IG51bGw7XG5cbiAgY29uc3RydWN0b3Iob3B0czoge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICAgIGRhdGFzZXRLaW5kPzogc3RyaW5nO1xuICAgIGV4YW1wbGVzPzogRXhhbXBsZVtdO1xuICAgIGNsaWVudD86IEp1ZGdtZW50QXBpQ2xpZW50IHwgbnVsbDtcbiAgfSkge1xuICAgIHRoaXMubmFtZSA9IG9wdHMubmFtZTtcbiAgICB0aGlzLnByb2plY3RJZCA9IG9wdHMucHJvamVjdElkO1xuICAgIHRoaXMucHJvamVjdE5hbWUgPSBvcHRzLnByb2plY3ROYW1lO1xuICAgIHRoaXMuZGF0YXNldEtpbmQgPSBvcHRzLmRhdGFzZXRLaW5kID8/IFwiZXhhbXBsZVwiO1xuICAgIHRoaXMuZXhhbXBsZXMgPSBvcHRzLmV4YW1wbGVzID8/IFtdO1xuICAgIHRoaXMuX2NsaWVudCA9IG9wdHMuY2xpZW50ID8/IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogVXBsb2FkIGV4YW1wbGVzIHRvIHRoaXMgZGF0YXNldCBpbiBiYXRjaGVzLlxuICAgKlxuICAgKiBAcGFyYW0gZXhhbXBsZXMgLSBUaGUgZXhhbXBsZXMgdG8gdXBsb2FkLlxuICAgKiBAcGFyYW0gYmF0Y2hTaXplIC0gTnVtYmVyIG9mIGV4YW1wbGVzIHBlciBiYXRjaCByZXF1ZXN0LiBEZWZhdWx0cyB0byAxMDAuXG4gICAqL1xuICBhc3luYyBhZGRFeGFtcGxlcyhcbiAgICBleGFtcGxlczogRXhhbXBsZVtdLFxuICAgIGJhdGNoU2l6ZTogbnVtYmVyID0gMTAwLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuX2NsaWVudCkgcmV0dXJuO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleGFtcGxlcy5sZW5ndGg7IGkgKz0gYmF0Y2hTaXplKSB7XG4gICAgICBjb25zdCBiYXRjaCA9IGV4YW1wbGVzLnNsaWNlKGksIGkgKyBiYXRjaFNpemUpO1xuICAgICAgYXdhaXQgdGhpcy5fY2xpZW50LnBvc3RWMXByb2plY3RzRGF0YXNldHNCeURhdGFzZXROYW1lRXhhbXBsZXMoXG4gICAgICAgIHRoaXMucHJvamVjdElkLFxuICAgICAgICB0aGlzLm5hbWUsXG4gICAgICAgIHsgZXhhbXBsZXM6IGJhdGNoLm1hcCgoZSkgPT4gZS50b0pTT04oKSkgfSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgZXhhbXBsZXMgZnJvbSBhIEpTT04gZmlsZSBhbmQgYWRkIHRoZW0gdG8gdGhlIGRhdGFzZXQuXG4gICAqXG4gICAqIEV4cGVjdHMgdGhlIGZpbGUgdG8gY29udGFpbiBhIEpTT04gYXJyYXkgb2Ygb2JqZWN0cywgZWFjaCB3aXRoXG4gICAqIHByb3BlcnRpZXMgbGlrZSBgaW5wdXRgLCBgYWN0dWFsX291dHB1dGAsIGV0Yy5cbiAgICpcbiAgICogQHBhcmFtIGZpbGVQYXRoIC0gUGF0aCB0byB0aGUgSlNPTiBmaWxlLlxuICAgKiBAcGFyYW0gYmF0Y2hTaXplIC0gTnVtYmVyIG9mIGV4YW1wbGVzIHBlciBiYXRjaCByZXF1ZXN0LiBEZWZhdWx0cyB0byAxMDAuXG4gICAqL1xuICBhc3luYyBhZGRGcm9tSnNvbihmaWxlUGF0aDogc3RyaW5nLCBiYXRjaFNpemU6IG51bWJlciA9IDEwMCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgcmVhZEZpbGUgfSA9IGF3YWl0IGltcG9ydChcImZzL3Byb21pc2VzXCIpO1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHJlYWRGaWxlKGZpbGVQYXRoLCBcInV0Zi04XCIpO1xuICAgIGNvbnN0IGRhdGE6IHVua25vd25bXSA9IEpTT04ucGFyc2UocmF3KTtcblxuICAgIGNvbnN0IGV4YW1wbGVzOiBFeGFtcGxlW10gPSBkYXRhLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBpdGVtICE9PSBcIm9iamVjdFwiIHx8IGl0ZW0gPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRWFjaCBpdGVtIGluIHRoZSBKU09OIGFycmF5IG11c3QgYmUgYW4gb2JqZWN0XCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIEV4YW1wbGUuY3JlYXRlKGl0ZW0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hZGRFeGFtcGxlcyhleGFtcGxlcywgYmF0Y2hTaXplKTtcbiAgfVxuXG4gIC8qKiBOdW1iZXIgb2YgZXhhbXBsZXMgaW4gdGhpcyBkYXRhc2V0LiAqL1xuICBnZXQgbGVuZ3RoKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZXhhbXBsZXMubGVuZ3RoO1xuICB9XG5cbiAgLyoqIEl0ZXJhdGUgb3ZlciBleGFtcGxlcy4gKi9cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmF0b3I8RXhhbXBsZT4ge1xuICAgIHJldHVybiB0aGlzLmV4YW1wbGVzW1N5bWJvbC5pdGVyYXRvcl0oKTtcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBEYXRhc2V0KG5hbWU9JHt0aGlzLm5hbWV9LCBleGFtcGxlcz0ke3RoaXMuZXhhbXBsZXMubGVuZ3RofSlgO1xuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgSnVkZ21lbnRBcGlDbGllbnQgfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpL2NsaWVudFwiO1xuaW1wb3J0IHR5cGUgeyBTREtDcmVhdGVBZ2VudEp1ZGdlUmVxdWVzdCB9IGZyb20gXCIuLi9pbnRlcm5hbC9hcGkvbW9kZWxzL1NES0NyZWF0ZUFnZW50SnVkZ2VSZXF1ZXN0XCI7XG5pbXBvcnQgdHlwZSB7IFNES1VwZGF0ZUFnZW50SnVkZ2VSZXF1ZXN0IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9tb2RlbHMvU0RLVXBkYXRlQWdlbnRKdWRnZVJlcXVlc3RcIjtcbmltcG9ydCB0eXBlIHsgU0RLVXBkYXRlQWdlbnRKdWRnZVJlc3BvbnNlIH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaS9tb2RlbHMvU0RLVXBkYXRlQWdlbnRKdWRnZVJlc3BvbnNlXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvbG9nZ2VyXCI7XG5pbXBvcnQgdHlwZSB7IEFnZW50SnVkZ2UsIFNjb3JlVHlwZSB9IGZyb20gXCIuL0FnZW50SnVkZ2VcIjtcblxuLyoqXG4gKiBDcmVhdGUgYW5kIHVwZGF0ZSBwcm9tcHQtYmFzZWQgQWdlbnQgSnVkZ2VzIG9uIHRoZSBKdWRnbWVudCBwbGF0Zm9ybS5cbiAqXG4gKiBBY2Nlc3MgdmlhIGBjbGllbnQuYWdlbnRKdWRnZXNgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBqdWRnZSA9IGF3YWl0IGNsaWVudC5hZ2VudEp1ZGdlcy5jcmVhdGUoe1xuICogICBuYW1lOiBcImhlbHBmdWxuZXNzXCIsXG4gKiAgIHByb21wdDogXCJSYXRlIHRoZSBhc3Npc3RhbnQncyBoZWxwZnVsbmVzcyBmcm9tIDAgdG8gMS5cIixcbiAqICAgbW9kZWw6IFwiZ3B0LTUuMlwiLFxuICogICBzY29yZVR5cGU6IFwibnVtZXJpY1wiLFxuICogfSk7XG4gKlxuICogYXdhaXQgY2xpZW50LmFnZW50SnVkZ2VzLnVwZGF0ZSh7XG4gKiAgIGp1ZGdlSWQ6IGp1ZGdlLmp1ZGdlSWQsXG4gKiAgIHByb21wdDogXCJVcGRhdGVkIHJ1YnJpYyBwcm9tcHQuXCIsXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgQWdlbnRKdWRnZUZhY3Rvcnkge1xuICBwcml2YXRlIHJlYWRvbmx5IF9jbGllbnQ6IEp1ZGdtZW50QXBpQ2xpZW50O1xuICBwcml2YXRlIHJlYWRvbmx5IF9wcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3Byb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudCxcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGwsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgKSB7XG4gICAgdGhpcy5fY2xpZW50ID0gY2xpZW50O1xuICAgIHRoaXMuX3Byb2plY3RJZCA9IHByb2plY3RJZDtcbiAgICB0aGlzLl9wcm9qZWN0TmFtZSA9IHByb2plY3ROYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBBZ2VudCBKdWRnZSAocHJvbXB0LWJhc2VkIHNjb3JlcikuXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zLm5hbWUgLSBVbmlxdWUganVkZ2UgbmFtZSB3aXRoaW4gdGhlIHByb2plY3QuXG4gICAqIEBwYXJhbSBvcHRpb25zLnByb21wdCAtIFJ1YnJpYyBwcm9tcHQgdGVtcGxhdGUgdXNlZCBieSB0aGUgYWdlbnQganVkZ2UgaGFybmVzcy5cbiAgICogQHBhcmFtIG9wdGlvbnMubW9kZWwgLSBMaXRlTExNIG1vZGVsIGlkIChlLmcuIGBcImdwdC01LjJcImApLlxuICAgKiBAcGFyYW0gb3B0aW9ucy5zY29yZVR5cGUgLSBPbmUgb2YgYFwibnVtZXJpY1wiYCwgYFwiYmluYXJ5XCJgLCBvciBgXCJjYXRlZ29yaWNhbFwiYC5cbiAgICogQHBhcmFtIG9wdGlvbnMuZGVzY3JpcHRpb24gLSBEZXNjcmlwdGlvbiBzdG9yZWQgb24gdGhlIHVuZGVybHlpbmcgc2NvcmVyIHZlcnNpb24uXG4gICAqIEBwYXJhbSBvcHRpb25zLmp1ZGdlRGVzY3JpcHRpb24gLSBEZXNjcmlwdGlvbiBzaG93biBpbiB0aGUgVUkuXG4gICAqIEBwYXJhbSBvcHRpb25zLmNhdGVnb3JpZXMgLSBDaG9pY2UgbGlzdCBmb3IgYGNhdGVnb3JpY2FsYCBqdWRnZXMuXG4gICAqIEBwYXJhbSBvcHRpb25zLm1pblNjb3JlIC0gTG93ZXIgYm91bmQgZm9yIGBudW1lcmljYCBqdWRnZXMgKGRlZmF1bHRzIHRvIGAwYCBzZXJ2ZXItc2lkZSkuXG4gICAqIEBwYXJhbSBvcHRpb25zLm1heFNjb3JlIC0gVXBwZXIgYm91bmQgZm9yIGBudW1lcmljYCBqdWRnZXMgKGRlZmF1bHRzIHRvIGAxYCBzZXJ2ZXItc2lkZSkuXG4gICAqIEByZXR1cm5zIFRoZSBuZXdseSBjcmVhdGVkIGBBZ2VudEp1ZGdlYCwgb3IgYG51bGxgIGlmIHRoZSBwcm9qZWN0IGlzIHVucmVzb2x2ZWQuXG4gICAqL1xuICBhc3luYyBjcmVhdGUob3B0aW9uczoge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBwcm9tcHQ6IHN0cmluZztcbiAgICBtb2RlbDogc3RyaW5nO1xuICAgIHNjb3JlVHlwZTogU2NvcmVUeXBlO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIGp1ZGdlRGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gICAgY2F0ZWdvcmllcz86IHsgbmFtZTogc3RyaW5nOyBkZXNjcmlwdGlvbjogc3RyaW5nIH1bXTtcbiAgICBtaW5TY29yZT86IG51bWJlcjtcbiAgICBtYXhTY29yZT86IG51bWJlcjtcbiAgfSk6IFByb21pc2U8QWdlbnRKdWRnZSB8IG51bGw+IHtcbiAgICBjb25zdCBwcm9qZWN0SWQgPSB0aGlzLl9leHBlY3RQcm9qZWN0SWQoKTtcbiAgICBpZiAoIXByb2plY3RJZCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBwYXlsb2FkOiBTREtDcmVhdGVBZ2VudEp1ZGdlUmVxdWVzdCA9IHtcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHByb21wdDogb3B0aW9ucy5wcm9tcHQsXG4gICAgICBtb2RlbDogb3B0aW9ucy5tb2RlbCxcbiAgICAgIHNjb3JlX3R5cGU6IG9wdGlvbnMuc2NvcmVUeXBlLFxuICAgIH07XG4gICAgaWYgKG9wdGlvbnMuZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZClcbiAgICAgIHBheWxvYWQuZGVzY3JpcHRpb24gPSBvcHRpb25zLmRlc2NyaXB0aW9uO1xuICAgIGlmIChvcHRpb25zLmp1ZGdlRGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZClcbiAgICAgIHBheWxvYWQuanVkZ2VfZGVzY3JpcHRpb24gPSBvcHRpb25zLmp1ZGdlRGVzY3JpcHRpb247XG4gICAgaWYgKG9wdGlvbnMuY2F0ZWdvcmllcyAhPT0gdW5kZWZpbmVkKVxuICAgICAgcGF5bG9hZC5jYXRlZ29yaWVzID0gb3B0aW9ucy5jYXRlZ29yaWVzO1xuICAgIGlmIChvcHRpb25zLm1pblNjb3JlICE9PSB1bmRlZmluZWQpIHBheWxvYWQubWluX3Njb3JlID0gb3B0aW9ucy5taW5TY29yZTtcbiAgICBpZiAob3B0aW9ucy5tYXhTY29yZSAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLm1heF9zY29yZSA9IG9wdGlvbnMubWF4U2NvcmU7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuX2NsaWVudC5wb3N0VjFwcm9qZWN0c0p1ZGdlcyhcbiAgICAgIHByb2plY3RJZCxcbiAgICAgIHBheWxvYWQsXG4gICAgKTtcblxuICAgIHJldHVybiB7XG4gICAgICBqdWRnZUlkOiByZXNwb25zZS5qdWRnZV9pZCxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHByb21wdDogb3B0aW9ucy5wcm9tcHQsXG4gICAgICBtb2RlbDogb3B0aW9ucy5tb2RlbCxcbiAgICAgIHNjb3JlVHlwZTogb3B0aW9ucy5zY29yZVR5cGUsXG4gICAgICBkZXNjcmlwdGlvbjogb3B0aW9ucy5kZXNjcmlwdGlvbiA/PyBudWxsLFxuICAgICAganVkZ2VEZXNjcmlwdGlvbjogb3B0aW9ucy5qdWRnZURlc2NyaXB0aW9uID8/IG51bGwsXG4gICAgICBjYXRlZ29yaWVzOiBvcHRpb25zLmNhdGVnb3JpZXMgPz8gbnVsbCxcbiAgICAgIG1pblNjb3JlOiBvcHRpb25zLm1pblNjb3JlID8/IG51bGwsXG4gICAgICBtYXhTY29yZTogb3B0aW9ucy5tYXhTY29yZSA/PyBudWxsLFxuICAgICAgbWFqb3JWZXJzaW9uOiAwLFxuICAgICAgbWlub3JWZXJzaW9uOiAwLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIGFuIGV4aXN0aW5nIEFnZW50IEp1ZGdlLlxuICAgKlxuICAgKiBQYXNzaW5nIGFueSBvZiBgcHJvbXB0YCwgYG1vZGVsYCwgYGNhdGVnb3JpZXNgLCBgbWluU2NvcmVgLCBvclxuICAgKiBgbWF4U2NvcmVgIHdyaXRlcyBhIG5ldyB2ZXJzaW9uIG9mIHRoZSB1bmRlcmx5aW5nIHByb21wdCBzY29yZXIuXG4gICAqIFdoZW4gYHRhcmdldE1ham9yVmVyc2lvbmAgLyBgdGFyZ2V0TWlub3JWZXJzaW9uYCBhcmUgb21pdHRlZCwgdGhlXG4gICAqIHNlcnZlciBhdXRvLWJ1bXBzIHRoZSBsYXRlc3QgdmVyc2lvbidzIG1pbm9yIGJ5IDEg4oCUIG1hdGNoaW5nIHRoZVxuICAgKiBVSSdzIGRlZmF1bHQgXCJzYXZlXCIgYmVoYXZpb3VyLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucy5qdWRnZUlkIC0gSUQgb2YgdGhlIGp1ZGdlIHRvIHVwZGF0ZS5cbiAgICogQHBhcmFtIG9wdGlvbnMucHJvbXB0IC0gTmV3IHJ1YnJpYyBwcm9tcHQgdGVtcGxhdGUuXG4gICAqIEBwYXJhbSBvcHRpb25zLm1vZGVsIC0gTmV3IExpdGVMTE0gbW9kZWwgaWQuXG4gICAqIEBwYXJhbSBvcHRpb25zLnNjb3JlVHlwZSAtIE5ldyBzY29yZSB0eXBlLlxuICAgKiBAcGFyYW0gb3B0aW9ucy5kZXNjcmlwdGlvbiAtIE5ldyBzY29yZXItdmVyc2lvbiBkZXNjcmlwdGlvbi5cbiAgICogQHBhcmFtIG9wdGlvbnMuanVkZ2VEZXNjcmlwdGlvbiAtIE5ldyBVSS1mYWNpbmcgZGVzY3JpcHRpb24uXG4gICAqIEBwYXJhbSBvcHRpb25zLmNhdGVnb3JpZXMgLSBOZXcgY2hvaWNlcyBmb3IgYGNhdGVnb3JpY2FsYCBqdWRnZXMuXG4gICAqIEBwYXJhbSBvcHRpb25zLm1pblNjb3JlIC0gTmV3IGxvd2VyIGJvdW5kIGZvciBgbnVtZXJpY2AganVkZ2VzLlxuICAgKiBAcGFyYW0gb3B0aW9ucy5tYXhTY29yZSAtIE5ldyB1cHBlciBib3VuZCBmb3IgYG51bWVyaWNgIGp1ZGdlcy5cbiAgICogQHBhcmFtIG9wdGlvbnMuc291cmNlTWFqb3JWZXJzaW9uIC0gTWFqb3IgdmVyc2lvbiB0byBjb3B5IHVuc3BlY2lmaWVkIGZpZWxkcyBmcm9tLlxuICAgKiBAcGFyYW0gb3B0aW9ucy5zb3VyY2VNaW5vclZlcnNpb24gLSBNaW5vciB2ZXJzaW9uIHRvIGNvcHkgdW5zcGVjaWZpZWQgZmllbGRzIGZyb20uXG4gICAqIEBwYXJhbSBvcHRpb25zLnRhcmdldE1ham9yVmVyc2lvbiAtIE1ham9yIHZlcnNpb24gdG8gd3JpdGUgdG8uXG4gICAqIEBwYXJhbSBvcHRpb25zLnRhcmdldE1pbm9yVmVyc2lvbiAtIE1pbm9yIHZlcnNpb24gdG8gd3JpdGUgdG8uXG4gICAqIEByZXR1cm5zIFRoZSB1cGRhdGVkIGBBZ2VudEp1ZGdlYCwgb3IgYG51bGxgIGlmIHRoZSBwcm9qZWN0IGlzIHVucmVzb2x2ZWQuXG4gICAqL1xuICBhc3luYyB1cGRhdGUob3B0aW9uczoge1xuICAgIGp1ZGdlSWQ6IHN0cmluZztcbiAgICBwcm9tcHQ/OiBzdHJpbmc7XG4gICAgbW9kZWw/OiBzdHJpbmc7XG4gICAgc2NvcmVUeXBlPzogU2NvcmVUeXBlO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIGp1ZGdlRGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gICAgY2F0ZWdvcmllcz86IHsgbmFtZTogc3RyaW5nOyBkZXNjcmlwdGlvbjogc3RyaW5nIH1bXTtcbiAgICBtaW5TY29yZT86IG51bWJlcjtcbiAgICBtYXhTY29yZT86IG51bWJlcjtcbiAgICBzb3VyY2VNYWpvclZlcnNpb24/OiBudW1iZXI7XG4gICAgc291cmNlTWlub3JWZXJzaW9uPzogbnVtYmVyO1xuICAgIHRhcmdldE1ham9yVmVyc2lvbj86IG51bWJlcjtcbiAgICB0YXJnZXRNaW5vclZlcnNpb24/OiBudW1iZXI7XG4gIH0pOiBQcm9taXNlPEFnZW50SnVkZ2UgfCBudWxsPiB7XG4gICAgY29uc3QgcHJvamVjdElkID0gdGhpcy5fZXhwZWN0UHJvamVjdElkKCk7XG4gICAgaWYgKCFwcm9qZWN0SWQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgcGF5bG9hZDogU0RLVXBkYXRlQWdlbnRKdWRnZVJlcXVlc3QgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5wcm9tcHQgIT09IHVuZGVmaW5lZCkgcGF5bG9hZC5wcm9tcHQgPSBvcHRpb25zLnByb21wdDtcbiAgICBpZiAob3B0aW9ucy5tb2RlbCAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICBpZiAob3B0aW9ucy5zY29yZVR5cGUgIT09IHVuZGVmaW5lZCkgcGF5bG9hZC5zY29yZV90eXBlID0gb3B0aW9ucy5zY29yZVR5cGU7XG4gICAgaWYgKG9wdGlvbnMuZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZClcbiAgICAgIHBheWxvYWQuZGVzY3JpcHRpb24gPSBvcHRpb25zLmRlc2NyaXB0aW9uO1xuICAgIGlmIChvcHRpb25zLmp1ZGdlRGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZClcbiAgICAgIHBheWxvYWQuanVkZ2VfZGVzY3JpcHRpb24gPSBvcHRpb25zLmp1ZGdlRGVzY3JpcHRpb247XG4gICAgaWYgKG9wdGlvbnMuY2F0ZWdvcmllcyAhPT0gdW5kZWZpbmVkKVxuICAgICAgcGF5bG9hZC5jYXRlZ29yaWVzID0gb3B0aW9ucy5jYXRlZ29yaWVzO1xuICAgIGlmIChvcHRpb25zLm1pblNjb3JlICE9PSB1bmRlZmluZWQpIHBheWxvYWQubWluX3Njb3JlID0gb3B0aW9ucy5taW5TY29yZTtcbiAgICBpZiAob3B0aW9ucy5tYXhTY29yZSAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLm1heF9zY29yZSA9IG9wdGlvbnMubWF4U2NvcmU7XG4gICAgaWYgKG9wdGlvbnMuc291cmNlTWFqb3JWZXJzaW9uICE9PSB1bmRlZmluZWQpXG4gICAgICBwYXlsb2FkLnNvdXJjZV9tYWpvcl92ZXJzaW9uID0gb3B0aW9ucy5zb3VyY2VNYWpvclZlcnNpb247XG4gICAgaWYgKG9wdGlvbnMuc291cmNlTWlub3JWZXJzaW9uICE9PSB1bmRlZmluZWQpXG4gICAgICBwYXlsb2FkLnNvdXJjZV9taW5vcl92ZXJzaW9uID0gb3B0aW9ucy5zb3VyY2VNaW5vclZlcnNpb247XG4gICAgaWYgKG9wdGlvbnMudGFyZ2V0TWFqb3JWZXJzaW9uICE9PSB1bmRlZmluZWQpXG4gICAgICBwYXlsb2FkLnRhcmdldF9tYWpvcl92ZXJzaW9uID0gb3B0aW9ucy50YXJnZXRNYWpvclZlcnNpb247XG4gICAgaWYgKG9wdGlvbnMudGFyZ2V0TWlub3JWZXJzaW9uICE9PSB1bmRlZmluZWQpXG4gICAgICBwYXlsb2FkLnRhcmdldF9taW5vcl92ZXJzaW9uID0gb3B0aW9ucy50YXJnZXRNaW5vclZlcnNpb247XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuX2NsaWVudC5wYXRjaFYxcHJvamVjdHNKdWRnZXNCeUp1ZGdlSWQoXG4gICAgICBwcm9qZWN0SWQsXG4gICAgICBvcHRpb25zLmp1ZGdlSWQsXG4gICAgICBwYXlsb2FkLFxuICAgICk7XG5cbiAgICByZXR1cm4gYWdlbnRKdWRnZUZyb21EZXRhaWwocmVzcG9uc2UpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZXhwZWN0UHJvamVjdElkKCk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICghdGhpcy5fcHJvamVjdElkKSB7XG4gICAgICBMb2dnZXIuZXJyb3IoXG4gICAgICAgIFwiUHJvamVjdCBJRCBpcyBub3QgcmVzb2x2ZWQuIEFnZW50IGp1ZGdlIG9wZXJhdGlvbnMgcmVxdWlyZSBhIHZhbGlkIHByb2plY3QuXCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9wcm9qZWN0SWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gYWdlbnRKdWRnZUZyb21EZXRhaWwoXG4gIHJlc3BvbnNlOiBTREtVcGRhdGVBZ2VudEp1ZGdlUmVzcG9uc2UsXG4pOiBBZ2VudEp1ZGdlIHtcbiAgY29uc3QganVkZ2UgPSByZXNwb25zZS5qdWRnZTtcbiAgcmV0dXJuIHtcbiAgICBqdWRnZUlkOiBqdWRnZS5pZCxcbiAgICBuYW1lOiBqdWRnZS5uYW1lLFxuICAgIHByb21wdDoganVkZ2UucHJvbXB0ID8/IFwiXCIsXG4gICAgbW9kZWw6IGp1ZGdlLm1vZGVsID8/IFwiXCIsXG4gICAgc2NvcmVUeXBlOiBqdWRnZS5zY29yZV90eXBlIGFzIFNjb3JlVHlwZSxcbiAgICBkZXNjcmlwdGlvbjoganVkZ2UuZGVzY3JpcHRpb24gPz8gbnVsbCxcbiAgICBqdWRnZURlc2NyaXB0aW9uOiBqdWRnZS5qdWRnZV9kZXNjcmlwdGlvbiA/PyBudWxsLFxuICAgIGNhdGVnb3JpZXM6IGp1ZGdlLmNhdGVnb3JpZXMgPz8gbnVsbCxcbiAgICBtaW5TY29yZToganVkZ2UubWluX3Njb3JlID8/IG51bGwsXG4gICAgbWF4U2NvcmU6IGp1ZGdlLm1heF9zY29yZSA/PyBudWxsLFxuICAgIG1ham9yVmVyc2lvbjoganVkZ2UubWFqb3JfdmVyc2lvbiA/PyBudWxsLFxuICAgIG1pbm9yVmVyc2lvbjoganVkZ2UubWlub3JfdmVyc2lvbiA/PyBudWxsLFxuICB9O1xufVxuIiwKICAgICJleHBvcnQge1xuICBCYXNlVHJhY2VyLFxuICB0eXBlIEFzeW5jRXZhbHVhdGVPcHRpb25zLFxuICB0eXBlIExMTU1ldGFkYXRhLFxuICB0eXBlIE9ic2VydmVPcHRpb25zLFxuICB0eXBlIFRyYWNlckNvbmZpZyxcbn0gZnJvbSBcIi4vQmFzZVRyYWNlclwiO1xuZXhwb3J0IHsgSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi9leHBvcnRlcnMvSnVkZ21lbnRTcGFuRXhwb3J0ZXJcIjtcbmV4cG9ydCB7IE5vT3BTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi9leHBvcnRlcnMvTm9PcFNwYW5FeHBvcnRlclwiO1xuZXhwb3J0IHsgSnVkZ21lbnRUcmFjZXJQcm92aWRlciB9IGZyb20gXCIuL0p1ZGdtZW50VHJhY2VyUHJvdmlkZXJcIjtcbmV4cG9ydCB7IEp1ZGdtZW50U3BhblByb2Nlc3NvciB9IGZyb20gXCIuL3Byb2Nlc3NvcnMvSnVkZ21lbnRTcGFuUHJvY2Vzc29yXCI7XG5leHBvcnQgeyBOb09wU3BhblByb2Nlc3NvciB9IGZyb20gXCIuL3Byb2Nlc3NvcnMvTm9PcFNwYW5Qcm9jZXNzb3JcIjtcbmV4cG9ydCB7IE9mZmxpbmVKdWRnbWVudFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi9wcm9jZXNzb3JzL09mZmxpbmVKdWRnbWVudFNwYW5Qcm9jZXNzb3JcIjtcbmV4cG9ydCB7XG4gIEFMTE9XX0FMTF9CQUdHQUdFX0tFWVMsXG4gIEp1ZGdtZW50QmFnZ2FnZVNwYW5Qcm9jZXNzb3IsXG4gIHR5cGUgQmFnZ2FnZUtleVByZWRpY2F0ZSxcbn0gZnJvbSBcIi4vcHJvY2Vzc29ycy9KdWRnbWVudEJhZ2dhZ2VTcGFuUHJvY2Vzc29yXCI7XG5leHBvcnQgeyBKdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yIH0gZnJvbSBcIi4vYmFnZ2FnZS9KdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yXCI7XG5leHBvcnQgKiBhcyBiYWdnYWdlIGZyb20gXCIuL2JhZ2dhZ2VcIjtcbmV4cG9ydCAqIGFzIHByb3BhZ2F0aW9uIGZyb20gXCIuL3Byb3BhZ2F0aW9uXCI7XG5leHBvcnQgeyBUcmFjZXIgfSBmcm9tIFwiLi9UcmFjZXJcIjtcbmV4cG9ydCB7IE9mZmxpbmVUcmFjZXIsIHR5cGUgT2ZmbGluZVRyYWNlckNvbmZpZyB9IGZyb20gXCIuL09mZmxpbmVUcmFjZXJcIjtcbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBPcGVuQUkgfSBmcm9tIFwib3BlbmFpXCI7XG5pbXBvcnQgeyBzZXRMTE1XcmFwcGVyIH0gZnJvbSBcIi4uL3RyYWNlL3J1bnRpbWVcIjtcbmltcG9ydCB7IHdyYXBPcGVuQUkgfSBmcm9tIFwiLi9sbG0vb3BlbmFpXCI7XG5cbmV4cG9ydCB7IHdyYXBPcGVuQUkgfTtcblxuLyoqXG4gKiBXcmFwIGEgc3VwcG9ydGVkIExMTSBjbGllbnQgdG8gYWRkIGF1dG9tYXRpYyB0cmFjaW5nLlxuICpcbiAqIEN1cnJlbnRseSBzdXBwb3J0cyBPcGVuQUkgY2xpZW50cy4gRGV0ZWN0cyB0aGUgY2xpZW50IHR5cGVcbiAqIGF1dG9tYXRpY2FsbHkgYW5kIGFwcGxpZXMgdGhlIGFwcHJvcHJpYXRlIGluc3RydW1lbnRhdGlvbi5cbiAqXG4gKiBAcGFyYW0gY2xpZW50IC0gQW4gT3BlbkFJIGNsaWVudCBpbnN0YW5jZS5cbiAqIEByZXR1cm5zIFRoZSBzYW1lIGNsaWVudCBpbnN0YW5jZSwgaW5zdHJ1bWVudGVkIGluLXBsYWNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgT3BlbkFJIGZyb20gXCJvcGVuYWlcIjtcbiAqIGltcG9ydCB7IHdyYXAgfSBmcm9tIFwianVkZ2V2YWxcIjtcbiAqXG4gKiBjb25zdCBjbGllbnQgPSB3cmFwKG5ldyBPcGVuQUkoKSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyYXA8VCBleHRlbmRzIE9wZW5BST4oY2xpZW50OiBUKTogVCB7XG4gIHJldHVybiB3cmFwT3BlbkFJKGNsaWVudCk7XG59XG5cbnNldExMTVdyYXBwZXIoKGNsaWVudCkgPT4gd3JhcChjbGllbnQgYXMgT3BlbkFJKSk7XG4iLAogICAgImltcG9ydCB0eXBlIHsgT3BlbkFJIH0gZnJvbSBcIm9wZW5haVwiO1xuaW1wb3J0IHsgZG9udFRocm93IH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL2RvbnQtdGhyb3dcIjtcbmltcG9ydCB7IHdyYXBDaGF0Q29tcGxldGlvbnNQYXJzZSB9IGZyb20gXCIuL2JldGEtY2hhdC1jb21wbGV0aW9uc1wiO1xuaW1wb3J0IHsgd3JhcENoYXRDb21wbGV0aW9uc0NyZWF0ZSB9IGZyb20gXCIuL2NoYXQtY29tcGxldGlvbnNcIjtcbmltcG9ydCB7IHdyYXBJbWFnZXNHZW5lcmF0ZSB9IGZyb20gXCIuL2ltYWdlc1wiO1xuaW1wb3J0IHsgd3JhcFJlc3BvbnNlc0NyZWF0ZSB9IGZyb20gXCIuL3Jlc3BvbnNlc1wiO1xuXG4vKipcbiAqIEluc3RydW1lbnQgYW4gT3BlbkFJIGNsaWVudCBpbnN0YW5jZSB0byBlbWl0IEp1ZGdtZW50IHNwYW5zLlxuICpcbiAqIFBhdGNoZXMgdGhlIGZvbGxvd2luZyBtZXRob2RzIGluLXBsYWNlOlxuICogIC0gYGNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZWAgKHN0cmVhbWluZyArIG5vbi1zdHJlYW1pbmcpXG4gKiAgLSBgY2xpZW50LmNoYXQuY29tcGxldGlvbnMucGFyc2VgIChub24tc3RyZWFtaW5nKVxuICogIC0gYGNsaWVudC5yZXNwb25zZXMuY3JlYXRlYCAoc3RyZWFtaW5nICsgbm9uLXN0cmVhbWluZylcbiAqICAtIGBjbGllbnQuaW1hZ2VzLmdlbmVyYXRlYCAoc3RyZWFtaW5nICsgbm9uLXN0cmVhbWluZylcbiAqXG4gKiBAcmV0dXJucyBUaGUgc2FtZSBjbGllbnQgaW5zdGFuY2UgKG11dGF0ZWQpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gd3JhcE9wZW5BSTxUIGV4dGVuZHMgT3BlbkFJPihjbGllbnQ6IFQpOiBUIHtcbiAgZG9udFRocm93KFwid3JhcE9wZW5BSVwiLCAoKSA9PiB7XG4gICAgd3JhcENoYXRDb21wbGV0aW9uc0NyZWF0ZShjbGllbnQpO1xuICAgIHdyYXBDaGF0Q29tcGxldGlvbnNQYXJzZShjbGllbnQpO1xuICAgIHdyYXBSZXNwb25zZXNDcmVhdGUoY2xpZW50KTtcbiAgICB3cmFwSW1hZ2VzR2VuZXJhdGUoY2xpZW50KTtcbiAgfSk7XG4gIHJldHVybiBjbGllbnQ7XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgT3BlbkFJIH0gZnJvbSBcIm9wZW5haVwiO1xuaW1wb3J0IHsgQmFzZVRyYWNlciB9IGZyb20gXCIuLi8uLi8uLi90cmFjZS9CYXNlVHJhY2VyXCI7XG5pbXBvcnQgeyBzYWZlU3RyaW5naWZ5IH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3NlcmlhbGl6ZXJcIjtcbmltcG9ydCB7IGltbXV0YWJsZVdyYXBBc3luYyB9IGZyb20gXCIuLi8uLi8uLi91dGlscy93cmFwcGVyc1wiO1xuaW1wb3J0IHsgcmVjb3JkQ2hhdFVzYWdlIH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuLyoqXG4gKiBXcmFwIGBjbGllbnQuY2hhdC5jb21wbGV0aW9ucy5wYXJzZWAgdG8gcHJvZHVjZSBKdWRnbWVudCBzcGFucy5cbiAqIE5vbi1zdHJlYW1pbmcgb25seSDigJQgcGFyc2UgZG9lcyBub3Qgc3VwcG9ydCBzdHJlYW1pbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cmFwQ2hhdENvbXBsZXRpb25zUGFyc2UoY2xpZW50OiBPcGVuQUkpOiB2b2lkIHtcbiAgY2xpZW50LmNoYXQuY29tcGxldGlvbnMucGFyc2UgPSBpbW11dGFibGVXcmFwQXN5bmMoXG4gICAgY2xpZW50LmNoYXQuY29tcGxldGlvbnMucGFyc2UuYmluZChjbGllbnQuY2hhdC5jb21wbGV0aW9ucyksXG4gICAge1xuICAgICAgcHJlOiAoYm9keSkgPT4ge1xuICAgICAgICBjb25zdCBzcGFuID0gQmFzZVRyYWNlci5zdGFydFNwYW4oXCJPUEVOQUlfQVBJX0NBTExcIik7XG4gICAgICAgIEJhc2VUcmFjZXIuc2V0U3BhbktpbmQoXCJsbG1cIiwgc3Bhbik7XG4gICAgICAgIEJhc2VUcmFjZXIucmVjb3JkTExNTWV0YWRhdGEoeyBtb2RlbDogYm9keS5tb2RlbCB9LCBzcGFuKTtcbiAgICAgICAgQmFzZVRyYWNlci5zZXRJbnB1dChib2R5LCBzcGFuKTtcbiAgICAgICAgcmV0dXJuIHNwYW47XG4gICAgICB9LFxuXG4gICAgICBwb3N0OiAoc3BhbiwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmICghc3BhbikgcmV0dXJuO1xuICAgICAgICBCYXNlVHJhY2VyLnNldE91dHB1dChzYWZlU3RyaW5naWZ5KHJlc3VsdCksIHNwYW4pO1xuICAgICAgICBpZiAocmVzdWx0LnVzYWdlKSByZWNvcmRDaGF0VXNhZ2Uoc3BhbiwgcmVzdWx0LnVzYWdlKTtcbiAgICAgICAgQmFzZVRyYWNlci5yZWNvcmRMTE1NZXRhZGF0YSh7IG1vZGVsOiByZXN1bHQubW9kZWwgfSwgc3Bhbik7XG4gICAgICAgIHJldHVybiBzcGFuO1xuICAgICAgfSxcblxuICAgICAgZXJyb3I6IChzcGFuLCBlcnIpID0+IHtcbiAgICAgICAgaWYgKHNwYW4pIEJhc2VUcmFjZXIuc2V0RXJyb3IoZXJyLCBzcGFuKTtcbiAgICAgICAgcmV0dXJuIHNwYW47XG4gICAgICB9LFxuXG4gICAgICBmaW5hbGx5OiAoc3BhbikgPT4ge1xuICAgICAgICBzcGFuPy5lbmQoKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgZG9udFRocm93IH0gZnJvbSBcIi4uL2RvbnQtdGhyb3dcIjtcbmltcG9ydCB0eXBlIHsgSW1tdXRhYmxlSG9va3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gaW1tdXRhYmxlV3JhcFN5bmM8XG4gIEEgZXh0ZW5kcyB1bmtub3duW10sXG4gIFIsXG4gIEMxID0gdW5kZWZpbmVkLFxuICBDMiA9IHVuZGVmaW5lZCxcbiAgQzMgPSB1bmRlZmluZWQsXG4+KFxuICBmbjogKC4uLmFyZ3M6IEEpID0+IFIsXG4gIGhvb2tzOiBJbW11dGFibGVIb29rczxBLCBSLCBDMSwgQzIsIEMzPiA9IHt9LFxuKTogKC4uLmFyZ3M6IEEpID0+IFIge1xuICBjb25zdCB7XG4gICAgcHJlOiBwcmVGbixcbiAgICBwb3N0OiBwb3N0Rm4sXG4gICAgZXJyb3I6IGVycm9yRm4sXG4gICAgZmluYWxseTogZmluYWxseUZuLFxuICB9ID0gaG9va3M7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXBwZWQoLi4uYXJnczogQSk6IFIge1xuICAgIGNvbnN0IGN0eDEgPSBwcmVGblxuICAgICAgPyBkb250VGhyb3coXCJpbW11dGFibGVXcmFwU3luYy5wcmVcIiwgKCkgPT4gcHJlRm4oLi4uYXJncykpXG4gICAgICA6IHVuZGVmaW5lZDtcblxuICAgIGxldCBmaW5hbEN0eDogQzIgfCBDMyB8IHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZm4oLi4uYXJncyk7XG4gICAgICBpZiAocG9zdEZuKSB7XG4gICAgICAgIGZpbmFsQ3R4ID0gZG9udFRocm93KFwiaW1tdXRhYmxlV3JhcFN5bmMucG9zdFwiLCAoKSA9PlxuICAgICAgICAgIHBvc3RGbihjdHgxLCByZXN1bHQsIGFyZ3MpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnJvckZuKSB7XG4gICAgICAgIGZpbmFsQ3R4ID0gZG9udFRocm93KFwiaW1tdXRhYmxlV3JhcFN5bmMuZXJyb3JcIiwgKCkgPT5cbiAgICAgICAgICBlcnJvckZuKGN0eDEsIGVyciwgYXJncyksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGlmIChmaW5hbGx5Rm4pIHtcbiAgICAgICAgZG9udFRocm93KFwiaW1tdXRhYmxlV3JhcFN5bmMuZmluYWxseVwiLCAoKSA9PiB7XG4gICAgICAgICAgZmluYWxseUZuKGZpbmFsQ3R4KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuIiwKICAgICJpbXBvcnQgeyBkb250VGhyb3cgfSBmcm9tIFwiLi4vZG9udC10aHJvd1wiO1xuaW1wb3J0IHR5cGUgeyBBc3luY0ZuLCBJbW11dGFibGVIb29rcyB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbW11dGFibGVXcmFwQXN5bmM8XG4gIEYgZXh0ZW5kcyBBc3luY0ZuLFxuICBDMSA9IHVuZGVmaW5lZCxcbiAgQzIgPSB1bmRlZmluZWQsXG4gIEMzID0gdW5kZWZpbmVkLFxuPihcbiAgZm46IEYsXG4gIGhvb2tzOiBJbW11dGFibGVIb29rczxQYXJhbWV0ZXJzPEY+LCBBd2FpdGVkPFJldHVyblR5cGU8Rj4+LCBDMSwgQzIsIEMzPiA9IHt9LFxuKTogRiB7XG4gIGNvbnN0IHtcbiAgICBwcmU6IHByZUZuLFxuICAgIHBvc3Q6IHBvc3RGbixcbiAgICBlcnJvcjogZXJyb3JGbixcbiAgICBmaW5hbGx5OiBmaW5hbGx5Rm4sXG4gIH0gPSBob29rcztcblxuICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gd3JhcHBlZChcbiAgICB0aGlzOiB1bmtub3duLFxuICAgIC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj5cbiAgKTogUHJvbWlzZTxBd2FpdGVkPFJldHVyblR5cGU8Rj4+PiB7XG4gICAgY29uc3QgY3R4MSA9IHByZUZuXG4gICAgICA/IGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBBc3luYy5wcmVcIiwgKCkgPT4gcHJlRm4oLi4uYXJncykpXG4gICAgICA6IHVuZGVmaW5lZDtcblxuICAgIGxldCBmaW5hbEN0eDogQzIgfCBDMyB8IHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnNhZmUtYXNzaWdubWVudFxuICAgICAgY29uc3QgcmVzdWx0OiBBd2FpdGVkPFJldHVyblR5cGU8Rj4+ID0gYXdhaXQgZm4uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICBpZiAocG9zdEZuKSB7XG4gICAgICAgIGZpbmFsQ3R4ID0gZG9udFRocm93KFwiaW1tdXRhYmxlV3JhcEFzeW5jLnBvc3RcIiwgKCkgPT5cbiAgICAgICAgICBwb3N0Rm4oY3R4MSwgcmVzdWx0LCBhcmdzKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyb3JGbikge1xuICAgICAgICBmaW5hbEN0eCA9IGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBBc3luYy5lcnJvclwiLCAoKSA9PlxuICAgICAgICAgIGVycm9yRm4oY3R4MSwgZXJyLCBhcmdzKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycjtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgaWYgKGZpbmFsbHlGbikge1xuICAgICAgICBkb250VGhyb3coXCJpbW11dGFibGVXcmFwQXN5bmMuZmluYWxseVwiLCAoKSA9PiB7XG4gICAgICAgICAgZmluYWxseUZuKGZpbmFsQ3R4KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9IGFzIEY7XG59XG4iLAogICAgImltcG9ydCB7IGRvbnRUaHJvdyB9IGZyb20gXCIuLi9kb250LXRocm93XCI7XG5pbXBvcnQgdHlwZSB7IEltbXV0YWJsZUl0ZXJhdG9ySG9va3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gaW1tdXRhYmxlV3JhcFN5bmNJdGVyYXRvcjxcbiAgQSBleHRlbmRzIHVua25vd25bXSxcbiAgWSxcbiAgQzEgPSB1bmRlZmluZWQsXG4gIEMyID0gdW5kZWZpbmVkLFxuICBDMyA9IHVuZGVmaW5lZCxcbj4oXG4gIGZuOiAoLi4uYXJnczogQSkgPT4gSXRlcmFibGU8WT4sXG4gIGhvb2tzOiBJbW11dGFibGVJdGVyYXRvckhvb2tzPEEsIFksIEMxLCBDMiwgQzM+ID0ge30sXG4pOiAoLi4uYXJnczogQSkgPT4gR2VuZXJhdG9yPFk+IHtcbiAgY29uc3Qge1xuICAgIHByZTogcHJlRm4sXG4gICAgeWllbGQ6IHlpZWxkRm4sXG4gICAgcG9zdDogcG9zdEZuLFxuICAgIGVycm9yOiBlcnJvckZuLFxuICAgIGZpbmFsbHk6IGZpbmFsbHlGbixcbiAgfSA9IGhvb2tzO1xuXG4gIHJldHVybiBmdW5jdGlvbiogd3JhcHBlZCguLi5hcmdzOiBBKTogR2VuZXJhdG9yPFk+IHtcbiAgICBjb25zdCBjdHgxID0gcHJlRm5cbiAgICAgID8gZG9udFRocm93KFwiaW1tdXRhYmxlV3JhcFN5bmNJdGVyYXRvci5wcmVcIiwgKCkgPT4gcHJlRm4oLi4uYXJncykpXG4gICAgICA6IHVuZGVmaW5lZDtcblxuICAgIGxldCBmaW5hbEN0eDogQzIgfCBDMyB8IHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiBmbiguLi5hcmdzKSkge1xuICAgICAgICBpZiAoeWllbGRGbikge1xuICAgICAgICAgIGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBTeW5jSXRlcmF0b3IueWllbGRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgeWllbGRGbihjdHgxLCB2YWx1ZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgeWllbGQgdmFsdWU7XG4gICAgICB9XG4gICAgICBpZiAocG9zdEZuKSB7XG4gICAgICAgIGZpbmFsQ3R4ID0gZG9udFRocm93KFwiaW1tdXRhYmxlV3JhcFN5bmNJdGVyYXRvci5wb3N0XCIsICgpID0+XG4gICAgICAgICAgcG9zdEZuKGN0eDEpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVycm9yRm4pIHtcbiAgICAgICAgZmluYWxDdHggPSBkb250VGhyb3coXCJpbW11dGFibGVXcmFwU3luY0l0ZXJhdG9yLmVycm9yXCIsICgpID0+XG4gICAgICAgICAgZXJyb3JGbihjdHgxLCBlcnIpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpZiAoZmluYWxseUZuKSB7XG4gICAgICAgIGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBTeW5jSXRlcmF0b3IuZmluYWxseVwiLCAoKSA9PiB7XG4gICAgICAgICAgZmluYWxseUZuKGZpbmFsQ3R4KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuIiwKICAgICJpbXBvcnQgeyBkb250VGhyb3cgfSBmcm9tIFwiLi4vZG9udC10aHJvd1wiO1xuaW1wb3J0IHR5cGUgeyBJbW11dGFibGVJdGVyYXRvckhvb2tzIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGltbXV0YWJsZVdyYXBBc3luY0l0ZXJhdG9yPFxuICBBIGV4dGVuZHMgdW5rbm93bltdLFxuICBZLFxuICBDMSA9IHVuZGVmaW5lZCxcbiAgQzIgPSB1bmRlZmluZWQsXG4gIEMzID0gdW5kZWZpbmVkLFxuPihcbiAgZm46ICguLi5hcmdzOiBBKSA9PiBBc3luY0l0ZXJhYmxlPFk+LFxuICBob29rczogSW1tdXRhYmxlSXRlcmF0b3JIb29rczxBLCBZLCBDMSwgQzIsIEMzPiA9IHt9LFxuKTogKC4uLmFyZ3M6IEEpID0+IEFzeW5jR2VuZXJhdG9yPFk+IHtcbiAgY29uc3Qge1xuICAgIHByZTogcHJlRm4sXG4gICAgeWllbGQ6IHlpZWxkRm4sXG4gICAgcG9zdDogcG9zdEZuLFxuICAgIGVycm9yOiBlcnJvckZuLFxuICAgIGZpbmFsbHk6IGZpbmFsbHlGbixcbiAgfSA9IGhvb2tzO1xuXG4gIHJldHVybiBhc3luYyBmdW5jdGlvbiogd3JhcHBlZCguLi5hcmdzOiBBKTogQXN5bmNHZW5lcmF0b3I8WT4ge1xuICAgIGNvbnN0IGN0eDEgPSBwcmVGblxuICAgICAgPyBkb250VGhyb3coXCJpbW11dGFibGVXcmFwQXN5bmNJdGVyYXRvci5wcmVcIiwgKCkgPT4gcHJlRm4oLi4uYXJncykpXG4gICAgICA6IHVuZGVmaW5lZDtcblxuICAgIGxldCBmaW5hbEN0eDogQzIgfCBDMyB8IHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB2YWx1ZSBvZiBmbiguLi5hcmdzKSkge1xuICAgICAgICBpZiAoeWllbGRGbikge1xuICAgICAgICAgIGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBBc3luY0l0ZXJhdG9yLnlpZWxkXCIsICgpID0+IHtcbiAgICAgICAgICAgIHlpZWxkRm4oY3R4MSwgdmFsdWUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHlpZWxkIHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKHBvc3RGbikge1xuICAgICAgICBmaW5hbEN0eCA9IGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBBc3luY0l0ZXJhdG9yLnBvc3RcIiwgKCkgPT5cbiAgICAgICAgICBwb3N0Rm4oY3R4MSksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyb3JGbikge1xuICAgICAgICBmaW5hbEN0eCA9IGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBBc3luY0l0ZXJhdG9yLmVycm9yXCIsICgpID0+XG4gICAgICAgICAgZXJyb3JGbihjdHgxLCBlcnIpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpZiAoZmluYWxseUZuKSB7XG4gICAgICAgIGRvbnRUaHJvdyhcImltbXV0YWJsZVdyYXBBc3luY0l0ZXJhdG9yLmZpbmFsbHlcIiwgKCkgPT4ge1xuICAgICAgICAgIGZpbmFsbHlGbihmaW5hbEN0eCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgaW1tdXRhYmxlV3JhcEFzeW5jSXRlcmF0b3IgfSBmcm9tIFwiLi9pbW11dGFibGUtd3JhcC1hc3luYy1pdGVyYXRvclwiO1xuXG4vKipcbiAqIFJlcGxhY2UgYFtTeW1ib2wuYXN5bmNJdGVyYXRvcl1gIG9uIGB0YXJnZXRgIGluIHBsYWNlLCBpbnRlcmNlcHRpbmdcbiAqIHlpZWxkZWQgdmFsdWVzIGFuZCBsaWZlY3ljbGUgZXZlbnRzIHRocm91Z2ggaG9va3MuIFRoZSB0YXJnZXQgb2JqZWN0XG4gKiBpcyBtdXRhdGVkIHNvIHRoYXQgb3RoZXIgcHJvcGVydGllcyAoZS5nLiBgLmNvbnRyb2xsZXJgLCBgLnRlZSgpYClcbiAqIHJlbWFpbiBpbnRhY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUFzeW5jSXRlcmFibGU8VD4oXG4gIHRhcmdldDogQXN5bmNJdGVyYWJsZTxUPixcbiAgaG9va3M6IHtcbiAgICBvbllpZWxkOiAodmFsdWU6IFQpID0+IHZvaWQ7XG4gICAgb25Eb25lOiAoKSA9PiB2b2lkO1xuICAgIG9uRXJyb3I6IChlcnI6IHVua25vd24pID0+IHZvaWQ7XG4gICAgb25GaW5hbGx5OiAoKSA9PiB2b2lkO1xuICB9LFxuKTogdm9pZCB7XG4gIGNvbnN0IG9yaWdpbmFsID0gdGFyZ2V0W1N5bWJvbC5hc3luY0l0ZXJhdG9yXS5iaW5kKHRhcmdldCk7XG5cbiAgY29uc3Qgd3JhcHBlZCA9IGltbXV0YWJsZVdyYXBBc3luY0l0ZXJhdG9yKFxuICAgICgpID0+ICh7IFtTeW1ib2wuYXN5bmNJdGVyYXRvcl06IG9yaWdpbmFsIH0pIGFzIEFzeW5jSXRlcmFibGU8VD4sXG4gICAge1xuICAgICAgeWllbGQ6IChfY3R4LCB2YWx1ZSkgPT4ge1xuICAgICAgICBob29rcy5vbllpZWxkKHZhbHVlKTtcbiAgICAgIH0sXG4gICAgICBwb3N0OiAoKSA9PiB7XG4gICAgICAgIGhvb2tzLm9uRG9uZSgpO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiAoX2N0eCwgZXJyKSA9PiB7XG4gICAgICAgIGhvb2tzLm9uRXJyb3IoZXJyKTtcbiAgICAgIH0sXG4gICAgICBmaW5hbGx5OiAoKSA9PiB7XG4gICAgICAgIGhvb2tzLm9uRmluYWxseSgpO1xuICAgICAgfSxcbiAgICB9LFxuICApO1xuXG4gICh0YXJnZXQgYXMgdW5rbm93biBhcyB7IFtTeW1ib2wuYXN5bmNJdGVyYXRvcl06ICgpID0+IEFzeW5jSXRlcmF0b3I8VD4gfSlbXG4gICAgU3ltYm9sLmFzeW5jSXRlcmF0b3JcbiAgXSA9ICgpID0+IHdyYXBwZWQoKTtcbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBTcGFuIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHR5cGUgeyBDb21wbGV0aW9uVXNhZ2UgfSBmcm9tIFwib3BlbmFpL3Jlc291cmNlcy9jb21wbGV0aW9uc1wiO1xuaW1wb3J0IHsgQXR0cmlidXRlS2V5cyB9IGZyb20gXCIuLi8uLi8uLi9KdWRnbWVudEF0dHJpYnV0ZUtleXNcIjtcbmltcG9ydCB7IEJhc2VUcmFjZXIgfSBmcm9tIFwiLi4vLi4vLi4vdHJhY2UvQmFzZVRyYWNlclwiO1xuaW1wb3J0IHsgZG9udFRocm93IH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL2RvbnQtdGhyb3dcIjtcbmltcG9ydCB7IHNhZmVTdHJpbmdpZnkgfSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvc2VyaWFsaXplclwiO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVjb3JkQ2hhdFVzYWdlKHNwYW46IFNwYW4sIHVzYWdlOiBDb21wbGV0aW9uVXNhZ2UpOiB2b2lkIHtcbiAgZG9udFRocm93KFwicmVjb3JkQ2hhdFVzYWdlXCIsICgpID0+IHtcbiAgICBjb25zdCBjYWNoZVJlYWQgPSB1c2FnZS5wcm9tcHRfdG9rZW5zX2RldGFpbHM/LmNhY2hlZF90b2tlbnMgPz8gMDtcbiAgICBjb25zdCBzdW0gPSB1c2FnZS5wcm9tcHRfdG9rZW5zICsgdXNhZ2UuY29tcGxldGlvbl90b2tlbnMgKyBjYWNoZVJlYWQ7XG4gICAgQmFzZVRyYWNlci5yZWNvcmRMTE1NZXRhZGF0YShcbiAgICAgIHtcbiAgICAgICAgbm9uX2NhY2hlZF9pbnB1dF90b2tlbnM6XG4gICAgICAgICAgc3VtID4gdXNhZ2UudG90YWxfdG9rZW5zXG4gICAgICAgICAgICA/IHVzYWdlLnByb21wdF90b2tlbnMgLSBjYWNoZVJlYWRcbiAgICAgICAgICAgIDogdXNhZ2UucHJvbXB0X3Rva2VucyxcbiAgICAgICAgb3V0cHV0X3Rva2VuczogdXNhZ2UuY29tcGxldGlvbl90b2tlbnMgfHwgdW5kZWZpbmVkLFxuICAgICAgICBjYWNoZV9yZWFkX2lucHV0X3Rva2VuczogY2FjaGVSZWFkIHx8IHVuZGVmaW5lZCxcbiAgICAgIH0sXG4gICAgICBzcGFuLFxuICAgICk7XG4gICAgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoXG4gICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1VTQUdFX01FVEFEQVRBLFxuICAgICAgc2FmZVN0cmluZ2lmeSh1c2FnZSksXG4gICAgICBzcGFuLFxuICAgICk7XG4gIH0pO1xufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IE9wZW5BSSB9IGZyb20gXCJvcGVuYWlcIjtcbmltcG9ydCB0eXBlIHtcbiAgQ2hhdENvbXBsZXRpb24sXG4gIENoYXRDb21wbGV0aW9uQ2h1bmssXG59IGZyb20gXCJvcGVuYWkvcmVzb3VyY2VzL2NoYXQvY29tcGxldGlvbnMvY29tcGxldGlvbnNcIjtcbmltcG9ydCB0eXBlIHsgU3RyZWFtIH0gZnJvbSBcIm9wZW5haS9zdHJlYW1pbmdcIjtcbmltcG9ydCB7IEJhc2VUcmFjZXIgfSBmcm9tIFwiLi4vLi4vLi4vdHJhY2UvQmFzZVRyYWNlclwiO1xuaW1wb3J0IHsgc2FmZVN0cmluZ2lmeSB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9zZXJpYWxpemVyXCI7XG5pbXBvcnQge1xuICBpbW11dGFibGVXcmFwQXN5bmMsXG4gIHByb3h5QXN5bmNJdGVyYWJsZSxcbn0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3dyYXBwZXJzXCI7XG5pbXBvcnQgeyByZWNvcmRDaGF0VXNhZ2UgfSBmcm9tIFwiLi91dGlsc1wiO1xuXG4vKipcbiAqIFdyYXAgYGNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZWAgdG8gcHJvZHVjZSBKdWRnbWVudCBzcGFucy5cbiAqIEhhbmRsZXMgYm90aCBzdHJlYW1pbmcgYW5kIG5vbi1zdHJlYW1pbmcgY2FsbHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cmFwQ2hhdENvbXBsZXRpb25zQ3JlYXRlKGNsaWVudDogT3BlbkFJKTogdm9pZCB7XG4gIGNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSA9IGltbXV0YWJsZVdyYXBBc3luYyhcbiAgICBjbGllbnQuY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUuYmluZChjbGllbnQuY2hhdC5jb21wbGV0aW9ucyksXG4gICAge1xuICAgICAgcHJlOiAoYm9keSkgPT4ge1xuICAgICAgICBpZiAoYm9keS5zdHJlYW0pIGJvZHkuc3RyZWFtX29wdGlvbnMgPz89IHsgaW5jbHVkZV91c2FnZTogdHJ1ZSB9O1xuICAgICAgICBjb25zdCBzcGFuID0gQmFzZVRyYWNlci5zdGFydFNwYW4oXCJPUEVOQUlfQVBJX0NBTExcIik7XG4gICAgICAgIEJhc2VUcmFjZXIuc2V0U3BhbktpbmQoXCJsbG1cIiwgc3Bhbik7XG4gICAgICAgIEJhc2VUcmFjZXIucmVjb3JkTExNTWV0YWRhdGEoeyBtb2RlbDogYm9keS5tb2RlbCB9LCBzcGFuKTtcbiAgICAgICAgQmFzZVRyYWNlci5zZXRJbnB1dChib2R5LCBzcGFuKTtcbiAgICAgICAgcmV0dXJuIHsgc3BhbiwgcHJveGllZDogZmFsc2UgfTtcbiAgICAgIH0sXG5cbiAgICAgIHBvc3Q6IChjdHgsIHJlc3VsdCwgYXJncykgPT4ge1xuICAgICAgICBpZiAoIWN0eCkgcmV0dXJuO1xuICAgICAgICBjb25zdCB7IHNwYW4gfSA9IGN0eDtcblxuICAgICAgICBpZiAoYXJnc1swXS5zdHJlYW0pIHtcbiAgICAgICAgICBjb25zdCBzdHJlYW0gPSByZXN1bHQgYXMgU3RyZWFtPENoYXRDb21wbGV0aW9uQ2h1bms+O1xuICAgICAgICAgIGxldCBhY2N1bXVsYXRlZENvbnRlbnQgPSBcIlwiO1xuXG4gICAgICAgICAgcHJveHlBc3luY0l0ZXJhYmxlKHN0cmVhbSwge1xuICAgICAgICAgICAgb25ZaWVsZChjaHVuaykge1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIGNodW5rLmNob2ljZXNbMF0/LmRlbHRhLmNvbnRlbnQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBhY2N1bXVsYXRlZENvbnRlbnQgKz0gY2h1bmsuY2hvaWNlc1swXS5kZWx0YS5jb250ZW50O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChjaHVuay51c2FnZSkgcmVjb3JkQ2hhdFVzYWdlKHNwYW4sIGNodW5rLnVzYWdlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvbkRvbmUoKSB7XG4gICAgICAgICAgICAgIEJhc2VUcmFjZXIuc2V0T3V0cHV0KGFjY3VtdWxhdGVkQ29udGVudCwgc3Bhbik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25FcnJvcihlcnIpIHtcbiAgICAgICAgICAgICAgQmFzZVRyYWNlci5zZXRFcnJvcihlcnIsIHNwYW4pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uRmluYWxseSgpIHtcbiAgICAgICAgICAgICAgc3Bhbi5lbmQoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4geyBzcGFuLCBwcm94aWVkOiB0cnVlIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb24tc3RyZWFtaW5nXG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb24gPSByZXN1bHQgYXMgQ2hhdENvbXBsZXRpb247XG4gICAgICAgIEJhc2VUcmFjZXIuc2V0T3V0cHV0KHNhZmVTdHJpbmdpZnkoY29tcGxldGlvbiksIHNwYW4pO1xuICAgICAgICBpZiAoY29tcGxldGlvbi51c2FnZSkgcmVjb3JkQ2hhdFVzYWdlKHNwYW4sIGNvbXBsZXRpb24udXNhZ2UpO1xuICAgICAgICBCYXNlVHJhY2VyLnJlY29yZExMTU1ldGFkYXRhKHsgbW9kZWw6IGNvbXBsZXRpb24ubW9kZWwgfSwgc3Bhbik7XG4gICAgICAgIHJldHVybiBjdHg7XG4gICAgICB9LFxuXG4gICAgICBlcnJvcjogKGN0eCwgZXJyKSA9PiB7XG4gICAgICAgIGlmIChjdHgpIEJhc2VUcmFjZXIuc2V0RXJyb3IoZXJyLCBjdHguc3Bhbik7XG4gICAgICAgIHJldHVybiBjdHg7XG4gICAgICB9LFxuXG4gICAgICBmaW5hbGx5OiAoY3R4KSA9PiB7XG4gICAgICAgIGlmIChjdHggJiYgIWN0eC5wcm94aWVkKSBjdHguc3Bhbi5lbmQoKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgKTtcbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBTcGFuIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHR5cGUgeyBPcGVuQUkgfSBmcm9tIFwib3BlbmFpXCI7XG5pbXBvcnQgdHlwZSB7XG4gIEltYWdlR2VuQ29tcGxldGVkRXZlbnQsXG4gIEltYWdlR2VuU3RyZWFtRXZlbnQsXG4gIEltYWdlc1Jlc3BvbnNlLFxufSBmcm9tIFwib3BlbmFpL3Jlc291cmNlcy9pbWFnZXNcIjtcbmltcG9ydCB0eXBlIHsgU3RyZWFtIH0gZnJvbSBcIm9wZW5haS9zdHJlYW1pbmdcIjtcbmltcG9ydCB7IEF0dHJpYnV0ZUtleXMgfSBmcm9tIFwiLi4vLi4vLi4vSnVkZ21lbnRBdHRyaWJ1dGVLZXlzXCI7XG5pbXBvcnQgeyBCYXNlVHJhY2VyIH0gZnJvbSBcIi4uLy4uLy4uL3RyYWNlL0Jhc2VUcmFjZXJcIjtcbmltcG9ydCB7IGRvbnRUaHJvdyB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9kb250LXRocm93XCI7XG5pbXBvcnQgeyBzYWZlU3RyaW5naWZ5IH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3NlcmlhbGl6ZXJcIjtcbmltcG9ydCB7XG4gIGltbXV0YWJsZVdyYXBBc3luYyxcbiAgcHJveHlBc3luY0l0ZXJhYmxlLFxufSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvd3JhcHBlcnNcIjtcblxuY29uc3QgSU1BR0VfQ09NUExFVEVEX1RZUEVTID0gbmV3IFNldChbXG4gIFwiaW1hZ2VfZ2VuZXJhdGlvbi5jb21wbGV0ZWRcIixcbiAgXCJpbWFnZV9lZGl0LmNvbXBsZXRlZFwiLFxuXSk7XG5cbnR5cGUgSW1hZ2VVc2FnZSA9IEltYWdlR2VuQ29tcGxldGVkRXZlbnQuVXNhZ2UgfCBJbWFnZXNSZXNwb25zZS5Vc2FnZTtcblxuZnVuY3Rpb24gcmVjb3JkVXNhZ2Uoc3BhbjogU3BhbiwgdXNhZ2U6IEltYWdlVXNhZ2UpOiB2b2lkIHtcbiAgZG9udFRocm93KFwiaW1hZ2VzLnJlY29yZFVzYWdlXCIsICgpID0+IHtcbiAgICBjb25zdCBpbnB1dERldGFpbHMgPVxuICAgICAgXCJpbnB1dF90b2tlbnNfZGV0YWlsc1wiIGluIHVzYWdlID8gdXNhZ2UuaW5wdXRfdG9rZW5zX2RldGFpbHMgOiB1bmRlZmluZWQ7XG4gICAgY29uc3QgaW1hZ2VJbnB1dFRva2VucyA9IGlucHV0RGV0YWlscz8uaW1hZ2VfdG9rZW5zID8/IDA7XG5cbiAgICBCYXNlVHJhY2VyLnJlY29yZExMTU1ldGFkYXRhKFxuICAgICAge1xuICAgICAgICBub25fY2FjaGVkX2lucHV0X3Rva2VuczogaW5wdXREZXRhaWxzPy50ZXh0X3Rva2VucyA/PyAwLFxuICAgICAgICBvdXRwdXRfdG9rZW5zOiB1c2FnZS5vdXRwdXRfdG9rZW5zIHx8IHVuZGVmaW5lZCxcbiAgICAgIH0sXG4gICAgICBzcGFuLFxuICAgICk7XG5cbiAgICBpZiAoaW1hZ2VJbnB1dFRva2Vucykge1xuICAgICAgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoXG4gICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVNBR0VfTk9OX0NBQ0hFRF9JTlBVVF9JTUFHRV9UT0tFTlMsXG4gICAgICAgIGltYWdlSW5wdXRUb2tlbnMsXG4gICAgICAgIHNwYW4sXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodXNhZ2Uub3V0cHV0X3Rva2Vucykge1xuICAgICAgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoXG4gICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVNBR0VfT1VUUFVUX0lNQUdFX1RPS0VOUyxcbiAgICAgICAgdXNhZ2Uub3V0cHV0X3Rva2VucyxcbiAgICAgICAgc3BhbixcbiAgICAgICk7XG4gICAgfVxuICAgIEJhc2VUcmFjZXIuc2V0QXR0cmlidXRlKFxuICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9VU0FHRV9NRVRBREFUQSxcbiAgICAgIHNhZmVTdHJpbmdpZnkodXNhZ2UpLFxuICAgICAgc3BhbixcbiAgICApO1xuICB9KTtcbn1cblxuLyoqXG4gKiBXcmFwIGBjbGllbnQuaW1hZ2VzLmdlbmVyYXRlYCB0byBwcm9kdWNlIEp1ZGdtZW50IHNwYW5zLlxuICogSGFuZGxlcyBib3RoIHN0cmVhbWluZyBhbmQgbm9uLXN0cmVhbWluZyBjYWxscy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyYXBJbWFnZXNHZW5lcmF0ZShjbGllbnQ6IE9wZW5BSSk6IHZvaWQge1xuICBjbGllbnQuaW1hZ2VzLmdlbmVyYXRlID0gaW1tdXRhYmxlV3JhcEFzeW5jKFxuICAgIGNsaWVudC5pbWFnZXMuZ2VuZXJhdGUuYmluZChjbGllbnQuaW1hZ2VzKSxcbiAgICB7XG4gICAgICBwcmU6IChib2R5KSA9PiB7XG4gICAgICAgIGNvbnN0IHNwYW4gPSBCYXNlVHJhY2VyLnN0YXJ0U3BhbihcIk9QRU5BSV9BUElfQ0FMTFwiKTtcbiAgICAgICAgQmFzZVRyYWNlci5zZXRTcGFuS2luZChcImxsbVwiLCBzcGFuKTtcbiAgICAgICAgQmFzZVRyYWNlci5yZWNvcmRMTE1NZXRhZGF0YSh7IG1vZGVsOiBib2R5Lm1vZGVsIH0sIHNwYW4pO1xuICAgICAgICBCYXNlVHJhY2VyLnNldElucHV0KGJvZHksIHNwYW4pO1xuICAgICAgICByZXR1cm4geyBzcGFuLCBwcm94aWVkOiBmYWxzZSB9O1xuICAgICAgfSxcblxuICAgICAgcG9zdDogKGN0eCwgcmVzdWx0LCBhcmdzKSA9PiB7XG4gICAgICAgIGlmICghY3R4KSByZXR1cm47XG4gICAgICAgIGNvbnN0IHsgc3BhbiB9ID0gY3R4O1xuXG4gICAgICAgIGlmIChhcmdzWzBdLnN0cmVhbSkge1xuICAgICAgICAgIGNvbnN0IHN0cmVhbSA9IHJlc3VsdCBhcyBTdHJlYW08SW1hZ2VHZW5TdHJlYW1FdmVudD47XG4gICAgICAgICAgbGV0IGNvbXBsZXRpb25EYXRhOiBJbWFnZUdlbkNvbXBsZXRlZEV2ZW50IHwgdW5kZWZpbmVkO1xuXG4gICAgICAgICAgcHJveHlBc3luY0l0ZXJhYmxlKHN0cmVhbSwge1xuICAgICAgICAgICAgb25ZaWVsZChjaHVuaykge1xuICAgICAgICAgICAgICBpZiAoSU1BR0VfQ09NUExFVEVEX1RZUEVTLmhhcyhjaHVuay50eXBlKSkge1xuICAgICAgICAgICAgICAgIGNvbXBsZXRpb25EYXRhID0gY2h1bmsgYXMgSW1hZ2VHZW5Db21wbGV0ZWRFdmVudDtcbiAgICAgICAgICAgICAgICByZWNvcmRVc2FnZShzcGFuLCBjb21wbGV0aW9uRGF0YS51c2FnZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvbkRvbmUoKSB7XG4gICAgICAgICAgICAgIEJhc2VUcmFjZXIuc2V0T3V0cHV0KHNhZmVTdHJpbmdpZnkoY29tcGxldGlvbkRhdGEgPz8ge30pLCBzcGFuKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvbkVycm9yKGVycikge1xuICAgICAgICAgICAgICBCYXNlVHJhY2VyLnNldEVycm9yKGVyciwgc3Bhbik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25GaW5hbGx5KCkge1xuICAgICAgICAgICAgICBzcGFuLmVuZCgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJldHVybiB7IHNwYW4sIHByb3hpZWQ6IHRydWUgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5vbi1zdHJlYW1pbmdcbiAgICAgICAgY29uc3QgaW1nUmVzdWx0ID0gcmVzdWx0IGFzIEltYWdlc1Jlc3BvbnNlO1xuICAgICAgICBCYXNlVHJhY2VyLnNldE91dHB1dChzYWZlU3RyaW5naWZ5KGltZ1Jlc3VsdCksIHNwYW4pO1xuICAgICAgICBpZiAoaW1nUmVzdWx0LnVzYWdlKSByZWNvcmRVc2FnZShzcGFuLCBpbWdSZXN1bHQudXNhZ2UpO1xuICAgICAgICByZXR1cm4gY3R4O1xuICAgICAgfSxcblxuICAgICAgZXJyb3I6IChjdHgsIGVycikgPT4ge1xuICAgICAgICBpZiAoY3R4KSBCYXNlVHJhY2VyLnNldEVycm9yKGVyciwgY3R4LnNwYW4pO1xuICAgICAgICByZXR1cm4gY3R4O1xuICAgICAgfSxcblxuICAgICAgZmluYWxseTogKGN0eCkgPT4ge1xuICAgICAgICBpZiAoY3R4ICYmICFjdHgucHJveGllZCkgY3R4LnNwYW4uZW5kKCk7XG4gICAgICB9LFxuICAgIH0sXG4gICk7XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgU3BhbiB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB0eXBlIHsgT3BlbkFJIH0gZnJvbSBcIm9wZW5haVwiO1xuaW1wb3J0IHR5cGUge1xuICBSZXNwb25zZSxcbiAgUmVzcG9uc2VTdHJlYW1FdmVudCxcbiAgUmVzcG9uc2VVc2FnZSxcbn0gZnJvbSBcIm9wZW5haS9yZXNvdXJjZXMvcmVzcG9uc2VzL3Jlc3BvbnNlc1wiO1xuaW1wb3J0IHR5cGUgeyBTdHJlYW0gfSBmcm9tIFwib3BlbmFpL3N0cmVhbWluZ1wiO1xuaW1wb3J0IHsgQXR0cmlidXRlS2V5cyB9IGZyb20gXCIuLi8uLi8uLi9KdWRnbWVudEF0dHJpYnV0ZUtleXNcIjtcbmltcG9ydCB7IEJhc2VUcmFjZXIgfSBmcm9tIFwiLi4vLi4vLi4vdHJhY2UvQmFzZVRyYWNlclwiO1xuaW1wb3J0IHsgZG9udFRocm93IH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL2RvbnQtdGhyb3dcIjtcbmltcG9ydCB7IHNhZmVTdHJpbmdpZnkgfSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvc2VyaWFsaXplclwiO1xuaW1wb3J0IHtcbiAgaW1tdXRhYmxlV3JhcEFzeW5jLFxuICBwcm94eUFzeW5jSXRlcmFibGUsXG59IGZyb20gXCIuLi8uLi8uLi91dGlscy93cmFwcGVyc1wiO1xuXG5mdW5jdGlvbiByZWNvcmRVc2FnZShzcGFuOiBTcGFuLCB1c2FnZTogUmVzcG9uc2VVc2FnZSk6IHZvaWQge1xuICBkb250VGhyb3coXCJyZXNwb25zZXMucmVjb3JkVXNhZ2VcIiwgKCkgPT4ge1xuICAgIGNvbnN0IGNhY2hlUmVhZCA9IHVzYWdlLmlucHV0X3Rva2Vuc19kZXRhaWxzLmNhY2hlZF90b2tlbnM7XG4gICAgY29uc3Qgc3VtID0gdXNhZ2UuaW5wdXRfdG9rZW5zICsgdXNhZ2Uub3V0cHV0X3Rva2VucyArIGNhY2hlUmVhZDtcbiAgICBCYXNlVHJhY2VyLnJlY29yZExMTU1ldGFkYXRhKFxuICAgICAge1xuICAgICAgICBub25fY2FjaGVkX2lucHV0X3Rva2VuczpcbiAgICAgICAgICBzdW0gPiB1c2FnZS50b3RhbF90b2tlbnNcbiAgICAgICAgICAgID8gdXNhZ2UuaW5wdXRfdG9rZW5zIC0gY2FjaGVSZWFkXG4gICAgICAgICAgICA6IHVzYWdlLmlucHV0X3Rva2VucyxcbiAgICAgICAgb3V0cHV0X3Rva2VuczogdXNhZ2Uub3V0cHV0X3Rva2VucyB8fCB1bmRlZmluZWQsXG4gICAgICAgIGNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zOiBjYWNoZVJlYWQgfHwgdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICAgIHNwYW4sXG4gICAgKTtcbiAgICBCYXNlVHJhY2VyLnNldEF0dHJpYnV0ZShcbiAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVNBR0VfTUVUQURBVEEsXG4gICAgICBzYWZlU3RyaW5naWZ5KHVzYWdlKSxcbiAgICAgIHNwYW4sXG4gICAgKTtcbiAgfSk7XG59XG5cbi8qKlxuICogV3JhcCBgY2xpZW50LnJlc3BvbnNlcy5jcmVhdGVgIHRvIHByb2R1Y2UgSnVkZ21lbnQgc3BhbnMuXG4gKiBIYW5kbGVzIGJvdGggc3RyZWFtaW5nIGFuZCBub24tc3RyZWFtaW5nIGNhbGxzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gd3JhcFJlc3BvbnNlc0NyZWF0ZShjbGllbnQ6IE9wZW5BSSk6IHZvaWQge1xuICBjbGllbnQucmVzcG9uc2VzLmNyZWF0ZSA9IGltbXV0YWJsZVdyYXBBc3luYyhcbiAgICBjbGllbnQucmVzcG9uc2VzLmNyZWF0ZS5iaW5kKGNsaWVudC5yZXNwb25zZXMpLFxuICAgIHtcbiAgICAgIHByZTogKGJvZHkpID0+IHtcbiAgICAgICAgY29uc3Qgc3BhbiA9IEJhc2VUcmFjZXIuc3RhcnRTcGFuKFwiT1BFTkFJX0FQSV9DQUxMXCIpO1xuICAgICAgICBCYXNlVHJhY2VyLnNldFNwYW5LaW5kKFwibGxtXCIsIHNwYW4pO1xuICAgICAgICBCYXNlVHJhY2VyLnJlY29yZExMTU1ldGFkYXRhKHsgbW9kZWw6IGJvZHkubW9kZWwgfSwgc3Bhbik7XG4gICAgICAgIEJhc2VUcmFjZXIuc2V0SW5wdXQoYm9keSwgc3Bhbik7XG4gICAgICAgIHJldHVybiB7IHNwYW4sIHByb3hpZWQ6IGZhbHNlIH07XG4gICAgICB9LFxuXG4gICAgICBwb3N0OiAoY3R4LCByZXN1bHQsIGFyZ3MpID0+IHtcbiAgICAgICAgaWYgKCFjdHgpIHJldHVybjtcbiAgICAgICAgY29uc3QgeyBzcGFuIH0gPSBjdHg7XG5cbiAgICAgICAgaWYgKGFyZ3NbMF0uc3RyZWFtKSB7XG4gICAgICAgICAgY29uc3Qgc3RyZWFtID0gcmVzdWx0IGFzIFN0cmVhbTxSZXNwb25zZVN0cmVhbUV2ZW50PjtcbiAgICAgICAgICBsZXQgYWNjdW11bGF0ZWRDb250ZW50ID0gXCJcIjtcblxuICAgICAgICAgIHByb3h5QXN5bmNJdGVyYWJsZShzdHJlYW0sIHtcbiAgICAgICAgICAgIG9uWWllbGQoY2h1bmspIHtcbiAgICAgICAgICAgICAgaWYgKGNodW5rLnR5cGUgPT09IFwicmVzcG9uc2Uub3V0cHV0X3RleHQuZGVsdGFcIikge1xuICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkQ29udGVudCArPSBjaHVuay5kZWx0YTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoY2h1bmsudHlwZSA9PT0gXCJyZXNwb25zZS5jb21wbGV0ZWRcIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3AgPSBjaHVuay5yZXNwb25zZTtcbiAgICAgICAgICAgICAgICBpZiAocmVzcC51c2FnZSkgcmVjb3JkVXNhZ2Uoc3BhbiwgcmVzcC51c2FnZSk7XG4gICAgICAgICAgICAgICAgQmFzZVRyYWNlci5yZWNvcmRMTE1NZXRhZGF0YSh7IG1vZGVsOiByZXNwLm1vZGVsIH0sIHNwYW4pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25Eb25lKCkge1xuICAgICAgICAgICAgICBCYXNlVHJhY2VyLnNldE91dHB1dChhY2N1bXVsYXRlZENvbnRlbnQsIHNwYW4pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uRXJyb3IoZXJyKSB7XG4gICAgICAgICAgICAgIEJhc2VUcmFjZXIuc2V0RXJyb3IoZXJyLCBzcGFuKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvbkZpbmFsbHkoKSB7XG4gICAgICAgICAgICAgIHNwYW4uZW5kKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIHsgc3BhbiwgcHJveGllZDogdHJ1ZSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm9uLXN0cmVhbWluZ1xuICAgICAgICBjb25zdCByZXNwID0gcmVzdWx0IGFzIFJlc3BvbnNlO1xuICAgICAgICBCYXNlVHJhY2VyLnNldE91dHB1dChzYWZlU3RyaW5naWZ5KHJlc3ApLCBzcGFuKTtcbiAgICAgICAgaWYgKHJlc3AudXNhZ2UpIHJlY29yZFVzYWdlKHNwYW4sIHJlc3AudXNhZ2UpO1xuICAgICAgICBpZiAodHlwZW9mIHJlc3AubW9kZWwgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICBCYXNlVHJhY2VyLnJlY29yZExMTU1ldGFkYXRhKHsgbW9kZWw6IHJlc3AubW9kZWwgfSwgc3Bhbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN0eDtcbiAgICAgIH0sXG5cbiAgICAgIGVycm9yOiAoY3R4LCBlcnIpID0+IHtcbiAgICAgICAgaWYgKGN0eCkgQmFzZVRyYWNlci5zZXRFcnJvcihlcnIsIGN0eC5zcGFuKTtcbiAgICAgICAgcmV0dXJuIGN0eDtcbiAgICAgIH0sXG5cbiAgICAgIGZpbmFsbHk6IChjdHgpID0+IHtcbiAgICAgICAgaWYgKGN0eCAmJiAhY3R4LnByb3hpZWQpIGN0eC5zcGFuLmVuZCgpO1xuICAgICAgfSxcbiAgICB9LFxuICApO1xufVxuIiwKICAgICJleHBvcnQgeyBFeGFtcGxlLCB0eXBlIEV4YW1wbGVEaWN0IH0gZnJvbSBcIi4vRXhhbXBsZVwiO1xuZXhwb3J0IHR5cGUgeyBTY29yaW5nUmVzdWx0IH0gZnJvbSBcIi4vU2NvcmluZ1Jlc3VsdFwiO1xuIgogIF0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBLFNBQVMsU0FBUyxDQUFDLFNBQWlCLGNBQXNDO0FBQUEsRUFDeEUsTUFBTSxRQUFRLFFBQVEsSUFBSTtBQUFBLEVBQzFCLElBQUksQ0FBQyxPQUFPO0FBQUEsSUFDVixPQUFPLGdCQUFnQjtBQUFBLEVBQ3pCO0FBQUEsRUFDQSxPQUFPO0FBQUE7QUFBQSxJQUdJLGtCQUNBLGlCQUNBLGtCQUlBO0FBQUE7QUFBQSxFQU5BLG1CQUFtQixVQUFVLGtCQUFrQjtBQUFBLEVBQy9DLGtCQUFrQixVQUFVLGlCQUFpQjtBQUFBLEVBQzdDLG1CQUFtQixVQUM5QixvQkFDQSw2QkFDRjtBQUFBLEVBQ2EscUJBQXFCLFVBQVUsc0JBQXNCLE1BQU07QUFBQTs7QUNnQ2pFLE1BQU0sa0JBQWtCO0FBQUEsRUFDckI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBRVIsV0FBVyxDQUFDLFNBQWlCLFFBQWdCLGdCQUF3QjtBQUFBLElBQ25FLEtBQUssVUFBVTtBQUFBLElBQ2YsS0FBSyxTQUFTO0FBQUEsSUFDZCxLQUFLLGlCQUFpQjtBQUFBO0FBQUEsRUFHeEIsVUFBVSxHQUFXO0FBQUEsSUFDbkIsT0FBTyxLQUFLO0FBQUE7QUFB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QVMsS0FBSztBQUFBLE1BQy9CO0FBQUEsTUFHQSxNQUFNLE9BQU87QUFBQSxNQUNiLFdBQVcsVUFBVSxjQUFjLElBQUksR0FBRyxJQUFJO0FBQUEsTUFDOUMsSUFBSSxLQUFLO0FBQUEsUUFBTyxhQUFZLE1BQU0sS0FBSyxLQUFLO0FBQUEsTUFDNUMsSUFBSSxPQUFPLEtBQUssVUFBVSxVQUFVO0FBQUEsUUFDbEMsV0FBVyxrQkFBa0IsRUFBRSxPQUFPLEtBQUssTUFBTSxHQUFHLElBQUk7QUFBQSxNQUMxRDtBQUFBLE1BQ0EsT0FBTztBQUFBO0FBQUEsSUFHVCxPQUFPLENBQUMsS0FBSyxRQUFRO0FBQUEsTUFDbkIsSUFBSTtBQUFBLFFBQUssV0FBVyxTQUFTLEtBQUssSUFBSSxJQUFJO0FBQUEsTUFDMUMsT0FBTztBQUFBO0FBQUEsSUFHVCxTQUFTLENBQUMsUUFBUTtBQUFBLE1BQ2hCLElBQUksT0FBTyxDQUFDLElBQUk7QUFBQSxRQUFTLElBQUksS0FBSyxJQUFJO0FBQUE7QUFBQSxFQUUxQyxDQUNGO0FBQUE7OztBVjFGSyxTQUFTLFVBQTRCLENBQUMsU0FBYztBQUFBLEVBQ3pELFVBQVUsY0FBYyxNQUFNO0FBQUEsSUFDNUIsMEJBQTBCLE9BQU07QUFBQSxJQUNoQyx5QkFBeUIsT0FBTTtBQUFBLElBQy9CLG9CQUFvQixPQUFNO0FBQUEsSUFDMUIsbUJBQW1CLE9BQU07QUFBQSxHQUMxQjtBQUFBLEVBQ0QsT0FBTztBQUFBOzs7QURGRixTQUFTLElBQXNCLENBQUMsU0FBYztBQUFBLEVBQ25ELE9BQU8sV0FBVyxPQUFNO0FBQUE7QUFHMUIsY0FBYyxDQUFDLFlBQVcsS0FBSyxPQUFnQixDQUFDOztBWTNCaEQ7IiwKICAiZGVidWdJZCI6ICJGOTMyNDA1NjNGNkY0MEVENjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
