export type ScoreType = "binary" | "numeric" | "categorical";
export interface AgentJudge {
    judgeId: string;
    name: string;
    prompt: string;
    model: string;
    scoreType: ScoreType;
    description: string | null;
    judgeDescription: string | null;
    categories: {
        name: string;
        description: string;
    }[] | null;
    minScore: number | null;
    maxScore: number | null;
    majorVersion: number | null;
    minorVersion: number | null;
}
//# sourceMappingURL=AgentJudge.d.ts.map