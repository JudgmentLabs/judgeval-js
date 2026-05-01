import type { JudgmentApiClient } from "../internal/api/client";
import { Example, type ExampleDict } from "../data/Example";

/**
 * A collection of {@link Example} objects stored on the Judgment platform.
 *
 * Datasets are retrieved via {@link DatasetFactory.get} or created via
 * {@link DatasetFactory.create}. Once obtained, you can iterate over
 * the examples directly, or add new ones.
 *
 * @example
 * ```typescript
 * const dataset = await client.datasets.get("golden-set");
 * for (const example of dataset) {
 *   console.log(example.get("input"));
 * }
 * ```
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
   *
   * @param examples - The examples to upload.
   * @param batchSize - Number of examples per batch request. Defaults to 100.
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
        { examples: batch.map((e) => e.toJSON()) },
      );
    }
  }

  /**
   * Load examples from a JSON file and add them to the dataset.
   *
   * Expects the file to contain a JSON array of objects, each with
   * properties like `input`, `actual_output`, etc.
   *
   * @param filePath - Path to the JSON file.
   * @param batchSize - Number of examples per batch request. Defaults to 100.
   */
  async addFromJson(filePath: string, batchSize: number = 100): Promise<void> {
    const fs = await import("fs");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data: unknown[] = JSON.parse(raw);

    const examples: Example[] = data.map((item) => {
      if (typeof item !== "object" || item === null) {
        throw new Error("Each item in the JSON array must be an object");
      }
      return Example.from(item as ExampleDict);
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
