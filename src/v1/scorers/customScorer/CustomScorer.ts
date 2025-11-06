import type { ScorerConfig } from "../../../internal/api/models";
import { APIScorerType } from "../../data/APIScorerType";
import { APIScorer } from "../APIScorer";

export class CustomScorer extends APIScorer {
  private _className?: string;
  private _serverHosted: boolean;

  private constructor(builder: CustomScorerBuilder) {
    super(APIScorerType.CUSTOM);
    if (builder.name) {
      this.setName(builder.name);
    }
    if (builder.className) {
      this._className = builder.className;
      this.setAdditionalProperty("class_name", builder.className);
    }
    this._serverHosted = true;
    this.setAdditionalProperty("server_hosted", true);
  }

  getClassName(): string | undefined {
    return this._className;
  }

  isServerHosted(): boolean {
    return this._serverHosted;
  }

  getScorerConfig(): ScorerConfig {
    throw new Error("CustomScorer does not use ScorerConfig");
  }

  static builder(): CustomScorerBuilder {
    return new CustomScorerBuilder();
  }
}

export class CustomScorerBuilder {
  name?: string;
  className?: string;

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setClassName(className: string): this {
    this.className = className;
    return this;
  }

  build(): CustomScorer {
    return new CustomScorer(this);
  }
}
