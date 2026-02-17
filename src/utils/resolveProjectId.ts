import type { JudgmentApiClient } from "../internal/api";
import { Logger } from "./logger";

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
    const response = await client.projectsResolve({ project_name: projectName });
    const projectId = response.project_id;
    if (!projectId) {
      throw new Error(`Project ID not found for project: ${projectName}`);
    }
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
