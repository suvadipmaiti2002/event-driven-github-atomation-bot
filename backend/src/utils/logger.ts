type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export class SimpleLogger {
  constructor(private moduleName: string = "App") {}

  private format(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    let metaStr = "";

    if (meta !== undefined && meta !== null) {
      if (meta instanceof Error) {
        metaStr = ` | Error: ${meta.message}`;
      } else if (typeof meta === "object") {
        // Redact secrets if any exist in the metadata
        const safeMeta: Record<string, any> = { ...meta };
        for (const key of Object.keys(safeMeta)) {
          if (/token|secret|password|authorization|cookie/i.test(key)) {
            safeMeta[key] = "[REDACTED]";
          }
        }
        metaStr = ` | ${JSON.stringify(safeMeta)}`;
      } else {
        metaStr = ` | ${meta}`;
      }
    }

    return `[${timestamp}] [${level.padEnd(5)}] [${this.moduleName}] ${message}${metaStr}`;
  }

  private parseArgs(arg1: any, arg2?: any): { message: string; meta?: any } {
    if (typeof arg1 === "string") {
      return { message: arg1, meta: arg2 };
    }
    if (typeof arg2 === "string") {
      return { message: arg2, meta: arg1 };
    }
    if (arg1 instanceof Error) {
      return { message: arg1.message, meta: arg1 };
    }
    return { message: JSON.stringify(arg1), meta: arg2 };
  }

  info(arg1: any, arg2?: any) {
    const { message, meta } = this.parseArgs(arg1, arg2);
    console.log(this.format("INFO", message, meta));
  }

  warn(arg1: any, arg2?: any) {
    const { message, meta } = this.parseArgs(arg1, arg2);
    console.warn(this.format("WARN", message, meta));
  }

  error(arg1: any, arg2?: any) {
    const { message, meta } = this.parseArgs(arg1, arg2);
    console.error(this.format("ERROR", message, meta));
    const err = meta?.err || meta?.error || (meta instanceof Error ? meta : null);
    if (err?.stack) {
      console.error(err.stack);
    }
  }

  fatal(arg1: any, arg2?: any) {
    this.error(arg1, arg2);
  }

  debug(arg1: any, arg2?: any) {
    const { message, meta } = this.parseArgs(arg1, arg2);
    console.log(this.format("DEBUG", message, meta));
  }

  child(metaOrModuleName: string | Record<string, any>) {
    if (typeof metaOrModuleName === "string") {
      return new SimpleLogger(metaOrModuleName);
    }
    return new SimpleLogger(metaOrModuleName.module || this.moduleName);
  }
}

export const logger = new SimpleLogger("Server");
export const createChildLogger = (moduleName: string, _meta: Record<string, any> = {}) => {
  return new SimpleLogger(moduleName);
};
