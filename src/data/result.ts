import { Example } from './example';

/**
 * Represents the data for a single scorer
 */
export interface ScorerData {
  name: string;
  score: number;
  threshold: number;
  success: boolean;
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Represents the result of scoring an example
 */
export interface ScoringResultOptions {
  dataObject: Example;
  scorersData?: ScorerData[];
  error?: string;
}

export class ScoringResult {
  dataObject: Example;
  scorersData?: ScorerData[];
  error?: string;

  constructor(options: ScoringResultOptions) {
    this.dataObject = options.dataObject;
    this.scorersData = options.scorersData;
    this.error = options.error;
  }

  /**
   * Builder pattern for creating a ScoringResult
   */
  static builder(): ScoringResultBuilder {
    return new ScoringResultBuilder();
  }

  /**
   * Convert the scoring result to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      success: this.scorersData ? this.scorersData.every(scorer => scorer.success) : false,
      scorers_data: this.scorersData ? this.scorersData.map(scorer => ({
        name: scorer.name,
        threshold: scorer.threshold,
        success: scorer.success,
        score: scorer.score,
        reason: null,
        strict_mode: null,
        evaluation_model: "gpt-4",
        error: scorer.error || null,
        evaluation_cost: null,
        verbose_logs: null,
        additional_metadata: scorer.metadata || null
      })) : null,
      data_object: this.dataObject ? {
        input: this.dataObject.input,
        actual_output: this.dataObject.actualOutput,
        expected_output: this.dataObject.expectedOutput,
        context: this.dataObject.context,
        retrieval_context: this.dataObject.retrievalContext,
        additional_metadata: this.dataObject.additionalMetadata,
        tools_called: this.dataObject.toolsCalled,
        expected_tools: this.dataObject.expectedTools,
        name: "example",
        example_id: `example-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        example_index: 0,
        timestamp: new Date().toISOString(),
        trace_id: `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      } : null,
      error: this.error || null
    };
  }
}

/**
 * Builder for creating ScoringResult instances
 */
export class ScoringResultBuilder {
  private _dataObject!: Example;
  private _scorersData?: ScorerData[];
  private _error?: string;

  dataObject(dataObject: Example): ScoringResultBuilder {
    this._dataObject = dataObject;
    return this;
  }

  scorersData(scorersData: ScorerData[]): ScoringResultBuilder {
    this._scorersData = scorersData;
    return this;
  }

  error(error: string): ScoringResultBuilder {
    this._error = error;
    return this;
  }

  build(): ScoringResult {
    if (!this._dataObject) {
      throw new Error('Data object is required for a ScoringResult');
    }
    
    return new ScoringResult({
      dataObject: this._dataObject,
      scorersData: this._scorersData,
      error: this._error,
    });
  }
}
