import { expect, test } from "bun:test";
import createClient from "openapi-fetch";
import { JudgmentApi } from "./operations";
import type { paths } from "./schema";

test("a generated method sends its route's method, path and body", async () => {
  let sent: Request | undefined;
  const api = new JudgmentApi(
    createClient<paths>({
      baseUrl: "https://api.test",
      fetch: async (request: Request) => {
        sent = request;
        return Response.json({ project_id: "p1" });
      },
    }),
  );

  await api.createProject({ body: { project_name: "demo" } });

  expect(sent?.method).toBe("POST");
  expect(sent?.url).toBe("https://api.test/v1/projects");
  expect(await sent?.json()).toEqual({ project_name: "demo" });
});
