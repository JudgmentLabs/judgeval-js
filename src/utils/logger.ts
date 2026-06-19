type WritableStreamLike = {
  isTTY?: boolean;
  write?: (message: string) => void;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
  stderr?: WritableStreamLike;
  stdout?: WritableStreamLike;
};

function getProcess(): ProcessLike | undefined {
  return (globalThis as typeof globalThis & { process?: ProcessLike }).process;
}

function getEnvVar(name: string, defaultValue: string): string {
  return getProcess()?.env?.[name] ?? defaultValue;
}

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
export class Logger {
  private static readonly RESET = "\x1b[0m";
  private static readonly RED = "\x1b[31m";
  private static readonly YELLOW = "\x1b[33m";
  private static readonly GRAY = "\x1b[90m";

  public static Level = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    CRITICAL: 4,
  } as const;

  private static initialized = false;
  private static levelSetManually = false;
  private static currentLevel: number = Logger.Level.WARNING;
  private static useColor = true;

  private static initialize(): void {
    if (!Logger.initialized) {
      const proc = getProcess();
      const noColor = proc?.env?.JUDGMENT_NO_COLOR;
      Logger.useColor = !noColor && proc?.stdout?.isTTY === true;

      if (!Logger.levelSetManually) {
        const logLevel = getEnvVar("JUDGMENT_LOG_LEVEL", "warn").toLowerCase();
        if (logLevel) {
          const levelMap: Record<string, number> = {
            debug: Logger.Level.DEBUG,
            info: Logger.Level.INFO,
            warning: Logger.Level.WARNING,
            warn: Logger.Level.WARNING,
            error: Logger.Level.ERROR,
            critical: Logger.Level.CRITICAL,
          };
          Logger.currentLevel = levelMap[logLevel] ?? Logger.Level.WARNING;
        }
      }

      Logger.initialized = true;
    }
  }

  /** Set the minimum log level. */
  public static setLevel(level: number): void {
    Logger.currentLevel = level;
    Logger.levelSetManually = true;
  }

  /** Enable or disable colored output. */
  public static setUseColor(useColor: boolean): void {
    Logger.useColor = useColor;
  }

  private static log(level: number, message: string): void {
    Logger.initialize();

    if (level < Logger.currentLevel) {
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    const levelName =
      Object.keys(Logger.Level).find(
        (key) => Logger.Level[key as keyof typeof Logger.Level] === level,
      ) ?? "UNKNOWN";
    let formattedMessage = `${timestamp} - judgeval - ${levelName} - ${message}`;

    if (Logger.useColor) {
      const color =
        level === Logger.Level.DEBUG || level === Logger.Level.INFO
          ? Logger.GRAY
          : level === Logger.Level.WARNING
            ? Logger.YELLOW
            : Logger.RED;
      formattedMessage = `${color}${formattedMessage}${Logger.RESET}`;
    }

    const proc = getProcess();
    const output = level >= Logger.Level.ERROR ? proc?.stderr : proc?.stdout;
    if (output?.write) {
      output.write(formattedMessage + "\n");
      return;
    }

    if (level >= Logger.Level.ERROR) {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  /** Log a debug message. */
  public static debug(message: string): void {
    Logger.log(Logger.Level.DEBUG, message);
  }

  /** Log an informational message. */
  public static info(message: string): void {
    Logger.log(Logger.Level.INFO, message);
  }

  /** Log a warning message. */
  public static warning(message: string): void {
    Logger.log(Logger.Level.WARNING, message);
  }

  public static warn(message: string): void {
    Logger.log(Logger.Level.WARNING, message);
  }

  /** Log an error message. */
  public static error(message: string): void {
    Logger.log(Logger.Level.ERROR, message);
  }

  /** Log a critical error message. */
  public static critical(message: string): void {
    Logger.log(Logger.Level.CRITICAL, message);
  }
}
