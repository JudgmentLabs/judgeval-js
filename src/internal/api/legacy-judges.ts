// Request/response shapes of the flat agent-judge routes removed from /v1 in
// judgment-mono#4302. The new /judges routes take a different body (JUD-10954).

export interface SDKCreateAgentJudgeRequest {
  name: string;
  judge_description?: string | null;
  description?: string | null;
  model: string;
  prompt: string;
  score_type: string;
  categories?: { name: string; description: string }[] | null;
  min_score?: number | null;
  max_score?: number | null;
}

export interface SDKCreateAgentJudgeResponse {
  judge_id: string;
}

export interface SDKUpdateAgentJudgeRequest {
  judge_description?: string | null;
  score_type?: string | null;
  description?: string | null;
  model?: string | null;
  prompt?: string | null;
  categories?: { name: string; description: string }[] | null;
  min_score?: number | null;
  max_score?: number | null;
  target_major_version?: number | null;
  target_minor_version?: number | null;
  source_major_version?: number | null;
  source_minor_version?: number | null;
}

export interface SDKUpdateAgentJudgeResponse {
  judge: {
    id: string;
    name: string;
    judge_description: string | null;
    method: string;
    output: string;
    last_updated: string;
    score_type: string;
    behaviors: string[];
    model?: string | null;
    prompt?: string | null;
    description?: string | null;
    categories?: { name: string; description: string }[] | null;
    min_score?: number | null;
    max_score?: number | null;
    major_version?: number | null;
    minor_version?: number | null;
    prod_version?: { major: number; minor: number } | null;
    code?: string | null;
    dependencies?: string | null;
    prompts?: {
      name: string;
      description: string | null;
      prompt: string;
      position: number;
      updated_at: string;
    }[];
    custom_scorer_id?: string | null;
    entrypoint_path?: string | null;
    requirements_path?: string | null;
    online_evaluation_mode?: string | null;
    online_sampling_rate?: number | null;
    online_span_triggers?: {
      field: string;
      operator: string;
      value: string;
      key?: string | null;
      values?: string[] | null;
    }[];
    online_session_scoring?: boolean | null;
    versions: {
      major_version: number;
      minor_version: number;
      model: string | null;
      prompt: string | null;
      description: string | null;
      categories?: { name: string; description: string }[] | null;
      min_score: number;
      max_score: number;
      tags: string[];
      created_at: string;
      prompts?: {
        name: string;
        description: string | null;
        prompt: string;
        position: number;
        updated_at: string;
      }[];
      custom_scorer_id?: string | null;
    }[];
  };
}
