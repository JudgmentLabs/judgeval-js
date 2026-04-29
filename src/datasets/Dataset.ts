import type { JudgmentApiClient } from "../internal/api/client";
import { Example } from "../data/Example";

/**
 * A collection of `Example` objects stored on the Judgment platform.
 *
 * Supports adding examples individually or from JSON files,
 * and iterating over the examples.
 */
export class Dataset {
  readonly name: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly datasetKind: string;
  readonly examples: Example[];
  private readonly _client: JudgmentApiClient | null;

  constructor(opts: {
    name: string;
    projectId: string;
    projectName: string;
    datasetKind?: string;
    examples?: Example[];
    client?: JudgmentApiClient | null;
  }) {
    this.name = opts.name;
    this.projectId = opts.projectId;
    this.projectName = opts.projectName;
    this.datasetKind = opts.datasetKind ?? "example";
    this.examples = opts.examples ?? [];
    this._client = opts.client ?? null;
  }

  /**
   * Upload examples to this dataset in batches.
   */
  async addExamples(
    examples: Example[],
    batchSize: number = 100,
  ): Promise<void> {
    if (!this._client) return;

    for (let i = 0; i < examples.length; i += batchSize) {
      const batch = examples.slice(i, i + batchSize);
      await this._client.postV1projectsDatasetsByDatasetNameExamples(
        this.projectId,
        this.name,
        { examples: batch.map((e) => e.toDict()) },
      );
    }
  }

  /**
   * Load examples from a JSON file and add them to the dataset.
   *
   * Expects the file to contain a JSON array of objects, each with
   * properties like `input`, `actual_output`, etc.
   */
  async addFromJson(filePath: string, batchSize: number = 100): Promise<void> {
    const fs = await import("fs");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data: unknown[] = JSON.parse(raw);

    const examples: Example[] = data.map((item) => {
      if (typeof item === "object" && item !== null) {
        return Example.fromDict(item as Record<string, unknown>);
      }
      throw new Error("Each item in the JSON array must be an object");
    });

    await this.addExamples(examples, batchSize);
  }

  /** Number of examples in this dataset. */
  get length(): number {
    return this.examples.length;
  }

  /** Iterate over examples. */
  [Symbol.iterator](): Iterator<Example> {
    return this.examples[Symbol.iterator]();
  }

  toString(): string {
    return `Dataset(name=${this.name}, examples=${this.examples.length})`;
  }
}
