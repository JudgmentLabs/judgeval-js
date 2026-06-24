export interface SDKCreateAgentJudgeRequest {
    name: string;
    judge_description?: string | null;
    description?: string | null;
    model: string;
    prompt: string;
    score_type: string;
    categories?: {
        name: string;
        description: string;
    }[] | null;
    min_score?: number | null;
    max_score?: number | null;
}
//# sourceMappingURL=SDKCreateAgentJudgeRequest.d.ts.map