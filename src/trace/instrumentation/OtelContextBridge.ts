import { context as otelContext, type Context } from "@opentelemetry/api";
import { AsyncLocalStorage } from "async_hooks";

type OTelContextApi = typeof otelContext;

let installed = false;
let getJudgmentContext: (() => Context) | null = null;

const gateStorage = new AsyncLocalStorage<boolean>();
const bridgeContextStorage = new AsyncLocalStorage<Context>();

const originalActive = otelContext.active.bind(otelContext);
const originalWith = otelContext.with.bind(otelContext);
const originalBind = otelContext.bind.bind(otelContext);

function isGateEnabled(): boolean {
  return gateStorage.getStore() === true;
}

export function installOtelContextBridge(
  getCurrentJudgmentContext: () => Context,
): void {
  getJudgmentContext = getCurrentJudgmentContext;
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
    const bridged = bridgeContextStorage.getStore();
    if (bridged) return bridged;
    return getJudgmentContext ? getJudgmentContext() : originalActive();
  };

  api.with = (contextValue, fn, thisArg, ...args) => {
    if (!isGateEnabled())
      return originalWith(contextValue, fn, thisArg, ...args);
    return bridgeContextStorage.run(contextValue, () =>
      fn.apply(thisArg, args),
    );
  };

  api.bind = (contextValue, target) => {
    if (!isGateEnabled()) return originalBind(contextValue, target);
    if (typeof target !== "function") return target;
    const fn = target as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) =>
      bridgeContextStorage.run(contextValue, () =>
        fn(...args),
      )) as typeof target;
  };

  installed = true;
}

export function runWithOtelBridgeGate<T>(ctx: Context, fn: () => T): T {
  return gateStorage.run(true, () => bridgeContextStorage.run(ctx, fn));
}
