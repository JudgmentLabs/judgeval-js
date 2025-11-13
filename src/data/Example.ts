import { randomUUID } from "crypto";
import type { Example as APIExample } from "../internal/api/models";

export interface ExampleConfig<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  name?: string;
  properties?: TData;
  exampleId?: string;
  createdAt?: string;
}

export class Example<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  exampleId: string;
  createdAt: string;
  name?: string | null;
  private properties: TData | null;

  private constructor(config: ExampleConfig<TData> = {}) {
    this.exampleId = config.exampleId ?? randomUUID();
    this.createdAt = config.createdAt ?? new Date().toISOString();
    this.name = config.name ?? null;
    this.properties = config.properties ?? null;
  }

  static create<
    TData extends Record<string, unknown> = Record<string, unknown>,
  >(data: TData): Example<TData> {
    return new Example({
      properties: data,
    });
  }

  toModel(): APIExample {
    return {
      example_id: this.exampleId,
      created_at: this.createdAt,
      name: this.name ?? undefined,
      ...(this.properties ?? {}),
    };
  }
}
