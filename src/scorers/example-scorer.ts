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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  abstract scoreExample<TArgs extends unknown[] = unknown[]>(
    example: Example,
    ...args: TArgs
  ): Promise<number>;

  getRequiredParams(): string[] {
    return [...this.required_params];
  }

  setRequiredParams(params: string[]): void {
    this.required_params = [...params];
  }
}
