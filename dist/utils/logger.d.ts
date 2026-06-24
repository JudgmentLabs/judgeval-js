/**
 * SDK logger with configurable levels and color output.
 *
 * Log level is controlled by the `JUDGMENT_LOG_LEVEL` environment variable.
 * Defaults to "warn". Supported levels: "debug", "info", "warning", "error", "critical".
 *
 * @example
 * ```typescript
 * import { Logger } from "judgeval";
 *
 * Logger.setLevel("debug");
 * Logger.info("Tracer initialized");
 * ```
 */
export declare class Logger {
    private static readonly RESET;
    private static readonly RED;
    private static readonly YELLOW;
    private static readonly GRAY;
    static Level: {
        readonly DEBUG: 0;
        readonly INFO: 1;
        readonly WARNING: 2;
        readonly ERROR: 3;
        readonly CRITICAL: 4;
    };
    private static initialized;
    private static levelSetManually;
    private static currentLevel;
    private static useColor;
    private static initialize;
    /** Set the minimum log level. */
    static setLevel(level: number): void;
    /** Enable or disable colored output. */
    static setUseColor(useColor: boolean): void;
    private static log;
    /** Log a debug message. */
    static debug(message: string): void;
    /** Log an informational message. */
    static info(message: string): void;
    /** Log a warning message. */
    static warning(message: string): void;
    static warn(message: string): void;
    /** Log an error message. */
    static error(message: string): void;
    /** Log a critical error message. */
    static critical(message: string): void;
}
//# sourceMappingURL=logger.d.ts.map