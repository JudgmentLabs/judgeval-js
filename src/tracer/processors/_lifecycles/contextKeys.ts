import { createContextKey } from "@opentelemetry/api";
import { AttributeKeys } from "../../../judgmentAttributeKeys";

export const CUSTOMER_ID_KEY = createContextKey(
  AttributeKeys.JUDGMENT_CUSTOMER_ID,
);
export const SESSION_ID_KEY = createContextKey(
  AttributeKeys.JUDGMENT_SESSION_ID,
);
