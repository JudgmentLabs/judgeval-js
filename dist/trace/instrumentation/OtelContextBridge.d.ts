import { type Context } from "@opentelemetry/api";
export declare function installOtelContextBridge(getCurrentJudgmentContext: () => Context): void;
export declare function runWithOtelBridgeGate<T>(ctx: Context, fn: () => T): T;
//# sourceMappingURL=OtelContextBridge.d.ts.map