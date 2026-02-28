function getEnvVar(varName: string): string | null;
function getEnvVar(varName: string, defaultValue: string): string;
function getEnvVar(varName: string, defaultValue?: string): string | null {
  const value = process.env[varName];
  if (!value) {
    return defaultValue ?? null;
  }
  return value;
}

export const JUDGMENT_API_KEY = getEnvVar("JUDGMENT_API_KEY");
export const JUDGMENT_ORG_ID = getEnvVar("JUDGMENT_ORG_ID");
export const JUDGMENT_API_URL = getEnvVar(
  "JUDGMENT_API_URL",
  "https://api.judgmentlabs.ai",
);
export const JUDGMENT_LOG_LEVEL = getEnvVar("JUDGMENT_LOG_LEVEL", "warn");
