import type { JudgmentApiClient } from "../internal/api/client";
import { Example } from "../data/Example";
import { Dataset } from "./Dataset";
import type { DatasetInfo } from "./Dataset";

/** Creates, retrieves, and lists datasets in your project. */
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
   */
  async get(name: string): Promise<Dataset | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const response = await this._client.getV1projectsDatasetsByDatasetName(
      projectId,
      name,
    );

    const datasetKind = response.dataset_kind ?? "example";
    const rawExamples = response.examples ?? [];
    const examples = rawExamples.map((e) =>
      Example.fromDict(e as unknown as Record<string, unknown>),
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
   */
  async create(
    name: string,
    options: {
      examples?: Example[];
      overwrite?: boolean;
      batchSize?: number;
    } = {},
  ): Promise<Dataset | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const { examples = [], overwrite = false, batchSize = 100 } = options;

    await this._client.postV1projectsDatasets(projectId, {
      name,
      examples: [],
      dataset_kind: "example",
      overwrite,
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
   */
  async list(): Promise<DatasetInfo[] | null> {
    const projectId = this._expectProjectId();
    if (!projectId) return null;

    const response = await this._client.getV1projectsDatasets(projectId);

    // PullAllDatasetsResponse is DatasetInfo[] (the API type)
    const items = response as unknown as Array<Record<string, unknown>>;
    return items.map((d) => ({
      datasetId: d.dataset_id as string,
      name: d.name as string,
      createdAt: d.created_at as string,
      kind: d.kind as string,
      entries: d.entries as number,
      creator: d.creator as string,
    }));
  }

  private _expectProjectId(): string | null {
    if (!this._projectId) {
      console.error(
        "Project ID is not resolved. Dataset operations require a valid project.",
      );
      return null;
    }
    return this._projectId;
  }
}
