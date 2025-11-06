import { randomUUID } from "node:crypto";
import type { Example as APIExample } from "../../internal/api/models";

export interface ExampleConfig {
  name?: string;
  properties?: Record<string, unknown>;
  exampleId?: string;
  createdAt?: string;
}

export class Example {
  exampleId: string;
  createdAt: string;
  name?: string | null;
  private properties: Record<string, unknown>;

  constructor(config: ExampleConfig = {}) {
    this.exampleId = config.exampleId ?? randomUUID();
    this.createdAt = config.createdAt ?? new Date().toISOString();
    this.name = config.name ?? null;
    this.properties = config.properties ?? {};
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
}
