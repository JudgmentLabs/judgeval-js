import { Example as ExampleModel } from "../internal/api/models/Example";

export type Example<
  T extends Record<string, unknown> = Record<string, unknown>,
> = ExampleModel & T;

export function Example<T extends Record<string, unknown>>(
  properties: T,
): Example<T> {
  const example: Example<T> = {
    example_id: undefined,
    created_at: new Date().toISOString(),
    name: null,
    ...properties,
  } as Example<T>;

  return example;
}
