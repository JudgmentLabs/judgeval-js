export interface UploadCustomScorerBundleMetadata {
    scorer_name: string;
    entrypoint_path: string;
    requirements_path?: string | null;
    class_name: string;
    scorer_type?: string | null;
    response_type: string;
    version?: number | null;
    bump_major?: boolean | null;
    categories?: {
        value: string;
        description: string;
    }[] | null;
}
//# sourceMappingURL=UploadCustomScorerBundleMetadata.d.ts.map