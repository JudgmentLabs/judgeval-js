import { Example } from "../data";
import { BaseScorer } from "./base-scorer";

export abstract class ExampleScorer extends BaseScorer {
  score_type = "Custom";
  required_params: string[] = [];

  constructor() {
    super();
    this.score_type = "Custom";
    this.required_params = [];
  }

  abstract scoreExample(example: Example): Promise<number>;

  static get<T extends ExampleScorer>(
    this: new () => T,
    options?: ExampleScorerOptions,
  ): T {
    const instance = new this();

    if (options) {
      if (options.name !== undefined) {
        instance.name = options.name;
      }
      if (options.threshold !== undefined) {
        instance.setThreshold(options.threshold);
      }
      if (options.model !== undefined) {
        instance.addModel(options.model);
      }
      if (options.strict_mode !== undefined) {
        instance.strict_mode = options.strict_mode;
      }
    }

    return instance;
  }

  getRequiredParams(): string[] {
    return [...this.required_params];
  }

  setRequiredParams(params: string[]): void {
    this.required_params = [...params];
  }
}

export interface ExampleScorerOptions {
  name?: string;
  threshold?: number;
  model?: string;
  strict_mode?: boolean;
}
