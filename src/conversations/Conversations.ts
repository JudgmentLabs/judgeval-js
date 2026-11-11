import { JUDGMENT_API_KEY, JUDGMENT_API_URL, JUDGMENT_ORG_ID } from "../env";
import { JudgmentApiClient } from "../internal/api";
import type { Observation } from "../internal/api/models";
import { dontThrow } from "../utils/dont-throw";
import { Logger } from "../utils/logger";
import { resolveProjectId } from "../utils/resolve-project-id";
import { BatchObservationProcessor } from "./BatchObservationProcessor";
import { ObservationExporter } from "./ObservationExporter";

/** Where {@link Conversations.record} sends calls. */
export interface ConversationsConfig {
  /** The Judgment project to record into. */
  projectName?: string;
  /** Your Judgment API key. Defaults to `JUDGMENT_API_KEY`. */
  apiKey?: string;
  /** Your organization ID. Defaults to `JUDGMENT_ORG_ID`. */
  organizationId?: string;
  /** Override the API endpoint URL. Defaults to `JUDGMENT_API_URL`. */
  apiUrl?: string;
  /**
   * The deployment environment calls run in, such as `"production"`; judges
   * can be limited to environments.
   */
  environment?: string;
}

/** Options for {@link Conversations.record}. */
export interface RecordOptions {
  /**
   * When the call completed; defaults to now. Two identical calls at
   * different times are two calls.
   */
  observedAt?: Date;
}

/**
 * Records model calls in the conversation format, without traces.
 *
 * Call `Conversations.init` once at startup, then `Conversations.record`
 * from anywhere. Each call is stored in its conversation and evaluated by
 * the project's conversation judges, as model calls recorded from traces
 * are. Nothing here throws into your code: `init` logs a warning and leaves
 * recording off when a credential is missing or the project is not found,
 * and `record` queues the call and returns at once.
 *
 * Calls are sent in the background, in batches. Await
 * `Conversations.flush()` before a serverless handler returns, and
 * `Conversations.shutdown()` before the process exits.
 *
 * @example
 * ```typescript
 * import { Conversations } from "judgeval";
 *
 * await Conversations.init({ projectName: "support-bot", environment: "production" });
 *
 * Conversations.record({
 *   conversation_id: "ticket-4812",
 *   model: "my-model-v2",
 *   input: [{ type: "message", role: "user", content: [{ type: "text", text: "Where is my order?" }] }],
 *   output: [{ type: "message", role: "assistant", content: [{ type: "text", text: "It ships today." }] }],
 * });
 * ```
 */
export class Conversations {
  private static _initialized = false;
  private static _processor: BatchObservationProcessor | null = null;
  private static _environment: string | undefined;
  private static _notInitializedReported = false;

  private constructor() {}

  /**
   * Configure where recorded calls are sent. Calling `init` again sends what
   * the previous configuration queued, then replaces it.
   *
   * @returns Resolves once configured; never rejects.
   */
  static async init(config: ConversationsConfig = {}): Promise<void> {
    try {
      const projectName = config.projectName;
      const apiKey = config.apiKey ?? JUDGMENT_API_KEY;
      const organizationId = config.organizationId ?? JUDGMENT_ORG_ID;
      const apiUrl = config.apiUrl ?? JUDGMENT_API_URL;
      let processor: BatchObservationProcessor | null = null;
      if (projectName && apiKey && organizationId && apiUrl) {
        const client = new JudgmentApiClient(apiUrl, apiKey, organizationId);
        const projectId = await resolveProjectId(client, projectName).catch(
          () => null,
        );
        if (projectId === null) {
          Logger.warning(
            `Project '${projectName}' not found. Conversations will not record observations.`,
          );
        } else {
          processor = new BatchObservationProcessor(
            new ObservationExporter(client, projectId),
          );
        }
      } else {
        const missing = Object.entries({
          projectName,
          apiKey,
          organizationId,
          apiUrl,
        })
          .filter(([, value]) => !value)
          .map(([name]) => name);
        Logger.warning(
          `${missing.join(", ")} not provided. Conversations will not record observations.`,
        );
      }
      const previous = Conversations._processor;
      Conversations._initialized = true;
      Conversations._processor = processor;
      Conversations._environment = config.environment;
      await previous?.shutdown();
    } catch (error) {
      Logger.error(`[Conversations] init failed: ${String(error)}`);
    }
  }

  /**
   * Queue one model call to be sent to Judgment.
   *
   * @param observation - The call, in the conversation format: its
   *   `conversation_id`, `input` (everything the model was given, including
   *   history from earlier calls), and optionally its `output`, `tools`,
   *   `model`, `usage`, and more.
   * @param options - When the call was observed.
   */
  static record(observation: Observation, options: RecordOptions = {}): void {
    dontThrow("Conversations.record", () => {
      if (!Conversations._initialized) {
        if (!Conversations._notInitializedReported) {
          Conversations._notInitializedReported = true;
          Logger.warning(
            "[Conversations] Conversations.init() was not called; observations are not recorded",
          );
        }
        return;
      }
      Conversations._processor?.emit({
        // Sent later, so copy it: changes the caller makes afterwards, such
        // as appending to a shared message history, are not sent.
        observation: structuredClone(observation),
        observed_at: (options.observedAt ?? new Date()).toISOString(),
        environment: Conversations._environment,
      });
    });
  }

  /**
   * Send every queued call now.
   *
   * @returns Resolves once every queued call was sent or dropped; never
   *   rejects.
   */
  static async flush(): Promise<void> {
    await Conversations._processor?.forceFlush();
  }

  /**
   * Send queued calls, then stop recording. Calls recorded afterwards are
   * ignored until `init` is called again.
   */
  static async shutdown(): Promise<void> {
    await Conversations._processor?.shutdown();
  }
}
