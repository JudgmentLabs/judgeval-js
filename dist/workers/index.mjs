var __defProp = Object.defineProperty;
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

// src/trace/BaseTracer.ts
import {
  INVALID_SPAN_CONTEXT as INVALID_SPAN_CONTEXT2,
  SpanStatusCode as SpanStatusCode2
} from "@opentelemetry/api";

// src/utils/annotate.ts
var ARROW_ARG = /^([^(]+?)=>/;
var FN_ARGS = /^[^(]*\(\s*([^)]*)\)/m;
var FN_ARG_SPLIT = /,/;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
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

// src/utils/logger.ts
function getProcess() {
  return globalThis.process;
}
function getEnvVar(name, defaultValue) {
  return getProcess()?.env?.[name] ?? defaultValue;
}

class Logger {
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
        const logLevel = getEnvVar("JUDGMENT_LOG_LEVEL", "warn").toLowerCase();
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
}

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

// src/trace/runtime.ts
import {
  INVALID_SPAN_CONTEXT,
  ROOT_CONTEXT,
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
var noOpTracer = new NoOpTracer;
var noOpRuntime = {
  register() {},
  deregister() {},
  setActive() {
    return false;
  },
  getActiveTracer() {
    return null;
  },
  getCurrentContext() {
    return ROOT_CONTEXT;
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
var runtime = null;
var llmWrapper = null;
function setTraceRuntime(nextRuntime) {
  runtime = nextRuntime;
}
function getTraceRuntime() {
  return runtime ?? noOpRuntime;
}
function wrapLLMClient(client) {
  if (!llmWrapper) {
    Logger.warning("LLM client instrumentation is not available from this entrypoint.");
    return client;
  }
  return llmWrapper(client);
}

// src/trace/baggage/index.ts
import { baggageEntryMetadataFromString as baggageEntryMetadataFromString2 } from "@opentelemetry/api";

// src/trace/baggage/JudgmentBaggagePropagator.ts
import { isTracingSuppressed } from "@opentelemetry/core";

// src/trace/baggage/constants.ts
var BAGGAGE_KEY_PAIR_SEPARATOR = "=";
var BAGGAGE_PROPERTIES_SEPARATOR = ";";
var BAGGAGE_ITEMS_SEPARATOR = ",";
var BAGGAGE_HEADER = "baggage";
var BAGGAGE_MAX_NAME_VALUE_PAIRS = 180;
var BAGGAGE_MAX_PER_NAME_VALUE_PAIRS = 4096;
var BAGGAGE_MAX_TOTAL_LENGTH = 8192;

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

// src/trace/baggage/JudgmentBaggagePropagator.ts
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

// src/trace/baggage/index.ts
var createBaggage = propagation.createBaggage.bind(propagation);
var BAGGAGE_KEY = createContextKey("baggage");
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
var _globalTextmap = new CompositePropagator({
  propagators: [
    new W3CTraceContextPropagator,
    new JudgmentBaggagePropagator
  ]
});
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

// src/trace/BaseTracer.ts
var TRACER_NAME = "judgeval";

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
  constructor(projectName, projectId, apiKey, organizationId, apiUrl, environment, serializer, tracerProvider, client, enableMonitoring) {
    this.projectName = projectName;
    this.projectId = projectId;
    this.apiKey = apiKey;
    this.organizationId = organizationId;
    this.apiUrl = apiUrl;
    this.environment = environment;
    this.serializer = serializer;
    this._tracerProvider = tracerProvider;
    this._client = client;
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
  static wrap(client) {
    return wrapLLMClient(client);
  }
  static getOTELTracer() {
    const proxy = BaseTracer._getProxyProvider();
    return proxy.getTracer(TRACER_NAME);
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
            span.setStatus({ code: SpanStatusCode2.ERROR, message: String(e) });
            span.recordException(e);
            throw e;
          });
        }
        return result;
      } catch (e) {
        span.setStatus({ code: SpanStatusCode2.ERROR, message: String(e) });
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
        const otelTracer = proxy.getTracer(TRACER_NAME);
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
          const parentlessCtx = proxy.setSpan(proxy.getCurrentContext(), proxy.wrapSpanContext(INVALID_SPAN_CONTEXT2));
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
                code: SpanStatusCode2.ERROR,
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
                  code: SpanStatusCode2.ERROR,
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
            span.setStatus({ code: SpanStatusCode2.ERROR, message: String(e) });
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
      target.setStatus({ code: SpanStatusCode2.ERROR, message: String(error) });
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
// src/workers/Tracer.ts
import {
  defaultResource,
  resourceFromAttributes
} from "@opentelemetry/resources";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
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
var cache = new Map;
var inflight = new Map;
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
// package.json
var version = "1.0.1";

// src/version.ts
var VERSION = version;

// src/trace/exporters/NoOpSpanExporter.ts
import { ExportResultCode } from "@opentelemetry/core";

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

// src/trace/exporters/NoOpSpanExporter.ts
class NoOpSpanExporter extends JudgmentSpanExporter {
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
}

// src/trace/processors/JudgmentSpanProcessor.ts
import {
  BatchSpanProcessor
} from "@opentelemetry/sdk-trace-base";

// src/trace/processors/JudgmentBaggageSpanProcessor.ts
var ALLOW_ALL_BAGGAGE_KEYS = () => true;

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

// src/trace/processors/JudgmentSpanProcessor.ts
function makeSpanKey(ctx) {
  return `${ctx.traceId}:${ctx.spanId}`;
}
function isZeroHrTime(hrTime) {
  return hrTime[0] === 0 && hrTime[1] === 0;
}

class JudgmentSpanProcessor extends BatchSpanProcessor {
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
}

// src/trace/processors/NoOpSpanProcessor.ts
class NoOpSpanProcessor extends JudgmentSpanProcessor {
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
}

// src/workers/WorkerTracerProvider.ts
import {
  INVALID_SPAN_CONTEXT as INVALID_SPAN_CONTEXT3,
  ROOT_CONTEXT as ROOT_CONTEXT2,
  SpanStatusCode as SpanStatusCode3,
  trace as trace2
} from "@opentelemetry/api";
var TRACER_NAME2 = "judgeval";
var activeContext = ROOT_CONTEXT2;
function takeExporterError(tracer) {
  const exporter = tracer.getSpanExporter();
  return exporter.takeExportError?.();
}

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
    return trace2.wrapSpanContext(INVALID_SPAN_CONTEXT3);
  }
  startActiveSpan(_name, ...args) {
    const fn = args.length === 1 ? args[0] : args.length === 2 ? args[1] : args[2];
    return fn(this.startSpan());
  }
}

class WorkerTracerProvider {
  static _instance = null;
  _activeTracer = null;
  _noOpTracer;
  _proxyTracer;
  _tracers = new Set;
  constructor() {
    this._noOpTracer = new NoOpTracer2;
    this._proxyTracer = new ProxyTracer(this);
    setTraceRuntime(this);
  }
  static getInstance() {
    WorkerTracerProvider._instance ??= new WorkerTracerProvider;
    return WorkerTracerProvider._instance;
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
    return activeContext;
  }
  setSpan(ctx, span) {
    return trace2.setSpan(ctx, span);
  }
  wrapSpanContext(spanContext) {
    return trace2.wrapSpanContext(spanContext);
  }
  getCurrentSpan() {
    return trace2.getSpan(this.getCurrentContext());
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
    return tracer._tracerProvider.getTracer(TRACER_NAME2);
  }
  getTracer(_instrumentingModuleName, _instrumentingLibraryVersion, _options) {
    return this._proxyTracer;
  }
  addInstrumentation(_instrumentor) {
    Logger.warning("OpenTelemetry instrumentations are only supported by the Node entrypoint.");
  }
  useSpan(span, endOnExit, recordException, setStatusOnException, fn) {
    const prevCtx = this.getCurrentContext();
    const ctx = trace2.setSpan(prevCtx, span);
    activeContext = ctx;
    const restore = () => {
      activeContext = prevCtx;
    };
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
                code: SpanStatusCode3.ERROR,
                message: `${err.name}: ${err.message}`
              });
            }
          }
          throw exc;
        }).finally(() => {
          if (endOnExit)
            span.end();
          restore();
        });
      }
      if (endOnExit)
        span.end();
      restore();
      return result;
    } catch (exc) {
      if (span.isRecording()) {
        if (recordException)
          span.recordException(exc);
        if (setStatusOnException) {
          const err = exc;
          span.setStatus({
            code: SpanStatusCode3.ERROR,
            message: `${err.name}: ${err.message}`
          });
        }
      }
      if (endOnExit)
        span.end();
      restore();
      throw exc;
    }
  }
  attachContext(ctx) {
    activeContext = ctx;
  }
  withContext(ctx, fn) {
    const prevCtx = this.getCurrentContext();
    activeContext = ctx;
    const restore = () => {
      activeContext = prevCtx;
    };
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.finally(restore);
      }
      restore();
      return result;
    } catch (exc) {
      restore();
      throw exc;
    }
  }
  async forceFlush() {
    const results = await Promise.allSettled(Array.from(this._tracers).map((t) => t._tracerProvider.forceFlush()));
    const errors = [];
    for (const r of results) {
      if (r.status === "rejected") {
        Logger.error(`forceFlush failed: ${String(r.reason)}`);
        errors.push(r.reason);
      }
    }
    if (errors.length === 0) {
      for (const tracer of this._tracers) {
        const error = takeExporterError(tracer);
        if (error) {
          Logger.error(`forceFlush export failed: ${String(error)}`);
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw errors[0];
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
    activeContext = ROOT_CONTEXT2;
  }
}

// src/workers/WorkerSpanExporter.ts
import { ExportResultCode as ExportResultCode2 } from "@opentelemetry/core";
import { ProtobufTraceSerializer } from "@opentelemetry/otlp-transformer";
class WorkerSpanExporter extends JudgmentSpanExporter {
  _endpoint;
  _apiKey;
  _organizationId;
  _projectId;
  _exportErrors = [];
  constructor(_endpoint, _apiKey, _organizationId, _projectId) {
    super("", "", "", "");
    this._endpoint = _endpoint;
    this._apiKey = _apiKey;
    this._organizationId = _organizationId;
    this._projectId = _projectId;
  }
  export(spans, resultCallback) {
    const body = ProtobufTraceSerializer.serializeRequest(spans);
    if (!body) {
      resultCallback({ code: ExportResultCode2.SUCCESS });
      return;
    }
    fetch(this._endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._apiKey}`,
        "Content-Type": "application/x-protobuf",
        "X-Organization-Id": this._organizationId,
        "X-Project-Id": this._projectId
      },
      body
    }).then(async (res) => {
      if (res.ok) {
        resultCallback({ code: ExportResultCode2.SUCCESS });
        return;
      }
      const detail = (await res.text().catch(() => "")).slice(0, 500);
      const error = new Error(detail ? `OTLP export failed: ${res.status}: ${detail}` : `OTLP export failed: ${res.status}`);
      this._exportErrors.push(error);
      resultCallback({ code: ExportResultCode2.FAILED, error });
    }).catch((error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this._exportErrors.push(normalized);
      resultCallback({ code: ExportResultCode2.FAILED, error: normalized });
    });
  }
  takeExportError() {
    return this._exportErrors.shift();
  }
  shutdown() {
    return Promise.resolve();
  }
  forceFlush() {
    const error = this.takeExportError();
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve();
  }
}

// src/workers/Tracer.ts
function requireConfigValue(value, key) {
  if (!value) {
    throw new Error(`${key} is required for judgeval/workers Tracer.init`);
  }
  return value;
}

class Tracer extends BaseTracer {
  _spanExporter = null;
  _spanProcessor = null;
  constructor(projectName, projectId, apiKey, organizationId, apiUrl, environment, serializer, tracerProvider, client2) {
    super(projectName, projectId, apiKey, organizationId, apiUrl, environment, serializer, tracerProvider, client2, true);
  }
  static async init(config) {
    const apiKey = requireConfigValue(config.apiKey, "apiKey");
    const organizationId = requireConfigValue(config.organizationId, "organizationId");
    const apiUrl = requireConfigValue(config.apiUrl, "apiUrl");
    const serializer = config.serializer ?? safeStringify;
    const client2 = new JudgmentApiClient(apiUrl, apiKey, organizationId);
    let projectId = config.projectId;
    if (!projectId) {
      const projectName = requireConfigValue(config.projectName, "projectName");
      try {
        projectId = await resolveProjectId(client2, projectName);
      } catch (err) {
        throw new Error(`Project '${projectName}' not found; cannot start judgeval/workers tracer: ${String(err)}`);
      }
    }
    const serviceName = config.projectName ?? projectId;
    const resourceAttrs = {
      "service.name": serviceName,
      "telemetry.sdk.name": "judgeval",
      "telemetry.sdk.version": VERSION,
      "judgment.project_id": projectId
    };
    if (config.environment) {
      resourceAttrs["deployment.environment"] = config.environment;
    }
    if (config.resourceAttributes) {
      Object.assign(resourceAttrs, config.resourceAttributes);
    }
    const resource = defaultResource().merge(resourceFromAttributes(resourceAttrs));
    const tracer = new Tracer(config.projectName ?? null, projectId, apiKey, organizationId, apiUrl, config.environment ?? null, serializer, new WebTracerProvider({
      resource,
      sampler: config.sampler,
      spanLimits: config.spanLimits
    }), client2);
    const providerWithProcessor = new WebTracerProvider({
      resource,
      sampler: config.sampler,
      spanLimits: config.spanLimits,
      spanProcessors: [
        tracer.getSpanProcessor(),
        ...config.spanProcessors ?? []
      ]
    });
    tracer._tracerProvider = providerWithProcessor;
    const proxy = WorkerTracerProvider.getInstance();
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
      this._spanExporter = new WorkerSpanExporter(endpoint, this.apiKey, this.organizationId, this.projectId);
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
}
export {
  exports_propagation as propagation,
  exports_baggage as baggage,
  WorkerSpanExporter,
  Tracer,
  NoOpSpanProcessor,
  NoOpSpanExporter,
  JudgmentSpanProcessor,
  JudgmentSpanExporter,
  JudgmentBaggageSpanProcessor,
  JudgmentBaggagePropagator,
  BaseTracer,
  ALLOW_ALL_BAGGAGE_KEYS
};

//# debugId=67B1C9E4E436FC4664756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3RyYWNlL0Jhc2VUcmFjZXIudHMiLCAiLi4vc3JjL3V0aWxzL2Fubm90YXRlLnRzIiwgIi4uL3NyYy91dGlscy9sb2dnZXIudHMiLCAiLi4vc3JjL3V0aWxzL2RvbnQtdGhyb3cudHMiLCAiLi4vc3JjL3V0aWxzL3JhbmRvbS11dWlkLnRzIiwgIi4uL3NyYy91dGlscy9zZXJpYWxpemVyLnRzIiwgIi4uL3NyYy90cmFjZS9iYWdnYWdlL2luZGV4LnRzIiwgIi4uL3NyYy90cmFjZS9ydW50aW1lLnRzIiwgIi4uL3NyYy90cmFjZS9iYWdnYWdlL0p1ZGdtZW50QmFnZ2FnZVByb3BhZ2F0b3IudHMiLCAiLi4vc3JjL3RyYWNlL2JhZ2dhZ2UvY29uc3RhbnRzLnRzIiwgIi4uL3NyYy90cmFjZS9iYWdnYWdlL3V0aWxzLnRzIiwgIi4uL3NyYy90cmFjZS9wcm9wYWdhdGlvbi9pbmRleC50cyIsICIuLi9zcmMvd29ya2Vycy9UcmFjZXIudHMiLCAiLi4vc3JjL2ludGVybmFsL2FwaS9jbGllbnQudHMiLCAiLi4vc3JjL3V0aWxzL3JldHJ5LnRzIiwgIi4uL3NyYy91dGlscy9yZXNvbHZlLXByb2plY3QtaWQudHMiLCAiLi4vc3JjL3ZlcnNpb24udHMiLCAiLi4vc3JjL3RyYWNlL2V4cG9ydGVycy9Ob09wU3BhbkV4cG9ydGVyLnRzIiwgIi4uL3NyYy90cmFjZS9leHBvcnRlcnMvSnVkZ21lbnRTcGFuRXhwb3J0ZXIudHMiLCAiLi4vc3JjL3RyYWNlL3Byb2Nlc3NvcnMvSnVkZ21lbnRTcGFuUHJvY2Vzc29yLnRzIiwgIi4uL3NyYy90cmFjZS9wcm9jZXNzb3JzL0p1ZGdtZW50QmFnZ2FnZVNwYW5Qcm9jZXNzb3IudHMiLCAiLi4vc3JjL3RyYWNlL3Byb2Nlc3NvcnMvTm9PcFNwYW5Qcm9jZXNzb3IudHMiLCAiLi4vc3JjL3dvcmtlcnMvV29ya2VyVHJhY2VyUHJvdmlkZXIudHMiLCAiLi4vc3JjL3dvcmtlcnMvV29ya2VyU3BhbkV4cG9ydGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgImltcG9ydCB7XG4gIHR5cGUgQXR0cmlidXRlcyxcbiAgdHlwZSBDb250ZXh0LFxuICBJTlZBTElEX1NQQU5fQ09OVEVYVCxcbiAgdHlwZSBTcGFuLFxuICBTcGFuU3RhdHVzQ29kZSxcbiAgdHlwZSBUcmFjZXIsXG59IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB0eXBlIHsgSW5zdHJ1bWVudGF0aW9uIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2luc3RydW1lbnRhdGlvblwiO1xuaW1wb3J0IHR5cGUge1xuICBCYXNpY1RyYWNlclByb3ZpZGVyLFxuICBTYW1wbGVyLFxuICBTcGFuTGltaXRzLFxuICBTcGFuUHJvY2Vzc29yLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB7IEF0dHJpYnV0ZUtleXMsIEludGVybmFsQXR0cmlidXRlS2V5cyB9IGZyb20gXCIuLi9KdWRnbWVudEF0dHJpYnV0ZUtleXNcIjtcbmltcG9ydCB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaVwiO1xuaW1wb3J0IHR5cGUgeyBQZW5kaW5nRXZhbFBheWxvYWQgfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpL21vZGVscy9QZW5kaW5nRXZhbFBheWxvYWRcIjtcbmltcG9ydCB7IHBhcnNlRnVuY3Rpb25BcmdzIH0gZnJvbSBcIi4uL3V0aWxzL2Fubm90YXRlXCI7XG5pbXBvcnQgeyBkb250VGhyb3cgfSBmcm9tIFwiLi4vdXRpbHMvZG9udC10aHJvd1wiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2xvZ2dlclwiO1xuaW1wb3J0IHsgY3JlYXRlUmFuZG9tVVVJRCB9IGZyb20gXCIuLi91dGlscy9yYW5kb20tdXVpZFwiO1xuaW1wb3J0IHtcbiAgc2FmZVN0cmluZ2lmeSxcbiAgc2VyaWFsaXplQXR0cmlidXRlLFxuICBTZXJpYWxpemVyLFxufSBmcm9tIFwiLi4vdXRpbHMvc2VyaWFsaXplclwiO1xuaW1wb3J0IHsgTWF5YmUgfSBmcm9tIFwiLi4vdXRpbHMvdHlwZS1oZWxwZXJzXCI7XG5pbXBvcnQgeyBjcmVhdGVCYWdnYWdlLCBnZXRCYWdnYWdlLCBzZXRCYWdnYWdlIH0gZnJvbSBcIi4vYmFnZ2FnZVwiO1xuaW1wb3J0IHsgZXh0cmFjdCB9IGZyb20gXCIuL3Byb3BhZ2F0aW9uXCI7XG5pbXBvcnQgdHlwZSB7IEp1ZGdtZW50U3BhbkV4cG9ydGVyIH0gZnJvbSBcIi4vZXhwb3J0ZXJzL0p1ZGdtZW50U3BhbkV4cG9ydGVyXCI7XG5pbXBvcnQgdHlwZSB7IEp1ZGdtZW50U3BhblByb2Nlc3NvciB9IGZyb20gXCIuL3Byb2Nlc3NvcnMvSnVkZ21lbnRTcGFuUHJvY2Vzc29yXCI7XG5pbXBvcnQgeyBnZXRUcmFjZVJ1bnRpbWUsIHR5cGUgVHJhY2VSdW50aW1lLCB3cmFwTExNQ2xpZW50IH0gZnJvbSBcIi4vcnVudGltZVwiO1xuXG5jb25zdCBUUkFDRVJfTkFNRSA9IFwianVkZ2V2YWxcIjtcblxuLyoqXG4gKiBNZXRhZGF0YSBhYm91dCBhbiBMTE0gY2FsbCB0byByZWNvcmQgb24gYSBzcGFuLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIExMTU1ldGFkYXRhIHtcbiAgLyoqIE1vZGVsIG5hbWUgKGUuZy4gXCJncHQtNG9cIikuICovXG4gIG1vZGVsPzogTWF5YmU8c3RyaW5nPjtcbiAgLyoqIFByb3ZpZGVyIG5hbWUgKGUuZy4gXCJvcGVuYWlcIikuICovXG4gIHByb3ZpZGVyPzogTWF5YmU8c3RyaW5nPjtcbiAgLyoqIE51bWJlciBvZiBub24tY2FjaGVkIGlucHV0IHRva2Vucy4gKi9cbiAgbm9uX2NhY2hlZF9pbnB1dF90b2tlbnM/OiBNYXliZTxudW1iZXI+O1xuICAvKiogTnVtYmVyIG9mIG91dHB1dCB0b2tlbnMuICovXG4gIG91dHB1dF90b2tlbnM/OiBNYXliZTxudW1iZXI+O1xuICAvKiogTnVtYmVyIG9mIGNhY2hlLXJlYWQgaW5wdXQgdG9rZW5zLiAqL1xuICBjYWNoZV9yZWFkX2lucHV0X3Rva2Vucz86IE1heWJlPG51bWJlcj47XG4gIC8qKiBOdW1iZXIgb2YgY2FjaGUtY3JlYXRpb24gaW5wdXQgdG9rZW5zLiAqL1xuICBjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnM/OiBNYXliZTxudW1iZXI+O1xuICAvKiogVG90YWwgY29zdCBpbiBVU0QuICovXG4gIHRvdGFsX2Nvc3RfdXNkPzogTWF5YmU8bnVtYmVyPjtcbn1cblxuLyoqXG4gKiBPcHRpb25zIGZvciB7QGxpbmsgQmFzZVRyYWNlci5vYnNlcnZlfS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBPYnNlcnZlT3B0aW9ucyB7XG4gIC8qKiBUaGUgc3BhbiBraW5kIChlLmcuIGBcImxsbVwiYCwgYFwidG9vbFwiYCwgYFwic3BhblwiYCkuIERlZmF1bHRzIHRvIGBcInNwYW5cImAuICovXG4gIHNwYW5UeXBlPzogc3RyaW5nO1xuICAvKiogQ3VzdG9tIHNwYW4gbmFtZS4gRGVmYXVsdHMgdG8gdGhlIHdyYXBwZWQgZnVuY3Rpb24ncyBuYW1lLiAqL1xuICBzcGFuTmFtZT86IHN0cmluZztcbiAgLyoqIFdoZXRoZXIgdG8gcmVjb3JkIGZ1bmN0aW9uIGlucHV0cyBhcyBhIHNwYW4gYXR0cmlidXRlLiBEZWZhdWx0cyB0byBgdHJ1ZWAuICovXG4gIHJlY29yZElucHV0PzogYm9vbGVhbjtcbiAgLyoqIFdoZXRoZXIgdG8gcmVjb3JkIGZ1bmN0aW9uIG91dHB1dHMgYXMgYSBzcGFuIGF0dHJpYnV0ZS4gRGVmYXVsdHMgdG8gYHRydWVgLiAqL1xuICByZWNvcmRPdXRwdXQ/OiBib29sZWFuO1xuICAvKipcbiAgICogSWYgYHRydWVgLCBydW4gdGhlIGZ1bmN0aW9uIGluIGEgZnJlc2ggbGlua2VkIHRyYWNlIGluc3RlYWQgb2YgYXMgYVxuICAgKiBjaGlsZCBvZiB0aGUgY3VycmVudCB0cmFjZSwgd2hlbiBhbiBhY3RpdmUgcGFyZW50IHNwYW4gZXhpc3RzLlxuICAgKiBEZWZhdWx0cyB0byBgZmFsc2VgLlxuICAgKi9cbiAgZm9yaz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3Ige0BsaW5rIEJhc2VUcmFjZXIuYXN5bmNFdmFsdWF0ZX0uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNFdmFsdWF0ZU9wdGlvbnMge1xuICAvKipcbiAgICogTmFtZSBvZiB0aGUgaG9zdGVkIGp1ZGdlL3Njb3JlciAoZS5nLiBgXCJmYWl0aGZ1bG5lc3NcImAsXG4gICAqIGBcImFuc3dlcl9yZWxldmFuY3lcImApLlxuICAgKi9cbiAganVkZ2U6IHN0cmluZztcbiAgLyoqXG4gICAqIE9wdGlvbmFsIGRpY3Qgd2l0aCBldmFsdWF0aW9uIGRhdGEuIEtleXMgbGlrZSBgaW5wdXRgLCBgYWN0dWFsX291dHB1dGAsXG4gICAqIGBleHBlY3RlZF9vdXRwdXRgLCBhbmQgYHJldHJpZXZhbF9jb250ZXh0YCBhcmUgY29tbW9ubHkgdXNlZC5cbiAgICovXG4gIGV4YW1wbGU/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIGluaXRpYWxpemluZyBhIFRyYWNlci5cbiAqXG4gKiBDcmVkZW50aWFscyBhcmUgcmVzb2x2ZWQgaW4gb3JkZXI6IGV4cGxpY2l0IGFyZ3VtZW50cyBmaXJzdCwgdGhlblxuICogZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlckNvbmZpZyB7XG4gIC8qKiBZb3VyIEp1ZGdtZW50IHByb2plY3QgbmFtZS4gUmVxdWlyZWQgZm9yIHNwYW4gZXhwb3J0LiAqL1xuICBwcm9qZWN0TmFtZT86IHN0cmluZztcbiAgLyoqIEp1ZGdtZW50IEFQSSBrZXkuIERlZmF1bHRzIHRvIGBKVURHTUVOVF9BUElfS0VZYCBlbnYgdmFyLiAqL1xuICBhcGlLZXk/OiBzdHJpbmc7XG4gIC8qKiBKdWRnbWVudCBvcmdhbml6YXRpb24gSUQuIERlZmF1bHRzIHRvIGBKVURHTUVOVF9PUkdfSURgIGVudiB2YXIuICovXG4gIG9yZ2FuaXphdGlvbklkPzogc3RyaW5nO1xuICAvKiogSnVkZ21lbnQgQVBJIFVSTC4gRGVmYXVsdHMgdG8gYEpVREdNRU5UX0FQSV9VUkxgIGVudiB2YXIuICovXG4gIGFwaVVybD86IHN0cmluZztcbiAgLyoqIERlcGxveW1lbnQgZW52aXJvbm1lbnQgbmFtZSAoZS5nLiBcInByb2R1Y3Rpb25cIikuICovXG4gIGVudmlyb25tZW50Pzogc3RyaW5nO1xuICAvKiogV2hldGhlciB0byBhdXRvbWF0aWNhbGx5IHNldCB0aGlzIHRyYWNlciBhcyBhY3RpdmUuIERlZmF1bHRzIHRvIGB0cnVlYC4gKi9cbiAgc2V0QWN0aXZlPzogYm9vbGVhbjtcbiAgLyoqIEN1c3RvbSBzZXJpYWxpemF0aW9uIGZ1bmN0aW9uIGZvciBzcGFuIGF0dHJpYnV0ZSB2YWx1ZXMuICovXG4gIHNlcmlhbGl6ZXI/OiAodmFsdWU6IHVua25vd24pID0+IHN0cmluZztcbiAgLyoqIEFkZGl0aW9uYWwgT3BlblRlbGVtZXRyeSByZXNvdXJjZSBhdHRyaWJ1dGVzLiAqL1xuICByZXNvdXJjZUF0dHJpYnV0ZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAvKiogQ3VzdG9tIE9wZW5UZWxlbWV0cnkgc2FtcGxlci4gRGVmYXVsdHMgdG8gdGhlIFNESydzIGRlZmF1bHQuICovXG4gIHNhbXBsZXI/OiBTYW1wbGVyO1xuICAvKiogQ3VzdG9tIE9wZW5UZWxlbWV0cnkgc3BhbiBsaW1pdHMgKGF0dHJpYnV0ZS9ldmVudC9saW5rIGNhcHMpLiAqL1xuICBzcGFuTGltaXRzPzogU3BhbkxpbWl0cztcbiAgLyoqIEFkZGl0aW9uYWwgc3BhbiBwcm9jZXNzb3JzIHRvIHJlZ2lzdGVyIGFsb25nc2lkZSBKdWRnbWVudCdzIG93biBwcm9jZXNzb3IuICovXG4gIHNwYW5Qcm9jZXNzb3JzPzogU3BhblByb2Nlc3NvcltdO1xufVxuXG4vKipcbiAqIEFic3RyYWN0IGJhc2UgZm9yIGFsbCBKdWRnbWVudCB0cmFjZXJzLlxuICpcbiAqIFByb3ZpZGVzIHRoZSBjb3JlIHRyYWNpbmcgc3VyZmFjZTogc3BhbiBjcmVhdGlvbiwgYXR0cmlidXRlIHJlY29yZGluZyxcbiAqIHRoZSBgb2JzZXJ2ZWAgZGVjb3JhdG9yLCBjb250ZXh0IHByb3BhZ2F0aW9uIGZvciBjdXN0b21lci9zZXNzaW9uIElEcyxcbiAqIHRhZ2dpbmcsIGFuZCBhc3luYyBldmFsdWF0aW9uIGRpc3BhdGNoLlxuICogQ29uY3JldGUgc3ViY2xhc3NlcyBzdXBwbHkgdGhlIE9UZWwgVHJhY2VyUHJvdmlkZXIsIGV4cG9ydGVyLCBhbmRcbiAqIHByb2Nlc3NvciB3aXJpbmcuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlVHJhY2VyIHtcbiAgcHJvamVjdE5hbWU6IHN0cmluZyB8IG51bGw7XG4gIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbDtcbiAgYXBpS2V5OiBzdHJpbmcgfCBudWxsO1xuICBvcmdhbml6YXRpb25JZDogc3RyaW5nIHwgbnVsbDtcbiAgYXBpVXJsOiBzdHJpbmcgfCBudWxsO1xuICBlbnZpcm9ubWVudDogc3RyaW5nIHwgbnVsbDtcbiAgc2VyaWFsaXplcjogU2VyaWFsaXplcjtcbiAgX3RyYWNlclByb3ZpZGVyOiBCYXNpY1RyYWNlclByb3ZpZGVyO1xuICBfY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudCB8IG51bGw7XG4gIF9lbmFibGVNb25pdG9yaW5nOiBib29sZWFuO1xuXG4gIHJlYWRvbmx5IHN1cHBvcnRzTGl2ZUluc3RydW1lbnRhdGlvbjogYm9vbGVhbiA9IHRydWU7XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBJbml0aWFsaXphdGlvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICBwcm90ZWN0ZWQgY29uc3RydWN0b3IoXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyB8IG51bGwsXG4gICAgcHJvamVjdElkOiBzdHJpbmcgfCBudWxsLFxuICAgIGFwaUtleTogc3RyaW5nIHwgbnVsbCxcbiAgICBvcmdhbml6YXRpb25JZDogc3RyaW5nIHwgbnVsbCxcbiAgICBhcGlVcmw6IHN0cmluZyB8IG51bGwsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyB8IG51bGwsXG4gICAgc2VyaWFsaXplcjogU2VyaWFsaXplcixcbiAgICB0cmFjZXJQcm92aWRlcjogQmFzaWNUcmFjZXJQcm92aWRlcixcbiAgICBjbGllbnQ6IEp1ZGdtZW50QXBpQ2xpZW50IHwgbnVsbCxcbiAgICBlbmFibGVNb25pdG9yaW5nOiBib29sZWFuLFxuICApIHtcbiAgICB0aGlzLnByb2plY3ROYW1lID0gcHJvamVjdE5hbWU7XG4gICAgdGhpcy5wcm9qZWN0SWQgPSBwcm9qZWN0SWQ7XG4gICAgdGhpcy5hcGlLZXkgPSBhcGlLZXk7XG4gICAgdGhpcy5vcmdhbml6YXRpb25JZCA9IG9yZ2FuaXphdGlvbklkO1xuICAgIHRoaXMuYXBpVXJsID0gYXBpVXJsO1xuICAgIHRoaXMuZW52aXJvbm1lbnQgPSBlbnZpcm9ubWVudDtcbiAgICB0aGlzLnNlcmlhbGl6ZXIgPSBzZXJpYWxpemVyO1xuICAgIHRoaXMuX3RyYWNlclByb3ZpZGVyID0gdHJhY2VyUHJvdmlkZXI7XG4gICAgdGhpcy5fY2xpZW50ID0gY2xpZW50O1xuICAgIHRoaXMuX2VuYWJsZU1vbml0b3JpbmcgPSBlbmFibGVNb25pdG9yaW5nO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGlzIHRyYWNlciBhcyB0aGUgYWN0aXZlIHRyYWNlciBpbiB0aGUgZ2xvYmFsIHByb3ZpZGVyLlxuICAgKlxuICAgKiBAcmV0dXJucyBgdHJ1ZWAgaWYgYWN0aXZhdGlvbiBzdWNjZWVkZWQsIGBmYWxzZWAgaWYgYSByb290IHNwYW4gaXMgYWN0aXZlLlxuICAgKi9cbiAgc2V0QWN0aXZlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBnZXRUcmFjZVJ1bnRpbWUoKS5zZXRBY3RpdmUodGhpcyk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIEFic3RyYWN0IExpZmVjeWNsZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIGFic3RyYWN0IGdldFNwYW5Qcm9jZXNzb3IoKTogSnVkZ21lbnRTcGFuUHJvY2Vzc29yO1xuICBhYnN0cmFjdCBnZXRTcGFuRXhwb3J0ZXIoKTogSnVkZ21lbnRTcGFuRXhwb3J0ZXI7XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBJbnRlcm5hbCBIZWxwZXJzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICBwcml2YXRlIHN0YXRpYyBfZ2V0UHJveHlQcm92aWRlcigpOiBUcmFjZVJ1bnRpbWUge1xuICAgIHJldHVybiBnZXRUcmFjZVJ1bnRpbWUoKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIF9nZXRTZXJpYWxpemVyKCk6IFNlcmlhbGl6ZXIge1xuICAgIGNvbnN0IHRyYWNlciA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKS5nZXRBY3RpdmVUcmFjZXIoKTtcbiAgICByZXR1cm4gdHJhY2VyPy5zZXJpYWxpemVyID8/IHNhZmVTdHJpbmdpZnk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBfZ2V0Q3VycmVudFRyYWNlQW5kU3BhbklkKCk6IFtzdHJpbmcsIHN0cmluZ10gfCBudWxsIHtcbiAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICBjb25zdCBjdXJyZW50U3BhbiA9IHByb3h5LmdldEN1cnJlbnRTcGFuKCk7XG4gICAgaWYgKCFjdXJyZW50U3Bhbj8uaXNSZWNvcmRpbmcoKSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgY3R4ID0gY3VycmVudFNwYW4uc3BhbkNvbnRleHQoKTtcbiAgICBpZiAoIWN0eC50cmFjZUlkIHx8ICEoY3R4LnRyYWNlRmxhZ3MgJiAweDAxKSkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIFtjdHgudHJhY2VJZCwgY3R4LnNwYW5JZF07XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBfZW1pdFBhcnRpYWwoKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiQmFzZVRyYWNlci5fZW1pdFBhcnRpYWxcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdHJhY2VyID0gQmFzZVRyYWNlci5fZ2V0UHJveHlQcm92aWRlcigpLmdldEFjdGl2ZVRyYWNlcigpO1xuICAgICAgaWYgKCF0cmFjZXIgfHwgIXRyYWNlci5zdXBwb3J0c0xpdmVJbnN0cnVtZW50YXRpb24pIHJldHVybjtcbiAgICAgIHRyYWNlci5nZXRTcGFuUHJvY2Vzc29yKCkuZW1pdFBhcnRpYWwoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuICAvLyAgU3RhdGljIEFQSTogU3BhbiBBY2Nlc3MgJiBMaWZlY3ljbGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY3VycmVudGx5IGFjdGl2ZSBzcGFuLlxuICAgKlxuICAgKiBAcmV0dXJucyBUaGUgYWN0aXZlIHNwYW4sIG9yIGB1bmRlZmluZWRgIGlmIG5vbmUuXG4gICAqL1xuICBzdGF0aWMgZ2V0Q3VycmVudFNwYW4oKTogU3BhbiB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgcmV0dXJuIHByb3h5LmdldEN1cnJlbnRTcGFuKCk7XG4gIH1cblxuICAvKipcbiAgICogRmx1c2ggYWxsIHBlbmRpbmcgc3BhbnMgdG8gdGhlIGV4cG9ydCBlbmRwb2ludC5cbiAgICpcbiAgICogQ2FsbCB0aGlzIGJlZm9yZSB5b3VyIHByb2Nlc3MgZXhpdHMgdG8gZW5zdXJlIGFsbCBzcGFucyBhcmUgc2VudC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBhd2FpdCBUcmFjZXIuZm9yY2VGbHVzaCgpO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBhc3luYyBmb3JjZUZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHByb3h5ID0gQmFzZVRyYWNlci5fZ2V0UHJveHlQcm92aWRlcigpO1xuICAgIGF3YWl0IHByb3h5LmZvcmNlRmx1c2goKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaHV0IGRvd24gdGhlIHRyYWNlciBhbmQgZmx1c2ggYW55IHBlbmRpbmcgZGF0YS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBhd2FpdCBUcmFjZXIuc2h1dGRvd24oKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgc2h1dGRvd24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgYXdhaXQgcHJveHkuc2h1dGRvd24oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhbiBPcGVuVGVsZW1ldHJ5IGluc3RydW1lbnRhdGlvbiB0byBjYXB0dXJlIHNwYW5zIGF1dG9tYXRpY2FsbHkuXG4gICAqXG4gICAqIEBwYXJhbSBpbnN0cnVtZW50b3IgLSBUaGUgT3BlblRlbGVtZXRyeSBpbnN0cnVtZW50YXRpb24gdG8gcmVnaXN0ZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogaW1wb3J0IHsgT3BlbkFJSW5zdHJ1bWVudGF0aW9uIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2luc3RydW1lbnRhdGlvbi1vcGVuYWlcIjtcbiAgICogVHJhY2VyLnJlZ2lzdGVyT1RFTEluc3RydW1lbnRhdGlvbihuZXcgT3BlbkFJSW5zdHJ1bWVudGF0aW9uKCkpO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyByZWdpc3Rlck9URUxJbnN0cnVtZW50YXRpb24oaW5zdHJ1bWVudG9yOiBJbnN0cnVtZW50YXRpb24pOiB2b2lkIHtcbiAgICBkb250VGhyb3coXCJCYXNlVHJhY2VyLnJlZ2lzdGVyT1RFTEluc3RydW1lbnRhdGlvblwiLCAoKSA9PiB7XG4gICAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICAgIHByb3h5LmFkZEluc3RydW1lbnRhdGlvbihpbnN0cnVtZW50b3IpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyYXAgYSBzdXBwb3J0ZWQgTExNIGNsaWVudCB0byBhZGQgYXV0b21hdGljIHRyYWNpbmcuXG4gICAqXG4gICAqIEN1cnJlbnRseSBzdXBwb3J0cyBPcGVuQUkgY2xpZW50cy4gVGhlIGNsaWVudCBpcyBpbnN0cnVtZW50ZWRcbiAgICogaW4tcGxhY2UgYW5kIHJldHVybmVkLlxuICAgKlxuICAgKiBAcGFyYW0gY2xpZW50IC0gQW4gTExNIGNsaWVudCBpbnN0YW5jZSAoZS5nLiBgbmV3IE9wZW5BSSgpYCkuXG4gICAqIEByZXR1cm5zIFRoZSBzYW1lIGNsaWVudCBpbnN0YW5jZSwgaW5zdHJ1bWVudGVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGltcG9ydCBPcGVuQUkgZnJvbSBcIm9wZW5haVwiO1xuICAgKlxuICAgKiBjb25zdCBjbGllbnQgPSBUcmFjZXIud3JhcChuZXcgT3BlbkFJKCkpO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyB3cmFwPFQ+KGNsaWVudDogVCk6IFQge1xuICAgIHJldHVybiB3cmFwTExNQ2xpZW50KGNsaWVudCk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYzogU3BhbiBDcmVhdGlvbiAoT1RFTC1saWtlIHNpZ25hdHVyZXMpICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHVuZGVybHlpbmcgT3BlblRlbGVtZXRyeSBUcmFjZXIgaW5zdGFuY2UuXG4gICAqXG4gICAqIEByZXR1cm5zIFRoZSBPcGVuVGVsZW1ldHJ5IGBUcmFjZXJgLlxuICAgKi9cbiAgc3RhdGljIGdldE9URUxUcmFjZXIoKTogVHJhY2VyIHtcbiAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICByZXR1cm4gcHJveHkuZ2V0VHJhY2VyKFRSQUNFUl9OQU1FKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhIG5ldyBzcGFuIHdpdGhvdXQgc2V0dGluZyBpdCBhcyBhY3RpdmUuXG4gICAqXG4gICAqICoqTW9zdCB1c2VycyBzaG91bGQgcHJlZmVyIHtAbGluayBvYnNlcnZlfSBvciB7QGxpbmsgd2l0aH0qKiwgd2hpY2hcbiAgICogaGFuZGxlIGFjdGl2YXRpb24sIGVycm9yIHJlY29yZGluZywgYW5kIHNwYW4gZW5kaW5nIGF1dG9tYXRpY2FsbHkuXG4gICAqIFVzZSB0aGlzIG9ubHkgd2hlbiB5b3UgbmVlZCBsb3ctbGV2ZWwgY29udHJvbCBvdmVyIHRoZSBzcGFuIGxpZmVjeWNsZS5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgLSBUaGUgc3BhbiBuYW1lLlxuICAgKiBAcGFyYW0gYXR0cmlidXRlcyAtIE9wdGlvbmFsIHNwYW4gYXR0cmlidXRlcy5cbiAgICogQHJldHVybnMgVGhlIGNyZWF0ZWQgc3Bhbi5cbiAgICovXG4gIHN0YXRpYyBzdGFydFNwYW4obmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzPzogQXR0cmlidXRlcyk6IFNwYW4ge1xuICAgIGNvbnN0IHNwYW4gPSBCYXNlVHJhY2VyLmdldE9URUxUcmFjZXIoKS5zdGFydFNwYW4obmFtZSwgeyBhdHRyaWJ1dGVzIH0pO1xuICAgIEJhc2VUcmFjZXIuX2VtaXRQYXJ0aWFsKCk7XG4gICAgcmV0dXJuIHNwYW47XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBuZXcgYWN0aXZlIHNwYW4gYW5kIHJ1biBhIGZ1bmN0aW9uIHdpdGhpbiBpdC5cbiAgICpcbiAgICogVGhlIHNwYW4gaXMgYXV0b21hdGljYWxseSBlbmRlZCB3aGVuIHRoZSBmdW5jdGlvbiBjb21wbGV0ZXMuXG4gICAqXG4gICAqICoqTW9zdCB1c2VycyBzaG91bGQgcHJlZmVyIHtAbGluayBvYnNlcnZlfSBvciB7QGxpbmsgd2l0aH0qKiwgd2hpY2hcbiAgICogYWRkaXRpb25hbGx5IHJlY29yZCBpbnB1dHMvb3V0cHV0cyBhbmQgY2FwdHVyZSBlcnJvcnMgYXV0b21hdGljYWxseS5cbiAgICogVXNlIHRoaXMgb25seSB3aGVuIHlvdSBuZWVkIGxvdy1sZXZlbCBjb250cm9sIG92ZXIgdGhlIHNwYW4gbGlmZWN5Y2xlLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIFNwYW4gb3B0aW9ucy4gYG5hbWVgIGlzIHJlcXVpcmVkOyBgYXR0cmlidXRlc2AgaXMgb3B0aW9uYWwuXG4gICAqIEBwYXJhbSBmbiAtIEZ1bmN0aW9uIHRvIGV4ZWN1dGUgd2l0aGluIHRoZSBzcGFuIGNvbnRleHQuXG4gICAqIEByZXR1cm5zIFRoZSByZXR1cm4gdmFsdWUgb2YgYGZuYC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBUcmFjZXIuc3RhcnRBY3RpdmVTcGFuKHsgbmFtZTogXCJmZXRjaC11c2VyXCIgfSwgKHNwYW4pID0+IHtcbiAgICogICAvLyAuLi5cbiAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIHN0YXJ0QWN0aXZlU3BhbjxUPihcbiAgICBvcHRpb25zOiB7IG5hbWU6IHN0cmluZzsgYXR0cmlidXRlcz86IEF0dHJpYnV0ZXMgfSxcbiAgICBmbjogKHNwYW46IFNwYW4pID0+IFQsXG4gICk6IFQge1xuICAgIGNvbnN0IHsgbmFtZSwgYXR0cmlidXRlcyB9ID0gb3B0aW9ucztcbiAgICByZXR1cm4gQmFzZVRyYWNlci5nZXRPVEVMVHJhY2VyKCkuc3RhcnRBY3RpdmVTcGFuKFxuICAgICAgbmFtZSxcbiAgICAgIHsgYXR0cmlidXRlcyB9LFxuICAgICAgKHNwYW4pID0+IHtcbiAgICAgICAgQmFzZVRyYWNlci5fZW1pdFBhcnRpYWwoKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBmbihzcGFuKTtcbiAgICAgICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgUHJvbWlzZTx1bmtub3duPikuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgICAgIHNwYW4uZW5kKCk7XG4gICAgICAgICAgICB9KSBhcyBUO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGFuLmVuZCgpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBzcGFuLmVuZCgpO1xuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuICAvLyAgU3RhdGljOiBTcGFuIEhlbHBlcnMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5hbWVkIHNwYW4sIGV4ZWN1dGUgYSBmdW5jdGlvbiwgYW5kIGhhbmRsZSBlcnJvcnMuXG4gICAqXG4gICAqIEVycm9ycyBhcmUgcmVjb3JkZWQgb24gdGhlIHNwYW4gYW5kIHJlLXRocm93bi5cbiAgICpcbiAgICogQHBhcmFtIHNwYW5OYW1lIC0gVGhlIHNwYW4gbmFtZS5cbiAgICogQHBhcmFtIGZuIC0gRnVuY3Rpb24gdG8gZXhlY3V0ZSB3aXRoaW4gdGhlIHNwYW4uXG4gICAqIEByZXR1cm5zIFRoZSByZXR1cm4gdmFsdWUgb2YgYGZuYC5cbiAgICovXG4gIHN0YXRpYyBzcGFuPFQ+KHNwYW5OYW1lOiBzdHJpbmcsIGZuOiAoc3BhbjogU3BhbikgPT4gVCk6IFQge1xuICAgIHJldHVybiBCYXNlVHJhY2VyLnN0YXJ0QWN0aXZlU3Bhbih7IG5hbWU6IHNwYW5OYW1lIH0sIChzcGFuKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBmbihzcGFuKTtcbiAgICAgICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0LmNhdGNoKChlOiB1bmtub3duKSA9PiB7XG4gICAgICAgICAgICBzcGFuLnNldFN0YXR1cyh7IGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLCBtZXNzYWdlOiBTdHJpbmcoZSkgfSk7XG4gICAgICAgICAgICBzcGFuLnJlY29yZEV4Y2VwdGlvbihlIGFzIEVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgfSkgYXMgVDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzcGFuLnNldFN0YXR1cyh7IGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLCBtZXNzYWdlOiBTdHJpbmcoZSkgfSk7XG4gICAgICAgIHNwYW4ucmVjb3JkRXhjZXB0aW9uKGUgYXMgRXJyb3IpO1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFsaWFzIGZvciB7QGxpbmsgc3Bhbn0uIENyZWF0ZSBhIG5hbWVkIHNwYW4gYW5kIGV4ZWN1dGUgYSBmdW5jdGlvbiB3aXRoaW4gaXQuXG4gICAqXG4gICAqIEBwYXJhbSBzcGFuTmFtZSAtIFRoZSBzcGFuIG5hbWUuXG4gICAqIEBwYXJhbSBmbiAtIEZ1bmN0aW9uIHRvIGV4ZWN1dGUgd2l0aGluIHRoZSBzcGFuLlxuICAgKiBAcmV0dXJucyBUaGUgcmV0dXJuIHZhbHVlIG9mIGBmbmAuXG4gICAqL1xuICBzdGF0aWMgd2l0aDxUPihzcGFuTmFtZTogc3RyaW5nLCBmbjogKHNwYW46IFNwYW4pID0+IFQpOiBUIHtcbiAgICByZXR1cm4gQmFzZVRyYWNlci5zcGFuKHNwYW5OYW1lLCBmbik7XG4gIH1cblxuICAvKipcbiAgICogQ29udGludWUgYSBkaXN0cmlidXRlZCB0cmFjZSBmcm9tIGFuIHVwc3RyZWFtIHNlcnZpY2UuXG4gICAqXG4gICAqIEV4dHJhY3RzIFczQyB0cmFjZSBjb250ZXh0IGFuZCBiYWdnYWdlIGZyb20gYGNhcnJpZXJgIGFuZCBpbnN0YWxsc1xuICAgKiBpdCBhcyB0aGUgYWN0aXZlIGNvbnRleHQgZm9yIHRoZSBkdXJhdGlvbiBvZiBgZm5gLiBBbnkgc3BhbiBzdGFydGVkXG4gICAqIGluc2lkZSDigJQgaW5jbHVkaW5nIGBAVHJhY2VyLm9ic2VydmVgLXdyYXBwZWQgZnVuY3Rpb25zIGFuZFxuICAgKiBgVHJhY2VyLndpdGhgIGJsb2NrcyDigJQgYmVjb21lcyBhIGNoaWxkIG9mIHRoZSB1cHN0cmVhbSBwYXJlbnQsXG4gICAqIHN0aXRjaGluZyB5b3VyIHNlcnZpY2UgaW50byB0aGUgY2FsbGVyJ3MgdHJhY2UuXG4gICAqXG4gICAqIFVzZSB0aGlzIGF0IHRoZSBlbnRyeSBwb2ludCBvZiBhbiBpbmJvdW5kIHJlcXVlc3QgKEhUVFAgaGFuZGxlcixcbiAgICogbWVzc2FnZSBxdWV1ZSBjb25zdW1lciwgUlBDIGRpc3BhdGNoZXIsIGV0Yy4pIHRvIGpvaW4gYSB0cmFjZVxuICAgKiBzdGFydGVkIGJ5IHRoZSB1cHN0cmVhbSBjYWxsZXIuIElmIHRoZSBjYXJyaWVyIGNvbnRhaW5zIG5vIHRyYWNlXG4gICAqIGNvbnRleHQsIGBmbmAgc3RpbGwgcnVucyBub3JtYWxseSB3aXRoIGEgZnJlc2ggY29udGV4dC5cbiAgICpcbiAgICogQHBhcmFtIGNhcnJpZXIgLSBBIG1hcHBpbmcgY29udGFpbmluZyBwcm9wYWdhdGlvbiBoZWFkZXJzLiBUeXBpY2FsbHlcbiAgICogICBgcmVxLmhlYWRlcnNgIGZyb20gTm9kZSdzIGBodHRwYC9FeHByZXNzL0Zhc3RpZnksIGJ1dCBhbnkgZGljdC1zaGFwZWRcbiAgICogICBvYmplY3Qgd2l0aCBsb3dlcmNhc2Uga2V5cyB3b3JrcyAocXVldWUgYXR0cmlidXRlcywgTGFtYmRhIGV2ZW50XG4gICAqICAgaGVhZGVycywgUlBDIG1ldGFkYXRhLCBldGMuKS5cbiAgICogQHBhcmFtIGZuIC0gRnVuY3Rpb24gdG8gcnVuIGluc2lkZSB0aGUgZXh0cmFjdGVkIGNvbnRleHQuIFJlY2VpdmVzXG4gICAqICAgdGhlIGV4dHJhY3RlZCB7QGxpbmsgQ29udGV4dH0gYXMgaXRzIGFyZ3VtZW50OyBtb3N0IGNhbGxlcnMgaWdub3JlXG4gICAqICAgaXQuIFN5bmMgb3IgYXN5bmMuXG4gICAqIEByZXR1cm5zIFRoZSByZXR1cm4gdmFsdWUgb2YgYGZuYC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBpbXBvcnQgeyBUcmFjZXIgfSBmcm9tIFwianVkZ2V2YWxcIjtcbiAgICpcbiAgICogY29uc3QgaGFuZGxlID0gVHJhY2VyLm9ic2VydmUoYXN5bmMgKHBheWxvYWQ6IHVua25vd24pID0+IHtcbiAgICogICAvLyAuLi4geW91ciBhZ2VudCBsb2dpYyAuLi5cbiAgICogfSk7XG4gICAqXG4gICAqIC8vIEV4cHJlc3MgLyBOb2RlIGh0dHAgaGFuZGxlcjpcbiAgICogYXBwLnBvc3QoXCIvcnVuXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgKiAgIGF3YWl0IFRyYWNlci5jb250aW51ZVRyYWNlKHJlcS5oZWFkZXJzLCBhc3luYyAoKSA9PiB7XG4gICAqICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBoYW5kbGUocmVxLmJvZHkpO1xuICAgKiAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICogICB9KTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBQcm9wYWdhdGluZyBpbiB0aGUgb3Bwb3NpdGUgZGlyZWN0aW9uIChvdXRib3VuZCk6XG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogaW1wb3J0IHsgcHJvcGFnYXRpb24gfSBmcm9tIFwianVkZ2V2YWxcIjtcbiAgICpcbiAgICogY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgKiBwcm9wYWdhdGlvbi5pbmplY3QoaGVhZGVycyk7XG4gICAqIGF3YWl0IGZldGNoKGRvd25zdHJlYW1VcmwsIHsgaGVhZGVycywgbWV0aG9kOiBcIlBPU1RcIiwgYm9keSB9KTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgY29udGludWVUcmFjZTxUPihjYXJyaWVyOiBvYmplY3QsIGZuOiAoY3R4OiBDb250ZXh0KSA9PiBUKTogVCB7XG4gICAgY29uc3QgcHJveHkgPSBCYXNlVHJhY2VyLl9nZXRQcm94eVByb3ZpZGVyKCk7XG4gICAgY29uc3QgY3R4ID0gZXh0cmFjdChjYXJyaWVyKTtcbiAgICByZXR1cm4gcHJveHkud2l0aENvbnRleHQoY3R4LCAoKSA9PiBmbihjdHgpKTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuICAvLyAgU3RhdGljIEFQSTogT2JzZXJ2YXRpb24gRGVjb3JhdG9yICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG5cbiAgLyoqXG4gICAqIFdyYXAgYSBmdW5jdGlvbiB0byBhdXRvbWF0aWNhbGx5IGNyZWF0ZSBzcGFucyBhbmQgcmVjb3JkIGlucHV0cy9vdXRwdXRzLlxuICAgKlxuICAgKiBDYW4gYmUgY2FsbGVkIHdpdGggYSBmdW5jdGlvbiB0byB3cmFwIGl0IGRpcmVjdGx5LCBvciB3aXRoIGp1c3Qgb3B0aW9uc1xuICAgKiB0byBnZXQgYSBkZWNvcmF0b3IgKGUuZy4gZm9yIFRDMzkgZGVjb3JhdG9yIHN5bnRheCkuXG4gICAqXG4gICAqIEBwYXJhbSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIHdyYXAuIE9taXQgdG8gZ2V0IGEgZGVjb3JhdG9yLlxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIE9wdGlvbmFsIG9ic2VydmF0aW9uIG9wdGlvbnMuXG4gICAqIEByZXR1cm5zIFRoZSB3cmFwcGVkIGZ1bmN0aW9uLCBvciBhIGRlY29yYXRvciBpZiBgZnVuY2AgaXMgb21pdHRlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiAvLyBEaXJlY3Qgd3JhcHBpbmdcbiAgICogY29uc3QgdHJhY2VkID0gVHJhY2VyLm9ic2VydmUoXG4gICAqICAgYXN5bmMgKHF1ZXJ5OiBzdHJpbmcpID0+IHNlYXJjaChxdWVyeSksXG4gICAqICAgeyBzcGFuVHlwZTogXCJ0b29sXCIgfSxcbiAgICogKTtcbiAgICpcbiAgICogLy8gRGVjb3JhdG9yIGZvcm1cbiAgICogY2xhc3MgQWdlbnQge1xuICAgKiAgIFxcQFRyYWNlci5vYnNlcnZlKHsgc3BhblR5cGU6IFwibGxtXCIgfSlcbiAgICogICBhc3luYyBjaGF0KGlucHV0OiBzdHJpbmcpIHsgLi4uIH1cbiAgICogfVxuICAgKlxuICAgKiAvLyBGb3JrIGludG8gYSBsaW5rZWQgdHJhY2VcbiAgICogY29uc3QgZGVsZWdhdGUgPSBUcmFjZXIub2JzZXJ2ZShydW5TdWJzeXN0ZW0sIHtcbiAgICogICBzcGFuVHlwZTogXCJhZ2VudFwiLFxuICAgKiAgIGZvcms6IHRydWUsXG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBvYnNlcnZlPFRBcmdzIGV4dGVuZHMgdW5rbm93bltdLCBUUmV0dXJuPihcbiAgICBmdW5jOiAoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm4sXG4gICAgb3B0aW9ucz86IE9ic2VydmVPcHRpb25zLFxuICApOiAoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm47XG4gIHN0YXRpYyBvYnNlcnZlKFxuICAgIG9wdGlvbnM/OiBPYnNlcnZlT3B0aW9ucyxcbiAgKTogPFRBcmdzIGV4dGVuZHMgdW5rbm93bltdLCBUUmV0dXJuPihcbiAgICBmdW5jOiAoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm4sXG4gICAgY29udGV4dD86IHVua25vd24sXG4gICkgPT4gKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuO1xuICBzdGF0aWMgb2JzZXJ2ZTxUQXJncyBleHRlbmRzIHVua25vd25bXSwgVFJldHVybj4oXG4gICAgZnVuY09yT3B0aW9ucz86ICgoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm4pIHwgT2JzZXJ2ZU9wdGlvbnMsXG4gICAgb3B0aW9ucz86IE9ic2VydmVPcHRpb25zLFxuICApOlxuICAgIHwgKCguLi5hcmdzOiBUQXJncykgPT4gVFJldHVybilcbiAgICB8ICgoZnVuYzogKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuKSA9PiAoLi4uYXJnczogVEFyZ3MpID0+IFRSZXR1cm4pIHtcbiAgICBsZXQgZnVuYzogKCguLi5hcmdzOiBUQXJncykgPT4gVFJldHVybikgfCB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiBmdW5jT3JPcHRpb25zID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGZ1bmMgPSBmdW5jT3JPcHRpb25zO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gZnVuY09yT3B0aW9ucztcbiAgICB9XG4gICAgY29uc3Qge1xuICAgICAgc3BhblR5cGUgPSBcInNwYW5cIixcbiAgICAgIHNwYW5OYW1lLFxuICAgICAgcmVjb3JkSW5wdXQgPSB0cnVlLFxuICAgICAgcmVjb3JkT3V0cHV0ID0gdHJ1ZSxcbiAgICAgIGZvcmsgPSBmYWxzZSxcbiAgICB9ID0gb3B0aW9ucyA/PyB7fTtcbiAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICBjb25zdCBkZWNvcmF0b3IgPSAoXG4gICAgICBpbm5lckZ1bmM6ICguLi5hcmdzOiBUQXJncykgPT4gVFJldHVybixcbiAgICApOiAoKC4uLmFyZ3M6IFRBcmdzKSA9PiBUUmV0dXJuKSA9PiB7XG4gICAgICBjb25zdCBuYW1lID0gc3Bhbk5hbWUgPz8gaW5uZXJGdW5jLm5hbWU7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKHRoaXM6IHVua25vd24sIC4uLmFyZ3M6IFRBcmdzKTogVFJldHVybiB7XG4gICAgICAgIGNvbnN0IG90ZWxUcmFjZXIgPSBwcm94eS5nZXRUcmFjZXIoVFJBQ0VSX05BTUUpO1xuXG4gICAgICAgIGNvbnN0IHNob3VsZEZvcmsgPVxuICAgICAgICAgIGZvcmsgJiZcbiAgICAgICAgICBwcm94eS5nZXRBY3RpdmVUcmFjZXIoKSAhPT0gbnVsbCAmJlxuICAgICAgICAgIHByb3h5LmdldEN1cnJlbnRTcGFuKCk/LmlzUmVjb3JkaW5nKCkgPT09IHRydWU7XG5cbiAgICAgICAgaWYgKHNob3VsZEZvcmspIHtcbiAgICAgICAgICBjb25zdCBzZXJpYWxpemVyID0gQmFzZVRyYWNlci5fZ2V0U2VyaWFsaXplcigpO1xuXG4gICAgICAgICAgLy8gSW52b2NhdGlvbiBzcGFuIOKAlCBjaGlsZCBvZiBjdXJyZW50IHRyYWNlXG4gICAgICAgICAgY29uc3QgaW52b2NhdGlvblNwYW4gPSBvdGVsVHJhY2VyLnN0YXJ0U3BhbihuYW1lKTtcbiAgICAgICAgICBjb25zdCBpbnZvY2F0aW9uQ3R4ID0gaW52b2NhdGlvblNwYW4uc3BhbkNvbnRleHQoKTtcbiAgICAgICAgICBpZiAoc3BhblR5cGUpIHtcbiAgICAgICAgICAgIGludm9jYXRpb25TcGFuLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9TUEFOX0tJTkQsXG4gICAgICAgICAgICAgIHNwYW5UeXBlLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBMaW5rZWQtcm9vdCBzcGFuIOKAlCByb290IG9mIGEgbmV3IHRyYWNlXG4gICAgICAgICAgY29uc3QgbGlua2VkUm9vdEF0dHJzOiBBdHRyaWJ1dGVzID0ge1xuICAgICAgICAgICAgW0F0dHJpYnV0ZUtleXMuSlVER01FTlRfTElOS19TT1VSQ0VfVFJBQ0VfSURdOlxuICAgICAgICAgICAgICBpbnZvY2F0aW9uQ3R4LnRyYWNlSWQsXG4gICAgICAgICAgICBbQXR0cmlidXRlS2V5cy5KVURHTUVOVF9MSU5LX1NPVVJDRV9TUEFOX0lEXTogaW52b2NhdGlvbkN0eC5zcGFuSWQsXG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAoc3BhblR5cGUpIHtcbiAgICAgICAgICAgIGxpbmtlZFJvb3RBdHRyc1tBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1NQQU5fS0lORF0gPSBzcGFuVHlwZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwYXJlbnRsZXNzQ3R4ID0gcHJveHkuc2V0U3BhbihcbiAgICAgICAgICAgIHByb3h5LmdldEN1cnJlbnRDb250ZXh0KCksXG4gICAgICAgICAgICBwcm94eS53cmFwU3BhbkNvbnRleHQoSU5WQUxJRF9TUEFOX0NPTlRFWFQpLFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgbGlua2VkUm9vdCA9IG90ZWxUcmFjZXIuc3RhcnRTcGFuKFxuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIHsgYXR0cmlidXRlczogbGlua2VkUm9vdEF0dHJzIH0sXG4gICAgICAgICAgICBwYXJlbnRsZXNzQ3R4LFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgbGlua2VkUm9vdEN0eCA9IGxpbmtlZFJvb3Quc3BhbkNvbnRleHQoKTtcbiAgICAgICAgICBpbnZvY2F0aW9uU3Bhbi5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX0xJTktfVEFSR0VUX1RSQUNFX0lELFxuICAgICAgICAgICAgbGlua2VkUm9vdEN0eC50cmFjZUlkLFxuICAgICAgICAgICk7XG4gICAgICAgICAgaW52b2NhdGlvblNwYW4uc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9MSU5LX1RBUkdFVF9TUEFOX0lELFxuICAgICAgICAgICAgbGlua2VkUm9vdEN0eC5zcGFuSWQsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGNvbnN0IGVuZEJvdGggPSAoKTogdm9pZCA9PiB7XG4gICAgICAgICAgICBsaW5rZWRSb290LmVuZCgpO1xuICAgICAgICAgICAgaW52b2NhdGlvblNwYW4uZW5kKCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCByZWNvcmRFcnJvck9uQm90aCA9IChlOiB1bmtub3duKTogdm9pZCA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHMgb2YgW2xpbmtlZFJvb3QsIGludm9jYXRpb25TcGFuXSkge1xuICAgICAgICAgICAgICBzLnJlY29yZEV4Y2VwdGlvbihlIGFzIEVycm9yKTtcbiAgICAgICAgICAgICAgcy5zZXRTdGF0dXMoe1xuICAgICAgICAgICAgICAgIGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFN0cmluZyhlKSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCByZWNvcmRPdXRwdXRPbkJvdGggPSAodmFsdWU6IHVua25vd24pOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZWQgPSBzZXJpYWxpemVBdHRyaWJ1dGUodmFsdWUsIHNlcmlhbGl6ZXIpO1xuICAgICAgICAgICAgbGlua2VkUm9vdC5zZXRBdHRyaWJ1dGUoQXR0cmlidXRlS2V5cy5KVURHTUVOVF9PVVRQVVQsIHNlcmlhbGl6ZWQpO1xuICAgICAgICAgICAgaW52b2NhdGlvblNwYW4uc2V0QXR0cmlidXRlKFxuICAgICAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX09VVFBVVCxcbiAgICAgICAgICAgICAgc2VyaWFsaXplZCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmIChyZWNvcmRJbnB1dCkge1xuICAgICAgICAgICAgY29uc3Qgc2VyaWFsaXplZElucHV0ID0gc2VyaWFsaXplQXR0cmlidXRlKFxuICAgICAgICAgICAgICBnZXRJbnB1dHMoaW5uZXJGdW5jLCBhcmdzKSxcbiAgICAgICAgICAgICAgc2VyaWFsaXplcixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBsaW5rZWRSb290LnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9JTlBVVCxcbiAgICAgICAgICAgICAgc2VyaWFsaXplZElucHV0LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGludm9jYXRpb25TcGFuLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9JTlBVVCxcbiAgICAgICAgICAgICAgc2VyaWFsaXplZElucHV0LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgQmFzZVRyYWNlci5fZW1pdFBhcnRpYWwoKTtcblxuICAgICAgICAgIHJldHVybiBwcm94eS51c2VTcGFuKGxpbmtlZFJvb3QsIGZhbHNlLCBmYWxzZSwgZmFsc2UsICgpOiBUUmV0dXJuID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGlubmVyRnVuYy5jYWxsKHRoaXMsIC4uLmFyZ3MpO1xuICAgICAgICAgICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIFByb21pc2U8dW5rbm93bj4pXG4gICAgICAgICAgICAgICAgICAudGhlbigocmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWNvcmRPdXRwdXQpIHJlY29yZE91dHB1dE9uQm90aChyZXMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzIGFzIFRSZXR1cm47XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgLmNhdGNoKChlOiB1bmtub3duKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlY29yZEVycm9yT25Cb3RoKGUpO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC5maW5hbGx5KGVuZEJvdGgpIGFzIFRSZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHJlY29yZE91dHB1dCkgcmVjb3JkT3V0cHV0T25Cb3RoKHJlc3VsdCk7XG4gICAgICAgICAgICAgIGVuZEJvdGgoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgcmVjb3JkRXJyb3JPbkJvdGgoZSk7XG4gICAgICAgICAgICAgIGVuZEJvdGgoKTtcbiAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvdGVsVHJhY2VyLnN0YXJ0QWN0aXZlU3BhbihuYW1lLCAoc3BhbikgPT4ge1xuICAgICAgICAgIGlmIChzcGFuVHlwZSkge1xuICAgICAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoQXR0cmlidXRlS2V5cy5KVURHTUVOVF9TUEFOX0tJTkQsIHNwYW5UeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChyZWNvcmRJbnB1dCkge1xuICAgICAgICAgICAgICBzcGFuLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX0lOUFVULFxuICAgICAgICAgICAgICAgIHNlcmlhbGl6ZUF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgIGdldElucHV0cyhpbm5lckZ1bmMsIGFyZ3MpLFxuICAgICAgICAgICAgICAgICAgQmFzZVRyYWNlci5fZ2V0U2VyaWFsaXplcigpLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBCYXNlVHJhY2VyLl9lbWl0UGFydGlhbCgpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gaW5uZXJGdW5jLmNhbGwodGhpcywgLi4uYXJncyk7XG5cbiAgICAgICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIFByb21pc2U8dW5rbm93bj4pXG4gICAgICAgICAgICAgICAgLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKHJlY29yZE91dHB1dCkge1xuICAgICAgICAgICAgICAgICAgICBzcGFuLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX09VVFBVVCxcbiAgICAgICAgICAgICAgICAgICAgICBzZXJpYWxpemVBdHRyaWJ1dGUocmVzLCBCYXNlVHJhY2VyLl9nZXRTZXJpYWxpemVyKCkpLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcyBhcyBUUmV0dXJuO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChlOiB1bmtub3duKSA9PiB7XG4gICAgICAgICAgICAgICAgICBzcGFuLnJlY29yZEV4Y2VwdGlvbihlIGFzIEVycm9yKTtcbiAgICAgICAgICAgICAgICAgIHNwYW4uc2V0U3RhdHVzKHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogU3BhblN0YXR1c0NvZGUuRVJST1IsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFN0cmluZyhlKSxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHNwYW4uZW5kKCk7XG4gICAgICAgICAgICAgICAgfSkgYXMgVFJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHJlY29yZE91dHB1dCkge1xuICAgICAgICAgICAgICBzcGFuLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX09VVFBVVCxcbiAgICAgICAgICAgICAgICBzZXJpYWxpemVBdHRyaWJ1dGUocmVzdWx0LCBCYXNlVHJhY2VyLl9nZXRTZXJpYWxpemVyKCkpLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3Bhbi5lbmQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgc3Bhbi5yZWNvcmRFeGNlcHRpb24oZSBhcyBFcnJvcik7XG4gICAgICAgICAgICBzcGFuLnNldFN0YXR1cyh7IGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLCBtZXNzYWdlOiBTdHJpbmcoZSkgfSk7XG4gICAgICAgICAgICBzcGFuLmVuZCgpO1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICB9O1xuXG4gICAgaWYgKCFmdW5jKSByZXR1cm4gZGVjb3JhdG9yO1xuICAgIHJldHVybiBkZWNvcmF0b3IoZnVuYyk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIEludGVybmFsOiByZXNvbHZlIHRhcmdldCBzcGFuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIHByaXZhdGUgc3RhdGljIF9yZXNvbHZlU3BhbihzcGFuPzogU3Bhbik6IFNwYW4gfCB1bmRlZmluZWQge1xuICAgIGlmIChzcGFuKSByZXR1cm4gc3BhbjtcbiAgICByZXR1cm4gQmFzZVRyYWNlci5fZ2V0UHJveHlQcm92aWRlcigpLmdldEN1cnJlbnRTcGFuKCk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYzogU3BhbiBLaW5kICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBTZXQgdGhlIGtpbmQgb2YgYSBzcGFuLlxuICAgKlxuICAgKiBAcGFyYW0ga2luZCAtIFRoZSBzcGFuIGtpbmQgKGUuZy4gXCJsbG1cIiwgXCJ0b29sXCIsIFwic3BhblwiKS5cbiAgICogQHBhcmFtIHNwYW4gLSBUYXJnZXQgc3Bhbi4gRGVmYXVsdHMgdG8gdGhlIGN1cnJlbnQgYWN0aXZlIHNwYW4uXG4gICAqL1xuICBzdGF0aWMgc2V0U3BhbktpbmQoa2luZDogc3RyaW5nKTogdm9pZDtcbiAgc3RhdGljIHNldFNwYW5LaW5kKGtpbmQ6IHN0cmluZywgc3BhbjogU3Bhbik6IHZvaWQ7XG4gIHN0YXRpYyBzZXRTcGFuS2luZChraW5kOiBzdHJpbmcsIHNwYW4/OiBTcGFuKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiQmFzZVRyYWNlci5zZXRTcGFuS2luZFwiLCAoKSA9PiB7XG4gICAgICBpZiAoIWtpbmQpIHJldHVybjtcbiAgICAgIGNvbnN0IHRhcmdldCA9IEJhc2VUcmFjZXIuX3Jlc29sdmVTcGFuKHNwYW4pO1xuICAgICAgaWYgKHRhcmdldD8uaXNSZWNvcmRpbmcoKSkge1xuICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKEF0dHJpYnV0ZUtleXMuSlVER01FTlRfU1BBTl9LSU5ELCBraW5kKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgdGhlIGN1cnJlbnQgc3BhbiBraW5kIHRvIFwibGxtXCIuXG4gICAqL1xuICBzdGF0aWMgc2V0TExNU3BhbigpOiB2b2lkIHtcbiAgICBCYXNlVHJhY2VyLnNldFNwYW5LaW5kKFwibGxtXCIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgY3VycmVudCBzcGFuIGtpbmQgdG8gXCJ0b29sXCIuXG4gICAqL1xuICBzdGF0aWMgc2V0VG9vbFNwYW4oKTogdm9pZCB7XG4gICAgQmFzZVRyYWNlci5zZXRTcGFuS2luZChcInRvb2xcIik7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBjdXJyZW50IHNwYW4ga2luZCB0byBcInNwYW5cIi5cbiAgICovXG4gIHN0YXRpYyBzZXRHZW5lcmFsU3BhbigpOiB2b2lkIHtcbiAgICBCYXNlVHJhY2VyLnNldFNwYW5LaW5kKFwic3BhblwiKTtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuICAvLyAgU3RhdGljOiBTcGFuIEF0dHJpYnV0ZSBPcGVyYXRpb25zICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG5cbiAgLyoqXG4gICAqIFNldCBhIHNpbmdsZSBhdHRyaWJ1dGUgb24gYSBzcGFuLlxuICAgKlxuICAgKiBAcGFyYW0ga2V5IC0gVGhlIGF0dHJpYnV0ZSBrZXkuXG4gICAqIEBwYXJhbSB2YWx1ZSAtIFRoZSBhdHRyaWJ1dGUgdmFsdWUgKHdpbGwgYmUgc2VyaWFsaXplZCkuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKi9cbiAgc3RhdGljIHNldEF0dHJpYnV0ZShrZXk6IHN0cmluZywgdmFsdWU6IHVua25vd24pOiB2b2lkO1xuICBzdGF0aWMgc2V0QXR0cmlidXRlKGtleTogc3RyaW5nLCB2YWx1ZTogdW5rbm93biwgc3BhbjogU3Bhbik6IHZvaWQ7XG4gIHN0YXRpYyBzZXRBdHRyaWJ1dGUoa2V5OiBzdHJpbmcsIHZhbHVlOiB1bmtub3duLCBzcGFuPzogU3Bhbik6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkJhc2VUcmFjZXIuc2V0QXR0cmlidXRlXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldCA9IEJhc2VUcmFjZXIuX3Jlc29sdmVTcGFuKHNwYW4pO1xuICAgICAgaWYgKCF0YXJnZXQ/LmlzUmVjb3JkaW5nKCkpIHJldHVybjtcbiAgICAgIGlmICgha2V5IHx8IHZhbHVlID09IG51bGwpIHJldHVybjtcbiAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgIGtleSxcbiAgICAgICAgc2VyaWFsaXplQXR0cmlidXRlKHZhbHVlLCBCYXNlVHJhY2VyLl9nZXRTZXJpYWxpemVyKCkpLFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgbXVsdGlwbGUgYXR0cmlidXRlcyBvbiBhIHNwYW4uXG4gICAqXG4gICAqIEBwYXJhbSBhdHRyaWJ1dGVzIC0gS2V5LXZhbHVlIHBhaXJzIHRvIHNldC5cbiAgICogQHBhcmFtIHNwYW4gLSBUYXJnZXQgc3Bhbi4gRGVmYXVsdHMgdG8gdGhlIGN1cnJlbnQgYWN0aXZlIHNwYW4uXG4gICAqL1xuICBzdGF0aWMgc2V0QXR0cmlidXRlcyhhdHRyaWJ1dGVzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHZvaWQ7XG4gIHN0YXRpYyBzZXRBdHRyaWJ1dGVzKGF0dHJpYnV0ZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBzcGFuOiBTcGFuKTogdm9pZDtcbiAgc3RhdGljIHNldEF0dHJpYnV0ZXMoYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHNwYW4/OiBTcGFuKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoYXR0cmlidXRlcykpIHtcbiAgICAgIGlmIChzcGFuKSBCYXNlVHJhY2VyLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlLCBzcGFuKTtcbiAgICAgIGVsc2UgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgaW5wdXQgZGF0YSBvbiBhIHNwYW4uXG4gICAqXG4gICAqIEBwYXJhbSBpbnB1dERhdGEgLSBUaGUgaW5wdXQgZGF0YSB0byByZWNvcmQuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKi9cbiAgc3RhdGljIHNldElucHV0KGlucHV0RGF0YTogdW5rbm93bik6IHZvaWQ7XG4gIHN0YXRpYyBzZXRJbnB1dChpbnB1dERhdGE6IHVua25vd24sIHNwYW46IFNwYW4pOiB2b2lkO1xuICBzdGF0aWMgc2V0SW5wdXQoaW5wdXREYXRhOiB1bmtub3duLCBzcGFuPzogU3Bhbik6IHZvaWQge1xuICAgIGlmIChzcGFuKVxuICAgICAgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUoQXR0cmlidXRlS2V5cy5KVURHTUVOVF9JTlBVVCwgaW5wdXREYXRhLCBzcGFuKTtcbiAgICBlbHNlIEJhc2VUcmFjZXIuc2V0QXR0cmlidXRlKEF0dHJpYnV0ZUtleXMuSlVER01FTlRfSU5QVVQsIGlucHV0RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBvdXRwdXQgZGF0YSBvbiBhIHNwYW4uXG4gICAqXG4gICAqIEBwYXJhbSBvdXRwdXREYXRhIC0gVGhlIG91dHB1dCBkYXRhIHRvIHJlY29yZC5cbiAgICogQHBhcmFtIHNwYW4gLSBUYXJnZXQgc3Bhbi4gRGVmYXVsdHMgdG8gdGhlIGN1cnJlbnQgYWN0aXZlIHNwYW4uXG4gICAqL1xuICBzdGF0aWMgc2V0T3V0cHV0KG91dHB1dERhdGE6IHVua25vd24pOiB2b2lkO1xuICBzdGF0aWMgc2V0T3V0cHV0KG91dHB1dERhdGE6IHVua25vd24sIHNwYW46IFNwYW4pOiB2b2lkO1xuICBzdGF0aWMgc2V0T3V0cHV0KG91dHB1dERhdGE6IHVua25vd24sIHNwYW4/OiBTcGFuKTogdm9pZCB7XG4gICAgaWYgKHNwYW4pXG4gICAgICBCYXNlVHJhY2VyLnNldEF0dHJpYnV0ZShBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX09VVFBVVCwgb3V0cHV0RGF0YSwgc3Bhbik7XG4gICAgZWxzZSBCYXNlVHJhY2VyLnNldEF0dHJpYnV0ZShBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX09VVFBVVCwgb3V0cHV0RGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogUmVjb3JkIGFuIGVycm9yIG9uIGEgc3Bhbi5cbiAgICpcbiAgICogU2V0cyB0aGUgc3BhbiBzdGF0dXMgdG8gRVJST1IgYW5kIHJlY29yZHMgdGhlIGV4Y2VwdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGVycm9yIC0gVGhlIGVycm9yIHRvIHJlY29yZC5cbiAgICogQHBhcmFtIHNwYW4gLSBUYXJnZXQgc3Bhbi4gRGVmYXVsdHMgdG8gdGhlIGN1cnJlbnQgYWN0aXZlIHNwYW4uXG4gICAqL1xuICBzdGF0aWMgc2V0RXJyb3IoZXJyb3I6IHVua25vd24pOiB2b2lkO1xuICBzdGF0aWMgc2V0RXJyb3IoZXJyb3I6IHVua25vd24sIHNwYW46IFNwYW4pOiB2b2lkO1xuICBzdGF0aWMgc2V0RXJyb3IoZXJyb3I6IHVua25vd24sIHNwYW4/OiBTcGFuKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiQmFzZVRyYWNlci5zZXRFcnJvclwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBCYXNlVHJhY2VyLl9yZXNvbHZlU3BhbihzcGFuKTtcbiAgICAgIGlmICghdGFyZ2V0Py5pc1JlY29yZGluZygpKSByZXR1cm47XG4gICAgICB0YXJnZXQucmVjb3JkRXhjZXB0aW9uKGVycm9yIGFzIEVycm9yKTtcbiAgICAgIHRhcmdldC5zZXRTdGF0dXMoeyBjb2RlOiBTcGFuU3RhdHVzQ29kZS5FUlJPUiwgbWVzc2FnZTogU3RyaW5nKGVycm9yKSB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNvcmQgTExNIHVzYWdlIG1ldGFkYXRhIG9uIGEgc3Bhbi5cbiAgICpcbiAgICogQHBhcmFtIG1ldGFkYXRhIC0gTExNIG1ldGFkYXRhIGluY2x1ZGluZyBtb2RlbCwgcHJvdmlkZXIsIGFuZCB0b2tlbiBjb3VudHMuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIFRyYWNlci5yZWNvcmRMTE1NZXRhZGF0YSh7XG4gICAqICAgbW9kZWw6IFwiZ3B0LTRvXCIsXG4gICAqICAgcHJvdmlkZXI6IFwib3BlbmFpXCIsXG4gICAqICAgb3V0cHV0X3Rva2VuczogMTUwLFxuICAgKiB9KTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgcmVjb3JkTExNTWV0YWRhdGEobWV0YWRhdGE6IExMTU1ldGFkYXRhKTogdm9pZDtcbiAgc3RhdGljIHJlY29yZExMTU1ldGFkYXRhKG1ldGFkYXRhOiBMTE1NZXRhZGF0YSwgc3BhbjogU3Bhbik6IHZvaWQ7XG4gIHN0YXRpYyByZWNvcmRMTE1NZXRhZGF0YShtZXRhZGF0YTogTExNTWV0YWRhdGEsIHNwYW4/OiBTcGFuKTogdm9pZCB7XG4gICAgZG9udFRocm93KFwiQmFzZVRyYWNlci5yZWNvcmRMTE1NZXRhZGF0YVwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBCYXNlVHJhY2VyLl9yZXNvbHZlU3BhbihzcGFuKTtcbiAgICAgIGlmICghdGFyZ2V0Py5pc1JlY29yZGluZygpKSByZXR1cm47XG5cbiAgICAgIGlmICh0eXBlb2YgbWV0YWRhdGEubW9kZWwgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZShcbiAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX0xMTV9NT0RFTF9OQU1FLFxuICAgICAgICAgIG1ldGFkYXRhLm1vZGVsLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIG1ldGFkYXRhLnByb3ZpZGVyID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9MTE1fUFJPVklERVIsXG4gICAgICAgICAgbWV0YWRhdGEucHJvdmlkZXIsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgbWV0YWRhdGEubm9uX2NhY2hlZF9pbnB1dF90b2tlbnMgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZShcbiAgICAgICAgICBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1VTQUdFX05PTl9DQUNIRURfSU5QVVRfVE9LRU5TLFxuICAgICAgICAgIG1ldGFkYXRhLm5vbl9jYWNoZWRfaW5wdXRfdG9rZW5zLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBtZXRhZGF0YS5vdXRwdXRfdG9rZW5zID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9VU0FHRV9PVVRQVVRfVE9LRU5TLFxuICAgICAgICAgIG1ldGFkYXRhLm91dHB1dF90b2tlbnMsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG1ldGFkYXRhLmNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9VU0FHRV9DQUNIRV9SRUFEX0lOUFVUX1RPS0VOUyxcbiAgICAgICAgICBtZXRhZGF0YS5jYWNoZV9yZWFkX2lucHV0X3Rva2VucyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgbWV0YWRhdGEuY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgQXR0cmlidXRlS2V5cy5KVURHTUVOVF9VU0FHRV9DQUNIRV9DUkVBVElPTl9JTlBVVF9UT0tFTlMsXG4gICAgICAgICAgbWV0YWRhdGEuY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBtZXRhZGF0YS50b3RhbF9jb3N0X3VzZCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKFxuICAgICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfVVNBR0VfVE9UQUxfQ09TVF9VU0QsXG4gICAgICAgICAgbWV0YWRhdGEudG90YWxfY29zdF91c2QsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYzogQ29udGV4dCBQcm9wYWdhdGlvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBTZXQgYSBrZXkgb24gdGhlIGN1cnJlbnQgc3BhbiBhbmQgb24gYmFnZ2FnZSBzbyBpdCBwcm9wYWdhdGVzIHRvIGFsbFxuICAgKiBjaGlsZCBzcGFucy4gQWxzbyByZWF0dGFjaGVzIHRoZSBjdXJyZW50IGNvbnRleHQgdG8gdGhlIHVwZGF0ZWQgb25lLlxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgX3NldFByb3BhZ2F0aW5nQmFnZ2FnZUtleShrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkJhc2VUcmFjZXIuX3NldFByb3BhZ2F0aW5nQmFnZ2FnZUtleVwiLCAoKSA9PiB7XG4gICAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICAgIGNvbnN0IGN1cnJlbnRTcGFuID0gcHJveHkuZ2V0Q3VycmVudFNwYW4oKTtcbiAgICAgIGlmICghY3VycmVudFNwYW4/LmlzUmVjb3JkaW5nKCkpIHJldHVybjtcbiAgICAgIGN1cnJlbnRTcGFuLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgICAgIGNvbnN0IGN0eCA9IHByb3h5LmdldEN1cnJlbnRDb250ZXh0KCk7XG4gICAgICBjb25zdCBiYWdnYWdlID0gKGdldEJhZ2dhZ2UoY3R4KSA/PyBjcmVhdGVCYWdnYWdlKCkpLnNldEVudHJ5KGtleSwge1xuICAgICAgICB2YWx1ZSxcbiAgICAgIH0pO1xuICAgICAgcHJveHkuYXR0YWNoQ29udGV4dChzZXRCYWdnYWdlKGN0eCwgYmFnZ2FnZSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgY3VzdG9tZXIgSUQgb24gdGhlIGN1cnJlbnQgYWN0aXZlIHNwYW4uXG4gICAqXG4gICAqIFRoZSBJRCBpcyBhdXRvbWF0aWNhbGx5IHByb3BhZ2F0ZWQgdG8gYWxsIGNoaWxkIHNwYW5zIHZpYSBiYWdnYWdlLlxuICAgKiBUaGlzIG1ldGhvZCBhbHdheXMgdGFyZ2V0cyB0aGUgYWN0aXZlIHNwYW4gYmVjYXVzZSBpdCBtb2RpZmllc1xuICAgKiB0aGUgYWN0aXZlIGNvbnRleHQncyBiYWdnYWdlIGZvciBwcm9wYWdhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGN1c3RvbWVySWQgLSBUaGUgY3VzdG9tZXIgaWRlbnRpZmllci5cbiAgICovXG4gIHN0YXRpYyBzZXRDdXN0b21lcklkKGN1c3RvbWVySWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIEJhc2VUcmFjZXIuX3NldFByb3BhZ2F0aW5nQmFnZ2FnZUtleShcbiAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfQ1VTVE9NRVJfSUQsXG4gICAgICBjdXN0b21lcklkLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBjdXN0b21lciB1c2VyIElEIG9uIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKlxuICAgKiBUaGUgSUQgaXMgYXV0b21hdGljYWxseSBwcm9wYWdhdGVkIHRvIGFsbCBjaGlsZCBzcGFucyB2aWEgYmFnZ2FnZS5cbiAgICogVGhpcyBtZXRob2QgYWx3YXlzIHRhcmdldHMgdGhlIGFjdGl2ZSBzcGFuIGJlY2F1c2UgaXQgbW9kaWZpZXNcbiAgICogdGhlIGFjdGl2ZSBjb250ZXh0J3MgYmFnZ2FnZSBmb3IgcHJvcGFnYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBjdXN0b21lclVzZXJJZCAtIFRoZSBjdXN0b21lciB1c2VyIGlkZW50aWZpZXIuXG4gICAqL1xuICBzdGF0aWMgc2V0Q3VzdG9tZXJVc2VySWQoY3VzdG9tZXJVc2VySWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIEJhc2VUcmFjZXIuX3NldFByb3BhZ2F0aW5nQmFnZ2FnZUtleShcbiAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfQ1VTVE9NRVJfVVNFUl9JRCxcbiAgICAgIGN1c3RvbWVyVXNlcklkLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBzZXNzaW9uIElEIG9uIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKlxuICAgKiBUaGUgSUQgaXMgYXV0b21hdGljYWxseSBwcm9wYWdhdGVkIHRvIGFsbCBjaGlsZCBzcGFucyB2aWEgYmFnZ2FnZS5cbiAgICogVGhpcyBtZXRob2QgYWx3YXlzIHRhcmdldHMgdGhlIGFjdGl2ZSBzcGFuIGJlY2F1c2UgaXQgbW9kaWZpZXNcbiAgICogdGhlIGFjdGl2ZSBjb250ZXh0J3MgYmFnZ2FnZSBmb3IgcHJvcGFnYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBzZXNzaW9uSWQgLSBUaGUgc2Vzc2lvbiBpZGVudGlmaWVyLlxuICAgKi9cbiAgc3RhdGljIHNldFNlc3Npb25JZChzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIEJhc2VUcmFjZXIuX3NldFByb3BhZ2F0aW5nQmFnZ2FnZUtleShcbiAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfU0VTU0lPTl9JRCxcbiAgICAgIHNlc3Npb25JZCxcbiAgICApO1xuICB9XG5cbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIC8vXG4gIC8vICBTdGF0aWM6IFRhZ3MgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cblxuICAvKipcbiAgICogQWRkIHRhZ3MgdG8gdGhlIGN1cnJlbnQgdHJhY2UuXG4gICAqXG4gICAqIEBwYXJhbSB0YWdzIC0gQSBzaW5nbGUgdGFnIHN0cmluZyBvciBhbiBhcnJheSBvZiB0YWcgc3RyaW5ncy5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBUcmFjZXIudGFnKFwicHJvZHVjdGlvblwiKTtcbiAgICogVHJhY2VyLnRhZyhbXCJpbXBvcnRhbnRcIiwgXCJjdXN0b21lci1mYWNpbmdcIl0pO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyB0YWcodGFnczogc3RyaW5nIHwgc3RyaW5nW10pOiB2b2lkIHtcbiAgICBkb250VGhyb3coXCJCYXNlVHJhY2VyLnRhZ1wiLCAoKSA9PiB7XG4gICAgICBpZiAoIXRhZ3MgfHwgKEFycmF5LmlzQXJyYXkodGFncykgJiYgdGFncy5sZW5ndGggPT09IDApKSByZXR1cm47XG4gICAgICBjb25zdCBwcm94eSA9IEJhc2VUcmFjZXIuX2dldFByb3h5UHJvdmlkZXIoKTtcbiAgICAgIGNvbnN0IHRyYWNlciA9IHByb3h5LmdldEFjdGl2ZVRyYWNlcigpO1xuICAgICAgaWYgKCF0cmFjZXI/LnByb2plY3RJZCB8fCAhdHJhY2VyLl9jbGllbnQpIHJldHVybjtcbiAgICAgIGlmICghdHJhY2VyLnN1cHBvcnRzTGl2ZUluc3RydW1lbnRhdGlvbikgcmV0dXJuO1xuICAgICAgY29uc3QgaWRzID0gQmFzZVRyYWNlci5fZ2V0Q3VycmVudFRyYWNlQW5kU3BhbklkKCk7XG4gICAgICBpZiAoIWlkcykgcmV0dXJuO1xuICAgICAgY29uc3QgW3RyYWNlSWRdID0gaWRzO1xuICAgICAgY29uc3QgdGFnQXJyYXkgPSBBcnJheS5pc0FycmF5KHRhZ3MpID8gdGFncyA6IFt0YWdzXTtcbiAgICAgIHRyYWNlci5fY2xpZW50XG4gICAgICAgIC5wb3N0VjFwcm9qZWN0c1RyYWNlc0J5VHJhY2VJZFRhZ3ModHJhY2VyLnByb2plY3RJZCwgdHJhY2VJZCwge1xuICAgICAgICAgIHRhZ3M6IHRhZ0FycmF5LFxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycjogdW5rbm93bikgPT4ge1xuICAgICAgICAgIExvZ2dlci5lcnJvcihgdGFnIGZhaWxlZDogJHtTdHJpbmcoZXJyKX1gKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy9cbiAgLy8gIFN0YXRpYyBBUEk6IEFzeW5jIEV2YWx1YXRpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvL1xuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIGFuIGFzeW5jaHJvbm91cyBzZXJ2ZXItc2lkZSBldmFsdWF0aW9uIG9uIGEgc3Bhbi5cbiAgICpcbiAgICogVGhlIGV2YWx1YXRpb24gaXMgcXVldWVkIGFuZCBwcm9jZXNzZWQgc2VydmVyLXNpZGUgYnkgdGhlIEp1ZGdtZW50XG4gICAqIHBsYXRmb3JtIGFmdGVyIHRoZSBzcGFuIGVuZHMuIFVzZSB0aGlzIHRvIHNjb3JlIGxpdmUgdHJhZmZpY1xuICAgKiB3aXRob3V0IGJsb2NraW5nIHlvdXIgYXBwbGljYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gRXZhbHVhdGlvbiBvcHRpb25zLiBganVkZ2VgIGlzIHJlcXVpcmVkOyBgZXhhbXBsZWBcbiAgICogICBpcyBvcHRpb25hbCBldmFsdWF0aW9uIGRhdGEuXG4gICAqIEBwYXJhbSBzcGFuIC0gVGFyZ2V0IHNwYW4uIERlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGFjdGl2ZSBzcGFuLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIFRyYWNlci5hc3luY0V2YWx1YXRlKHtcbiAgICogICBqdWRnZTogXCJhbnN3ZXJfcmVsZXZhbmN5XCIsXG4gICAqICAgZXhhbXBsZToge1xuICAgKiAgICAgaW5wdXQ6IFwiV2hhdCBpcyBBST9cIixcbiAgICogICAgIGFjdHVhbF9vdXRwdXQ6IHJlc3BvbnNlLFxuICAgKiAgIH0sXG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBhc3luY0V2YWx1YXRlKG9wdGlvbnM6IEFzeW5jRXZhbHVhdGVPcHRpb25zKTogdm9pZDtcbiAgc3RhdGljIGFzeW5jRXZhbHVhdGUob3B0aW9uczogQXN5bmNFdmFsdWF0ZU9wdGlvbnMsIHNwYW46IFNwYW4pOiB2b2lkO1xuICBzdGF0aWMgYXN5bmNFdmFsdWF0ZShvcHRpb25zOiBBc3luY0V2YWx1YXRlT3B0aW9ucywgc3Bhbj86IFNwYW4pOiB2b2lkIHtcbiAgICBkb250VGhyb3coXCJCYXNlVHJhY2VyLmFzeW5jRXZhbHVhdGVcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgeyBqdWRnZSwgZXhhbXBsZSB9ID0gb3B0aW9ucztcbiAgICAgIGNvbnN0IHByb3h5ID0gQmFzZVRyYWNlci5fZ2V0UHJveHlQcm92aWRlcigpO1xuICAgICAgY29uc3QgdHJhY2VyID0gcHJveHkuZ2V0QWN0aXZlVHJhY2VyKCk7XG4gICAgICBpZiAoIXRyYWNlcj8ucHJvamVjdElkKSByZXR1cm47XG4gICAgICBpZiAoIXRyYWNlci5zdXBwb3J0c0xpdmVJbnN0cnVtZW50YXRpb24pIHJldHVybjtcbiAgICAgIGNvbnN0IHRhcmdldCA9IEJhc2VUcmFjZXIuX3Jlc29sdmVTcGFuKHNwYW4pO1xuICAgICAgaWYgKCF0YXJnZXQ/LmlzUmVjb3JkaW5nKCkpIHJldHVybjtcblxuICAgICAgY29uc3QgcHJvY2Vzc29yID0gdHJhY2VyLmdldFNwYW5Qcm9jZXNzb3IoKTtcbiAgICAgIGNvbnN0IGN0eCA9IHRhcmdldC5zcGFuQ29udGV4dCgpO1xuXG4gICAgICBjb25zdCBpZHggPSBwcm9jZXNzb3Iuc3RhdGVJbmNyKFxuICAgICAgICBjdHgsXG4gICAgICAgIEludGVybmFsQXR0cmlidXRlS2V5cy5QRU5ESU5HX0VWQUxTX0NPVU5ULFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHBheWxvYWQ6IFBlbmRpbmdFdmFsUGF5bG9hZCA9IHtcbiAgICAgICAgcHJvamVjdF9pZDogdHJhY2VyLnByb2plY3RJZCxcbiAgICAgICAgZXZhbF9uYW1lOiBgYXN5bmNfZXZhbHVhdGVfJHtqdWRnZX1fJHtpZHh9YCxcbiAgICAgICAganVkZ2VzOiBbeyBuYW1lOiBqdWRnZSB9XSxcbiAgICAgICAgZXhhbXBsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICAuLi5leGFtcGxlLFxuICAgICAgICAgICAgZXhhbXBsZV9pZDogY3JlYXRlUmFuZG9tVVVJRCgpLFxuICAgICAgICAgICAgY3JlYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgdHJhY2VfaWQ6IGN0eC50cmFjZUlkLFxuICAgICAgICAgICAgc3Bhbl9pZDogY3R4LnNwYW5JZCxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBpc19vZmZsaW5lOiBmYWxzZSxcbiAgICAgICAgaXNfYmVoYXZpb3I6IGZhbHNlLFxuICAgICAgfTtcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSBwcm9jZXNzb3Iuc3RhdGVBcHBlbmQ8UGVuZGluZ0V2YWxQYXlsb2FkPihcbiAgICAgICAgY3R4LFxuICAgICAgICBJbnRlcm5hbEF0dHJpYnV0ZUtleXMuUEVORElOR19FVkFMUyxcbiAgICAgICAgcGF5bG9hZCxcbiAgICAgICk7XG5cbiAgICAgIC8vIFJhdyBzZXRBdHRyaWJ1dGUg4oCUIHZhbHVlIGlzIGFscmVhZHkgSlNPTi1zdHJpbmdpZmllZCwgQmFzZVRyYWNlci5zZXRBdHRyaWJ1dGUgd291bGQgZG91YmxlLXNlcmlhbGl6ZS5cbiAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoXG4gICAgICAgIEF0dHJpYnV0ZUtleXMuSlVER01FTlRfUEVORElOR19UUkFDRV9FVkFMLFxuICAgICAgICBKU09OLnN0cmluZ2lmeSh1cGRhdGVkKSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0SW5wdXRzPFRBcmdzIGV4dGVuZHMgdW5rbm93bltdPihcbiAgZjogKC4uLmFyZ3M6IFRBcmdzKSA9PiB1bmtub3duLFxuICBhcmdzOiBUQXJncyxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJhbU5hbWVzID0gcGFyc2VGdW5jdGlvbkFyZ3MoZilcbiAgICAgIC5tYXAoKHBhcmFtKSA9PlxuICAgICAgICBwYXJhbVxuICAgICAgICAgIC5yZXBsYWNlKC9eXFwuXFwuXFwuLywgXCJcIilcbiAgICAgICAgICAuc3BsaXQoXCI9XCIpWzBdXG4gICAgICAgICAgLnRyaW0oKSxcbiAgICAgIClcbiAgICAgIC5maWx0ZXIoKHBhcmFtKSA9PiBwYXJhbS5sZW5ndGggPiAwKTtcbiAgICBjb25zdCBpbnB1dHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gICAgcGFyYW1OYW1lcy5mb3JFYWNoKChuYW1lLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4IDwgYXJncy5sZW5ndGgpIHtcbiAgICAgICAgaW5wdXRzW25hbWVdID0gYXJnc1tpbmRleF07XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGlucHV0cztcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG59XG4iLAogICAgIi8qIGVzbGludC1kaXNhYmxlICovXG4vLy8gQWRvcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXIuanMvYmxvYi9tYXN0ZXIvc3JjL2F1dG8vaW5qZWN0b3IuanNcblxuY29uc3QgQVJST1dfQVJHID0gL14oW14oXSs/KT0+LztcbmNvbnN0IEZOX0FSR1MgPSAvXlteKF0qXFwoXFxzKihbXildKilcXCkvbTtcbmNvbnN0IEZOX0FSR19TUExJVCA9IC8sLztcbmNvbnN0IEZOX0FSRyA9IC9eXFxzKihfPykoXFxTKz8pXFwxXFxzKiQvO1xuY29uc3QgU1RSSVBfQ09NTUVOVFMgPSAvKChcXC9cXC8uKiQpfChcXC9cXCpbXFxzXFxTXSo/XFwqXFwvKSkvZ207XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeUZuKGZuOiBGdW5jdGlvbik6IHN0cmluZyB7XG4gIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChmbik7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RBcmdzKGZuOiBGdW5jdGlvbik6IFJlZ0V4cE1hdGNoQXJyYXkgfCBudWxsIHtcbiAgY29uc3QgZm5UZXh0ID0gc3RyaW5naWZ5Rm4oZm4pLnJlcGxhY2UoU1RSSVBfQ09NTUVOVFMsIFwiXCIpO1xuICByZXR1cm4gZm5UZXh0Lm1hdGNoKEFSUk9XX0FSRykgfHwgZm5UZXh0Lm1hdGNoKEZOX0FSR1MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VGdW5jdGlvbkFyZ3MoZm46IEZ1bmN0aW9uKTogc3RyaW5nW10ge1xuICBjb25zdCBhcmdzID0gZXh0cmFjdEFyZ3MoZm4pO1xuICBpZiAoIWFyZ3MgfHwgIWFyZ3NbMV0pIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICByZXR1cm4gYXJnc1sxXVxuICAgIC5zcGxpdChGTl9BUkdfU1BMSVQpXG4gICAgLm1hcCgoYXJnKSA9PiB7XG4gICAgICBjb25zdCBtYXRjaCA9IGFyZy5yZXBsYWNlKEZOX0FSRywgKGFsbCwgdW5kZXJzY29yZSwgbmFtZSkgPT4gbmFtZSk7XG4gICAgICByZXR1cm4gbWF0Y2gudHJpbSgpO1xuICAgIH0pXG4gICAgLmZpbHRlcigobmFtZSkgPT4gbmFtZS5sZW5ndGggPiAwKTtcbn1cbiIsCiAgICAidHlwZSBXcml0YWJsZVN0cmVhbUxpa2UgPSB7XG4gIGlzVFRZPzogYm9vbGVhbjtcbiAgd3JpdGU/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkO1xufTtcblxudHlwZSBQcm9jZXNzTGlrZSA9IHtcbiAgZW52PzogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPjtcbiAgc3RkZXJyPzogV3JpdGFibGVTdHJlYW1MaWtlO1xuICBzdGRvdXQ/OiBXcml0YWJsZVN0cmVhbUxpa2U7XG59O1xuXG5mdW5jdGlvbiBnZXRQcm9jZXNzKCk6IFByb2Nlc3NMaWtlIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIChnbG9iYWxUaGlzIGFzIHR5cGVvZiBnbG9iYWxUaGlzICYgeyBwcm9jZXNzPzogUHJvY2Vzc0xpa2UgfSkucHJvY2Vzcztcbn1cblxuZnVuY3Rpb24gZ2V0RW52VmFyKG5hbWU6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZ2V0UHJvY2VzcygpPy5lbnY/LltuYW1lXSA/PyBkZWZhdWx0VmFsdWU7XG59XG5cbi8qKlxuICogU0RLIGxvZ2dlciB3aXRoIGNvbmZpZ3VyYWJsZSBsZXZlbHMgYW5kIGNvbG9yIG91dHB1dC5cbiAqXG4gKiBMb2cgbGV2ZWwgaXMgY29udHJvbGxlZCBieSB0aGUgYEpVREdNRU5UX0xPR19MRVZFTGAgZW52aXJvbm1lbnQgdmFyaWFibGUuXG4gKiBEZWZhdWx0cyB0byBcIndhcm5cIi4gU3VwcG9ydGVkIGxldmVsczogXCJkZWJ1Z1wiLCBcImluZm9cIiwgXCJ3YXJuaW5nXCIsIFwiZXJyb3JcIiwgXCJjcml0aWNhbFwiLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwianVkZ2V2YWxcIjtcbiAqXG4gKiBMb2dnZXIuc2V0TGV2ZWwoXCJkZWJ1Z1wiKTtcbiAqIExvZ2dlci5pbmZvKFwiVHJhY2VyIGluaXRpYWxpemVkXCIpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2dnZXIge1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBSRVNFVCA9IFwiXFx4MWJbMG1cIjtcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUkVEID0gXCJcXHgxYlszMW1cIjtcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgWUVMTE9XID0gXCJcXHgxYlszM21cIjtcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgR1JBWSA9IFwiXFx4MWJbOTBtXCI7XG5cbiAgcHVibGljIHN0YXRpYyBMZXZlbCA9IHtcbiAgICBERUJVRzogMCxcbiAgICBJTkZPOiAxLFxuICAgIFdBUk5JTkc6IDIsXG4gICAgRVJST1I6IDMsXG4gICAgQ1JJVElDQUw6IDQsXG4gIH0gYXMgY29uc3Q7XG5cbiAgcHJpdmF0ZSBzdGF0aWMgaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBzdGF0aWMgbGV2ZWxTZXRNYW51YWxseSA9IGZhbHNlO1xuICBwcml2YXRlIHN0YXRpYyBjdXJyZW50TGV2ZWw6IG51bWJlciA9IExvZ2dlci5MZXZlbC5XQVJOSU5HO1xuICBwcml2YXRlIHN0YXRpYyB1c2VDb2xvciA9IHRydWU7XG5cbiAgcHJpdmF0ZSBzdGF0aWMgaW5pdGlhbGl6ZSgpOiB2b2lkIHtcbiAgICBpZiAoIUxvZ2dlci5pbml0aWFsaXplZCkge1xuICAgICAgY29uc3QgcHJvYyA9IGdldFByb2Nlc3MoKTtcbiAgICAgIGNvbnN0IG5vQ29sb3IgPSBwcm9jPy5lbnY/LkpVREdNRU5UX05PX0NPTE9SO1xuICAgICAgTG9nZ2VyLnVzZUNvbG9yID0gIW5vQ29sb3IgJiYgcHJvYz8uc3Rkb3V0Py5pc1RUWSA9PT0gdHJ1ZTtcblxuICAgICAgaWYgKCFMb2dnZXIubGV2ZWxTZXRNYW51YWxseSkge1xuICAgICAgICBjb25zdCBsb2dMZXZlbCA9IGdldEVudlZhcihcIkpVREdNRU5UX0xPR19MRVZFTFwiLCBcIndhcm5cIikudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKGxvZ0xldmVsKSB7XG4gICAgICAgICAgY29uc3QgbGV2ZWxNYXA6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gICAgICAgICAgICBkZWJ1ZzogTG9nZ2VyLkxldmVsLkRFQlVHLFxuICAgICAgICAgICAgaW5mbzogTG9nZ2VyLkxldmVsLklORk8sXG4gICAgICAgICAgICB3YXJuaW5nOiBMb2dnZXIuTGV2ZWwuV0FSTklORyxcbiAgICAgICAgICAgIHdhcm46IExvZ2dlci5MZXZlbC5XQVJOSU5HLFxuICAgICAgICAgICAgZXJyb3I6IExvZ2dlci5MZXZlbC5FUlJPUixcbiAgICAgICAgICAgIGNyaXRpY2FsOiBMb2dnZXIuTGV2ZWwuQ1JJVElDQUwsXG4gICAgICAgICAgfTtcbiAgICAgICAgICBMb2dnZXIuY3VycmVudExldmVsID0gbGV2ZWxNYXBbbG9nTGV2ZWxdID8/IExvZ2dlci5MZXZlbC5XQVJOSU5HO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIExvZ2dlci5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgLyoqIFNldCB0aGUgbWluaW11bSBsb2cgbGV2ZWwuICovXG4gIHB1YmxpYyBzdGF0aWMgc2V0TGV2ZWwobGV2ZWw6IG51bWJlcik6IHZvaWQge1xuICAgIExvZ2dlci5jdXJyZW50TGV2ZWwgPSBsZXZlbDtcbiAgICBMb2dnZXIubGV2ZWxTZXRNYW51YWxseSA9IHRydWU7XG4gIH1cblxuICAvKiogRW5hYmxlIG9yIGRpc2FibGUgY29sb3JlZCBvdXRwdXQuICovXG4gIHB1YmxpYyBzdGF0aWMgc2V0VXNlQ29sb3IodXNlQ29sb3I6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBMb2dnZXIudXNlQ29sb3IgPSB1c2VDb2xvcjtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGxvZyhsZXZlbDogbnVtYmVyLCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBMb2dnZXIuaW5pdGlhbGl6ZSgpO1xuXG4gICAgaWYgKGxldmVsIDwgTG9nZ2VyLmN1cnJlbnRMZXZlbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKClcbiAgICAgIC50b0lTT1N0cmluZygpXG4gICAgICAucmVwbGFjZShcIlRcIiwgXCIgXCIpXG4gICAgICAuc3Vic3RyaW5nKDAsIDE5KTtcbiAgICBjb25zdCBsZXZlbE5hbWUgPVxuICAgICAgT2JqZWN0LmtleXMoTG9nZ2VyLkxldmVsKS5maW5kKFxuICAgICAgICAoa2V5KSA9PiBMb2dnZXIuTGV2ZWxba2V5IGFzIGtleW9mIHR5cGVvZiBMb2dnZXIuTGV2ZWxdID09PSBsZXZlbCxcbiAgICAgICkgPz8gXCJVTktOT1dOXCI7XG4gICAgbGV0IGZvcm1hdHRlZE1lc3NhZ2UgPSBgJHt0aW1lc3RhbXB9IC0ganVkZ2V2YWwgLSAke2xldmVsTmFtZX0gLSAke21lc3NhZ2V9YDtcblxuICAgIGlmIChMb2dnZXIudXNlQ29sb3IpIHtcbiAgICAgIGNvbnN0IGNvbG9yID1cbiAgICAgICAgbGV2ZWwgPT09IExvZ2dlci5MZXZlbC5ERUJVRyB8fCBsZXZlbCA9PT0gTG9nZ2VyLkxldmVsLklORk9cbiAgICAgICAgICA/IExvZ2dlci5HUkFZXG4gICAgICAgICAgOiBsZXZlbCA9PT0gTG9nZ2VyLkxldmVsLldBUk5JTkdcbiAgICAgICAgICAgID8gTG9nZ2VyLllFTExPV1xuICAgICAgICAgICAgOiBMb2dnZXIuUkVEO1xuICAgICAgZm9ybWF0dGVkTWVzc2FnZSA9IGAke2NvbG9yfSR7Zm9ybWF0dGVkTWVzc2FnZX0ke0xvZ2dlci5SRVNFVH1gO1xuICAgIH1cblxuICAgIGNvbnN0IHByb2MgPSBnZXRQcm9jZXNzKCk7XG4gICAgY29uc3Qgb3V0cHV0ID0gbGV2ZWwgPj0gTG9nZ2VyLkxldmVsLkVSUk9SID8gcHJvYz8uc3RkZXJyIDogcHJvYz8uc3Rkb3V0O1xuICAgIGlmIChvdXRwdXQ/LndyaXRlKSB7XG4gICAgICBvdXRwdXQud3JpdGUoZm9ybWF0dGVkTWVzc2FnZSArIFwiXFxuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsZXZlbCA+PSBMb2dnZXIuTGV2ZWwuRVJST1IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZm9ybWF0dGVkTWVzc2FnZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKGZvcm1hdHRlZE1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBMb2cgYSBkZWJ1ZyBtZXNzYWdlLiAqL1xuICBwdWJsaWMgc3RhdGljIGRlYnVnKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgIExvZ2dlci5sb2coTG9nZ2VyLkxldmVsLkRFQlVHLCBtZXNzYWdlKTtcbiAgfVxuXG4gIC8qKiBMb2cgYW4gaW5mb3JtYXRpb25hbCBtZXNzYWdlLiAqL1xuICBwdWJsaWMgc3RhdGljIGluZm8obWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgTG9nZ2VyLmxvZyhMb2dnZXIuTGV2ZWwuSU5GTywgbWVzc2FnZSk7XG4gIH1cblxuICAvKiogTG9nIGEgd2FybmluZyBtZXNzYWdlLiAqL1xuICBwdWJsaWMgc3RhdGljIHdhcm5pbmcobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgTG9nZ2VyLmxvZyhMb2dnZXIuTGV2ZWwuV0FSTklORywgbWVzc2FnZSk7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIHdhcm4obWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgTG9nZ2VyLmxvZyhMb2dnZXIuTGV2ZWwuV0FSTklORywgbWVzc2FnZSk7XG4gIH1cblxuICAvKiogTG9nIGFuIGVycm9yIG1lc3NhZ2UuICovXG4gIHB1YmxpYyBzdGF0aWMgZXJyb3IobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgTG9nZ2VyLmxvZyhMb2dnZXIuTGV2ZWwuRVJST1IsIG1lc3NhZ2UpO1xuICB9XG5cbiAgLyoqIExvZyBhIGNyaXRpY2FsIGVycm9yIG1lc3NhZ2UuICovXG4gIHB1YmxpYyBzdGF0aWMgY3JpdGljYWwobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgTG9nZ2VyLmxvZyhMb2dnZXIuTGV2ZWwuQ1JJVElDQUwsIG1lc3NhZ2UpO1xuICB9XG59XG4iLAogICAgImltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuL2xvZ2dlclwiO1xuXG4vKipcbiAqIFJ1biBgZm5gIGFuZCBzd2FsbG93IGFueSB0aHJvd24gZXJyb3IsIGxvZ2dpbmcgaXQgaW5zdGVhZC5cbiAqXG4gKiBAcGFyYW0gbmFtZSAtIE5hbWUgdXNlZCBpbiB0aGUgZXJyb3IgbG9nICh0eXBpY2FsbHkgYFwiQ2xhc3NOYW1lLm1ldGhvZFwiYCkuXG4gKiBAcGFyYW0gZm4gLSBGdW5jdGlvbiB0byBpbnZva2UuXG4gKiBAcGFyYW0gZmFsbGJhY2sgLSBPcHRpb25hbCB2YWx1ZSByZXR1cm5lZCB3aGVuIGBmbmAgdGhyb3dzLlxuICogQHJldHVybnMgVGhlIHJldHVybiB2YWx1ZSBvZiBgZm5gLCBvciBgZmFsbGJhY2tgIChvciBgdW5kZWZpbmVkYCkgb24gZXJyb3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkb250VGhyb3c8VD4obmFtZTogc3RyaW5nLCBmbjogKCkgPT4gVCk6IFQgfCB1bmRlZmluZWQ7XG5leHBvcnQgZnVuY3Rpb24gZG9udFRocm93PFQ+KG5hbWU6IHN0cmluZywgZm46ICgpID0+IFQsIGZhbGxiYWNrOiBUKTogVDtcbmV4cG9ydCBmdW5jdGlvbiBkb250VGhyb3c8VD4oXG4gIG5hbWU6IHN0cmluZyxcbiAgZm46ICgpID0+IFQsXG4gIGZhbGxiYWNrPzogVCxcbik6IFQgfCB1bmRlZmluZWQge1xuICB0cnkge1xuICAgIHJldHVybiBmbigpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zdCBzdGFjayA9IGVyciBpbnN0YW5jZW9mIEVycm9yICYmIGVyci5zdGFjayA/IGBcXG4ke2Vyci5zdGFja31gIDogXCJcIjtcbiAgICBMb2dnZXIuZXJyb3IoXG4gICAgICBgW0NhdWdodF0gQW4gZXhjZXB0aW9uIHdhcyByYWlzZWQgaW4gJHtuYW1lfTogJHtTdHJpbmcoZXJyKX0ke3N0YWNrfWAsXG4gICAgKTtcbiAgICByZXR1cm4gZmFsbGJhY2s7XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJhbmRvbVVVSUQoKTogc3RyaW5nIHtcbiAgY29uc3QgY3J5cHRvT2JqZWN0ID0gZ2xvYmFsVGhpcy5jcnlwdG87XG4gIGlmICh0eXBlb2YgY3J5cHRvT2JqZWN0Py5yYW5kb21VVUlEID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICByZXR1cm4gY3J5cHRvT2JqZWN0LnJhbmRvbVVVSUQoKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgY3J5cHRvT2JqZWN0Py5nZXRSYW5kb21WYWx1ZXMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoMTYpO1xuICAgIGNyeXB0b09iamVjdC5nZXRSYW5kb21WYWx1ZXMoYnl0ZXMpO1xuXG4gICAgYnl0ZXNbNl0gPSAoYnl0ZXNbNl0gJiAweDBmKSB8IDB4NDA7XG4gICAgYnl0ZXNbOF0gPSAoYnl0ZXNbOF0gJiAweDNmKSB8IDB4ODA7XG5cbiAgICBjb25zdCBoZXggPSBBcnJheS5mcm9tKGJ5dGVzLCAoYnl0ZSkgPT5cbiAgICAgIGJ5dGUudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsIFwiMFwiKSxcbiAgICApLmpvaW4oXCJcIik7XG5cbiAgICByZXR1cm4gW1xuICAgICAgaGV4LnNsaWNlKDAsIDgpLFxuICAgICAgaGV4LnNsaWNlKDgsIDEyKSxcbiAgICAgIGhleC5zbGljZSgxMiwgMTYpLFxuICAgICAgaGV4LnNsaWNlKDE2LCAyMCksXG4gICAgICBoZXguc2xpY2UoMjApLFxuICAgIF0uam9pbihcIi1cIik7XG4gIH1cblxuICByZXR1cm4gXCIxMDAwMDAwMC0xMDAwLTQwMDAtODAwMC0xMDAwMDAwMDAwMDBcIi5yZXBsYWNlKC9bMDE4XS9nLCAoYykgPT5cbiAgICAoXG4gICAgICBOdW1iZXIoYykgXlxuICAgICAgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDI1NikgJiAoMTUgPj4gKE51bWJlcihjKSAvIDQpKSlcbiAgICApLnRvU3RyaW5nKDE2KSxcbiAgKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4vbG9nZ2VyXCI7XG5cbmV4cG9ydCB0eXBlIFNlcmlhbGl6ZXIgPSAob2JqOiB1bmtub3duKSA9PiBzdHJpbmc7XG5cbmZ1bmN0aW9uIGNyZWF0ZUNpcmN1bGFyUmVwbGFjZXIoKTogKFxuICB0aGlzOiB1bmtub3duLFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IHVua25vd24sXG4pID0+IHVua25vd24ge1xuICBjb25zdCBzZWVuID0gbmV3IFdlYWtTZXQ8b2JqZWN0PigpO1xuICByZXR1cm4gZnVuY3Rpb24gKF9rZXk6IHN0cmluZywgdmFsdWU6IHVua25vd24pOiB1bmtub3duIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImJpZ2ludFwiKSByZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICBpZiAoc2Vlbi5oYXModmFsdWUpKSByZXR1cm4gXCJbQ2lyY3VsYXJdXCI7XG4gICAgICBzZWVuLmFkZCh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhZmVTdHJpbmdpZnkob2JqOiB1bmtub3duKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBKU09OLnN0cmluZ2lmeShvYmopO1xuICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSBcInN0cmluZ1wiKSByZXR1cm4gcmVzdWx0O1xuICAgIHJldHVybiBTdHJpbmcocmVzdWx0KTtcbiAgfSBjYXRjaCB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KG9iaiwgY3JlYXRlQ2lyY3VsYXJSZXBsYWNlcigpKTtcbiAgICAgIHJldHVybiB0eXBlb2YgcmVzdWx0ID09PSBcInN0cmluZ1wiID8gcmVzdWx0IDogU3RyaW5nKG9iaik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nZ2VyLmVycm9yKGBzYWZlU3RyaW5naWZ5IGZhaWxlZDogJHtlfWApO1xuICAgICAgcmV0dXJuIFN0cmluZyhvYmopO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgYW4gYXR0cmlidXRlIHRvIGFuIFwiQXR0cmlidXRlXCIgY29tcGF0aWJsZSB2YWx1ZS4gUHJpbWl0aXZlcyBhcmUgcmV0dXJuZWQgYXMgaXMsIG9iamVjdHMgYXJlIHNlcmlhbGl6ZWQgdXNpbmcgdGhlIHByb3ZpZGVkIHNlcmlhbGl6ZXIuXG4gKlxuICogQHBhcmFtIHZhbHVlIC0gVGhlIHZhbHVlIHRvIHNlcmlhbGl6ZS5cbiAqIEBwYXJhbSBzZXJpYWxpemVyIC0gVGhlIHNlcmlhbGl6ZXIgdG8gdXNlLlxuICogQHJldHVybnMgQSBzdHJpbmcsIG51bWJlciwgb3IgYm9vbGVhbiB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUF0dHJpYnV0ZShcbiAgdmFsdWU6IHVua25vd24sXG4gIHNlcmlhbGl6ZXI6IFNlcmlhbGl6ZXIsXG4pOiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuIHtcbiAgaWYgKFxuICAgIHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiB8fFxuICAgIHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiB8fFxuICAgIHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCJcbiAgKVxuICAgIHJldHVybiB2YWx1ZTtcbiAgcmV0dXJuIHNlcmlhbGl6ZXIodmFsdWUpO1xufVxuIiwKICAgICJpbXBvcnQge1xuICB0eXBlIEJhZ2dhZ2UsXG4gIHR5cGUgQ29udGV4dCxcbiAgY3JlYXRlQ29udGV4dEtleSxcbiAgcHJvcGFnYXRpb24sXG59IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB7IGdldFRyYWNlUnVudGltZSB9IGZyb20gXCIuLi9ydW50aW1lXCI7XG5cbi8qKlxuICogSnVkZ21lbnQgYmFnZ2FnZSBzdG9yZS4gQmFnZ2FnZSBpcyBhIHNldCBvZiBrZXktdmFsdWUgcGFpcnMgYXR0YWNoZWRcbiAqIHRvIGEge0BsaW5rIENvbnRleHR9IGFuZCBhdXRvbWF0aWNhbGx5IHByb3BhZ2F0ZWQgdG8gY2hpbGQgc3BhbnMgYW5kXG4gKiB0byBkb3duc3RyZWFtIHNlcnZpY2VzIHRocm91Z2ggdGhlIGBiYWdnYWdlYCBIVFRQIGhlYWRlci5cbiAqL1xuXG4vKiogQ3JlYXRlIGEgbmV3IHtAbGluayBCYWdnYWdlfSwgb3B0aW9uYWxseSBwcmUtcG9wdWxhdGVkIHdpdGggZW50cmllcy4gKi9cbmV4cG9ydCBjb25zdCBjcmVhdGVCYWdnYWdlID0gcHJvcGFnYXRpb24uY3JlYXRlQmFnZ2FnZS5iaW5kKHByb3BhZ2F0aW9uKTtcblxuY29uc3QgQkFHR0FHRV9LRVkgPSBjcmVhdGVDb250ZXh0S2V5KFwiYmFnZ2FnZVwiKTtcblxuLyoqIFJldHJpZXZlIHRoZSBiYWdnYWdlIGF0dGFjaGVkIHRvIHRoZSBnaXZlbiBjb250ZXh0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEJhZ2dhZ2UoY29udGV4dDogQ29udGV4dCk6IEJhZ2dhZ2UgfCB1bmRlZmluZWQge1xuICByZXR1cm4gY29udGV4dC5nZXRWYWx1ZShCQUdHQUdFX0tFWSkgYXMgQmFnZ2FnZSB8IHVuZGVmaW5lZDtcbn1cblxuLyoqIFJldHJpZXZlIHRoZSBiYWdnYWdlIGF0dGFjaGVkIHRvIHRoZSBhY3RpdmUgY29udGV4dC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBY3RpdmVCYWdnYWdlKCk6IEJhZ2dhZ2UgfCB1bmRlZmluZWQge1xuICByZXR1cm4gZ2V0QmFnZ2FnZShnZXRUcmFjZVJ1bnRpbWUoKS5nZXRDdXJyZW50Q29udGV4dCgpKTtcbn1cblxuLyoqIEF0dGFjaCBhIGJhZ2dhZ2UgdG8gdGhlIGdpdmVuIGNvbnRleHQsIHJldHVybmluZyBhIG5ldyBjb250ZXh0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldEJhZ2dhZ2UoY29udGV4dDogQ29udGV4dCwgYmFnZ2FnZTogQmFnZ2FnZSk6IENvbnRleHQge1xuICByZXR1cm4gY29udGV4dC5zZXRWYWx1ZShCQUdHQUdFX0tFWSwgYmFnZ2FnZSk7XG59XG5cbi8qKiBSZW1vdmUgdGhlIGJhZ2dhZ2UgYXR0YWNoZWQgdG8gdGhlIGdpdmVuIGNvbnRleHQsIHJldHVybmluZyBhIG5ldyBjb250ZXh0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZUJhZ2dhZ2UoY29udGV4dDogQ29udGV4dCk6IENvbnRleHQge1xuICByZXR1cm4gY29udGV4dC5kZWxldGVWYWx1ZShCQUdHQUdFX0tFWSk7XG59XG5cbmV4cG9ydCB7IGJhZ2dhZ2VFbnRyeU1ldGFkYXRhRnJvbVN0cmluZyB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmV4cG9ydCB0eXBlIHtcbiAgQmFnZ2FnZSxcbiAgQmFnZ2FnZUVudHJ5LFxuICBCYWdnYWdlRW50cnlNZXRhZGF0YSxcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuXG5leHBvcnQgeyBKdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yIH0gZnJvbSBcIi4vSnVkZ21lbnRCYWdnYWdlUHJvcGFnYXRvclwiO1xuIiwKICAgICJpbXBvcnQge1xuICBJTlZBTElEX1NQQU5fQ09OVEVYVCxcbiAgUk9PVF9DT05URVhULFxuICBTcGFuU3RhdHVzQ29kZSxcbiAgdHJhY2UsXG4gIHR5cGUgQ29udGV4dCxcbiAgdHlwZSBTcGFuLFxuICB0eXBlIFNwYW5Db250ZXh0LFxuICB0eXBlIFNwYW5PcHRpb25zLFxuICB0eXBlIFRyYWNlcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHR5cGUgeyBJbnN0cnVtZW50YXRpb24gfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvaW5zdHJ1bWVudGF0aW9uXCI7XG5pbXBvcnQgdHlwZSB7IEJhc2ljVHJhY2VyUHJvdmlkZXIgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB0eXBlIHsgSnVkZ21lbnRBcGlDbGllbnQgfSBmcm9tIFwiLi4vaW50ZXJuYWwvYXBpXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvbG9nZ2VyXCI7XG5pbXBvcnQgdHlwZSB7IFNlcmlhbGl6ZXIgfSBmcm9tIFwiLi4vdXRpbHMvc2VyaWFsaXplclwiO1xuaW1wb3J0IHR5cGUgeyBKdWRnbWVudFNwYW5FeHBvcnRlciB9IGZyb20gXCIuL2V4cG9ydGVycy9KdWRnbWVudFNwYW5FeHBvcnRlclwiO1xuaW1wb3J0IHR5cGUgeyBKdWRnbWVudFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi9wcm9jZXNzb3JzL0p1ZGdtZW50U3BhblByb2Nlc3NvclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlUnVudGltZVRyYWNlciB7XG4gIHByb2plY3ROYW1lOiBzdHJpbmcgfCBudWxsO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGFwaUtleTogc3RyaW5nIHwgbnVsbDtcbiAgb3JnYW5pemF0aW9uSWQ6IHN0cmluZyB8IG51bGw7XG4gIGFwaVVybDogc3RyaW5nIHwgbnVsbDtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZyB8IG51bGw7XG4gIHNlcmlhbGl6ZXI6IFNlcmlhbGl6ZXI7XG4gIF90cmFjZXJQcm92aWRlcjogQmFzaWNUcmFjZXJQcm92aWRlcjtcbiAgX2NsaWVudDogSnVkZ21lbnRBcGlDbGllbnQgfCBudWxsO1xuICBfZW5hYmxlTW9uaXRvcmluZzogYm9vbGVhbjtcbiAgc3VwcG9ydHNMaXZlSW5zdHJ1bWVudGF0aW9uOiBib29sZWFuO1xuICBnZXRTcGFuRXhwb3J0ZXIoKTogSnVkZ21lbnRTcGFuRXhwb3J0ZXI7XG4gIGdldFNwYW5Qcm9jZXNzb3IoKTogSnVkZ21lbnRTcGFuUHJvY2Vzc29yO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlUnVudGltZSB7XG4gIHJlZ2lzdGVyKHRyYWNlcjogVHJhY2VSdW50aW1lVHJhY2VyKTogdm9pZDtcbiAgZGVyZWdpc3Rlcih0cmFjZXI6IFRyYWNlUnVudGltZVRyYWNlcik6IHZvaWQ7XG4gIHNldEFjdGl2ZSh0cmFjZXI6IFRyYWNlUnVudGltZVRyYWNlcik6IGJvb2xlYW47XG4gIGdldEFjdGl2ZVRyYWNlcigpOiBUcmFjZVJ1bnRpbWVUcmFjZXIgfCBudWxsO1xuICBnZXRDdXJyZW50Q29udGV4dCgpOiBDb250ZXh0O1xuICBzZXRTcGFuKGN0eDogQ29udGV4dCwgc3BhbjogU3Bhbik6IENvbnRleHQ7XG4gIHdyYXBTcGFuQ29udGV4dChzcGFuQ29udGV4dDogU3BhbkNvbnRleHQpOiBTcGFuO1xuICBnZXRDdXJyZW50U3BhbigpOiBTcGFuIHwgdW5kZWZpbmVkO1xuICBnZXRUcmFjZXIoXG4gICAgaW5zdHJ1bWVudGluZ01vZHVsZU5hbWU6IHN0cmluZyxcbiAgICBpbnN0cnVtZW50aW5nTGlicmFyeVZlcnNpb24/OiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHsgc2NoZW1hVXJsPzogc3RyaW5nIH0sXG4gICk6IFRyYWNlcjtcbiAgYWRkSW5zdHJ1bWVudGF0aW9uKGluc3RydW1lbnRvcjogSW5zdHJ1bWVudGF0aW9uKTogdm9pZDtcbiAgdXNlU3BhbjxUPihcbiAgICBzcGFuOiBTcGFuLFxuICAgIGVuZE9uRXhpdDogYm9vbGVhbixcbiAgICByZWNvcmRFeGNlcHRpb246IGJvb2xlYW4sXG4gICAgc2V0U3RhdHVzT25FeGNlcHRpb246IGJvb2xlYW4sXG4gICAgZm46ICgpID0+IFQsXG4gICk6IFQ7XG4gIGF0dGFjaENvbnRleHQoY3R4OiBDb250ZXh0KTogdm9pZDtcbiAgd2l0aENvbnRleHQ8VD4oY3R4OiBDb250ZXh0LCBmbjogKCkgPT4gVCk6IFQ7XG4gIGZvcmNlRmx1c2goKTogUHJvbWlzZTx2b2lkPjtcbiAgc2h1dGRvd24oKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuY2xhc3MgTm9PcFRyYWNlciBpbXBsZW1lbnRzIFRyYWNlciB7XG4gIHN0YXJ0U3BhbigpOiBTcGFuIHtcbiAgICByZXR1cm4gdHJhY2Uud3JhcFNwYW5Db250ZXh0KElOVkFMSURfU1BBTl9DT05URVhUKTtcbiAgfVxuXG4gIHN0YXJ0QWN0aXZlU3BhbjxGIGV4dGVuZHMgKHNwYW46IFNwYW4pID0+IHVua25vd24+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBmbjogRixcbiAgKTogUmV0dXJuVHlwZTxGPjtcbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFNwYW5PcHRpb25zLFxuICAgIGZuOiBGLFxuICApOiBSZXR1cm5UeXBlPEY+O1xuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3Bhbk9wdGlvbnMsXG4gICAgY29udGV4dDogQ29udGV4dCxcbiAgICBmbjogRixcbiAgKTogUmV0dXJuVHlwZTxGPjtcbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgX25hbWU6IHN0cmluZyxcbiAgICAuLi5hcmdzOiBbRl0gfCBbU3Bhbk9wdGlvbnMsIEZdIHwgW1NwYW5PcHRpb25zLCBDb250ZXh0LCBGXVxuICApOiBSZXR1cm5UeXBlPEY+IHtcbiAgICBjb25zdCBmbiA9XG4gICAgICBhcmdzLmxlbmd0aCA9PT0gMSA/IGFyZ3NbMF0gOiBhcmdzLmxlbmd0aCA9PT0gMiA/IGFyZ3NbMV0gOiBhcmdzWzJdO1xuICAgIHJldHVybiBmbih0aGlzLnN0YXJ0U3BhbigpKSBhcyBSZXR1cm5UeXBlPEY+O1xuICB9XG59XG5cbmNvbnN0IG5vT3BUcmFjZXIgPSBuZXcgTm9PcFRyYWNlcigpO1xuXG5jb25zdCBub09wUnVudGltZTogVHJhY2VSdW50aW1lID0ge1xuICByZWdpc3RlcigpIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9LFxuICBkZXJlZ2lzdGVyKCkge1xuICAgIC8qIGVtcHR5ICovXG4gIH0sXG4gIHNldEFjdGl2ZSgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGdldEFjdGl2ZVRyYWNlcigpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgZ2V0Q3VycmVudENvbnRleHQoKSB7XG4gICAgcmV0dXJuIFJPT1RfQ09OVEVYVDtcbiAgfSxcbiAgc2V0U3BhbihjdHgsIHNwYW4pIHtcbiAgICByZXR1cm4gdHJhY2Uuc2V0U3BhbihjdHgsIHNwYW4pO1xuICB9LFxuICB3cmFwU3BhbkNvbnRleHQoc3BhbkNvbnRleHQpIHtcbiAgICByZXR1cm4gdHJhY2Uud3JhcFNwYW5Db250ZXh0KHNwYW5Db250ZXh0KTtcbiAgfSxcbiAgZ2V0Q3VycmVudFNwYW4oKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfSxcbiAgZ2V0VHJhY2VyKCkge1xuICAgIExvZ2dlci5kZWJ1ZyhcIk5vIGFjdGl2ZSB0cmFjZXIgcHJvdmlkZXIsIHJldHVybmluZyBOb09wVHJhY2VyXCIpO1xuICAgIHJldHVybiBub09wVHJhY2VyO1xuICB9LFxuICBhZGRJbnN0cnVtZW50YXRpb24oKSB7XG4gICAgTG9nZ2VyLndhcm5pbmcoXG4gICAgICBcIk5vIGFjdGl2ZSB0cmFjZXIgcHJvdmlkZXIuIEluc3RydW1lbnRhdGlvbiB3YXMgbm90IHJlZ2lzdGVyZWQuXCIsXG4gICAgKTtcbiAgfSxcbiAgdXNlU3BhbihzcGFuLCBlbmRPbkV4aXQsIHJlY29yZEV4Y2VwdGlvbiwgc2V0U3RhdHVzT25FeGNlcHRpb24sIGZuKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGZuKCk7XG4gICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgICAgLmNhdGNoKChleGM6IHVua25vd24pID0+IHtcbiAgICAgICAgICAgIGlmIChzcGFuLmlzUmVjb3JkaW5nKCkpIHtcbiAgICAgICAgICAgICAgaWYgKHJlY29yZEV4Y2VwdGlvbikgc3Bhbi5yZWNvcmRFeGNlcHRpb24oZXhjIGFzIEVycm9yKTtcbiAgICAgICAgICAgICAgaWYgKHNldFN0YXR1c09uRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyID0gZXhjIGFzIEVycm9yO1xuICAgICAgICAgICAgICAgIHNwYW4uc2V0U3RhdHVzKHtcbiAgICAgICAgICAgICAgICAgIGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZXJyLm5hbWV9OiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IGV4YztcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIGlmIChlbmRPbkV4aXQpIHNwYW4uZW5kKCk7XG4gICAgICAgICAgfSkgYXMgdHlwZW9mIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGlmIChlbmRPbkV4aXQpIHNwYW4uZW5kKCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGV4Yykge1xuICAgICAgaWYgKHNwYW4uaXNSZWNvcmRpbmcoKSkge1xuICAgICAgICBpZiAocmVjb3JkRXhjZXB0aW9uKSBzcGFuLnJlY29yZEV4Y2VwdGlvbihleGMgYXMgRXJyb3IpO1xuICAgICAgICBpZiAoc2V0U3RhdHVzT25FeGNlcHRpb24pIHtcbiAgICAgICAgICBjb25zdCBlcnIgPSBleGMgYXMgRXJyb3I7XG4gICAgICAgICAgc3Bhbi5zZXRTdGF0dXMoe1xuICAgICAgICAgICAgY29kZTogU3BhblN0YXR1c0NvZGUuRVJST1IsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlcnIubmFtZX06ICR7ZXJyLm1lc3NhZ2V9YCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGVuZE9uRXhpdCkgc3Bhbi5lbmQoKTtcbiAgICAgIHRocm93IGV4YztcbiAgICB9XG4gIH0sXG4gIGF0dGFjaENvbnRleHQoKSB7XG4gICAgLyogZW1wdHkgKi9cbiAgfSxcbiAgd2l0aENvbnRleHQoX2N0eCwgZm4pIHtcbiAgICByZXR1cm4gZm4oKTtcbiAgfSxcbiAgZm9yY2VGbHVzaCgpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH0sXG4gIHNodXRkb3duKCkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfSxcbn07XG5cbmxldCBydW50aW1lOiBUcmFjZVJ1bnRpbWUgfCBudWxsID0gbnVsbDtcbmxldCBsbG1XcmFwcGVyOiAoKGNsaWVudDogdW5rbm93bikgPT4gdW5rbm93bikgfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIHNldFRyYWNlUnVudGltZShuZXh0UnVudGltZTogVHJhY2VSdW50aW1lKTogdm9pZCB7XG4gIHJ1bnRpbWUgPSBuZXh0UnVudGltZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRyYWNlUnVudGltZSgpOiBUcmFjZVJ1bnRpbWUge1xuICByZXR1cm4gcnVudGltZSA/PyBub09wUnVudGltZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldExMTVdyYXBwZXIod3JhcHBlcjogKGNsaWVudDogdW5rbm93bikgPT4gdW5rbm93bik6IHZvaWQge1xuICBsbG1XcmFwcGVyID0gd3JhcHBlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBMTE1DbGllbnQ8VD4oY2xpZW50OiBUKTogVCB7XG4gIGlmICghbGxtV3JhcHBlcikge1xuICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgXCJMTE0gY2xpZW50IGluc3RydW1lbnRhdGlvbiBpcyBub3QgYXZhaWxhYmxlIGZyb20gdGhpcyBlbnRyeXBvaW50LlwiLFxuICAgICk7XG4gICAgcmV0dXJuIGNsaWVudDtcbiAgfVxuICByZXR1cm4gbGxtV3JhcHBlcihjbGllbnQpIGFzIFQ7XG59XG4iLAogICAgImltcG9ydCB7XG4gIHR5cGUgQmFnZ2FnZUVudHJ5LFxuICB0eXBlIENvbnRleHQsXG4gIHR5cGUgVGV4dE1hcEdldHRlcixcbiAgdHlwZSBUZXh0TWFwUHJvcGFnYXRvcixcbiAgdHlwZSBUZXh0TWFwU2V0dGVyLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvYXBpXCI7XG5pbXBvcnQgeyBpc1RyYWNpbmdTdXBwcmVzc2VkIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2NvcmVcIjtcbmltcG9ydCB7XG4gIEJBR0dBR0VfSEVBREVSLFxuICBCQUdHQUdFX0lURU1TX1NFUEFSQVRPUixcbiAgQkFHR0FHRV9NQVhfTkFNRV9WQUxVRV9QQUlSUyxcbiAgQkFHR0FHRV9NQVhfUEVSX05BTUVfVkFMVUVfUEFJUlMsXG59IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuaW1wb3J0IHsgY3JlYXRlQmFnZ2FnZSwgZ2V0QmFnZ2FnZSwgc2V0QmFnZ2FnZSB9IGZyb20gXCIuL2luZGV4XCI7XG5pbXBvcnQgeyBnZXRLZXlQYWlycywgcGFyc2VQYWlyS2V5VmFsdWUsIHNlcmlhbGl6ZUtleVBhaXJzIH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuLyoqXG4gKiBQcm9wYWdhdGVzIHtAbGluayBCYWdnYWdlfSB0aHJvdWdoIHRoZSBXM0MgYGJhZ2dhZ2VgIGhlYWRlci5cbiAqXG4gKiBJbXBsZW1lbnRzIHRoZSBXM0MgQmFnZ2FnZSBzcGVjaWZpY2F0aW9uOiBodHRwczovL3czYy5naXRodWIuaW8vYmFnZ2FnZS9cbiAqL1xuZXhwb3J0IGNsYXNzIEp1ZGdtZW50QmFnZ2FnZVByb3BhZ2F0b3IgaW1wbGVtZW50cyBUZXh0TWFwUHJvcGFnYXRvciB7XG4gIGluamVjdChjb250ZXh0OiBDb250ZXh0LCBjYXJyaWVyOiB1bmtub3duLCBzZXR0ZXI6IFRleHRNYXBTZXR0ZXIpOiB2b2lkIHtcbiAgICBjb25zdCBiYWdnYWdlID0gZ2V0QmFnZ2FnZShjb250ZXh0KTtcbiAgICBpZiAoIWJhZ2dhZ2UgfHwgaXNUcmFjaW5nU3VwcHJlc3NlZChjb250ZXh0KSkgcmV0dXJuO1xuICAgIGNvbnN0IGtleVBhaXJzID0gZ2V0S2V5UGFpcnMoYmFnZ2FnZSlcbiAgICAgIC5maWx0ZXIoKHBhaXIpID0+IHBhaXIubGVuZ3RoIDw9IEJBR0dBR0VfTUFYX1BFUl9OQU1FX1ZBTFVFX1BBSVJTKVxuICAgICAgLnNsaWNlKDAsIEJBR0dBR0VfTUFYX05BTUVfVkFMVUVfUEFJUlMpO1xuICAgIGNvbnN0IGhlYWRlclZhbHVlID0gc2VyaWFsaXplS2V5UGFpcnMoa2V5UGFpcnMpO1xuICAgIGlmIChoZWFkZXJWYWx1ZS5sZW5ndGggPiAwKSB7XG4gICAgICBzZXR0ZXIuc2V0KGNhcnJpZXIsIEJBR0dBR0VfSEVBREVSLCBoZWFkZXJWYWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgZXh0cmFjdChjb250ZXh0OiBDb250ZXh0LCBjYXJyaWVyOiB1bmtub3duLCBnZXR0ZXI6IFRleHRNYXBHZXR0ZXIpOiBDb250ZXh0IHtcbiAgICBjb25zdCBoZWFkZXJWYWx1ZSA9IGdldHRlci5nZXQoY2FycmllciwgQkFHR0FHRV9IRUFERVIpO1xuICAgIGNvbnN0IGJhZ2dhZ2VTdHJpbmcgPSBBcnJheS5pc0FycmF5KGhlYWRlclZhbHVlKVxuICAgICAgPyBoZWFkZXJWYWx1ZS5qb2luKEJBR0dBR0VfSVRFTVNfU0VQQVJBVE9SKVxuICAgICAgOiBoZWFkZXJWYWx1ZTtcbiAgICBpZiAoIWJhZ2dhZ2VTdHJpbmcpIHJldHVybiBjb250ZXh0O1xuICAgIGNvbnN0IGJhZ2dhZ2U6IFJlY29yZDxzdHJpbmcsIEJhZ2dhZ2VFbnRyeT4gPSB7fTtcbiAgICBpZiAoYmFnZ2FnZVN0cmluZy5sZW5ndGggPT09IDApIHJldHVybiBjb250ZXh0O1xuICAgIGNvbnN0IHBhaXJzID0gYmFnZ2FnZVN0cmluZy5zcGxpdChCQUdHQUdFX0lURU1TX1NFUEFSQVRPUik7XG4gICAgcGFpcnMuZm9yRWFjaCgoZW50cnkpID0+IHtcbiAgICAgIGNvbnN0IGtleVBhaXIgPSBwYXJzZVBhaXJLZXlWYWx1ZShlbnRyeSk7XG4gICAgICBpZiAoa2V5UGFpcikge1xuICAgICAgICBjb25zdCBiYWdnYWdlRW50cnk6IEJhZ2dhZ2VFbnRyeSA9IHsgdmFsdWU6IGtleVBhaXIudmFsdWUgfTtcbiAgICAgICAgaWYgKGtleVBhaXIubWV0YWRhdGEpIHtcbiAgICAgICAgICBiYWdnYWdlRW50cnkubWV0YWRhdGEgPSBrZXlQYWlyLm1ldGFkYXRhO1xuICAgICAgICB9XG4gICAgICAgIGJhZ2dhZ2Vba2V5UGFpci5rZXldID0gYmFnZ2FnZUVudHJ5O1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChPYmplY3QuZW50cmllcyhiYWdnYWdlKS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBjb250ZXh0O1xuICAgIH1cbiAgICByZXR1cm4gc2V0QmFnZ2FnZShjb250ZXh0LCBjcmVhdGVCYWdnYWdlKGJhZ2dhZ2UpKTtcbiAgfVxuXG4gIGZpZWxkcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFtCQUdHQUdFX0hFQURFUl07XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGNvbnN0IEJBR0dBR0VfS0VZX1BBSVJfU0VQQVJBVE9SID0gXCI9XCI7XG5leHBvcnQgY29uc3QgQkFHR0FHRV9QUk9QRVJUSUVTX1NFUEFSQVRPUiA9IFwiO1wiO1xuZXhwb3J0IGNvbnN0IEJBR0dBR0VfSVRFTVNfU0VQQVJBVE9SID0gXCIsXCI7XG5cbi8qKiBOYW1lIG9mIHRoZSBIVFRQIGhlYWRlciB1c2VkIHRvIHByb3BhZ2F0ZSBiYWdnYWdlLiAqL1xuZXhwb3J0IGNvbnN0IEJBR0dBR0VfSEVBREVSID0gXCJiYWdnYWdlXCI7XG5cbi8qKiBNYXhpbXVtIG51bWJlciBvZiBuYW1lLXZhbHVlIHBhaXJzIGFsbG93ZWQgYnkgdGhlIFczQyBCYWdnYWdlIHNwZWMuICovXG5leHBvcnQgY29uc3QgQkFHR0FHRV9NQVhfTkFNRV9WQUxVRV9QQUlSUyA9IDE4MDtcblxuLyoqIE1heGltdW0gbnVtYmVyIG9mIGJ5dGVzIHBlciBhIHNpbmdsZSBuYW1lLXZhbHVlIHBhaXIgYWxsb3dlZCBieSB0aGUgVzNDIEJhZ2dhZ2Ugc3BlYy4gKi9cbmV4cG9ydCBjb25zdCBCQUdHQUdFX01BWF9QRVJfTkFNRV9WQUxVRV9QQUlSUyA9IDQwOTY7XG5cbi8qKiBNYXhpbXVtIHRvdGFsIGxlbmd0aCBvZiBhbGwgbmFtZS12YWx1ZSBwYWlycyBhbGxvd2VkIGJ5IHRoZSBXM0MgQmFnZ2FnZSBzcGVjLiAqL1xuZXhwb3J0IGNvbnN0IEJBR0dBR0VfTUFYX1RPVEFMX0xFTkdUSCA9IDgxOTI7XG4iLAogICAgImltcG9ydCB7XG4gIHR5cGUgQmFnZ2FnZSxcbiAgdHlwZSBCYWdnYWdlRW50cnlNZXRhZGF0YSxcbiAgYmFnZ2FnZUVudHJ5TWV0YWRhdGFGcm9tU3RyaW5nLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvYXBpXCI7XG5pbXBvcnQge1xuICBCQUdHQUdFX0lURU1TX1NFUEFSQVRPUixcbiAgQkFHR0FHRV9LRVlfUEFJUl9TRVBBUkFUT1IsXG4gIEJBR0dBR0VfTUFYX1RPVEFMX0xFTkdUSCxcbiAgQkFHR0FHRV9QUk9QRVJUSUVTX1NFUEFSQVRPUixcbn0gZnJvbSBcIi4vY29uc3RhbnRzXCI7XG5cbi8qKlxuICogU2VyaWFsaXplIGFuIGFycmF5IG9mIGtleT12YWx1ZSBwYWlycyBpbnRvIGEgYmFnZ2FnZSBoZWFkZXIgc3RyaW5nLFxuICogY2FwcGluZyB0aGUgcmVzdWx0IGF0IHtAbGluayBCQUdHQUdFX01BWF9UT1RBTF9MRU5HVEh9LlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplS2V5UGFpcnMoa2V5UGFpcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgcmV0dXJuIGtleVBhaXJzLnJlZHVjZSgoaFZhbHVlLCBjdXJyZW50KSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBgJHtoVmFsdWV9JHtoVmFsdWUgIT09IFwiXCIgPyBCQUdHQUdFX0lURU1TX1NFUEFSQVRPUiA6IFwiXCJ9JHtjdXJyZW50fWA7XG4gICAgcmV0dXJuIHZhbHVlLmxlbmd0aCA+IEJBR0dBR0VfTUFYX1RPVEFMX0xFTkdUSCA/IGhWYWx1ZSA6IHZhbHVlO1xuICB9LCBcIlwiKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEge0BsaW5rIEJhZ2dhZ2V9IGludG8gYW4gYXJyYXkgb2YgYGtleT12YWx1ZTttZXRhZGF0YWAgc3RyaW5ncyxcbiAqIFVSSS1lbmNvZGluZyBlYWNoIGtleSBhbmQgdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRLZXlQYWlycyhiYWdnYWdlOiBCYWdnYWdlKTogc3RyaW5nW10ge1xuICByZXR1cm4gYmFnZ2FnZS5nZXRBbGxFbnRyaWVzKCkubWFwKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICBsZXQgZW50cnkgPSBgJHtlbmNvZGVVUklDb21wb25lbnQoa2V5KX09JHtlbmNvZGVVUklDb21wb25lbnQodmFsdWUudmFsdWUpfWA7XG4gICAgaWYgKHZhbHVlLm1ldGFkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGVudHJ5ICs9IEJBR0dBR0VfUFJPUEVSVElFU19TRVBBUkFUT1IgKyB2YWx1ZS5tZXRhZGF0YS50b1N0cmluZygpO1xuICAgIH1cbiAgICByZXR1cm4gZW50cnk7XG4gIH0pO1xufVxuXG4vKiogUGFyc2UgYSBzaW5nbGUgYGtleT12YWx1ZTttZXRhZGF0YWAgYmFnZ2FnZSBsaXN0LW1lbWJlci4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBhaXJLZXlWYWx1ZShcbiAgZW50cnk6IHN0cmluZyxcbik6IHsga2V5OiBzdHJpbmc7IHZhbHVlOiBzdHJpbmc7IG1ldGFkYXRhPzogQmFnZ2FnZUVudHJ5TWV0YWRhdGEgfSB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHZhbHVlUHJvcHMgPSBlbnRyeS5zcGxpdChCQUdHQUdFX1BST1BFUlRJRVNfU0VQQVJBVE9SKTtcbiAgaWYgKHZhbHVlUHJvcHMubGVuZ3RoIDw9IDApIHJldHVybjtcbiAgY29uc3Qga2V5UGFpclBhcnQgPSB2YWx1ZVByb3BzLnNoaWZ0KCk7XG4gIGlmICgha2V5UGFpclBhcnQpIHJldHVybjtcbiAgY29uc3Qgc2VwYXJhdG9ySW5kZXggPSBrZXlQYWlyUGFydC5pbmRleE9mKEJBR0dBR0VfS0VZX1BBSVJfU0VQQVJBVE9SKTtcbiAgaWYgKHNlcGFyYXRvckluZGV4IDw9IDApIHJldHVybjtcbiAgY29uc3Qga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KFxuICAgIGtleVBhaXJQYXJ0LnN1YnN0cmluZygwLCBzZXBhcmF0b3JJbmRleCkudHJpbSgpLFxuICApO1xuICBjb25zdCB2YWx1ZSA9IGRlY29kZVVSSUNvbXBvbmVudChcbiAgICBrZXlQYWlyUGFydC5zdWJzdHJpbmcoc2VwYXJhdG9ySW5kZXggKyAxKS50cmltKCksXG4gICk7XG4gIGxldCBtZXRhZGF0YTogQmFnZ2FnZUVudHJ5TWV0YWRhdGEgfCB1bmRlZmluZWQ7XG4gIGlmICh2YWx1ZVByb3BzLmxlbmd0aCA+IDApIHtcbiAgICBtZXRhZGF0YSA9IGJhZ2dhZ2VFbnRyeU1ldGFkYXRhRnJvbVN0cmluZyhcbiAgICAgIHZhbHVlUHJvcHMuam9pbihCQUdHQUdFX1BST1BFUlRJRVNfU0VQQVJBVE9SKSxcbiAgICApO1xuICB9XG4gIHJldHVybiB7IGtleSwgdmFsdWUsIG1ldGFkYXRhIH07XG59XG4iLAogICAgImltcG9ydCB7XG4gIHR5cGUgQ29udGV4dCxcbiAgZGVmYXVsdFRleHRNYXBHZXR0ZXIsXG4gIGRlZmF1bHRUZXh0TWFwU2V0dGVyLFxuICB0eXBlIFRleHRNYXBHZXR0ZXIsXG4gIHR5cGUgVGV4dE1hcFByb3BhZ2F0b3IsXG4gIHR5cGUgVGV4dE1hcFNldHRlcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2FwaVwiO1xuaW1wb3J0IHtcbiAgQ29tcG9zaXRlUHJvcGFnYXRvcixcbiAgVzNDVHJhY2VDb250ZXh0UHJvcGFnYXRvcixcbn0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2NvcmVcIjtcbmltcG9ydCB7IGRvbnRUaHJvdyB9IGZyb20gXCIuLi8uLi91dGlscy9kb250LXRocm93XCI7XG5pbXBvcnQgeyBKdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yIH0gZnJvbSBcIi4uL2JhZ2dhZ2UvSnVkZ21lbnRCYWdnYWdlUHJvcGFnYXRvclwiO1xuaW1wb3J0IHsgZ2V0VHJhY2VSdW50aW1lIH0gZnJvbSBcIi4uL3J1bnRpbWVcIjtcblxuLyoqXG4gKiBJbmplY3QgYW5kIGV4dHJhY3QgdHJhY2UgY29udGV4dCBhbmQgYmFnZ2FnZSBhY3Jvc3Mgc2VydmljZVxuICogYm91bmRhcmllcyB0aHJvdWdoIGEgY29tcG9zaXRlIFczQyBUcmFjZUNvbnRleHQgKyBCYWdnYWdlIHByb3BhZ2F0b3IuXG4gKi9cblxubGV0IF9nbG9iYWxUZXh0bWFwOiBUZXh0TWFwUHJvcGFnYXRvciA9IG5ldyBDb21wb3NpdGVQcm9wYWdhdG9yKHtcbiAgcHJvcGFnYXRvcnM6IFtcbiAgICBuZXcgVzNDVHJhY2VDb250ZXh0UHJvcGFnYXRvcigpLFxuICAgIG5ldyBKdWRnbWVudEJhZ2dhZ2VQcm9wYWdhdG9yKCksXG4gIF0sXG59KTtcblxuLyoqIFJldHVybiB0aGUgYWN0aXZlIGNvbXBvc2l0ZSBwcm9wYWdhdG9yIChXM0MgVHJhY2VDb250ZXh0ICsgSnVkZ21lbnQgQmFnZ2FnZSkuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0R2xvYmFsVGV4dG1hcCgpOiBUZXh0TWFwUHJvcGFnYXRvciB7XG4gIHJldHVybiBfZ2xvYmFsVGV4dG1hcDtcbn1cblxuLyoqIFJlcGxhY2UgdGhlIGdsb2JhbCB0ZXh0LW1hcCBwcm9wYWdhdG9yLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldEdsb2JhbFRleHRtYXAocHJvcGFnYXRvcjogVGV4dE1hcFByb3BhZ2F0b3IpOiB2b2lkIHtcbiAgX2dsb2JhbFRleHRtYXAgPSBwcm9wYWdhdG9yO1xufVxuXG5mdW5jdGlvbiBfcmVzb2x2ZUNvbnRleHQoY29udGV4dD86IENvbnRleHQpOiBDb250ZXh0IHtcbiAgaWYgKGNvbnRleHQgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGNvbnRleHQ7XG4gIHJldHVybiBnZXRUcmFjZVJ1bnRpbWUoKS5nZXRDdXJyZW50Q29udGV4dCgpO1xufVxuXG4vKipcbiAqIEluamVjdCB0cmFjZSBjb250ZXh0IGFuZCBiYWdnYWdlIGludG8gYW4gb3V0Z29pbmcgY2FycmllciAoZS5nLiBIVFRQXG4gKiBoZWFkZXJzKS5cbiAqXG4gKiBDYWxsIHRoaXMgYmVmb3JlIG1ha2luZyBhbiBvdXRib3VuZCBIVFRQIHJlcXVlc3QgdG8gcHJvcGFnYXRlIHRoZVxuICogY3VycmVudCB0cmFjZSBhY3Jvc3Mgc2VydmljZSBib3VuZGFyaWVzLlxuICpcbiAqIEBwYXJhbSBjYXJyaWVyIC0gQSBtdXRhYmxlIG9iamVjdCB0byB3cml0ZSBwcm9wYWdhdGlvbiBoZWFkZXJzIGludG8uXG4gKiBAcGFyYW0gY29udGV4dCAtIFRoZSBjb250ZXh0IHRvIGluamVjdC4gRGVmYXVsdHMgdG8gdGhlIGN1cnJlbnRcbiAqICAgSnVkZ21lbnQgY29udGV4dC5cbiAqIEBwYXJhbSBzZXR0ZXIgLSBTdHJhdGVneSBmb3Igd3JpdGluZyB2YWx1ZXMgaW50byB0aGUgY2Fycmllci5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICogcHJvcGFnYXRpb24uaW5qZWN0KGhlYWRlcnMpO1xuICogYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5leGFtcGxlLmNvbVwiLCB7IGhlYWRlcnMgfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluamVjdDxDYXJyaWVyPihcbiAgY2FycmllcjogQ2FycmllcixcbiAgY29udGV4dD86IENvbnRleHQsXG4gIHNldHRlcjogVGV4dE1hcFNldHRlcjxDYXJyaWVyPiA9IGRlZmF1bHRUZXh0TWFwU2V0dGVyIGFzIFRleHRNYXBTZXR0ZXI8Q2Fycmllcj4sXG4pOiB2b2lkIHtcbiAgZG9udFRocm93KFwicHJvcGFnYXRpb24uaW5qZWN0XCIsICgpID0+IHtcbiAgICBnZXRHbG9iYWxUZXh0bWFwKCkuaW5qZWN0KF9yZXNvbHZlQ29udGV4dChjb250ZXh0KSwgY2Fycmllciwgc2V0dGVyKTtcbiAgfSk7XG59XG5cbi8qKlxuICogRXh0cmFjdCB0cmFjZSBjb250ZXh0IGFuZCBiYWdnYWdlIGZyb20gYW4gaW5jb21pbmcgY2Fycmllci5cbiAqXG4gKiBMb3ctbGV2ZWwgcHJpbWl0aXZlIOKAlCBtb3N0IGNhbGxlcnMgc2hvdWxkIHVzZVxuICoge0BsaW5rIFRyYWNlci5jb250aW51ZVRyYWNlfSBpbnN0ZWFkLCB3aGljaCBleHRyYWN0cyBhbmQgaW5zdGFsbHMgdGhlXG4gKiBjb250ZXh0IGluIG9uZSBzdGVwLlxuICpcbiAqIEBwYXJhbSBjYXJyaWVyIC0gQSBtYXBwaW5nIGNvbnRhaW5pbmcgcHJvcGFnYXRpb24gaGVhZGVycyAoZS5nLlxuICogICBgcmVxdWVzdC5oZWFkZXJzYCkuXG4gKiBAcGFyYW0gY29udGV4dCAtIEJhc2UgY29udGV4dCB0byBtZXJnZSBpbnRvLiBEZWZhdWx0cyB0byB0aGUgY3VycmVudFxuICogICBhY3RpdmUgY29udGV4dC5cbiAqIEBwYXJhbSBnZXR0ZXIgLSBTdHJhdGVneSBmb3IgcmVhZGluZyB2YWx1ZXMgZnJvbSB0aGUgY2Fycmllci5cbiAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBDb250ZXh0fSB3aXRoIHRoZSBleHRyYWN0ZWQgdHJhY2UgYW5kIGJhZ2dhZ2VcbiAqICAgZGF0YS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3Q8Q2Fycmllcj4oXG4gIGNhcnJpZXI6IENhcnJpZXIsXG4gIGNvbnRleHQ/OiBDb250ZXh0LFxuICBnZXR0ZXI6IFRleHRNYXBHZXR0ZXI8Q2Fycmllcj4gPSBkZWZhdWx0VGV4dE1hcEdldHRlciBhcyBUZXh0TWFwR2V0dGVyPENhcnJpZXI+LFxuKTogQ29udGV4dCB7XG4gIGNvbnN0IGJhc2UgPSBfcmVzb2x2ZUNvbnRleHQoY29udGV4dCk7XG4gIHJldHVybiBkb250VGhyb3c8Q29udGV4dD4oXG4gICAgXCJwcm9wYWdhdGlvbi5leHRyYWN0XCIsXG4gICAgKCkgPT4gZ2V0R2xvYmFsVGV4dG1hcCgpLmV4dHJhY3QoYmFzZSwgY2FycmllciwgZ2V0dGVyKSxcbiAgICBiYXNlLFxuICApO1xufVxuIiwKICAgICJpbXBvcnQge1xuICBkZWZhdWx0UmVzb3VyY2UsXG4gIHJlc291cmNlRnJvbUF0dHJpYnV0ZXMsXG59IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9yZXNvdXJjZXNcIjtcbmltcG9ydCB7IFdlYlRyYWNlclByb3ZpZGVyIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Nkay10cmFjZS13ZWJcIjtcbmltcG9ydCB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaVwiO1xuaW1wb3J0IHsgcmVzb2x2ZVByb2plY3RJZCB9IGZyb20gXCIuLi91dGlscy9yZXNvbHZlLXByb2plY3QtaWRcIjtcbmltcG9ydCB7IHNhZmVTdHJpbmdpZnkgfSBmcm9tIFwiLi4vdXRpbHMvc2VyaWFsaXplclwiO1xuaW1wb3J0IHsgVkVSU0lPTiB9IGZyb20gXCIuLi92ZXJzaW9uXCI7XG5pbXBvcnQgeyBCYXNlVHJhY2VyLCB0eXBlIFRyYWNlckNvbmZpZyB9IGZyb20gXCIuLi90cmFjZS9CYXNlVHJhY2VyXCI7XG5pbXBvcnQgeyBKdWRnbWVudFNwYW5FeHBvcnRlciB9IGZyb20gXCIuLi90cmFjZS9leHBvcnRlcnMvSnVkZ21lbnRTcGFuRXhwb3J0ZXJcIjtcbmltcG9ydCB7IE5vT3BTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi4vdHJhY2UvZXhwb3J0ZXJzL05vT3BTcGFuRXhwb3J0ZXJcIjtcbmltcG9ydCB7IEp1ZGdtZW50U3BhblByb2Nlc3NvciB9IGZyb20gXCIuLi90cmFjZS9wcm9jZXNzb3JzL0p1ZGdtZW50U3BhblByb2Nlc3NvclwiO1xuaW1wb3J0IHsgTm9PcFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi4vdHJhY2UvcHJvY2Vzc29ycy9Ob09wU3BhblByb2Nlc3NvclwiO1xuaW1wb3J0IHsgV29ya2VyVHJhY2VyUHJvdmlkZXIgfSBmcm9tIFwiLi9Xb3JrZXJUcmFjZXJQcm92aWRlclwiO1xuaW1wb3J0IHsgV29ya2VyU3BhbkV4cG9ydGVyIH0gZnJvbSBcIi4vV29ya2VyU3BhbkV4cG9ydGVyXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV29ya2Vyc1RyYWNlckNvbmZpZyBleHRlbmRzIE9taXQ8XG4gIFRyYWNlckNvbmZpZyxcbiAgXCJhcGlLZXlcIiB8IFwiYXBpVXJsXCIgfCBcIm9yZ2FuaXphdGlvbklkXCIgfCBcInByb2plY3ROYW1lXCJcbj4ge1xuICAvKiogWW91ciBKdWRnbWVudCBwcm9qZWN0IG5hbWUuIFJlcXVpcmVkIHdoZW4gcHJvamVjdElkIGlzIG5vdCBwcm92aWRlZC4gKi9cbiAgcHJvamVjdE5hbWU/OiBzdHJpbmc7XG4gIC8qKiBQcmUtcmVzb2x2ZWQgSnVkZ21lbnQgcHJvamVjdCBJRC4gUHJlZmVyIHRoaXMgaW4gV29ya2VycyB0byBhdm9pZCBhbiBpbml0LXRpbWUgQVBJIGxvb2t1cC4gKi9cbiAgcHJvamVjdElkPzogc3RyaW5nO1xuICAvKiogSnVkZ21lbnQgQVBJIGtleS4gUmVxdWlyZWQ7IFdvcmtlcnMgZG8gbm90IHJlYWQgcHJvY2Vzcy5lbnYuICovXG4gIGFwaUtleTogc3RyaW5nO1xuICAvKiogSnVkZ21lbnQgb3JnYW5pemF0aW9uIElELiBSZXF1aXJlZDsgV29ya2VycyBkbyBub3QgcmVhZCBwcm9jZXNzLmVudi4gKi9cbiAgb3JnYW5pemF0aW9uSWQ6IHN0cmluZztcbiAgLyoqIEp1ZGdtZW50IEFQSSBVUkwuIFJlcXVpcmVkOyBXb3JrZXJzIGRvIG5vdCByZWFkIHByb2Nlc3MuZW52LiAqL1xuICBhcGlVcmw6IHN0cmluZztcbn1cblxuZnVuY3Rpb24gcmVxdWlyZUNvbmZpZ1ZhbHVlKHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCF2YWx1ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgJHtrZXl9IGlzIHJlcXVpcmVkIGZvciBqdWRnZXZhbC93b3JrZXJzIFRyYWNlci5pbml0YCk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5leHBvcnQgY2xhc3MgVHJhY2VyIGV4dGVuZHMgQmFzZVRyYWNlciB7XG4gIHByaXZhdGUgX3NwYW5FeHBvcnRlcjogSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfc3BhblByb2Nlc3NvcjogSnVkZ21lbnRTcGFuUHJvY2Vzc29yIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcgfCBudWxsLFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIGFwaUtleTogc3RyaW5nLFxuICAgIG9yZ2FuaXphdGlvbklkOiBzdHJpbmcsXG4gICAgYXBpVXJsOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyB8IG51bGwsXG4gICAgc2VyaWFsaXplcjogKHY6IHVua25vd24pID0+IHN0cmluZyxcbiAgICB0cmFjZXJQcm92aWRlcjogV2ViVHJhY2VyUHJvdmlkZXIsXG4gICAgY2xpZW50OiBKdWRnbWVudEFwaUNsaWVudCxcbiAgKSB7XG4gICAgc3VwZXIoXG4gICAgICBwcm9qZWN0TmFtZSxcbiAgICAgIHByb2plY3RJZCxcbiAgICAgIGFwaUtleSxcbiAgICAgIG9yZ2FuaXphdGlvbklkLFxuICAgICAgYXBpVXJsLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICBzZXJpYWxpemVyLFxuICAgICAgdHJhY2VyUHJvdmlkZXIsXG4gICAgICBjbGllbnQsXG4gICAgICB0cnVlLFxuICAgICk7XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgaW5pdChjb25maWc6IFdvcmtlcnNUcmFjZXJDb25maWcpOiBQcm9taXNlPFRyYWNlcj4ge1xuICAgIGNvbnN0IGFwaUtleSA9IHJlcXVpcmVDb25maWdWYWx1ZShjb25maWcuYXBpS2V5LCBcImFwaUtleVwiKTtcbiAgICBjb25zdCBvcmdhbml6YXRpb25JZCA9IHJlcXVpcmVDb25maWdWYWx1ZShcbiAgICAgIGNvbmZpZy5vcmdhbml6YXRpb25JZCxcbiAgICAgIFwib3JnYW5pemF0aW9uSWRcIixcbiAgICApO1xuICAgIGNvbnN0IGFwaVVybCA9IHJlcXVpcmVDb25maWdWYWx1ZShjb25maWcuYXBpVXJsLCBcImFwaVVybFwiKTtcbiAgICBjb25zdCBzZXJpYWxpemVyID0gY29uZmlnLnNlcmlhbGl6ZXIgPz8gc2FmZVN0cmluZ2lmeTtcblxuICAgIGNvbnN0IGNsaWVudCA9IG5ldyBKdWRnbWVudEFwaUNsaWVudChhcGlVcmwsIGFwaUtleSwgb3JnYW5pemF0aW9uSWQpO1xuICAgIGxldCBwcm9qZWN0SWQgPSBjb25maWcucHJvamVjdElkO1xuICAgIGlmICghcHJvamVjdElkKSB7XG4gICAgICBjb25zdCBwcm9qZWN0TmFtZSA9IHJlcXVpcmVDb25maWdWYWx1ZShjb25maWcucHJvamVjdE5hbWUsIFwicHJvamVjdE5hbWVcIik7XG4gICAgICB0cnkge1xuICAgICAgICBwcm9qZWN0SWQgPSBhd2FpdCByZXNvbHZlUHJvamVjdElkKGNsaWVudCwgcHJvamVjdE5hbWUpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgUHJvamVjdCAnJHtwcm9qZWN0TmFtZX0nIG5vdCBmb3VuZDsgY2Fubm90IHN0YXJ0IGp1ZGdldmFsL3dvcmtlcnMgdHJhY2VyOiAke1N0cmluZyhlcnIpfWAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgc2VydmljZU5hbWUgPSBjb25maWcucHJvamVjdE5hbWUgPz8gcHJvamVjdElkO1xuICAgIGNvbnN0IHJlc291cmNlQXR0cnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICBcInNlcnZpY2UubmFtZVwiOiBzZXJ2aWNlTmFtZSxcbiAgICAgIFwidGVsZW1ldHJ5LnNkay5uYW1lXCI6IFwianVkZ2V2YWxcIixcbiAgICAgIFwidGVsZW1ldHJ5LnNkay52ZXJzaW9uXCI6IFZFUlNJT04sXG4gICAgICBcImp1ZGdtZW50LnByb2plY3RfaWRcIjogcHJvamVjdElkLFxuICAgIH07XG4gICAgaWYgKGNvbmZpZy5lbnZpcm9ubWVudCkge1xuICAgICAgcmVzb3VyY2VBdHRyc1tcImRlcGxveW1lbnQuZW52aXJvbm1lbnRcIl0gPSBjb25maWcuZW52aXJvbm1lbnQ7XG4gICAgfVxuICAgIGlmIChjb25maWcucmVzb3VyY2VBdHRyaWJ1dGVzKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHJlc291cmNlQXR0cnMsIGNvbmZpZy5yZXNvdXJjZUF0dHJpYnV0ZXMpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc291cmNlID0gZGVmYXVsdFJlc291cmNlKCkubWVyZ2UoXG4gICAgICByZXNvdXJjZUZyb21BdHRyaWJ1dGVzKHJlc291cmNlQXR0cnMpLFxuICAgICk7XG5cbiAgICBjb25zdCB0cmFjZXIgPSBuZXcgVHJhY2VyKFxuICAgICAgY29uZmlnLnByb2plY3ROYW1lID8/IG51bGwsXG4gICAgICBwcm9qZWN0SWQsXG4gICAgICBhcGlLZXksXG4gICAgICBvcmdhbml6YXRpb25JZCxcbiAgICAgIGFwaVVybCxcbiAgICAgIGNvbmZpZy5lbnZpcm9ubWVudCA/PyBudWxsLFxuICAgICAgc2VyaWFsaXplcixcbiAgICAgIG5ldyBXZWJUcmFjZXJQcm92aWRlcih7XG4gICAgICAgIHJlc291cmNlLFxuICAgICAgICBzYW1wbGVyOiBjb25maWcuc2FtcGxlcixcbiAgICAgICAgc3BhbkxpbWl0czogY29uZmlnLnNwYW5MaW1pdHMsXG4gICAgICB9KSxcbiAgICAgIGNsaWVudCxcbiAgICApO1xuXG4gICAgY29uc3QgcHJvdmlkZXJXaXRoUHJvY2Vzc29yID0gbmV3IFdlYlRyYWNlclByb3ZpZGVyKHtcbiAgICAgIHJlc291cmNlLFxuICAgICAgc2FtcGxlcjogY29uZmlnLnNhbXBsZXIsXG4gICAgICBzcGFuTGltaXRzOiBjb25maWcuc3BhbkxpbWl0cyxcbiAgICAgIHNwYW5Qcm9jZXNzb3JzOiBbXG4gICAgICAgIHRyYWNlci5nZXRTcGFuUHJvY2Vzc29yKCksXG4gICAgICAgIC4uLihjb25maWcuc3BhblByb2Nlc3NvcnMgPz8gW10pLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICB0cmFjZXIuX3RyYWNlclByb3ZpZGVyID0gcHJvdmlkZXJXaXRoUHJvY2Vzc29yO1xuXG4gICAgY29uc3QgcHJveHkgPSBXb3JrZXJUcmFjZXJQcm92aWRlci5nZXRJbnN0YW5jZSgpO1xuICAgIHByb3h5LnJlZ2lzdGVyKHRyYWNlcik7XG5cbiAgICBpZiAoY29uZmlnLnNldEFjdGl2ZSA/PyB0cnVlKSB7XG4gICAgICB0cmFjZXIuc2V0QWN0aXZlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRyYWNlcjtcbiAgfVxuXG4gIGdldFNwYW5FeHBvcnRlcigpOiBKdWRnbWVudFNwYW5FeHBvcnRlciB7XG4gICAgaWYgKHRoaXMuX3NwYW5FeHBvcnRlcikgcmV0dXJuIHRoaXMuX3NwYW5FeHBvcnRlcjtcblxuICAgIGlmIChcbiAgICAgICF0aGlzLl9lbmFibGVNb25pdG9yaW5nIHx8XG4gICAgICAhdGhpcy5wcm9qZWN0SWQgfHxcbiAgICAgICF0aGlzLmFwaUtleSB8fFxuICAgICAgIXRoaXMub3JnYW5pemF0aW9uSWQgfHxcbiAgICAgICF0aGlzLmFwaVVybFxuICAgICkge1xuICAgICAgdGhpcy5fc3BhbkV4cG9ydGVyID0gbmV3IE5vT3BTcGFuRXhwb3J0ZXIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZW5kcG9pbnQgPSB0aGlzLmFwaVVybC5lbmRzV2l0aChcIi9cIilcbiAgICAgICAgPyB0aGlzLmFwaVVybCArIFwib3RlbC92MS90cmFjZXNcIlxuICAgICAgICA6IHRoaXMuYXBpVXJsICsgXCIvb3RlbC92MS90cmFjZXNcIjtcbiAgICAgIHRoaXMuX3NwYW5FeHBvcnRlciA9IG5ldyBXb3JrZXJTcGFuRXhwb3J0ZXIoXG4gICAgICAgIGVuZHBvaW50LFxuICAgICAgICB0aGlzLmFwaUtleSxcbiAgICAgICAgdGhpcy5vcmdhbml6YXRpb25JZCxcbiAgICAgICAgdGhpcy5wcm9qZWN0SWQsXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3BhbkV4cG9ydGVyO1xuICB9XG5cbiAgZ2V0U3BhblByb2Nlc3NvcigpOiBKdWRnbWVudFNwYW5Qcm9jZXNzb3Ige1xuICAgIGlmICh0aGlzLl9zcGFuUHJvY2Vzc29yKSByZXR1cm4gdGhpcy5fc3BhblByb2Nlc3NvcjtcblxuICAgIGlmICghdGhpcy5fZW5hYmxlTW9uaXRvcmluZykge1xuICAgICAgdGhpcy5fc3BhblByb2Nlc3NvciA9IG5ldyBOb09wU3BhblByb2Nlc3NvcigpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zcGFuUHJvY2Vzc29yID0gbmV3IEp1ZGdtZW50U3BhblByb2Nlc3NvcihcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5nZXRTcGFuRXhwb3J0ZXIoKSxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zcGFuUHJvY2Vzc29yO1xuICB9XG59XG4iLAogICAgIi8vIEF1dG8tZ2VuZXJhdGVkIGJ5IHNjcmlwdHMvZ2VuZXJhdGUtY2xpZW50LnRzXG4vLyBETyBOT1QgRURJVCBNQU5VQUxMWVxuXG5pbXBvcnQgdHlwZSB7XG4gIEFkZFByb2plY3RSZXF1ZXN0LFxuICBBZGRQcm9qZWN0UmVzcG9uc2UsXG4gIEFkZFRvUnVuRXZhbFF1ZXVlRXhhbXBsZXNSZXNwb25zZSxcbiAgQWRkVG9SdW5FdmFsUXVldWVUcmFjZXNSZXNwb25zZSxcbiAgQWRkVHJhY2VUYWdzUmVxdWVzdCxcbiAgQWRkVHJhY2VUYWdzUmVzcG9uc2UsXG4gIENyZWF0ZURhdGFzZXRSZXF1ZXN0LFxuICBDcmVhdGVEYXRhc2V0UmVzcG9uc2UsXG4gIEN1c3RvbVNjb3JlckV4aXN0c1Jlc3BvbnNlLFxuICBEZWxldGVQcm9qZWN0UmVzcG9uc2UsXG4gIEUyRUZldGNoU3BhblNjb3JlUmVxdWVzdCxcbiAgRTJFRmV0Y2hTcGFuU2NvcmVSZXNwb25zZSxcbiAgRTJFRmV0Y2hUcmFjZVJlc3BvbnNlLFxuICBFMkVUcmFjZXNQZXJQcm9qZWN0UmVzcG9uc2UsXG4gIEV4YW1wbGVFdmFsdWF0aW9uUnVuLFxuICBGZXRjaEV4cGVyaW1lbnRSdW5SZXNwb25zZSxcbiAgRmV0Y2hQcm9tcHRSZXNwb25zZSxcbiAgRmV0Y2hQcm9tcHRTY29yZXJzUmVzcG9uc2UsXG4gIEdldFByb21wdFZlcnNpb25zUmVzcG9uc2UsXG4gIEluc2VydEV4YW1wbGVzUmVxdWVzdCxcbiAgSW5zZXJ0RXhhbXBsZXNSZXNwb25zZSxcbiAgSW5zZXJ0UHJvbXB0UmVxdWVzdCxcbiAgSW5zZXJ0UHJvbXB0UmVzcG9uc2UsXG4gIExvZ0V2YWxSZXN1bHRzRXhhbXBsZXNSZXF1ZXN0LFxuICBMb2dFdmFsUmVzdWx0c0V4YW1wbGVzUmVzcG9uc2UsXG4gIExvZ0V2YWxSZXN1bHRzUmVxdWVzdCxcbiAgTG9nRXZhbFJlc3VsdHNSZXNwb25zZSxcbiAgUHVsbEFsbERhdGFzZXRzUmVzcG9uc2UsXG4gIFB1bGxEYXRhc2V0UmVzcG9uc2UsXG4gIFJlc29sdmVQcm9qZWN0UmVxdWVzdCxcbiAgUmVzb2x2ZVByb2plY3RSZXNwb25zZSxcbiAgU0RLQ3JlYXRlQWdlbnRKdWRnZVJlcXVlc3QsXG4gIFNES0NyZWF0ZUFnZW50SnVkZ2VSZXNwb25zZSxcbiAgU0RLVXBkYXRlQWdlbnRKdWRnZVJlcXVlc3QsXG4gIFNES1VwZGF0ZUFnZW50SnVkZ2VSZXNwb25zZSxcbiAgU2NvcmVyRXhpc3RzUmVzcG9uc2UsXG4gIFRhZ1Byb21wdFJlcXVlc3QsXG4gIFRhZ1Byb21wdFJlc3BvbnNlLFxuICBUcmFjZUV2YWx1YXRpb25SdW4sXG4gIFVudGFnUHJvbXB0UmVxdWVzdCxcbiAgVW50YWdQcm9tcHRSZXNwb25zZSxcbiAgVXBsb2FkQ3VzdG9tU2NvcmVyUmVzcG9uc2UsXG59IGZyb20gXCIuL21vZGVsc1wiO1xuXG5leHBvcnQgY2xhc3MgSnVkZ21lbnRBcGlDbGllbnQge1xuICBwcml2YXRlIGJhc2VVcmw6IHN0cmluZztcbiAgcHJpdmF0ZSBhcGlLZXk6IHN0cmluZztcbiAgcHJpdmF0ZSBvcmdhbml6YXRpb25JZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZywgYXBpS2V5OiBzdHJpbmcsIG9yZ2FuaXphdGlvbklkOiBzdHJpbmcpIHtcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xuICAgIHRoaXMuYXBpS2V5ID0gYXBpS2V5O1xuICAgIHRoaXMub3JnYW5pemF0aW9uSWQgPSBvcmdhbml6YXRpb25JZDtcbiAgfVxuXG4gIGdldEJhc2VVcmwoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5iYXNlVXJsO1xuICB9XG4gIGdldEFwaUtleSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmFwaUtleTtcbiAgfVxuICBnZXRPcmdhbml6YXRpb25JZCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLm9yZ2FuaXphdGlvbklkO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXF1ZXN0PFQ+KFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIHVybDogc3RyaW5nLFxuICAgIGJvZHk/OiB1bmtub3duLFxuICApOiBQcm9taXNlPFQ+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMuYXBpS2V5fWAsXG4gICAgICAgIFwiWC1Pcmdhbml6YXRpb24tSWRcIjogdGhpcy5vcmdhbml6YXRpb25JZCxcbiAgICAgIH0sXG4gICAgICBib2R5OiBib2R5ICE9PSB1bmRlZmluZWQgPyBKU09OLnN0cmluZ2lmeShib2R5KSA6IHVuZGVmaW5lZCxcbiAgICB9KTtcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfTogJHt0ZXh0fWApO1xuICAgIH1cbiAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpIGFzIFQ7XG4gIH1cblxuICBhc3luYyBwb3N0T3RlbFYxdHJhY2VzKCk6IFByb21pc2U8dW5rbm93bj4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIFwiL290ZWwvdjEvdHJhY2VzXCI7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCB7fSk7XG4gIH1cblxuICBhc3luYyBwb3N0T3RlbFYxb2ZmbGluZVRyYWNlcygpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBcIi9vdGVsL3YxL29mZmxpbmUtdHJhY2VzXCI7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCB7fSk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c1Jlc29sdmUoXG4gICAgcGF5bG9hZDogUmVzb2x2ZVByb2plY3RSZXF1ZXN0LFxuICApOiBQcm9taXNlPFJlc29sdmVQcm9qZWN0UmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBcIi92MS9wcm9qZWN0cy9yZXNvbHZlL1wiO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0cyhcbiAgICBwYXlsb2FkOiBBZGRQcm9qZWN0UmVxdWVzdCxcbiAgKTogUHJvbWlzZTxBZGRQcm9qZWN0UmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBcIi92MS9wcm9qZWN0c1wiO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBkZWxldGVWMXByb2plY3RzKHByb2plY3RJZDogc3RyaW5nKTogUHJvbWlzZTxEZWxldGVQcm9qZWN0UmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfWA7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkRFTEVURVwiLCB1cmwsIHt9KTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzRGF0YXNldHMoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogQ3JlYXRlRGF0YXNldFJlcXVlc3QsXG4gICk6IFByb21pc2U8Q3JlYXRlRGF0YXNldFJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZGF0YXNldHNgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBnZXRWMXByb2plY3RzRGF0YXNldHMoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICk6IFByb21pc2U8UHVsbEFsbERhdGFzZXRzUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9kYXRhc2V0c2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkdFVFwiLCB1cmwsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c0RhdGFzZXRzQnlEYXRhc2V0TmFtZUV4YW1wbGVzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIGRhdGFzZXROYW1lOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogSW5zZXJ0RXhhbXBsZXNSZXF1ZXN0LFxuICApOiBQcm9taXNlPEluc2VydEV4YW1wbGVzUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICtcbiAgICAgIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2RhdGFzZXRzLyR7ZGF0YXNldE5hbWV9L2V4YW1wbGVzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFwcm9qZWN0c0RhdGFzZXRzQnlEYXRhc2V0TmFtZShcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBkYXRhc2V0TmFtZTogc3RyaW5nLFxuICApOiBQcm9taXNlPFB1bGxEYXRhc2V0UmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZGF0YXNldHMvJHtkYXRhc2V0TmFtZX1gO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJHRVRcIiwgdXJsLCB1bmRlZmluZWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNFdmFsdWF0ZUV4YW1wbGVzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IEV4YW1wbGVFdmFsdWF0aW9uUnVuLFxuICApOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9ldmFsdWF0ZS9leGFtcGxlc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBPU1RcIiwgdXJsLCBwYXlsb2FkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzRXZhbHVhdGVUcmFjZXMoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogVHJhY2VFdmFsdWF0aW9uUnVuLFxuICApOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9ldmFsdWF0ZS90cmFjZXNgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c0V2YWxSZXN1bHRzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IExvZ0V2YWxSZXN1bHRzUmVxdWVzdCxcbiAgKTogUHJvbWlzZTxMb2dFdmFsUmVzdWx0c1Jlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vZXZhbC1yZXN1bHRzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNFdmFsUmVzdWx0c0V4YW1wbGVzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IExvZ0V2YWxSZXN1bHRzRXhhbXBsZXNSZXF1ZXN0LFxuICApOiBQcm9taXNlPExvZ0V2YWxSZXN1bHRzRXhhbXBsZXNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9XG4gICAgICB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9ldmFsLXJlc3VsdHMvZXhhbXBsZXNgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBnZXRWMXByb2plY3RzRXhwZXJpbWVudHNCeVJ1bklkKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHJ1bklkOiBzdHJpbmcsXG4gICk6IFByb21pc2U8RmV0Y2hFeHBlcmltZW50UnVuUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9leHBlcmltZW50cy8ke3J1bklkfWA7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkdFVFwiLCB1cmwsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c0V2YWxRdWV1ZUV4YW1wbGVzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IEV4YW1wbGVFdmFsdWF0aW9uUnVuLFxuICApOiBQcm9taXNlPEFkZFRvUnVuRXZhbFF1ZXVlRXhhbXBsZXNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2V2YWwtcXVldWUvZXhhbXBsZXNgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBwb3N0VjFwcm9qZWN0c0V2YWxRdWV1ZVRyYWNlcyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBUcmFjZUV2YWx1YXRpb25SdW4sXG4gICk6IFByb21pc2U8QWRkVG9SdW5FdmFsUXVldWVUcmFjZXNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2V2YWwtcXVldWUvdHJhY2VzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFwcm9qZWN0c1Byb21wdHNCeU5hbWUoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGNvbW1pdF9pZD86IHN0cmluZyxcbiAgICB0YWc/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8RmV0Y2hQcm9tcHRSZXNwb25zZT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICBpZiAoY29tbWl0X2lkICE9PSB1bmRlZmluZWQpIHBhcmFtcy5zZXQoXCJjb21taXRfaWRcIiwgY29tbWl0X2lkKTtcbiAgICBpZiAodGFnICE9PSB1bmRlZmluZWQpIHBhcmFtcy5zZXQoXCJ0YWdcIiwgdGFnKTtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICtcbiAgICAgIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3Byb21wdHMvJHtuYW1lfWAgK1xuICAgICAgKHBhcmFtcy50b1N0cmluZygpID8gXCI/XCIgKyBwYXJhbXMudG9TdHJpbmcoKSA6IFwiXCIpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJHRVRcIiwgdXJsLCB1bmRlZmluZWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNQcm9tcHRzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIHBheWxvYWQ6IEluc2VydFByb21wdFJlcXVlc3QsXG4gICk6IFByb21pc2U8SW5zZXJ0UHJvbXB0UmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9wcm9tcHRzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNQcm9tcHRzQnlOYW1lVGFncyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogVGFnUHJvbXB0UmVxdWVzdCxcbiAgKTogUHJvbWlzZTxUYWdQcm9tcHRSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3Byb21wdHMvJHtuYW1lfS90YWdzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZGVsZXRlVjFwcm9qZWN0c1Byb21wdHNCeU5hbWVUYWdzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBVbnRhZ1Byb21wdFJlcXVlc3QsXG4gICk6IFByb21pc2U8VW50YWdQcm9tcHRSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3Byb21wdHMvJHtuYW1lfS90YWdzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiREVMRVRFXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cblxuICBhc3luYyBnZXRWMXByb2plY3RzUHJvbXB0c0J5TmFtZVZlcnNpb25zKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxHZXRQcm9tcHRWZXJzaW9uc1Jlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3Byb21wdHMvJHtuYW1lfS92ZXJzaW9uc2A7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIkdFVFwiLCB1cmwsIHVuZGVmaW5lZCk7XG4gIH1cblxuICBhc3luYyBnZXRWMXByb2plY3RzU2NvcmVycyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBuYW1lcz86IHN0cmluZyxcbiAgICBpc190cmFjZT86IHN0cmluZyxcbiAgKTogUHJvbWlzZTxGZXRjaFByb21wdFNjb3JlcnNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICBpZiAobmFtZXMgIT09IHVuZGVmaW5lZCkgcGFyYW1zLnNldChcIm5hbWVzXCIsIG5hbWVzKTtcbiAgICBpZiAoaXNfdHJhY2UgIT09IHVuZGVmaW5lZCkgcGFyYW1zLnNldChcImlzX3RyYWNlXCIsIGlzX3RyYWNlKTtcbiAgICBjb25zdCB1cmwgPVxuICAgICAgdGhpcy5iYXNlVXJsICtcbiAgICAgIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3Njb3JlcnNgICtcbiAgICAgIChwYXJhbXMudG9TdHJpbmcoKSA/IFwiP1wiICsgcGFyYW1zLnRvU3RyaW5nKCkgOiBcIlwiKTtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiR0VUXCIsIHVybCwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFYxcHJvamVjdHNTY29yZXJzQnlOYW1lRXhpc3RzKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxTY29yZXJFeGlzdHNSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9XG4gICAgICB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9zY29yZXJzLyR7bmFtZX0vZXhpc3RzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiR0VUXCIsIHVybCwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzU2NvcmVyc0N1c3RvbShwcm9qZWN0SWQ6IHN0cmluZyk6IFByb21pc2U8dW5rbm93bj4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3Njb3JlcnMvY3VzdG9tYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHt9KTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzU2NvcmVyc0N1c3RvbUJ1bmRsZShcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxVcGxvYWRDdXN0b21TY29yZXJSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9XG4gICAgICB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9zY29yZXJzL2N1c3RvbS9idW5kbGVgO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJQT1NUXCIsIHVybCwge30pO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFwcm9qZWN0c1Njb3JlcnNDdXN0b21CeU5hbWVFeGlzdHMoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgbmFtZTogc3RyaW5nLFxuICApOiBQcm9taXNlPEN1c3RvbVNjb3JlckV4aXN0c1Jlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID1cbiAgICAgIHRoaXMuYmFzZVVybCArIGAvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3Njb3JlcnMvY3VzdG9tLyR7bmFtZX0vZXhpc3RzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiR0VUXCIsIHVybCwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIGFzeW5jIHBvc3RWMXByb2plY3RzVHJhY2VzQnlUcmFjZUlkVGFncyhcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICB0cmFjZUlkOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogQWRkVHJhY2VUYWdzUmVxdWVzdCxcbiAgKTogUHJvbWlzZTxBZGRUcmFjZVRhZ3NSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9XG4gICAgICB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS90cmFjZXMvJHt0cmFjZUlkfS90YWdzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VjFlMmVGZXRjaFRyYWNlQnlQcm9qZWN0TmFtZUJ5VHJhY2VJZChcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIHRyYWNlSWQ6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxFMkVGZXRjaFRyYWNlUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL2UyZV9mZXRjaF90cmFjZS8ke3Byb2plY3ROYW1lfS8ke3RyYWNlSWR9YDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiR0VUXCIsIHVybCwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFYxZTJlVHJhY2VzUGVyUHJvamVjdChcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBsaW1pdD86IHN0cmluZyxcbiAgICBvZmZzZXQ/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8RTJFVHJhY2VzUGVyUHJvamVjdFJlc3BvbnNlPiB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgIGlmIChsaW1pdCAhPT0gdW5kZWZpbmVkKSBwYXJhbXMuc2V0KFwibGltaXRcIiwgbGltaXQpO1xuICAgIGlmIChvZmZzZXQgIT09IHVuZGVmaW5lZCkgcGFyYW1zLnNldChcIm9mZnNldFwiLCBvZmZzZXQpO1xuICAgIGNvbnN0IHVybCA9XG4gICAgICB0aGlzLmJhc2VVcmwgK1xuICAgICAgYC92MS9lMmVfdHJhY2VzX3Blcl9wcm9qZWN0LyR7cHJvamVjdElkfWAgK1xuICAgICAgKHBhcmFtcy50b1N0cmluZygpID8gXCI/XCIgKyBwYXJhbXMudG9TdHJpbmcoKSA6IFwiXCIpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoXCJHRVRcIiwgdXJsLCB1bmRlZmluZWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxZTJlRmV0Y2hTcGFuU2NvcmUoXG4gICAgcGF5bG9hZDogRTJFRmV0Y2hTcGFuU2NvcmVSZXF1ZXN0LFxuICApOiBQcm9taXNlPEUyRUZldGNoU3BhblNjb3JlUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBcIi92MS9lMmVfZmV0Y2hfc3Bhbl9zY29yZS9cIjtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgcG9zdFYxcHJvamVjdHNKdWRnZXMoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgcGF5bG9hZDogU0RLQ3JlYXRlQWdlbnRKdWRnZVJlcXVlc3QsXG4gICk6IFByb21pc2U8U0RLQ3JlYXRlQWdlbnRKdWRnZVJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gdGhpcy5iYXNlVXJsICsgYC92MS9wcm9qZWN0cy8ke3Byb2plY3RJZH0vanVkZ2VzYDtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KFwiUE9TVFwiLCB1cmwsIHBheWxvYWQpO1xuICB9XG5cbiAgYXN5bmMgcGF0Y2hWMXByb2plY3RzSnVkZ2VzQnlKdWRnZUlkKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIGp1ZGdlSWQ6IHN0cmluZyxcbiAgICBwYXlsb2FkOiBTREtVcGRhdGVBZ2VudEp1ZGdlUmVxdWVzdCxcbiAgKTogUHJvbWlzZTxTREtVcGRhdGVBZ2VudEp1ZGdlUmVzcG9uc2U+IHtcbiAgICBjb25zdCB1cmwgPSB0aGlzLmJhc2VVcmwgKyBgL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9qdWRnZXMvJHtqdWRnZUlkfWA7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcIlBBVENIXCIsIHVybCwgcGF5bG9hZCk7XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGludGVyZmFjZSBSZXRyeUNvbmZpZyB7XG4gIC8qKiBNYXhpbXVtIG51bWJlciBvZiBhdHRlbXB0cy4gRGVmYXVsdHMgdG8gYDNgLiAqL1xuICBtYXhSZXRyaWVzPzogbnVtYmVyO1xuICAvKipcbiAgICogRnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBiYWNrb2ZmIGRlbGF5IGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlXG4gICAqIGdpdmVuIGF0dGVtcHQuIFRoZSBmaXJzdCBjYWxsIHJlY2VpdmVzIGBpdGVyYXRpb24gPSAxYC5cbiAgICogRGVmYXVsdHMgdG8gYSBmbGF0IDEwMDAgbXMuXG4gICAqL1xuICBiYWNrb2ZmPzogKGl0ZXJhdGlvbjogbnVtYmVyKSA9PiBudW1iZXI7XG4gIC8qKiBDYWxsZWQgYWZ0ZXIgZWFjaCBmYWlsZWQgYXR0ZW1wdCwgYmVmb3JlIHNsZWVwaW5nIGZvciB0aGUgYmFja29mZi4gKi9cbiAgb25SZXRyeT86IChhdHRlbXB0OiBudW1iZXIsIGVycm9yOiB1bmtub3duKSA9PiB2b2lkO1xufVxuXG4vKipcbiAqIFJldHJ5IGEgZnVuY3Rpb24gdXAgdG8gYSBtYXhpbXVtIG51bWJlciBvZiB0aW1lcyB3aXRoIGNvbmZpZ3VyYWJsZVxuICogYmFja29mZi5cbiAqXG4gKiBAcGFyYW0gZm4gLSBUaGUgZnVuY3Rpb24gdG8gcmV0cnkuXG4gKiBAcGFyYW0gY29uZmlnIC0gUmV0cnkgY29uZmlndXJhdGlvbi5cbiAqICAgLSBgbWF4UmV0cmllc2Ag4oCUIG1heGltdW0gbnVtYmVyIG9mIGF0dGVtcHRzIChkZWZhdWx0OiAzKS5cbiAqICAgLSBgYmFja29mZmAg4oCUIGRlbGF5IGluIG1zIGJldHdlZW4gYXR0ZW1wdHMgKGRlZmF1bHQ6IGZsYXQgMTAwMCBtcykuXG4gKiAgIC0gYG9uUmV0cnlgIOKAlCBpbnZva2VkIHdpdGggYChhdHRlbXB0LCBlcnJvcilgIGFmdGVyIGVhY2ggZmFpbGVkXG4gKiAgICAgYXR0ZW1wdCAoZGVmYXVsdDogbm8tb3ApLlxuICogQHJldHVybnMgVGhlIHJlc29sdmVkIHZhbHVlIG9mIGBmbmAuXG4gKiBAdGhyb3dzIFRoZSBsYXN0IGVycm9yIHJhaXNlZCBieSBgZm5gIGlmIGl0IGZhaWxzIG9uIGV2ZXJ5IGF0dGVtcHQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXRyeTxUPihcbiAgZm46ICgpID0+IFByb21pc2U8VD4sXG4gIGNvbmZpZzogUmV0cnlDb25maWcgPSB7fSxcbik6IFByb21pc2U8VD4ge1xuICBjb25zdCB7IG1heFJldHJpZXMgPSAzLCBiYWNrb2ZmID0gKCkgPT4gMTAwMCwgb25SZXRyeSB9ID0gY29uZmlnO1xuXG4gIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IG1heFJldHJpZXM7IGF0dGVtcHQrKykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgZm4oKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGF0dGVtcHQgPT09IG1heFJldHJpZXMpIHtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG5cbiAgICAgIG9uUmV0cnk/LihhdHRlbXB0LCBlcnJvcik7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBiYWNrb2ZmKGF0dGVtcHQpKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVW5yZWFjaGFibGU6IHRoZSBsb29wIGFsd2F5cyBlaXRoZXIgcmV0dXJucyBvciB0aHJvd3MuXG4gIHRocm93IG5ldyBFcnJvcihcInJldHJ5OiBleGhhdXN0ZWQgYWxsIGF0dGVtcHRzXCIpO1xufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IEp1ZGdtZW50QXBpQ2xpZW50IH0gZnJvbSBcIi4uL2ludGVybmFsL2FwaVwiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4vbG9nZ2VyXCI7XG5pbXBvcnQgeyByZXRyeSB9IGZyb20gXCIuL3JldHJ5XCI7XG5cbmNvbnN0IGNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbmNvbnN0IGluZmxpZ2h0ID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8c3RyaW5nPj4oKTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc29sdmVQcm9qZWN0SWQoXG4gIGNsaWVudDogSnVkZ21lbnRBcGlDbGllbnQsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBjYWNoZUtleSA9IGBvcmc6JHtjbGllbnQuZ2V0T3JnYW5pemF0aW9uSWQoKX06cHJvamVjdDoke3Byb2plY3ROYW1lfWA7XG4gIGNvbnN0IGNhY2hlZCA9IGNhY2hlLmdldChjYWNoZUtleSk7XG4gIGlmIChjYWNoZWQpIHtcbiAgICByZXR1cm4gY2FjaGVkO1xuICB9XG4gIGNvbnN0IHBlbmRpbmcgPSBpbmZsaWdodC5nZXQoY2FjaGVLZXkpO1xuICBpZiAocGVuZGluZykge1xuICAgIHJldHVybiBwZW5kaW5nO1xuICB9XG4gIGNvbnN0IHJlcXVlc3QgPSAoYXN5bmMgKCk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgTG9nZ2VyLmluZm8oYFJlc29sdmluZyBwcm9qZWN0IElEIGZvciBwcm9qZWN0OiAke3Byb2plY3ROYW1lfWApO1xuICAgIGNvbnN0IHByb2plY3RJZCA9IGF3YWl0IHJldHJ5KFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNsaWVudC5wb3N0VjFwcm9qZWN0c1Jlc29sdmUoe1xuICAgICAgICAgIHByb2plY3RfbmFtZTogcHJvamVjdE5hbWUsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBpZCA9IHJlc3BvbnNlLnByb2plY3RfaWQ7XG4gICAgICAgIGlmICghaWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb2plY3QgSUQgbm90IGZvdW5kIGZvciBwcm9qZWN0OiAke3Byb2plY3ROYW1lfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpZDtcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG1heFJldHJpZXM6IDMsXG4gICAgICAgIGJhY2tvZmY6IChpdGVyYXRpb24pID0+IGl0ZXJhdGlvbiAqIDEwMDAsXG4gICAgICAgIG9uUmV0cnk6IChhdHRlbXB0LCBlcnJvcikgPT4ge1xuICAgICAgICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgICAgICAgYEZhaWxlZCB0byByZXNvbHZlIHByb2plY3QgSUQgZm9yICcke3Byb2plY3ROYW1lfScgKGF0dGVtcHQgJHthdHRlbXB0fSk6ICR7U3RyaW5nKGVycm9yKX1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICk7XG4gICAgTG9nZ2VyLmluZm8oYFJlc29sdmVkIHByb2plY3QgSUQ6ICR7cHJvamVjdElkfWApO1xuICAgIGNhY2hlLnNldChjYWNoZUtleSwgcHJvamVjdElkKTtcbiAgICByZXR1cm4gcHJvamVjdElkO1xuICB9KSgpO1xuICBpbmZsaWdodC5zZXQoY2FjaGVLZXksIHJlcXVlc3QpO1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCByZXF1ZXN0O1xuICB9IGZpbmFsbHkge1xuICAgIGluZmxpZ2h0LmRlbGV0ZShjYWNoZUtleSk7XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIiB3aXRoIHsgdHlwZTogXCJqc29uXCIgfTtcblxuZXhwb3J0IGNvbnN0IFZFUlNJT04gPSB2ZXJzaW9uO1xuIiwKICAgICJpbXBvcnQgeyBFeHBvcnRSZXN1bHRDb2RlLCB0eXBlIEV4cG9ydFJlc3VsdCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9jb3JlXCI7XG5pbXBvcnQgdHlwZSB7IFJlYWRhYmxlU3BhbiB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9zZGstdHJhY2UtYmFzZVwiO1xuaW1wb3J0IHsgSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi9KdWRnbWVudFNwYW5FeHBvcnRlclwiO1xuXG4vKipcbiAqIEEgbm8tb3Agc3BhbiBleHBvcnRlciB0aGF0IGRpc2NhcmRzIGFsbCBzcGFucy5cbiAqXG4gKiBVc2VkIHdoZW4gbW9uaXRvcmluZyBpcyBkaXNhYmxlZCBvciBjcmVkZW50aWFscyBhcmUgbWlzc2luZy5cbiAqL1xuZXhwb3J0IGNsYXNzIE5vT3BTcGFuRXhwb3J0ZXIgZXh0ZW5kcyBKdWRnbWVudFNwYW5FeHBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIpO1xuICB9XG5cbiAgb3ZlcnJpZGUgZXhwb3J0KFxuICAgIF9zcGFuczogUmVhZGFibGVTcGFuW10sXG4gICAgcmVzdWx0Q2FsbGJhY2s6IChyZXN1bHQ6IEV4cG9ydFJlc3VsdCkgPT4gdm9pZCxcbiAgKTogdm9pZCB7XG4gICAgcmVzdWx0Q2FsbGJhY2soeyBjb2RlOiBFeHBvcnRSZXN1bHRDb2RlLlNVQ0NFU1MgfSk7XG4gIH1cblxuICBvdmVycmlkZSBzaHV0ZG93bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBvdmVycmlkZSBmb3JjZUZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IEV4cG9ydFJlc3VsdCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9jb3JlXCI7XG5pbXBvcnQgeyBPVExQVHJhY2VFeHBvcnRlciB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9leHBvcnRlci10cmFjZS1vdGxwLWh0dHBcIjtcbmltcG9ydCB0eXBlIHsgUmVhZGFibGVTcGFuLCBTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuLi8uLi91dGlscy9sb2dnZXJcIjtcblxuLyoqXG4gKiBTcGFuIGV4cG9ydGVyIHRoYXQgc2VuZHMgdHJhY2VzIHRvIHRoZSBKdWRnbWVudCBwbGF0Zm9ybSB2aWEgT1RMUCBIVFRQLlxuICpcbiAqIFdyYXBzIHRoZSBPcGVuVGVsZW1ldHJ5IE9UTFAgdHJhY2UgZXhwb3J0ZXIgd2l0aCBKdWRnbWVudC1zcGVjaWZpY1xuICogYXV0aGVudGljYXRpb24gaGVhZGVycy5cbiAqL1xuZXhwb3J0IGNsYXNzIEp1ZGdtZW50U3BhbkV4cG9ydGVyIGltcGxlbWVudHMgU3BhbkV4cG9ydGVyIHtcbiAgcHJvdGVjdGVkIF9kZWxlZ2F0ZTogT1RMUFRyYWNlRXhwb3J0ZXIgfCBudWxsO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgSnVkZ21lbnRTcGFuRXhwb3J0ZXIuXG4gICAqXG4gICAqIEBwYXJhbSBlbmRwb2ludCAtIFRoZSBPVExQIEhUVFAgZW5kcG9pbnQgVVJMLlxuICAgKiBAcGFyYW0gYXBpS2V5IC0gSnVkZ21lbnQgQVBJIGtleSBmb3IgYXV0aGVudGljYXRpb24uXG4gICAqIEBwYXJhbSBvcmdhbml6YXRpb25JZCAtIEp1ZGdtZW50IG9yZ2FuaXphdGlvbiBJRC5cbiAgICogQHBhcmFtIHByb2plY3RJZCAtIEp1ZGdtZW50IHByb2plY3QgSUQuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbmRwb2ludDogc3RyaW5nLFxuICAgIGFwaUtleTogc3RyaW5nLFxuICAgIG9yZ2FuaXphdGlvbklkOiBzdHJpbmcsXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICkge1xuICAgIGlmICghZW5kcG9pbnQpIHtcbiAgICAgIHRoaXMuX2RlbGVnYXRlID0gbnVsbDtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fZGVsZWdhdGUgPSBuZXcgT1RMUFRyYWNlRXhwb3J0ZXIoe1xuICAgICAgdXJsOiBlbmRwb2ludCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgICBcIlgtT3JnYW5pemF0aW9uLUlkXCI6IG9yZ2FuaXphdGlvbklkLFxuICAgICAgICBcIlgtUHJvamVjdC1JZFwiOiBwcm9qZWN0SWQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4cG9ydCBhIGJhdGNoIG9mIHNwYW5zLlxuICAgKlxuICAgKiBAcGFyYW0gc3BhbnMgLSBUaGUgc3BhbnMgdG8gZXhwb3J0LlxuICAgKiBAcGFyYW0gcmVzdWx0Q2FsbGJhY2sgLSBDYWxsYmFjayBpbnZva2VkIHdpdGggdGhlIGV4cG9ydCByZXN1bHQuXG4gICAqL1xuICBleHBvcnQoXG4gICAgc3BhbnM6IFJlYWRhYmxlU3BhbltdLFxuICAgIHJlc3VsdENhbGxiYWNrOiAocmVzdWx0OiBFeHBvcnRSZXN1bHQpID0+IHZvaWQsXG4gICk6IHZvaWQge1xuICAgIExvZ2dlci5pbmZvKGBFeHBvcnRlZCAke3NwYW5zLmxlbmd0aH0gc3BhbnNgKTtcbiAgICB0aGlzLl9kZWxlZ2F0ZT8uZXhwb3J0KHNwYW5zLCByZXN1bHRDYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogU2h1dCBkb3duIHRoZSBleHBvcnRlci5cbiAgICovXG4gIHNodXRkb3duKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZT8uc2h1dGRvd24oKSA/PyBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGbHVzaCBhbnkgcGVuZGluZyBleHBvcnRzLlxuICAgKi9cbiAgZm9yY2VGbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5fZGVsZWdhdGU/LmZvcmNlRmx1c2goKSA/PyBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7XG4gIEF0dHJpYnV0ZXMsXG4gIENvbnRleHQsXG4gIEhyVGltZSxcbiAgU3BhbkNvbnRleHQsXG59IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB7XG4gIEJhdGNoU3BhblByb2Nlc3NvcixcbiAgdHlwZSBSZWFkYWJsZVNwYW4sXG4gIHR5cGUgU3BhbixcbiAgdHlwZSBTcGFuRXhwb3J0ZXIsXG59IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9zZGstdHJhY2UtYmFzZVwiO1xuaW1wb3J0IHtcbiAgQXR0cmlidXRlS2V5cyxcbiAgSW50ZXJuYWxBdHRyaWJ1dGVLZXlzLFxufSBmcm9tIFwiLi4vLi4vSnVkZ21lbnRBdHRyaWJ1dGVLZXlzXCI7XG5pbXBvcnQgeyBkb250VGhyb3cgfSBmcm9tIFwiLi4vLi4vdXRpbHMvZG9udC10aHJvd1wiO1xuaW1wb3J0IHR5cGUgeyBCYXNlVHJhY2VyIH0gZnJvbSBcIi4uL0Jhc2VUcmFjZXJcIjtcbmltcG9ydCB7IGdldFRyYWNlUnVudGltZSB9IGZyb20gXCIuLi9ydW50aW1lXCI7XG5pbXBvcnQgeyBKdWRnbWVudEJhZ2dhZ2VTcGFuUHJvY2Vzc29yIH0gZnJvbSBcIi4vSnVkZ21lbnRCYWdnYWdlU3BhblByb2Nlc3NvclwiO1xuXG50eXBlIFNwYW5LZXkgPSBgJHtzdHJpbmd9OiR7c3RyaW5nfWA7XG5cbmZ1bmN0aW9uIG1ha2VTcGFuS2V5KGN0eDogU3BhbkNvbnRleHQpOiBTcGFuS2V5IHtcbiAgcmV0dXJuIGAke2N0eC50cmFjZUlkfToke2N0eC5zcGFuSWR9YDtcbn1cblxuZnVuY3Rpb24gaXNaZXJvSHJUaW1lKGhyVGltZTogSHJUaW1lKTogYm9vbGVhbiB7XG4gIHJldHVybiBoclRpbWVbMF0gPT09IDAgJiYgaHJUaW1lWzFdID09PSAwO1xufVxuXG4vKipcbiAqIFNwYW4gcHJvY2Vzc29yIHRoYXQgbWFuYWdlcyBzcGFuIGxpZmVjeWNsZSwgc3RhdGUsIGFuZCBiYXRjaGVkIGV4cG9ydFxuICogdG8gdGhlIEp1ZGdtZW50IHBsYXRmb3JtLiBTdXBwb3J0cyBwZXItc3BhbiBzdGF0ZSAoY291bnRlcnMsIGxpc3RzKSxcbiAqIHBhcnRpYWwtc3BhbiBlbWlzc2lvbiBmb3Igc3RyZWFtaW5nIHVwZGF0ZXMsIGFuZCBiYWdnYWdlIHByb3BhZ2F0aW9uXG4gKiBvbnRvIGNoaWxkIHNwYW5zLlxuICpcbiAqIENyZWF0ZWQgYXV0b21hdGljYWxseSBieSBgVHJhY2VyLmluaXQoKWAuIFVzZSBpdCBkaXJlY3RseSBvbmx5IHdoZW5cbiAqIGJ1aWxkaW5nIGEgY3VzdG9tIHRyYWNpbmcgcGlwZWxpbmUuXG4gKi9cbmV4cG9ydCBjbGFzcyBKdWRnbWVudFNwYW5Qcm9jZXNzb3IgZXh0ZW5kcyBCYXRjaFNwYW5Qcm9jZXNzb3Ige1xuICB0cmFjZXI6IEJhc2VUcmFjZXIgfCBudWxsO1xuICBwcml2YXRlIF9zdGF0ZSA9IG5ldyBNYXA8U3BhbktleSwgTWFwPHN0cmluZywgdW5rbm93bj4+KCk7XG4gIHByaXZhdGUgX3NwYW5GaW5hbGl6ZXJzOiBGaW5hbGl6YXRpb25SZWdpc3RyeTxTcGFuS2V5PjtcbiAgcHJpdmF0ZSBfYmFnZ2FnZVByb2Nlc3NvcjogSnVkZ21lbnRCYWdnYWdlU3BhblByb2Nlc3NvcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICB0cmFjZXI6IEJhc2VUcmFjZXIgfCBudWxsLFxuICAgIGV4cG9ydGVyOiBTcGFuRXhwb3J0ZXIsXG4gICAgY29uZmlnPzoge1xuICAgICAgbWF4UXVldWVTaXplPzogbnVtYmVyO1xuICAgICAgc2NoZWR1bGVkRGVsYXlNaWxsaXM/OiBudW1iZXI7XG4gICAgICBtYXhFeHBvcnRCYXRjaFNpemU/OiBudW1iZXI7XG4gICAgICBleHBvcnRUaW1lb3V0TWlsbGlzPzogbnVtYmVyO1xuICAgIH0sXG4gICkge1xuICAgIHN1cGVyKGV4cG9ydGVyLCBjb25maWcpO1xuICAgIHRoaXMudHJhY2VyID0gdHJhY2VyO1xuICAgIHRoaXMuX3NwYW5GaW5hbGl6ZXJzID0gbmV3IEZpbmFsaXphdGlvblJlZ2lzdHJ5PFNwYW5LZXk+KChzcGFuS2V5KSA9PiB7XG4gICAgICB0aGlzLl9jbGVhbnVwU3BhblN0YXRlKHNwYW5LZXkpO1xuICAgIH0pO1xuICAgIHRoaXMuX2JhZ2dhZ2VQcm9jZXNzb3IgPSBuZXcgSnVkZ21lbnRCYWdnYWdlU3BhblByb2Nlc3NvcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY2xlYW51cFNwYW5TdGF0ZShzcGFuS2V5OiBTcGFuS2V5KTogdm9pZCB7XG4gICAgdGhpcy5fc3RhdGUuZGVsZXRlKHNwYW5LZXkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVnaXN0ZXJTcGFuKHNwYW46IFNwYW4pOiB2b2lkIHtcbiAgICBjb25zdCBjdHggPSBzcGFuLnNwYW5Db250ZXh0KCk7XG4gICAgaWYgKCFjdHgudHJhY2VJZCB8fCAhY3R4LnNwYW5JZCkgcmV0dXJuO1xuICAgIGNvbnN0IHNwYW5LZXkgPSBtYWtlU3BhbktleShjdHgpO1xuICAgIC8vIFJlZ2lzdGVycyB0aGUgbGl2ZSBTcGFuIG9iamVjdCB3aXRoIHRoZSBHQzsgaWYgaXQgaXMgZXZlclxuICAgIC8vIGNvbGxlY3RlZCB3aXRob3V0IGdvaW5nIHRocm91Z2ggYG9uRW5kYCwgY2xlYW51cCBzdGlsbCBydW5zLlxuICAgIHRoaXMuX3NwYW5GaW5hbGl6ZXJzLnJlZ2lzdGVyKHNwYW4sIHNwYW5LZXkpO1xuICB9XG5cbiAgLyoqIFN0b3JlIGEgdmFsdWUgaW4gdGhlIG11dGFibGUgc3RhdGUgZm9yIGEgc3Bhbi4gKi9cbiAgc3RhdGVTZXQoc3BhbkNvbnRleHQ6IFNwYW5Db250ZXh0LCBrZXk6IHN0cmluZywgdmFsdWU6IHVua25vd24pOiB2b2lkIHtcbiAgICBjb25zdCBzcGFuS2V5ID0gbWFrZVNwYW5LZXkoc3BhbkNvbnRleHQpO1xuICAgIGxldCBhdHRycyA9IHRoaXMuX3N0YXRlLmdldChzcGFuS2V5KTtcbiAgICBpZiAoIWF0dHJzKSB7XG4gICAgICBhdHRycyA9IG5ldyBNYXAoKTtcbiAgICAgIHRoaXMuX3N0YXRlLnNldChzcGFuS2V5LCBhdHRycyk7XG4gICAgfVxuICAgIGF0dHJzLnNldChrZXksIHZhbHVlKTtcbiAgfVxuXG4gIC8qKiBSZXRyaWV2ZSBhIHZhbHVlIGZyb20gdGhlIG11dGFibGUgc3RhdGUgZm9yIGEgc3Bhbi4gKi9cbiAgc3RhdGVHZXQ8VD4oc3BhbkNvbnRleHQ6IFNwYW5Db250ZXh0LCBrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBUKTogVCB7XG4gICAgY29uc3Qgc3BhbktleSA9IG1ha2VTcGFuS2V5KHNwYW5Db250ZXh0KTtcbiAgICBjb25zdCBhdHRycyA9IHRoaXMuX3N0YXRlLmdldChzcGFuS2V5KTtcbiAgICBpZiAoIWF0dHJzPy5oYXMoa2V5KSkgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICByZXR1cm4gYXR0cnMuZ2V0KGtleSkgYXMgVDtcbiAgfVxuXG4gIC8qKiBBdG9taWNhbGx5IGluY3JlbWVudCBhIGNvdW50ZXIuIFJldHVybnMgdGhlIHZhbHVlIGJlZm9yZSBpbmNyZW1lbnQuICovXG4gIHN0YXRlSW5jcihzcGFuQ29udGV4dDogU3BhbkNvbnRleHQsIGtleTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICBjb25zdCBzcGFuS2V5ID0gbWFrZVNwYW5LZXkoc3BhbkNvbnRleHQpO1xuICAgIGxldCBhdHRycyA9IHRoaXMuX3N0YXRlLmdldChzcGFuS2V5KTtcbiAgICBpZiAoIWF0dHJzKSB7XG4gICAgICBhdHRycyA9IG5ldyBNYXAoKTtcbiAgICAgIHRoaXMuX3N0YXRlLnNldChzcGFuS2V5LCBhdHRycyk7XG4gICAgfVxuICAgIGNvbnN0IHN0b3JlZCA9IGF0dHJzLmdldChrZXkpO1xuICAgIGNvbnN0IHByZXYgPSB0eXBlb2Ygc3RvcmVkID09PSBcIm51bWJlclwiID8gc3RvcmVkIDogMDtcbiAgICBhdHRycy5zZXQoa2V5LCBwcmV2ICsgMSk7XG4gICAgcmV0dXJuIHByZXY7XG4gIH1cblxuICAvKiogQXRvbWljYWxseSBhcHBlbmQgdG8gYSBsaXN0LiBSZXR1cm5zIHRoZSBuZXcgbGlzdC4gKi9cbiAgc3RhdGVBcHBlbmQ8VD4oc3BhbkNvbnRleHQ6IFNwYW5Db250ZXh0LCBrZXk6IHN0cmluZywgaXRlbTogVCk6IFRbXSB7XG4gICAgY29uc3Qgc3BhbktleSA9IG1ha2VTcGFuS2V5KHNwYW5Db250ZXh0KTtcbiAgICBsZXQgYXR0cnMgPSB0aGlzLl9zdGF0ZS5nZXQoc3BhbktleSk7XG4gICAgaWYgKCFhdHRycykge1xuICAgICAgYXR0cnMgPSBuZXcgTWFwKCk7XG4gICAgICB0aGlzLl9zdGF0ZS5zZXQoc3BhbktleSwgYXR0cnMpO1xuICAgIH1cbiAgICBjb25zdCBzdG9yZWQgPSBhdHRycy5nZXQoa2V5KTtcbiAgICBjb25zdCBsaXN0OiBUW10gPSBBcnJheS5pc0FycmF5KHN0b3JlZClcbiAgICAgID8gWy4uLihzdG9yZWQgYXMgVFtdKSwgaXRlbV1cbiAgICAgIDogW2l0ZW1dO1xuICAgIGF0dHJzLnNldChrZXksIGxpc3QpO1xuICAgIHJldHVybiBsaXN0O1xuICB9XG5cbiAgcHJpdmF0ZSBfZW1pdFNwYW4oc3BhbjogUmVhZGFibGVTcGFuLCBpc1BhcnRpYWwgPSBmYWxzZSk6IHZvaWQge1xuICAgIGNvbnN0IGN0eCA9IHNwYW4uc3BhbkNvbnRleHQoKTtcbiAgICBpZiAoIWN0eC50cmFjZUlkKSByZXR1cm47XG4gICAgY29uc3QgY3VycklkID0gdGhpcy5zdGF0ZUluY3IoY3R4LCBBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1VQREFURV9JRCk7XG4gICAgY29uc3QgYXR0cmlidXRlczogQXR0cmlidXRlcyA9IHtcbiAgICAgIC4uLnNwYW4uYXR0cmlidXRlcyxcbiAgICAgIFtBdHRyaWJ1dGVLZXlzLkpVREdNRU5UX1VQREFURV9JRF06IGN1cnJJZCxcbiAgICB9O1xuXG4gICAgaWYgKGlzUGFydGlhbCkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1keW5hbWljLWRlbGV0ZVxuICAgICAgZGVsZXRlIGF0dHJpYnV0ZXNbQXR0cmlidXRlS2V5cy5KVURHTUVOVF9QRU5ESU5HX1RSQUNFX0VWQUxdO1xuICAgIH1cblxuICAgIGNvbnN0IGVtaXR0ZWRTcGFuID0gT2JqZWN0LmNyZWF0ZShzcGFuKSBhcyBSZWFkYWJsZVNwYW47XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGVtaXR0ZWRTcGFuLCBcImF0dHJpYnV0ZXNcIiwge1xuICAgICAgdmFsdWU6IGF0dHJpYnV0ZXMsXG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgfSk7XG4gICAgY29uc3QgZW5kVGltZSA9IGlzWmVyb0hyVGltZShzcGFuLmVuZFRpbWUpID8gc3Bhbi5zdGFydFRpbWUgOiBzcGFuLmVuZFRpbWU7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGVtaXR0ZWRTcGFuLCBcImVuZFRpbWVcIiwge1xuICAgICAgdmFsdWU6IGVuZFRpbWUsXG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBzdXBlci5vbkVuZChlbWl0dGVkU3Bhbik7XG4gIH1cblxuICAvKiogRXhwb3J0IHRoZSBjdXJyZW50IHNwYW4ncyBpbi1wcm9ncmVzcyBzdGF0ZSBmb3Igc3RyZWFtaW5nIHVwZGF0ZXMuICovXG4gIGVtaXRQYXJ0aWFsKCk6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkp1ZGdtZW50U3BhblByb2Nlc3Nvci5lbWl0UGFydGlhbFwiLCAoKSA9PiB7XG4gICAgICBjb25zdCBzcGFuID0gZ2V0VHJhY2VSdW50aW1lKCkuZ2V0Q3VycmVudFNwYW4oKTtcbiAgICAgIGlmICghc3Bhbj8uaXNSZWNvcmRpbmcoKSkgcmV0dXJuO1xuICAgICAgY29uc3QgY3R4ID0gc3Bhbi5zcGFuQ29udGV4dCgpO1xuICAgICAgaWYgKCFjdHgudHJhY2VJZCkgcmV0dXJuO1xuICAgICAgaWYgKFxuICAgICAgICB0aGlzLnN0YXRlR2V0PGJvb2xlYW4+KFxuICAgICAgICAgIGN0eCxcbiAgICAgICAgICBJbnRlcm5hbEF0dHJpYnV0ZUtleXMuRElTQUJMRV9QQVJUSUFMX0VNSVQsXG4gICAgICAgICAgZmFsc2UsXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLl9lbWl0U3BhbihzcGFuIGFzIHVua25vd24gYXMgUmVhZGFibGVTcGFuLCB0cnVlKTtcbiAgICB9KTtcbiAgfVxuXG4gIG9uU3RhcnQoc3BhbjogU3BhbiwgcGFyZW50Q29udGV4dDogQ29udGV4dCk6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkp1ZGdtZW50U3BhblByb2Nlc3Nvci5vblN0YXJ0XCIsICgpID0+IHtcbiAgICAgIHRoaXMuX2JhZ2dhZ2VQcm9jZXNzb3Iub25TdGFydChzcGFuLCBwYXJlbnRDb250ZXh0KTtcbiAgICAgIHRoaXMuX3JlZ2lzdGVyU3BhbihzcGFuKTtcbiAgICB9KTtcbiAgfVxuXG4gIG9uRW5kKHNwYW46IFJlYWRhYmxlU3Bhbik6IHZvaWQge1xuICAgIGRvbnRUaHJvdyhcIkp1ZGdtZW50U3BhblByb2Nlc3Nvci5vbkVuZFwiLCAoKSA9PiB7XG4gICAgICBjb25zdCBjdHggPSBzcGFuLnNwYW5Db250ZXh0KCk7XG4gICAgICBpZiAoIWN0eC50cmFjZUlkKSB7XG4gICAgICAgIHN1cGVyLm9uRW5kKHNwYW4pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBzcGFuS2V5ID0gbWFrZVNwYW5LZXkoY3R4KTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGlzQ2FuY2VsbGVkID0gdGhpcy5zdGF0ZUdldDxib29sZWFuPihcbiAgICAgICAgICBjdHgsXG4gICAgICAgICAgSW50ZXJuYWxBdHRyaWJ1dGVLZXlzLkNBTkNFTExFRCxcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKCFpc0NhbmNlbGxlZCkge1xuICAgICAgICAgIHRoaXMuX2VtaXRTcGFuKHNwYW4pO1xuICAgICAgICB9XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0aGlzLl9jbGVhbnVwU3BhblN0YXRlKHNwYW5LZXkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgQ29udGV4dCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB0eXBlIHtcbiAgUmVhZGFibGVTcGFuLFxuICBTcGFuLFxuICBTcGFuUHJvY2Vzc29yLFxufSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvc2RrLXRyYWNlLWJhc2VcIjtcbmltcG9ydCB7IGdldEJhZ2dhZ2UgfSBmcm9tIFwiLi4vYmFnZ2FnZVwiO1xuXG4vKipcbiAqIFByZWRpY2F0ZSB0aGF0IGRlY2lkZXMgd2hpY2ggYmFnZ2FnZSBrZXlzIGFyZSBwcm9wYWdhdGVkIHRvIHNwYW5cbiAqIGF0dHJpYnV0ZXMuXG4gKi9cbmV4cG9ydCB0eXBlIEJhZ2dhZ2VLZXlQcmVkaWNhdGUgPSAoYmFnZ2FnZUtleTogc3RyaW5nKSA9PiBib29sZWFuO1xuXG4vKiogRGVmYXVsdCBwcmVkaWNhdGUgdGhhdCBhbGxvd3MgZXZlcnkgYmFnZ2FnZSBrZXkuICovXG5leHBvcnQgY29uc3QgQUxMT1dfQUxMX0JBR0dBR0VfS0VZUzogQmFnZ2FnZUtleVByZWRpY2F0ZSA9ICgpID0+IHRydWU7XG5cbi8qKlxuICogU3BhbiBwcm9jZXNzb3IgdGhhdCBjb3BpZXMgYmFnZ2FnZSBlbnRyaWVzIG9udG8gc3BhbiBhdHRyaWJ1dGVzIGF0XG4gKiBzcGFuIHN0YXJ0LiBVc2UgYGtleVByZWRpY2F0ZWAgdG8gY29udHJvbCB3aGljaCBrZXlzIGFyZSBwcm9wYWdhdGVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBwcm9jZXNzb3IgPSBuZXcgSnVkZ21lbnRCYWdnYWdlU3BhblByb2Nlc3NvcihcbiAqICAgKGtleSkgPT4ga2V5LnN0YXJ0c1dpdGgoXCJqdWRnbWVudC5cIiksXG4gKiApO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBKdWRnbWVudEJhZ2dhZ2VTcGFuUHJvY2Vzc29yIGltcGxlbWVudHMgU3BhblByb2Nlc3NvciB7XG4gIHByaXZhdGUgX2tleVByZWRpY2F0ZTogQmFnZ2FnZUtleVByZWRpY2F0ZTtcblxuICBjb25zdHJ1Y3RvcihrZXlQcmVkaWNhdGU6IEJhZ2dhZ2VLZXlQcmVkaWNhdGUgPSBBTExPV19BTExfQkFHR0FHRV9LRVlTKSB7XG4gICAgdGhpcy5fa2V5UHJlZGljYXRlID0ga2V5UHJlZGljYXRlO1xuICB9XG5cbiAgLyoqIENvcHkgbWF0Y2hpbmcgYmFnZ2FnZSBlbnRyaWVzIGZyb20gdGhlIHBhcmVudCBjb250ZXh0IG9udG8gdGhlIHNwYW4uICovXG4gIG9uU3RhcnQoc3BhbjogU3BhbiwgcGFyZW50Q29udGV4dDogQ29udGV4dCk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJpZXMgPSBnZXRCYWdnYWdlKHBhcmVudENvbnRleHQpPy5nZXRBbGxFbnRyaWVzKCkgPz8gW107XG4gICAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgZW50cmllcykge1xuICAgICAgaWYgKHRoaXMuX2tleVByZWRpY2F0ZShrZXkpKSB7XG4gICAgICAgIHNwYW4uc2V0QXR0cmlidXRlKGtleSwgZW50cnkudmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiBOby1vcC4gKi9cbiAgb25FbmQoX3NwYW46IFJlYWRhYmxlU3Bhbik6IHZvaWQge1xuICAgIC8qIG5vLW9wICovXG4gIH1cblxuICAvKiogTm8tb3AuICovXG4gIGZvcmNlRmx1c2goKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgLyoqIE5vLW9wLiAqL1xuICBzaHV0ZG93bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBDb250ZXh0LCBTcGFuQ29udGV4dCB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB0eXBlIHsgUmVhZGFibGVTcGFuLCBTcGFuIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L3Nkay10cmFjZS1iYXNlXCI7XG5pbXBvcnQgeyBOb09wU3BhbkV4cG9ydGVyIH0gZnJvbSBcIi4uL2V4cG9ydGVycy9Ob09wU3BhbkV4cG9ydGVyXCI7XG5pbXBvcnQgeyBKdWRnbWVudFNwYW5Qcm9jZXNzb3IgfSBmcm9tIFwiLi9KdWRnbWVudFNwYW5Qcm9jZXNzb3JcIjtcblxuLyoqXG4gKiBBIG5vLW9wIHNwYW4gcHJvY2Vzc29yIHRoYXQgZGlzY2FyZHMgYWxsIHNwYW5zLlxuICpcbiAqIFVzZWQgd2hlbiBtb25pdG9yaW5nIGlzIGRpc2FibGVkIG9yIGNyZWRlbnRpYWxzIGFyZSBtaXNzaW5nLlxuICovXG5leHBvcnQgY2xhc3MgTm9PcFNwYW5Qcm9jZXNzb3IgZXh0ZW5kcyBKdWRnbWVudFNwYW5Qcm9jZXNzb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihudWxsLCBuZXcgTm9PcFNwYW5FeHBvcnRlcigpKTtcbiAgfVxuXG4gIG9uU3RhcnQoX3NwYW46IFNwYW4sIF9wYXJlbnRDb250ZXh0OiBDb250ZXh0KTogdm9pZCB7XG4gICAgLyogZW1wdHkgKi9cbiAgfVxuXG4gIG9uRW5kKF9zcGFuOiBSZWFkYWJsZVNwYW4pOiB2b2lkIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9XG5cbiAgc2h1dGRvd24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgZm9yY2VGbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBlbWl0UGFydGlhbCgpOiB2b2lkIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9XG5cbiAgc3RhdGVTZXQoX3NwYW5Db250ZXh0OiBTcGFuQ29udGV4dCwgX2tleTogc3RyaW5nLCBfdmFsdWU6IHVua25vd24pOiB2b2lkIHtcbiAgICAvKiBlbXB0eSAqL1xuICB9XG5cbiAgc3RhdGVHZXQ8VD4oX3NwYW5Db250ZXh0OiBTcGFuQ29udGV4dCwgX2tleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IFQpOiBUIHtcbiAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICB9XG5cbiAgc3RhdGVJbmNyKF9zcGFuQ29udGV4dDogU3BhbkNvbnRleHQsIF9rZXk6IHN0cmluZyk6IG51bWJlciB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBzdGF0ZUFwcGVuZDxUPihfc3BhbkNvbnRleHQ6IFNwYW5Db250ZXh0LCBfa2V5OiBzdHJpbmcsIGl0ZW06IFQpOiBUW10ge1xuICAgIHJldHVybiBbaXRlbV07XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHtcbiAgSU5WQUxJRF9TUEFOX0NPTlRFWFQsXG4gIFJPT1RfQ09OVEVYVCxcbiAgU3BhblN0YXR1c0NvZGUsXG4gIHRyYWNlLFxuICB0eXBlIENvbnRleHQsXG4gIHR5cGUgU3BhbixcbiAgdHlwZSBTcGFuQ29udGV4dCxcbiAgdHlwZSBTcGFuT3B0aW9ucyxcbiAgdHlwZSBUcmFjZXIsXG4gIHR5cGUgVHJhY2VyUHJvdmlkZXIsXG59IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9hcGlcIjtcbmltcG9ydCB0eXBlIHsgSW5zdHJ1bWVudGF0aW9uIH0gZnJvbSBcIkBvcGVudGVsZW1ldHJ5L2luc3RydW1lbnRhdGlvblwiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2xvZ2dlclwiO1xuaW1wb3J0IHsgc2V0VHJhY2VSdW50aW1lLCB0eXBlIFRyYWNlUnVudGltZVRyYWNlciB9IGZyb20gXCIuLi90cmFjZS9ydW50aW1lXCI7XG5cbmNvbnN0IFRSQUNFUl9OQU1FID0gXCJqdWRnZXZhbFwiO1xuXG5sZXQgYWN0aXZlQ29udGV4dDogQ29udGV4dCA9IFJPT1RfQ09OVEVYVDtcblxuZnVuY3Rpb24gdGFrZUV4cG9ydGVyRXJyb3IodHJhY2VyOiBUcmFjZVJ1bnRpbWVUcmFjZXIpOiBFcnJvciB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGV4cG9ydGVyID0gdHJhY2VyLmdldFNwYW5FeHBvcnRlcigpIGFzIHtcbiAgICB0YWtlRXhwb3J0RXJyb3I/OiAoKSA9PiBFcnJvciB8IHVuZGVmaW5lZDtcbiAgfTtcbiAgcmV0dXJuIGV4cG9ydGVyLnRha2VFeHBvcnRFcnJvcj8uKCk7XG59XG5cbmNsYXNzIFByb3h5VHJhY2VyIGltcGxlbWVudHMgVHJhY2VyIHtcbiAgcHJpdmF0ZSBfcHJvdmlkZXI6IFdvcmtlclRyYWNlclByb3ZpZGVyO1xuXG4gIGNvbnN0cnVjdG9yKHByb3ZpZGVyOiBXb3JrZXJUcmFjZXJQcm92aWRlcikge1xuICAgIHRoaXMuX3Byb3ZpZGVyID0gcHJvdmlkZXI7XG4gIH1cblxuICBzdGFydFNwYW4obmFtZTogc3RyaW5nLCBvcHRpb25zPzogU3Bhbk9wdGlvbnMsIGNvbnRleHQ/OiBDb250ZXh0KTogU3BhbiB7XG4gICAgY29uc3QgY3R4ID0gY29udGV4dCA/PyB0aGlzLl9wcm92aWRlci5nZXRDdXJyZW50Q29udGV4dCgpO1xuICAgIGNvbnN0IGRlbGVnYXRlID0gdGhpcy5fcHJvdmlkZXIuX2dldERlbGVnYXRlVHJhY2VyKCk7XG4gICAgcmV0dXJuIGRlbGVnYXRlLnN0YXJ0U3BhbihuYW1lLCBvcHRpb25zLCBjdHgpO1xuICB9XG5cbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGZuOiBGLFxuICApOiBSZXR1cm5UeXBlPEY+O1xuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3Bhbk9wdGlvbnMsXG4gICAgZm46IEYsXG4gICk6IFJldHVyblR5cGU8Rj47XG4gIHN0YXJ0QWN0aXZlU3BhbjxGIGV4dGVuZHMgKHNwYW46IFNwYW4pID0+IHVua25vd24+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBTcGFuT3B0aW9ucyxcbiAgICBjb250ZXh0OiBDb250ZXh0LFxuICAgIGZuOiBGLFxuICApOiBSZXR1cm5UeXBlPEY+O1xuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgLi4uYXJnczogW0ZdIHwgW1NwYW5PcHRpb25zLCBGXSB8IFtTcGFuT3B0aW9ucywgQ29udGV4dCwgRl1cbiAgKTogUmV0dXJuVHlwZTxGPiB7XG4gICAgbGV0IG9wdGlvbnM6IFNwYW5PcHRpb25zID0ge307XG4gICAgbGV0IGNvbnRleHQ6IENvbnRleHQgPSB0aGlzLl9wcm92aWRlci5nZXRDdXJyZW50Q29udGV4dCgpO1xuICAgIGxldCBmbjogRjtcblxuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgZm4gPSBhcmdzWzBdO1xuICAgIH0gZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDIpIHtcbiAgICAgIG9wdGlvbnMgPSBhcmdzWzBdO1xuICAgICAgZm4gPSBhcmdzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gYXJnc1swXTtcbiAgICAgIGNvbnRleHQgPSBhcmdzWzFdO1xuICAgICAgZm4gPSBhcmdzWzJdO1xuICAgIH1cblxuICAgIGNvbnN0IHNwYW4gPSB0aGlzLnN0YXJ0U3BhbihuYW1lLCBvcHRpb25zLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcy5fcHJvdmlkZXIudXNlU3BhbihzcGFuLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCAoKSA9PlxuICAgICAgZm4oc3BhbiksXG4gICAgKSBhcyBSZXR1cm5UeXBlPEY+O1xuICB9XG59XG5cbmNsYXNzIE5vT3BUcmFjZXIgaW1wbGVtZW50cyBUcmFjZXIge1xuICBzdGFydFNwYW4oKTogU3BhbiB7XG4gICAgcmV0dXJuIHRyYWNlLndyYXBTcGFuQ29udGV4dChJTlZBTElEX1NQQU5fQ09OVEVYVCk7XG4gIH1cblxuICBzdGFydEFjdGl2ZVNwYW48RiBleHRlbmRzIChzcGFuOiBTcGFuKSA9PiB1bmtub3duPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgZm46IEYsXG4gICk6IFJldHVyblR5cGU8Rj47XG4gIHN0YXJ0QWN0aXZlU3BhbjxGIGV4dGVuZHMgKHNwYW46IFNwYW4pID0+IHVua25vd24+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBTcGFuT3B0aW9ucyxcbiAgICBmbjogRixcbiAgKTogUmV0dXJuVHlwZTxGPjtcbiAgc3RhcnRBY3RpdmVTcGFuPEYgZXh0ZW5kcyAoc3BhbjogU3BhbikgPT4gdW5rbm93bj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFNwYW5PcHRpb25zLFxuICAgIGNvbnRleHQ6IENvbnRleHQsXG4gICAgZm46IEYsXG4gICk6IFJldHVyblR5cGU8Rj47XG4gIHN0YXJ0QWN0aXZlU3BhbjxGIGV4dGVuZHMgKHNwYW46IFNwYW4pID0+IHVua25vd24+KFxuICAgIF9uYW1lOiBzdHJpbmcsXG4gICAgLi4uYXJnczogW0ZdIHwgW1NwYW5PcHRpb25zLCBGXSB8IFtTcGFuT3B0aW9ucywgQ29udGV4dCwgRl1cbiAgKTogUmV0dXJuVHlwZTxGPiB7XG4gICAgY29uc3QgZm4gPVxuICAgICAgYXJncy5sZW5ndGggPT09IDEgPyBhcmdzWzBdIDogYXJncy5sZW5ndGggPT09IDIgPyBhcmdzWzFdIDogYXJnc1syXTtcbiAgICByZXR1cm4gZm4odGhpcy5zdGFydFNwYW4oKSkgYXMgUmV0dXJuVHlwZTxGPjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VyVHJhY2VyUHJvdmlkZXIgaW1wbGVtZW50cyBUcmFjZXJQcm92aWRlciB7XG4gIHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZTogV29ya2VyVHJhY2VyUHJvdmlkZXIgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIF9hY3RpdmVUcmFjZXI6IFRyYWNlUnVudGltZVRyYWNlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9ub09wVHJhY2VyOiBOb09wVHJhY2VyO1xuICBwcml2YXRlIF9wcm94eVRyYWNlcjogUHJveHlUcmFjZXI7XG4gIHByaXZhdGUgX3RyYWNlcnMgPSBuZXcgU2V0PFRyYWNlUnVudGltZVRyYWNlcj4oKTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX25vT3BUcmFjZXIgPSBuZXcgTm9PcFRyYWNlcigpO1xuICAgIHRoaXMuX3Byb3h5VHJhY2VyID0gbmV3IFByb3h5VHJhY2VyKHRoaXMpO1xuICAgIHNldFRyYWNlUnVudGltZSh0aGlzKTtcbiAgfVxuXG4gIHN0YXRpYyBnZXRJbnN0YW5jZSgpOiBXb3JrZXJUcmFjZXJQcm92aWRlciB7XG4gICAgV29ya2VyVHJhY2VyUHJvdmlkZXIuX2luc3RhbmNlID8/PSBuZXcgV29ya2VyVHJhY2VyUHJvdmlkZXIoKTtcbiAgICByZXR1cm4gV29ya2VyVHJhY2VyUHJvdmlkZXIuX2luc3RhbmNlO1xuICB9XG5cbiAgcmVnaXN0ZXIodHJhY2VyOiBUcmFjZVJ1bnRpbWVUcmFjZXIpOiB2b2lkIHtcbiAgICB0aGlzLl90cmFjZXJzLmFkZCh0cmFjZXIpO1xuICB9XG5cbiAgZGVyZWdpc3Rlcih0cmFjZXI6IFRyYWNlUnVudGltZVRyYWNlcik6IHZvaWQge1xuICAgIHRoaXMuX3RyYWNlcnMuZGVsZXRlKHRyYWNlcik7XG4gIH1cblxuICBzZXRBY3RpdmUodHJhY2VyOiBUcmFjZVJ1bnRpbWVUcmFjZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBjdXJyZW50U3BhbiA9IHRoaXMuZ2V0Q3VycmVudFNwYW4oKTtcbiAgICBpZiAoY3VycmVudFNwYW4/LmlzUmVjb3JkaW5nKCkpIHtcbiAgICAgIGlmICh0cmFjZS5nZXRTcGFuKHRoaXMuZ2V0Q3VycmVudENvbnRleHQoKSkgPT09IGN1cnJlbnRTcGFuKSB7XG4gICAgICAgIExvZ2dlci5lcnJvcihcbiAgICAgICAgICBcIkNhbm5vdCBzZXRfYWN0aXZlKCkgd2hpbGUgYSByb290IHNwYW4gaXMgYWN0aXZlLiBLZWVwaW5nIGV4aXN0aW5nIHRyYWNlciBwcm92aWRlci5cIixcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlZ2lzdGVyKHRyYWNlcik7XG4gICAgdGhpcy5fYWN0aXZlVHJhY2VyID0gdHJhY2VyO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZ2V0QWN0aXZlVHJhY2VyKCk6IFRyYWNlUnVudGltZVRyYWNlciB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLl9hY3RpdmVUcmFjZXI7XG4gIH1cblxuICBnZXRDdXJyZW50Q29udGV4dCgpOiBDb250ZXh0IHtcbiAgICByZXR1cm4gYWN0aXZlQ29udGV4dDtcbiAgfVxuXG4gIHNldFNwYW4oY3R4OiBDb250ZXh0LCBzcGFuOiBTcGFuKTogQ29udGV4dCB7XG4gICAgcmV0dXJuIHRyYWNlLnNldFNwYW4oY3R4LCBzcGFuKTtcbiAgfVxuXG4gIHdyYXBTcGFuQ29udGV4dChzcGFuQ29udGV4dDogU3BhbkNvbnRleHQpOiBTcGFuIHtcbiAgICByZXR1cm4gdHJhY2Uud3JhcFNwYW5Db250ZXh0KHNwYW5Db250ZXh0KTtcbiAgfVxuXG4gIGdldEN1cnJlbnRTcGFuKCk6IFNwYW4gfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0cmFjZS5nZXRTcGFuKHRoaXMuZ2V0Q3VycmVudENvbnRleHQoKSk7XG4gIH1cblxuICBoYXNBY3RpdmVSb290U3BhbigpOiBib29sZWFuIHtcbiAgICBjb25zdCBjdXJyZW50U3BhbiA9IHRoaXMuZ2V0Q3VycmVudFNwYW4oKTtcbiAgICBpZiAoIWN1cnJlbnRTcGFuPy5pc1JlY29yZGluZygpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBfZ2V0RGVsZWdhdGVUcmFjZXIoKTogVHJhY2VyIHtcbiAgICBjb25zdCB0cmFjZXIgPSB0aGlzLl9hY3RpdmVUcmFjZXI7XG4gICAgaWYgKCF0cmFjZXIpIHtcbiAgICAgIExvZ2dlci5kZWJ1ZyhcIk5vIGFjdGl2ZSB0cmFjZXIsIHJldHVybmluZyBOb09wVHJhY2VyXCIpO1xuICAgICAgcmV0dXJuIHRoaXMuX25vT3BUcmFjZXI7XG4gICAgfVxuICAgIHJldHVybiB0cmFjZXIuX3RyYWNlclByb3ZpZGVyLmdldFRyYWNlcihUUkFDRVJfTkFNRSk7XG4gIH1cblxuICBnZXRUcmFjZXIoXG4gICAgX2luc3RydW1lbnRpbmdNb2R1bGVOYW1lOiBzdHJpbmcsXG4gICAgX2luc3RydW1lbnRpbmdMaWJyYXJ5VmVyc2lvbj86IHN0cmluZyxcbiAgICBfb3B0aW9ucz86IHsgc2NoZW1hVXJsPzogc3RyaW5nIH0sXG4gICk6IFRyYWNlciB7XG4gICAgcmV0dXJuIHRoaXMuX3Byb3h5VHJhY2VyO1xuICB9XG5cbiAgYWRkSW5zdHJ1bWVudGF0aW9uKF9pbnN0cnVtZW50b3I6IEluc3RydW1lbnRhdGlvbik6IHZvaWQge1xuICAgIExvZ2dlci53YXJuaW5nKFxuICAgICAgXCJPcGVuVGVsZW1ldHJ5IGluc3RydW1lbnRhdGlvbnMgYXJlIG9ubHkgc3VwcG9ydGVkIGJ5IHRoZSBOb2RlIGVudHJ5cG9pbnQuXCIsXG4gICAgKTtcbiAgfVxuXG4gIHVzZVNwYW48VD4oXG4gICAgc3BhbjogU3BhbixcbiAgICBlbmRPbkV4aXQ6IGJvb2xlYW4sXG4gICAgcmVjb3JkRXhjZXB0aW9uOiBib29sZWFuLFxuICAgIHNldFN0YXR1c09uRXhjZXB0aW9uOiBib29sZWFuLFxuICAgIGZuOiAoKSA9PiBULFxuICApOiBUIHtcbiAgICBjb25zdCBwcmV2Q3R4ID0gdGhpcy5nZXRDdXJyZW50Q29udGV4dCgpO1xuICAgIGNvbnN0IGN0eCA9IHRyYWNlLnNldFNwYW4ocHJldkN0eCwgc3Bhbik7XG4gICAgYWN0aXZlQ29udGV4dCA9IGN0eDtcblxuICAgIGNvbnN0IHJlc3RvcmUgPSAoKTogdm9pZCA9PiB7XG4gICAgICBhY3RpdmVDb250ZXh0ID0gcHJldkN0eDtcbiAgICB9O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGZuKCk7XG4gICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICAgICAgLmNhdGNoKChleGM6IHVua25vd24pID0+IHtcbiAgICAgICAgICAgIGlmIChzcGFuLmlzUmVjb3JkaW5nKCkpIHtcbiAgICAgICAgICAgICAgaWYgKHJlY29yZEV4Y2VwdGlvbikgc3Bhbi5yZWNvcmRFeGNlcHRpb24oZXhjIGFzIEVycm9yKTtcbiAgICAgICAgICAgICAgaWYgKHNldFN0YXR1c09uRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyID0gZXhjIGFzIEVycm9yO1xuICAgICAgICAgICAgICAgIHNwYW4uc2V0U3RhdHVzKHtcbiAgICAgICAgICAgICAgICAgIGNvZGU6IFNwYW5TdGF0dXNDb2RlLkVSUk9SLFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZXJyLm5hbWV9OiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IGV4YztcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIGlmIChlbmRPbkV4aXQpIHNwYW4uZW5kKCk7XG4gICAgICAgICAgICByZXN0b3JlKCk7XG4gICAgICAgICAgfSkgYXMgVDtcbiAgICAgIH1cbiAgICAgIGlmIChlbmRPbkV4aXQpIHNwYW4uZW5kKCk7XG4gICAgICByZXN0b3JlKCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGV4Yykge1xuICAgICAgaWYgKHNwYW4uaXNSZWNvcmRpbmcoKSkge1xuICAgICAgICBpZiAocmVjb3JkRXhjZXB0aW9uKSBzcGFuLnJlY29yZEV4Y2VwdGlvbihleGMgYXMgRXJyb3IpO1xuICAgICAgICBpZiAoc2V0U3RhdHVzT25FeGNlcHRpb24pIHtcbiAgICAgICAgICBjb25zdCBlcnIgPSBleGMgYXMgRXJyb3I7XG4gICAgICAgICAgc3Bhbi5zZXRTdGF0dXMoe1xuICAgICAgICAgICAgY29kZTogU3BhblN0YXR1c0NvZGUuRVJST1IsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlcnIubmFtZX06ICR7ZXJyLm1lc3NhZ2V9YCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGVuZE9uRXhpdCkgc3Bhbi5lbmQoKTtcbiAgICAgIHJlc3RvcmUoKTtcbiAgICAgIHRocm93IGV4YztcbiAgICB9XG4gIH1cblxuICBhdHRhY2hDb250ZXh0KGN0eDogQ29udGV4dCk6IHZvaWQge1xuICAgIGFjdGl2ZUNvbnRleHQgPSBjdHg7XG4gIH1cblxuICB3aXRoQ29udGV4dDxUPihjdHg6IENvbnRleHQsIGZuOiAoKSA9PiBUKTogVCB7XG4gICAgY29uc3QgcHJldkN0eCA9IHRoaXMuZ2V0Q3VycmVudENvbnRleHQoKTtcbiAgICBhY3RpdmVDb250ZXh0ID0gY3R4O1xuICAgIGNvbnN0IHJlc3RvcmUgPSAoKTogdm9pZCA9PiB7XG4gICAgICBhY3RpdmVDb250ZXh0ID0gcHJldkN0eDtcbiAgICB9O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGZuKCk7XG4gICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICByZXR1cm4gcmVzdWx0LmZpbmFsbHkocmVzdG9yZSkgYXMgVDtcbiAgICAgIH1cbiAgICAgIHJlc3RvcmUoKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXhjKSB7XG4gICAgICByZXN0b3JlKCk7XG4gICAgICB0aHJvdyBleGM7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZm9yY2VGbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgQXJyYXkuZnJvbSh0aGlzLl90cmFjZXJzKS5tYXAoKHQpID0+IHQuX3RyYWNlclByb3ZpZGVyLmZvcmNlRmx1c2goKSksXG4gICAgKTtcbiAgICBjb25zdCBlcnJvcnM6IHVua25vd25bXSA9IFtdO1xuICAgIGZvciAoY29uc3QgciBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAoci5zdGF0dXMgPT09IFwicmVqZWN0ZWRcIikge1xuICAgICAgICBMb2dnZXIuZXJyb3IoYGZvcmNlRmx1c2ggZmFpbGVkOiAke1N0cmluZyhyLnJlYXNvbil9YCk7XG4gICAgICAgIGVycm9ycy5wdXNoKHIucmVhc29uKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGZvciAoY29uc3QgdHJhY2VyIG9mIHRoaXMuX3RyYWNlcnMpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSB0YWtlRXhwb3J0ZXJFcnJvcih0cmFjZXIpO1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICBMb2dnZXIuZXJyb3IoYGZvcmNlRmx1c2ggZXhwb3J0IGZhaWxlZDogJHtTdHJpbmcoZXJyb3IpfWApO1xuICAgICAgICAgIGVycm9ycy5wdXNoKGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IGVycm9yc1swXTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzaHV0ZG93bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgQXJyYXkuZnJvbSh0aGlzLl90cmFjZXJzKS5tYXAoKHQpID0+IHQuX3RyYWNlclByb3ZpZGVyLnNodXRkb3duKCkpLFxuICAgICk7XG4gICAgZm9yIChjb25zdCByIG9mIHJlc3VsdHMpIHtcbiAgICAgIGlmIChyLnN0YXR1cyA9PT0gXCJyZWplY3RlZFwiKSB7XG4gICAgICAgIExvZ2dlci5lcnJvcihgc2h1dGRvd24gZmFpbGVkOiAke1N0cmluZyhyLnJlYXNvbil9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX2FjdGl2ZVRyYWNlciA9IG51bGw7XG4gICAgdGhpcy5fdHJhY2Vycy5jbGVhcigpO1xuICAgIGFjdGl2ZUNvbnRleHQgPSBST09UX0NPTlRFWFQ7XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBFeHBvcnRSZXN1bHQgfSBmcm9tIFwiQG9wZW50ZWxlbWV0cnkvY29yZVwiO1xuaW1wb3J0IHsgRXhwb3J0UmVzdWx0Q29kZSB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9jb3JlXCI7XG5pbXBvcnQgeyBQcm90b2J1ZlRyYWNlU2VyaWFsaXplciB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9vdGxwLXRyYW5zZm9ybWVyXCI7XG5pbXBvcnQgdHlwZSB7IFJlYWRhYmxlU3BhbiB9IGZyb20gXCJAb3BlbnRlbGVtZXRyeS9zZGstdHJhY2UtYmFzZVwiO1xuaW1wb3J0IHsgSnVkZ21lbnRTcGFuRXhwb3J0ZXIgfSBmcm9tIFwiLi4vdHJhY2UvZXhwb3J0ZXJzL0p1ZGdtZW50U3BhbkV4cG9ydGVyXCI7XG5cbmV4cG9ydCBjbGFzcyBXb3JrZXJTcGFuRXhwb3J0ZXIgZXh0ZW5kcyBKdWRnbWVudFNwYW5FeHBvcnRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2V4cG9ydEVycm9yczogRXJyb3JbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX2VuZHBvaW50OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBfYXBpS2V5OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBfb3JnYW5pemF0aW9uSWQ6IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9wcm9qZWN0SWQ6IHN0cmluZyxcbiAgKSB7XG4gICAgc3VwZXIoXCJcIiwgXCJcIiwgXCJcIiwgXCJcIik7XG4gIH1cblxuICBleHBvcnQoXG4gICAgc3BhbnM6IFJlYWRhYmxlU3BhbltdLFxuICAgIHJlc3VsdENhbGxiYWNrOiAocmVzdWx0OiBFeHBvcnRSZXN1bHQpID0+IHZvaWQsXG4gICk6IHZvaWQge1xuICAgIGNvbnN0IGJvZHkgPSBQcm90b2J1ZlRyYWNlU2VyaWFsaXplci5zZXJpYWxpemVSZXF1ZXN0KHNwYW5zKTtcbiAgICBpZiAoIWJvZHkpIHtcbiAgICAgIHJlc3VsdENhbGxiYWNrKHsgY29kZTogRXhwb3J0UmVzdWx0Q29kZS5TVUNDRVNTIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZldGNoKHRoaXMuX2VuZHBvaW50LCB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5fYXBpS2V5fWAsXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC1wcm90b2J1ZlwiLFxuICAgICAgICBcIlgtT3JnYW5pemF0aW9uLUlkXCI6IHRoaXMuX29yZ2FuaXphdGlvbklkLFxuICAgICAgICBcIlgtUHJvamVjdC1JZFwiOiB0aGlzLl9wcm9qZWN0SWQsXG4gICAgICB9LFxuICAgICAgYm9keSxcbiAgICB9KVxuICAgICAgLnRoZW4oYXN5bmMgKHJlcykgPT4ge1xuICAgICAgICBpZiAocmVzLm9rKSB7XG4gICAgICAgICAgcmVzdWx0Q2FsbGJhY2soeyBjb2RlOiBFeHBvcnRSZXN1bHRDb2RlLlNVQ0NFU1MgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGV0YWlsID0gKGF3YWl0IHJlcy50ZXh0KCkuY2F0Y2goKCkgPT4gXCJcIikpLnNsaWNlKDAsIDUwMCk7XG4gICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICAgIGRldGFpbFxuICAgICAgICAgICAgPyBgT1RMUCBleHBvcnQgZmFpbGVkOiAke3Jlcy5zdGF0dXN9OiAke2RldGFpbH1gXG4gICAgICAgICAgICA6IGBPVExQIGV4cG9ydCBmYWlsZWQ6ICR7cmVzLnN0YXR1c31gLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLl9leHBvcnRFcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgIHJlc3VsdENhbGxiYWNrKHsgY29kZTogRXhwb3J0UmVzdWx0Q29kZS5GQUlMRUQsIGVycm9yIH0pO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoZXJyb3I6IHVua25vd24pID0+IHtcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9XG4gICAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuICAgICAgICB0aGlzLl9leHBvcnRFcnJvcnMucHVzaChub3JtYWxpemVkKTtcbiAgICAgICAgcmVzdWx0Q2FsbGJhY2soeyBjb2RlOiBFeHBvcnRSZXN1bHRDb2RlLkZBSUxFRCwgZXJyb3I6IG5vcm1hbGl6ZWQgfSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHRha2VFeHBvcnRFcnJvcigpOiBFcnJvciB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuX2V4cG9ydEVycm9ycy5zaGlmdCgpO1xuICB9XG5cbiAgc2h1dGRvd24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgZm9yY2VGbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBlcnJvciA9IHRoaXMudGFrZUV4cG9ydEVycm9yKCk7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbn1cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBLDBCQUdFO0FBQUEsb0JBRUE7QUFBQTs7O0FDRkYsSUFBTSxZQUFZO0FBQ2xCLElBQU0sVUFBVTtBQUNoQixJQUFNLGVBQWU7QUFDckIsSUFBTSxTQUFTO0FBQ2YsSUFBTSxpQkFBaUI7QUFFdkIsU0FBUyxXQUFXLENBQUMsSUFBc0I7QUFBQSxFQUN6QyxPQUFPLFNBQVMsVUFBVSxTQUFTLEtBQUssRUFB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TixDQUFDLEtBQUssa0JBQ04sQ0FBQyxLQUFLLFFBQ047QUFBQSxNQUNBLEtBQUssZ0JBQWdCLElBQUk7QUFBQSxJQUMzQixFQUFPO0FBQUEsTUFDTCxNQUFNLFdBQVcsS0FBSyxPQUFPLFNBQVMsR0FBRyxJQUNyQyxLQUFLLFNBQVMsbUJBQ2QsS0FBSyxTQUFTO0FBQUEsTUFDbEIsS0FBSyxnQkFBZ0IsSUFBSSxtQkFDdkIsVUFDQSxLQUFLLFFBQ0wsS0FBSyxnQkFDTCxLQUFLLFNBQ1A7QUFBQTtBQUFBLElBRUYsT0FBTyxLQUFLO0FBQUE7QUFBQSxFQUdkLGdCQUFnQixHQUEwQjtBQUFBLElBQ3hDLElBQUksS0FBSztBQUFBLE1BQWdCLE9BQU8sS0FBSztBQUFBLElBRXJDLElBQUksQ0FBQyxLQUFLLG1CQUFtQjtBQUFBLE1BQzNCLEtBQUssaUJBQWlCLElBQUk7QUFBQSxJQUM1QixFQUFPO0FBQUEsTUFDTCxLQUFLLGlCQUFpQixJQUFJLHNCQUN4QixNQUNBLEtBQUssZ0JBQWdCLENBQ3ZCO0FBQUE7QUFBQSxJQUVGLE9BQU8sS0FBSztBQUFBO0FBRWhCOyIsCiAgImRlYnVnSWQiOiAiNjdCMUM5RTRFNDM2RkM0NjY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
