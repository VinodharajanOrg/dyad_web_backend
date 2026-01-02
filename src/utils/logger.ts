/**
 * Centralized logging utility for backend services
 * Supports structured logging with multiple transports (console, file, external services)
 * Compatible with observability platforms like Splunk, Grafana Loki, Tempo, etc.
 */
console.log(">>> LOG_FORMAT =", process.env.LOG_FORMAT);

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

export interface LogContext {
    service?: string;
    appId?: string;
    containerId?: string;
    engine?: string;
    userId?: string;
    requestId?: string;
    sessionId?: string;
    [key: string]: any;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    metadata?: Record<string, any>;
}

export interface LogTransport {
    log(entry: LogEntry): void | Promise<void>;
}

/**
 * Console transport - outputs to stdout/stderr with pretty formatting
 */
class ConsoleTransport implements LogTransport {
    private colors = {
        debug: '\x1b[36m',    // Cyan
        info: '\x1b[32m',     // Green
        warn: '\x1b[33m',     // Yellow
        error: '\x1b[31m',    // Red
        reset: '\x1b[0m',     // Reset
        bold: '\x1b[1m',      // Bold
        dim: '\x1b[2m',       // Dim
        gray: '\x1b[90m',     // Gray
        blue: '\x1b[34m',     // Blue
        magenta: '\x1b[35m',  // Magenta
        cyan: '\x1b[36m',     // Cyan (same as debug)
    };

    private formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ms = date.getMilliseconds().toString().padStart(3, '0');
        return `${this.colors.dim}${hours}:${minutes}:${seconds}.${ms}${this.colors.reset}`;
    }

    private formatLevel(level: LogLevel): string {
        const color = this.colors[level];
        const levelStr = level.toUpperCase().padEnd(5);
        return `${color}${levelStr}${this.colors.reset}`;
    }

    private formatContext(context?: LogContext): string {
        if (!context || Object.keys(context).length === 0) return '';

        const parts: string[] = [];

        // Highlight important fields
        if (context.service) {
            parts.push(`${this.colors.blue}${context.service}${this.colors.reset}`);
        }
        if (context.appId) {
            parts.push(`${this.colors.magenta}app:${context.appId}${this.colors.reset}`);
        }
        if (context.requestId) {
            parts.push(`${this.colors.gray}req:${context.requestId.slice(0, 8)}${this.colors.reset}`);
        }
        if (context.engine) {
            parts.push(`${this.colors.cyan}${context.engine}${this.colors.reset}`);
        }

        // Add remaining context as pretty JSON
        const remaining = Object.keys(context).filter(
            key => !['service', 'appId', 'requestId', 'engine'].includes(key)
        );

        if (remaining.length > 0) {
            const extra = remaining.reduce((acc, key) => {
                acc[key] = context[key];
                return acc;
            }, {} as Record<string, any>);

            const prettyJson = JSON.stringify(extra, null, 2)
                .split('\n')
                .map(line => `${this.colors.gray}${line}${this.colors.reset}`)
                .join('\n  ');

            parts.push(`\n  ${prettyJson}`);
        }

        return parts.length > 0 ? ` ${this.colors.dim}[${parts.join(' ')}]${this.colors.reset}` : '';
    }

    private formatMetadata(metadata?: Record<string, any>): string {
        if (!metadata || Object.keys(metadata).length === 0) return '';

        const formatted = JSON.stringify(metadata, null, 2)
            .split('\n')
            .map(line => `${this.colors.gray}${line}${this.colors.reset}`)
            .join('\n  ');

        return `\n  ${this.colors.dim}Metadata:${this.colors.reset}\n  ${formatted}`;
    }

    log(entry: LogEntry): void {
        const timestamp = this.formatTimestamp(entry.timestamp);
        const level = this.formatLevel(entry.level);
        const context = this.formatContext(entry.context);
        const message = `${this.colors.bold}${entry.message}${this.colors.reset}`;
        const metadata = this.formatMetadata(entry.metadata);

        const output = `${timestamp} ${level} ${message}${context}${metadata}`;

        if (entry.level === LogLevel.ERROR) {
            console.error(output);
            if (entry.error?.stack) {
                const stackLines = entry.error.stack.split('\n');
                console.error(`${this.colors.dim}${stackLines[0]}${this.colors.reset}`);
                stackLines.slice(1).forEach(line => {
                    console.error(`  ${this.colors.gray}${line.trim()}${this.colors.reset}`);
                });
            }
        } else {
            console.log(output);
        }
    }
}

/**
 * JSON transport - outputs structured JSON logs
 * Ideal for log aggregation systems like Splunk, ELK, Loki
 */
class JSONTransport implements LogTransport {
    log(entry: LogEntry): void {
        console.log(JSON.stringify(entry));
    }
}

/**
 * HTTP transport - sends logs to external observability platform
 * Configure endpoint via environment variables
 */
class HTTPTransport implements LogTransport {
    private endpoint: string;
    private headers: Record<string, string>;
    private batchSize: number;
    private batchTimeout: number;
    private batch: LogEntry[] = [];
    private timer?: NodeJS.Timeout;

    constructor(config: {
        endpoint: string;
        headers?: Record<string, string>;
        batchSize?: number;
        batchTimeout?: number;
    }) {
        this.endpoint = config.endpoint;
        this.headers = config.headers || { 'Content-Type': 'application/json' };
        this.batchSize = config.batchSize || 100;
        this.batchTimeout = config.batchTimeout || 5000;
    }

    log(entry: LogEntry): void {
        this.batch.push(entry);

        if (this.batch.length >= this.batchSize) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.batchTimeout);
        }
    }

    private async flush(): Promise<void> {
        if (this.batch.length === 0) return;

        const logs = [...this.batch];
        this.batch = [];

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        try {
            const payload = logs
                .map(entry => JSON.stringify({
                    time: Date.now() / 1000,
                    host: "localhost",
                    source: "nodejs-app",
                    sourcetype: "_json",
                    index: "main",
                    event: entry
                }))
                .join('\n')

            // await fetch(this.endpoint, {
            //     method: 'POST',
            //     headers: this.headers,
            //     body: payload,
            // });
        } catch (error) {
            console.error('Failed to send logs to Splunk HEC:', error);
        }
    }

}
/**
 * Main Logger class
 */
class Logger {
    private transports: LogTransport[] = [];
    private defaultContext: LogContext = {};
    private minLevel: LogLevel = LogLevel.INFO;

    constructor() {
        this.initializeFromEnv();
    }

    private initializeFromEnv(): void {
        const logFormat = process.env.LOG_FORMAT || 'console';
        const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;

        this.minLevel = logLevel;

        // Add console or JSON transport
        if (logFormat === 'json') {
            this.transports.push(new JSONTransport());
        } else {
            this.transports.push(new ConsoleTransport());
        }

        // Add HTTP transport if configured
        const httpEndpoint = process.env.LOG_HTTP_ENDPOINT;
        if (httpEndpoint) {
            this.transports.push(new HTTPTransport({
                endpoint: httpEndpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': process.env.LOG_HTTP_AUTH || '',
                },
            }));
        }
    }

    /**
     * Set default context that will be included in all logs
     */
    setDefaultContext(context: LogContext): void {
        this.defaultContext = { ...this.defaultContext, ...context };
    }

    /**
     * Add a custom transport
     */
    addTransport(transport: LogTransport): void {
        this.transports.push(transport);
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentIndex = levels.indexOf(this.minLevel);
        const requestedIndex = levels.indexOf(level);
        return requestedIndex >= currentIndex;
    }

    private log(level: LogLevel, message: string, context?: LogContext, metadata?: Record<string, any>, error?: Error): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: { ...this.defaultContext, ...context },
            metadata,
        };

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }

        for (const transport of this.transports) {
            try {
                transport.log(entry);
            } catch (err) {
                console.error('Logger transport error:', err);
            }
        }
    }

    debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, context, metadata);
    }

    info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context, metadata);
    }

    warn(message: string, context?: LogContext, metadata?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context, metadata);
    }

    error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, context, metadata, error);
    }

    /**
     * Create a child logger with preset context
     */
    child(context: LogContext): Logger {
        const childLogger = new Logger();
        childLogger.setDefaultContext({ ...this.defaultContext, ...context });
        childLogger.transports = this.transports;
        childLogger.minLevel = this.minLevel;
        return childLogger;
    }
}

// Export singleton instance
export const logger = new Logger();

// Export Logger class for creating custom instances
export { Logger };
