import { context as otelContext, type Context } from "@opentelemetry/api";
import { AsyncLocalStorage } from "async_hooks";
import { getTraceRuntime } from "../runtime";

type OTelContextApi = typeof otelContext;

let installed = false;

const gateStorage = new AsyncLocalStorage<boolean>();

const originalActive = otelContext.active.bind(otelContext);
const originalWith = otelContext.with.bind(otelContext);
const originalBind = otelContext.bind.bind(otelContext);

function isGateEnabled(): boolean {
  return gateStorage.getStore() === true;
}

export function installOtelContextBridge(): void {
  if (installed) return;

  const api = otelContext as OTelContextApi & {
    active: () => Context;
    with: <A extends unknown[], F extends (...args: A) => ReturnType<F>>(
      context: Context,
      fn: F,
      thisArg?: ThisParameterType<F>,
      ...args: A
    ) => ReturnType<F>;
    bind: <T>(context: Context, target: T) => T;
  };

  api.active = (): Context => {
    if (!isGateEnabled()) return originalActive();
    return getTraceRuntime().getCurrentContext();
  };

  api.with = (contextValue, fn, thisArg, ...args) => {
    if (!isGateEnabled())
      return originalWith(contextValue, fn, thisArg, ...args);
    return getTraceRuntime().withContext(contextValue, () =>
      fn.apply(thisArg, args),
    );
  };

  api.bind = (contextValue, target) => {
    if (!isGateEnabled()) return originalBind(contextValue, target);
    if (typeof target !== "function") return target;
    const fn = target as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) =>
      getTraceRuntime().withContext(contextValue, () =>
        fn(...args),
      )) as typeof target;
  };

  installed = true;
}

export function runWithOtelBridgeGate<T>(fn: () => T): T {
  return gateStorage.run(true, fn);
}
