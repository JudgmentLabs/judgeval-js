export interface ExperimentScorer {
    scorer_data_id: string;
    judge_id: string;
    judge_name: string;
    name: string;
    score_type: string;
    num_value: number;
    bool_value: boolean;
    str_value: string;
    score: number;
    success: number;
    reason: string | null;
    evaluation_model: string | null;
    threshold: number;
    created_at: string;
    error: string | null;
    additional_metadata: Record<string, unknown> | null;
    minimum_score_range: number;
    maximum_score_range: number;
}
//# sourceMappingURL=ExperimentScorer.d.ts.map