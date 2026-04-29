import type { JudgmentApiClient } from "../internal/api/client";

const projectIdCache = new Map<string, string>();

export async function resolveProjectId(
  client: JudgmentApiClient,
  projectName: string,
): Promise<string | null> {
  const key = `${client.getOrganizationId()}:${projectName}`;
  const cached = projectIdCache.get(key);
  if (cached) {
    return cached;
  }
  try {
    const response = await client.postV1projectsResolve({
      project_name: projectName,
    });
    const projectId = response.project_id;
    if (projectId) {
      projectIdCache.set(key, projectId);
      return projectId;
    }
  } catch (e) {
    console.error(`Failed to resolve project '${projectName}': ${String(e)}`);
  }
  return null;
}
