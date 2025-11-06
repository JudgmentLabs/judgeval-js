import { randomUUID } from "node:crypto";
import type { Example as APIExample } from "../../internal/api/models";

export class Example {
  exampleId: string;
  createdAt: string;
  name?: string | null;
  private properties: Record<string, unknown>;

  constructor() {
    this.exampleId = randomUUID();
    this.createdAt = new Date().toISOString();
    this.name = null;
    this.properties = {};
  }

  setProperty(key: string, value: unknown): this {
    this.properties[key] = value;
    return this;
  }

  getProperty(key: string): unknown {
    return this.properties[key];
  }

  getProperties(): Record<string, unknown> {
    return { ...this.properties };
  }

  toModel(): APIExample {
    return {
      example_id: this.exampleId,
      created_at: this.createdAt,
      name: this.name ?? undefined,
      ...this.properties,
    };
  }

  static builder(): ExampleBuilder {
    return new ExampleBuilder();
  }
}

export class ExampleBuilder {
  private example: Example;

  constructor() {
    this.example = new Example();
  }

  property(key: string, value: unknown): this {
    this.example.setProperty(key, value);
    return this;
  }

  name(name: string): this {
    this.example.name = name;
    return this;
  }

  build(): Example {
    return this.example;
  }
}

