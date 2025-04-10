/**
 * Represents an example for evaluation
 */
export interface ExampleOptions {
  input: string;
  actualOutput?: string;
  expectedOutput?: string;
  context?: string[];
  retrievalContext?: string[];
  additionalMetadata?: Record<string, any>;
  toolsCalled?: any[];
  expectedTools?: any[];
}

export class Example {
  input: string;
  actualOutput?: string;
  expectedOutput?: string;
  context?: string[];
  retrievalContext?: string[];
  additionalMetadata?: Record<string, any>;
  toolsCalled?: any[];
  expectedTools?: any[];

  constructor(options: ExampleOptions) {
    this.input = options.input;
    this.actualOutput = options.actualOutput;
    this.expectedOutput = options.expectedOutput;
    this.context = options.context;
    this.retrievalContext = options.retrievalContext;
    this.additionalMetadata = options.additionalMetadata;
    this.toolsCalled = options.toolsCalled;
    this.expectedTools = options.expectedTools;
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
    };
  }
}

/**
 * Builder for creating Example instances
 */
export class ExampleBuilder {
  private _input: string = '';
  private _actualOutput?: string;
  private _expectedOutput?: string;
  private _context?: string[];
  private _retrievalContext?: string[];
  private _additionalMetadata?: Record<string, any>;
  private _toolsCalled?: any[];
  private _expectedTools?: any[];

  input(input: string): ExampleBuilder {
    this._input = input;
    return this;
  }

  actualOutput(actualOutput: string): ExampleBuilder {
    this._actualOutput = actualOutput;
    return this;
  }

  expectedOutput(expectedOutput: string): ExampleBuilder {
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

  toolsCalled(toolsCalled: any[]): ExampleBuilder {
    this._toolsCalled = toolsCalled;
    return this;
  }

  expectedTools(expectedTools: any[]): ExampleBuilder {
    this._expectedTools = expectedTools;
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
    });
  }
}
