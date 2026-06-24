export interface PromptScorer {
    id: string;
    user_id: string;
    organization_id: string;
    name: string;
    prompt: string;
    model: string;
    options?: Record<string, unknown> | null;
    description?: string | null;
    created_at: string | null;
    updated_at: string | null;
    is_trace?: boolean | null;
}
//# sourceMappingURL=PromptScorer.d.ts.map