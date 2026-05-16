import {
  ROOT_CONTEXT,
  type Context,
  type ContextManager,
} from "@opentelemetry/api";
import { AsyncLocalStorage } from "async_hooks";

/**
 * A ContextManager that uses Judgment's own AsyncLocalStorage as the
 * single source of truth for OpenTelemetry context propagation.
 *
 * Registered via `context.setGlobalContextManager()`, this replaces
 * OTel's default context manager so that all OTel instrumentations
 * (including third-party auto-instrumentations) naturally participate
 * in Judgment's context hierarchy without any monkey-patching.
 */
export class JudgmentContextManager implements ContextManager {
  private _contextStorage: AsyncLocalStorage<Context>;

  constructor(contextStorage: AsyncLocalStorage<Context>) {
    this._contextStorage = contextStorage;
  }

  active(): Context {
    return this._contextStorage.getStore() ?? ROOT_CONTEXT;
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    const bound = thisArg == null ? fn : fn.bind(thisArg);
    return this._contextStorage.run(context, bound as F, ...args);
  }

  bind<T>(context: Context, target: T): T {
    if (typeof target !== "function") return target;
    const manager = this;
    const fn = target as unknown as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) =>
      manager.with(context, fn as () => unknown, undefined, ...args)) as T;
  }

  enable(): this {
    return this;
  }

  disable(): this {
    this._contextStorage.disable();
    return this;
  }
}
