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
    // Ensure exampleId is a valid UUID
    if (!this.exampleId || !this.exampleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      this.exampleId = this.generateUUID();
    }
    
    // Create the base object with required fields
    const result: Record<string, any> = {
      input: this.input,
      actualOutput: this.actualOutput,
      expectedOutput: this.expectedOutput,
      name: this.name || "example",
      exampleId: this.exampleId,
      exampleIndex: this.exampleIndex || 0,
      timestamp: this.timestamp || new Date().toISOString(),
      traceId: this.traceId || `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };
    
    // Only include non-null fields to avoid sending empty fields to the API
    if (this.context) result.context = this.context;
    if (this.retrievalContext) result.retrievalContext = this.retrievalContext;
    if (this.additionalMetadata) result.additionalMetadata = this.additionalMetadata;
    if (this.toolsCalled) result.toolsCalled = this.toolsCalled;
    if (this.expectedTools) result.expectedTools = this.expectedTools;
    if (this.example !== undefined) result.example = this.example;
    
    return result;
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
