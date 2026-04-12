import type { JudgmentApiClient } from "../internal/api";
import { Logger } from "./logger";
import { retry } from "./retry";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export async function resolveProjectId(
  client: JudgmentApiClient,
  projectName: string,
): Promise<string> {
  const cacheKey = `org:${client.getOrganizationId()}:project:${projectName}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const pending = inflight.get(cacheKey);
  if (pending) {
    return pending;
  }
  const request = (async (): Promise<string> => {
    Logger.info(`Resolving project ID for project: ${projectName}`);
    const projectId = await retry(
      async () => {
        const response = await client.postV1projectsResolve({
          project_name: projectName,
        });
        const id = response.project_id;
        if (!id) {
          throw new Error(`Project ID not found for project: ${projectName}`);
        }
        return id;
      },
      {
        maxRetries: 3,
        backoff: (iteration) => iteration * 1000,
        onRetry: (attempt, error) => {
          Logger.warning(
            `Failed to resolve project ID for '${projectName}' (attempt ${attempt}): ${String(error)}`,
          );
        },
      },
    );
    Logger.info(`Resolved project ID: ${projectId}`);
    cache.set(cacheKey, projectId);
    return projectId;
  })();
  inflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inflight.delete(cacheKey);
  }
}
