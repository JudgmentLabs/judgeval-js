import type { JudgmentApiClient } from "../internal/api/client";
import type { DatasetInfo } from "../internal/api/models/DatasetInfo";
import { Example } from "../data/Example";
import { Dataset } from "./Dataset";
/**
 * Creates, retrieves, and lists datasets in your project.
 *
 * Access via `client.datasets`.
 *
 * @example
 * ```typescript
 * const datasets = await client.datasets.list();
 * const dataset = await client.datasets.get("golden-set");
 * ```
 */
export declare class DatasetFactory {
    private readonly _client;
    private readonly _projectId;
    private readonly _projectName;
    constructor(client: JudgmentApiClient, projectId: string | null, projectName: string);
    /**
     * Retrieve a dataset by name, including all its examples.
     *
     * @param name - The dataset name.
     * @returns The dataset with all examples hydrated, or `null` if the project is unresolved.
     */
    get(name: string): Promise<Dataset | null>;
    /**
     * Create a new dataset, optionally pre-populated with examples.
     *
     * @param name - The dataset name.
     * @param options.examples - Examples to upload after creation.
     * @param options.overwrite - If `true`, overwrite an existing dataset with the same name.
     * @param options.batchSize - Number of examples per batch upload request. Defaults to 100.
     * @returns The newly created dataset, or `null` if the project is unresolved.
     */
    create(name: string, options?: {
        examples?: Example[];
        overwrite?: boolean;
        batchSize?: number;
    }): Promise<Dataset | null>;
    /**
     * List all datasets in the project.
     *
     * @returns An array of dataset metadata, or `null` if the project is unresolved.
     */
    list(): Promise<DatasetInfo[] | null>;
    private _expectProjectId;
}
//# sourceMappingURL=DatasetFactory.d.ts.map