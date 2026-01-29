import type { JudgmentApiClient } from "../internal/api";
import { Logger } from "./logger";

const cache = new Map<string, string>();

export async function resolveProjectId(
  client: JudgmentApiClient,
  projectName: string,
): Promise<string> {
  const cached = cache.get(projectName);
  if (cached) {
    return cached;
  }
  Logger.info(`Resolving project ID for project: ${projectName}`);
  const response = await client.projectsResolve({ project_name: projectName });
  const projectId = response.project_id;
  if (!projectId) {
    throw new Error(`Project ID not found for project: ${projectName}`);
  }
  Logger.info(`Resolved project ID: ${projectId}`);
  cache.set(projectName, projectId);
  return projectId;
}
