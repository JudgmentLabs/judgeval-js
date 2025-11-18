import { Tracer } from "@opentelemetry/api";
import {
  NodeTracerConfig,
  NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";
import { Logger } from "../utils";
import { BaseTracer } from "./BaseTracer";
import { NoOpTracer } from "./NoOpTracer";

export interface filterTracerParams {
  name: string;
  version?: string;
  options?: { schemaUrl?: string };
}

interface JudgmentNodeTracerProviderConfig extends NodeTracerConfig {
  /**
   * Filters what tracers are allowed to be created. This is useful when you want to disable any instrumentation / control instrumentation
   * that is automatically created by auto-instrumentations or other libraries.
   *
   * If set to false, the caller will receive a NoOpTracer.
   *
   * @param params The parameters of the tracer to check if it should be allowed.
   * @returns Whether the tracer should be allowed.
   */
  filterTracer?: (params: filterTracerParams) => boolean;
}

export class JudgmentNodeTracerProvider extends NodeTracerProvider {
  private readonly filterTracer: (params: filterTracerParams) => boolean;

  constructor(config: JudgmentNodeTracerProviderConfig) {
    super(config);
    this.filterTracer = config.filterTracer ?? (() => true);
  }

  getTracer(
    name: string,
    version?: string,
    options?: { schemaUrl?: string }
  ): Tracer {
    if (name === BaseTracer.TRACER_NAME) {
      return super.getTracer(name, version, options);
    }

    try {
      if (this.filterTracer({ name, version, options })) {
        return super.getTracer(name, version, options);
      } else {
        Logger.debug(
          `[JudgmentNodeTracerProvider] Returning NoOpTracer for tracer ${name} as it is disallowed by the filterTracer callback.`
        );
        return new NoOpTracer();
      }
    } catch (error: unknown) {
      Logger.error(
        `[JudgmentNodeTracerProvider] Failed to filter tracer ${name}: ${error}.`
      );
      return super.getTracer(name, version, options);
    }
  }
}
