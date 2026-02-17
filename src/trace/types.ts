export interface LLMMetadata {
  non_cached_input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  total_cost_usd?: number;
}

export interface TracerConfig {
  projectName?: string;
  apiKey?: string;
  organizationId?: string;
  apiUrl?: string;
  environment?: string;
  setActive?: boolean;
  serializer?: (value: unknown) => string;
  resourceAttributes?: Record<string, string>;
}

export type Serializer = (value: unknown) => string;
