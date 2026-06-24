export interface SDKUpdateAgentJudgeRequest {
    judge_description?: string | null;
    description?: string | null;
    model?: string | null;
    prompt?: string | null;
    score_type?: string | null;
    categories?: {
        name: string;
        description: string;
    }[] | null;
    min_score?: number | null;
    max_score?: number | null;
    target_major_version?: number | null;
    target_minor_version?: number | null;
    source_major_version?: number | null;
    source_minor_version?: number | null;
}
//# sourceMappingURL=SDKUpdateAgentJudgeRequest.d.ts.map