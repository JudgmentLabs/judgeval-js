export class OpenTelemetryKeys {
  public static readonly AttributeKeys = {
    JUDGMENT_SPAN_KIND: "judgment.span_kind",
    JUDGMENT_INPUT: "judgment.input",
    JUDGMENT_OUTPUT: "judgment.output",
  } as const;

  public static readonly ResourceKeys = {
    JUDGMENT_PROJECT_ID: "judgment.project_id",
  } as const;
}
