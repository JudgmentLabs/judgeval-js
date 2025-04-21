/**
 * Represents an example for evaluation
 */
export interface ExampleOptions {
  input: string;
  actualOutput?: string | string[];
  expectedOutput?: string | string[];
  context?: string[];
  retrievalContext?: string[];
  additionalMetadata?: Record<string, any>;
  toolsCalled?: string[];
  expectedTools?: string[];
  name?: string;
  exampleId?: string;
  exampleIndex?: number;
  timestamp?: string;
  traceId?: string;
  example?: boolean;
}

export class Example {
  input: string;
  actualOutput?: string | string[];
  expectedOutput?: string | string[];
  context?: string[];
  retrievalContext?: string[];
  additionalMetadata?: Record<string, any>;
  toolsCalled?: string[];
  expectedTools?: string[];
  name?: string;
  exampleId: string;
  exampleIndex?: number;
  timestamp?: string;
  traceId?: string;
  example?: boolean;

  constructor(options: ExampleOptions) {
    this.input = options.input;
    this.actualOutput = options.actualOutput;
    this.expectedOutput = options.expectedOutput;
    this.context = options.context;
    this.retrievalContext = options.retrievalContext;
    this.additionalMetadata = options.additionalMetadata;
    this.toolsCalled = options.toolsCalled;
    this.expectedTools = options.expectedTools;
    this.name = options.name;
    this.exampleId = options.exampleId || this.generateUUID();
    this.exampleIndex = options.exampleIndex;
    this.timestamp = options.timestamp || new Date().toISOString();
    this.traceId = options.traceId;
    this.example = options.example ?? true;
  }

  /**
   * Generate a UUID for the example ID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Builder pattern for creating an Example
   */
  static builder(): ExampleBuilder {
    return new ExampleBuilder();
  }

  /**
   * Convert the example to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      input: this.input,
      actual_output: this.actualOutput,
      expected_output: this.expectedOutput,
      context: this.context,
      retrieval_context: this.retrievalContext,
      additional_metadata: this.additionalMetadata,
      tools_called: this.toolsCalled,
      expected_tools: this.expectedTools,
      name: this.name || "example",
      example_id: this.exampleId,
      example_index: this.exampleIndex,
      timestamp: this.timestamp,
      trace_id: this.traceId,
      example: this.example ?? true,
    };
  }
}

/**
 * Builder for creating Example instances
 */
export class ExampleBuilder {
  private _input: string = '';
  private _actualOutput?: string | string[];
  private _expectedOutput?: string | string[];
  private _context?: string[];
  private _retrievalContext?: string[];
  private _additionalMetadata?: Record<string, any>;
  private _toolsCalled?: string[];
  private _expectedTools?: string[];
  private _name?: string;
  private _exampleId?: string;
  private _exampleIndex?: number;
  private _timestamp?: string;
  private _traceId?: string;
  private _example?: boolean;

  input(input: string): ExampleBuilder {
    this._input = input;
    return this;
  }

  actualOutput(actualOutput: string | string[]): ExampleBuilder {
    this._actualOutput = actualOutput;
    return this;
  }

  expectedOutput(expectedOutput: string | string[]): ExampleBuilder {
    this._expectedOutput = expectedOutput;
    return this;
  }

  context(context: string[]): ExampleBuilder {
    this._context = context;
    return this;
  }

  retrievalContext(retrievalContext: string[]): ExampleBuilder {
    this._retrievalContext = retrievalContext;
    return this;
  }

  additionalMetadata(additionalMetadata: Record<string, any>): ExampleBuilder {
    this._additionalMetadata = additionalMetadata;
    return this;
  }

  toolsCalled(toolsCalled: string[]): ExampleBuilder {
    this._toolsCalled = toolsCalled;
    return this;
  }

  expectedTools(expectedTools: string[]): ExampleBuilder {
    this._expectedTools = expectedTools;
    return this;
  }

  name(name: string): ExampleBuilder {
    this._name = name;
    return this;
  }

  exampleId(exampleId: string): ExampleBuilder {
    this._exampleId = exampleId;
    return this;
  }

  exampleIndex(exampleIndex: number): ExampleBuilder {
    this._exampleIndex = exampleIndex;
    return this;
  }

  timestamp(timestamp: string): ExampleBuilder {
    this._timestamp = timestamp;
    return this;
  }

  traceId(traceId: string): ExampleBuilder {
    this._traceId = traceId;
    return this;
  }

  example(example: boolean): ExampleBuilder {
    this._example = example;
    return this;
  }

  build(): Example {
    if (!this._input) {
      throw new Error('Input is required for an Example');
    }
    
    return new Example({
      input: this._input,
      actualOutput: this._actualOutput,
      expectedOutput: this._expectedOutput,
      context: this._context,
      retrievalContext: this._retrievalContext,
      additionalMetadata: this._additionalMetadata,
      toolsCalled: this._toolsCalled,
      expectedTools: this._expectedTools,
      name: this._name,
      exampleId: this._exampleId,
      exampleIndex: this._exampleIndex,
      timestamp: this._timestamp,
      traceId: this._traceId,
      example: this._example,
    });
  }
}
