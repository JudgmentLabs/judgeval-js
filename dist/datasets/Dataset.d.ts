import type { JudgmentApiClient } from "../internal/api/client";
import { Example } from "../data/Example";
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
export declare class Dataset {
    readonly name: string;
    readonly projectId: string;
    readonly projectName: string;
    readonly datasetKind: string;
    readonly examples: Example[];
    private readonly _client;
    constructor(opts: {
        name: string;
        projectId: string;
        projectName: string;
        datasetKind?: string;
        examples?: Example[];
        client?: JudgmentApiClient | null;
    });
    /**
     * Upload examples to this dataset in batches.
     *
     * @param examples - The examples to upload.
     * @param batchSize - Number of examples per batch request. Defaults to 100.
     */
    addExamples(examples: Example[], batchSize?: number): Promise<void>;
    /**
     * Load examples from a JSON file and add them to the dataset.
     *
     * Expects the file to contain a JSON array of objects, each with
     * properties like `input`, `actual_output`, etc.
     *
     * @param filePath - Path to the JSON file.
     * @param batchSize - Number of examples per batch request. Defaults to 100.
     */
    addFromJson(filePath: string, batchSize?: number): Promise<void>;
    /** Number of examples in this dataset. */
    get length(): number;
    /** Iterate over examples. */
    [Symbol.iterator](): Iterator<Example>;
    toString(): string;
}
//# sourceMappingURL=Dataset.d.ts.map