import type { JudgmentApiClient } from "../internal/api/client";
import type { PullAllOfflineDatasetsResponse } from "../internal/api/models";
import { Example, type ExampleDict } from "../data/Example";
import { Logger } from "../utils/logger";
import { Dataset } from "./Dataset";
import {
  type DatasetSchema,
  inferSchemaFromExamples,
  validateDatasetSchema,
} from "./schema";

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
export class DatasetFactory {
  private readonly _client: JudgmentApiClient;
  private readonly _projectId: string | null;
  private readonly _projectName: string;

  constructor(
    client: JudgmentApiClient,
    projectId: string | null,
    projectName: string,
  ) {
    this._client = client;
    this._projectId = projectId;
    this._projectName = projectName;
  }

  /**
   * Retrieve a dataset by name, including all its examples.
   *
   * @param name - The dataset name.
   * @returns The dataset with all examples hydrated, or `null` if the project is unresolved.
   */
  async get(name: string): Promise<Dataset | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const response =
      await this._client.getV1projectsDatasetsByDatasetIdentifier(
        projectId,
        name,
      );

    const datasetKind = response.dataset_kind ?? "example";
    // Offline datasets nest the user fields under `data` and carry server
    // metadata (organization_id, project_id, user_id) at the top level. Unwrap
    // `data` so user properties (input, etc.) become the Example's properties —
    // otherwise `example.get("input")` is undefined and the metadata / the
    // nested `data` object leak into properties.
    const examples = (response.examples ?? []).map((e) =>
      Example.from({
        ...(e.data ?? {}),
        example_id: e.example_id,
        created_at: e.created_at ?? "",
      } as ExampleDict),
    );

    return new Dataset({
      name,
      projectId,
      projectName: this._projectName,
      datasetKind,
      examples,
      client: this._client,
    });
  }

  /**
   * Create a new dataset, optionally pre-populated with examples.
   *
   * @param name - The dataset name.
   * @param options.examples - Examples to upload after creation.
   * @param options.overwrite - If `true`, overwrite an existing dataset with the same name.
   * @param options.batchSize - Number of examples per batch upload request. Defaults to 100.
   * @returns The newly created dataset, or `null` if the project is unresolved.
   */
  async create(
    name: string,
    options: {
      examples?: Example[];
      overwrite?: boolean;
      batchSize?: number;
      schema?: DatasetSchema;
    } = {},
  ): Promise<Dataset | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const {
      examples = [],
      overwrite = false,
      batchSize = 100,
      schema,
    } = options;

    let resolvedSchema: DatasetSchema;
    if (schema !== undefined) {
      validateDatasetSchema(schema);
      resolvedSchema = schema;
    } else {
      if (examples.length === 0) {
        throw new Error(
          "Datasets require a JSON Schema. Pass `schema` to create(), or provide `examples` to infer one.",
        );
      }
      resolvedSchema = inferSchemaFromExamples(examples);
    }

    await this._client.postV1projectsDatasets(projectId, {
      name,
      examples: [],
      dataset_kind: "example",
      overwrite,
      schema: resolvedSchema as unknown as Record<string, unknown>,
    });

    const dataset = new Dataset({
      name,
      projectId,
      projectName: this._projectName,
      examples,
      client: this._client,
    });

    if (examples.length > 0) {
      await dataset.addExamples(examples, batchSize);
    }

    return dataset;
  }

  /**
   * List all datasets in the project.
   *
   * @returns An array of dataset metadata, or `null` if the project is unresolved.
   */
  list(): Promise<PullAllOfflineDatasetsResponse | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return Promise.resolve(null);

    return this._client.getV1projectsDatasets(projectId);
  }

  private _expectProjectId(): string | null {
    if (!this._projectId) {
      Logger.error(
        "Project ID is not resolved. Dataset operations require a valid project.",
      );
      return null;
    }
    return this._projectId;
  }
}
