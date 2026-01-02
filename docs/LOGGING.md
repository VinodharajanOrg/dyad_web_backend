# Centralized Logging System

This document describes the centralized logging system used across the Dyad backend services.

## Overview

The logging system provides:
- Structured logging with consistent format
- Multiple transport options (Console, JSON, HTTP)
- Integration with observability platforms (Splunk, Grafana, etc.)
- Contextual logging with metadata
- Log level filtering
- Child loggers for scoped contexts

## Architecture

### Logger Class
Located in `src/utils/logger.ts`, the logger provides a singleton instance with support for:
- Multiple log levels (debug, info, warn, error)
- Contextual metadata
- Multiple transports
- Child loggers with inherited context

### Log Levels
```typescript
enum LogLevel {
    DEBUG = 'debug',  // Detailed debugging information
    INFO = 'info',    // General informational messages
    WARN = 'warn',    // Warning messages
    ERROR = 'error',  // Error messages with stack traces
}
```

### Log Entry Structure
```typescript
interface LogEntry {
    timestamp: string;           // ISO 8601 timestamp
    level: LogLevel;            // Log severity level
    message: string;            // Human-readable message
    context?: LogContext;       // Contextual metadata
    error?: {                   // Error details (for error level)
        name: string;
        message: string;
        stack?: string;
    };
    metadata?: Record<string, any>;  // Additional metadata
}
```

### Log Context
```typescript
interface LogContext {
    service?: string;      // Service name (e.g., 'container-startup', 'podman')
    appId?: string;        // Application ID
    containerId?: string;  // Container ID
    engine?: string;       // Container engine (docker, podman, etc.)
    userId?: string;       // User identifier
    requestId?: string;    // Request tracking ID
    sessionId?: string;    // Session identifier
    [key: string]: any;    // Custom context fields
}
```

## Configuration

### Environment Variables

```bash
# Log level - controls minimum severity to log
LOG_LEVEL=info  # Options: debug, info, warn, error

# Log format - output format
LOG_FORMAT=console  # Options: console (colored), json (structured)

# HTTP transport for external observability platforms
LOG_HTTP_ENDPOINT=https://your-observability-platform.com/api/logs
LOG_HTTP_AUTH=Bearer your-auth-token
```

## Transports

### Console Transport
Human-readable colored output for development:
```
[2025-11-21T10:30:15.123Z] [INFO] Starting container [{"engine":"podman","appId":"39"}]
```

### JSON Transport
Structured JSON output for log aggregation:
```json
{
  "timestamp": "2025-11-21T10:30:15.123Z",
  "level": "info",
  "message": "Starting container",
  "context": {
    "engine": "podman",
    "appId": "39"
  }
}
```

### HTTP Transport
Batched log shipping to external platforms:
- Configurable batch size (default: 100 logs)
- Configurable batch timeout (default: 5 seconds)
- Automatic retry on failure

## Usage

### Basic Logging

```typescript
import { logger } from '../utils/logger';

// Info level
logger.info('Application started', { service: 'backend', port: 3001 });

// Debug level
logger.debug('Processing request', { requestId: '12345' });

// Warning level
logger.warn('Deprecated API called', { endpoint: '/old-api' });

// Error level with exception
try {
  // some operation
} catch (error) {
  logger.error('Operation failed', error, { operation: 'runContainer' });
}
```

### Contextual Logging

```typescript
// Set default context for all logs
logger.setDefaultContext({ service: 'podman-handler', engine: 'podman' });

// All subsequent logs will include this context
logger.info('Container started', { appId: '39' });
// Output: {..., "context": {"service":"podman-handler","engine":"podman","appId":"39"}}
```

### Child Loggers

```typescript
// Create a child logger with preset context
const containerLogger = logger.child({ 
  service: 'container-ops', 
  appId: '39' 
});

// All logs from child inherit context
containerLogger.info('Starting container');
containerLogger.info('Container ready');
// Both logs include: {"service":"container-ops","appId":"39"}
```

### Container Startup Script Logging

The container startup script includes structured JSON logging:

```bash
log() {
    local level=${1}
    local message=${2}
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    echo "{\"timestamp\":\"${timestamp}\",\"level\":\"${level}\",\"service\":\"container-startup\",\"message\":\"${message}\"}"
}

log "info" "Installing dependencies with npm..."
```

## Integration Examples

### Splunk HEC (HTTP Event Collector)

```bash
# .env configuration
LOG_FORMAT=json
LOG_HTTP_ENDPOINT=https://http-inputs-splunk.example.com:8088/services/collector/event
LOG_HTTP_AUTH=Splunk YOUR-HEC-TOKEN
```

### Grafana Loki

```bash
# .env configuration
LOG_FORMAT=json
LOG_HTTP_ENDPOINT=https://loki.example.com/loki/api/v1/push
LOG_HTTP_AUTH=Basic base64-encoded-credentials
```

### Grafana Tempo (Traces)

For distributed tracing, include `requestId` and `spanId` in context:

```typescript
logger.info('Processing request', {
  requestId: 'req-12345',
  spanId: 'span-67890',
  service: 'api-gateway'
});
```

## Handler Integration

### PodmanHandler Example
```typescript
import { logger } from '../../utils/logger';

export class PodmanHandler extends AbstractContainerHandler {
  constructor(image: string, defaultPort: number, socketPath?: string) {
    super('podman');
    this.podmanImage = image;
    this.defaultPort = defaultPort;
    this.socketPath = socketPath;
    
    // Log initialization
    logger.debug('PodmanHandler initialized', { 
      engine: 'podman', 
      image, 
      defaultPort, 
      socketPath 
    });
  }

  async runContainer(options: RunContainerOptions): Promise<ContainerOperationResult> {
    logger.info('Starting container', {
      engine: 'podman',
      appId: options.appId,
      containerName: this.getContainerName(options.appId),
      port: options.port || this.defaultPort,
      image: this.podmanImage
    });
    
    try {
      // Container operations...
      logger.info('Container started successfully', { 
        engine: 'podman', 
        appId: options.appId 
      });
    } catch (error) {
      logger.error('Failed to start container', error, { 
        engine: 'podman', 
        appId: options.appId 
      });
      throw error;
    }
  }
}
```

### LocalRunnerService Example
```typescript
import { logger } from '../utils/logger';

export class LocalRunnerService {
  async runApp(appId: string, appPath: string, port: number): Promise<any> {
    logger.info('Starting local app', { 
      service: 'local-runner', 
      appId, 
      port 
    });
    
    const pm = detectPackageManager(appPath);
    logger.debug('Detected package manager', { 
      service: 'local-runner', 
      appId, 
      packageManager: pm 
    });
    
    // Run app...
  }
}
```

## Best Practices

1. **Always include context**: Provide relevant context (appId, engine, service) with every log
2. **Use appropriate levels**: 
   - DEBUG: Detailed troubleshooting info
   - INFO: Normal operational messages
   - WARN: Unexpected but handled situations
   - ERROR: Failures requiring attention
3. **Log structured data**: Use context and metadata instead of string interpolation
4. **Create child loggers**: For scoped operations with consistent context
5. **Include request IDs**: For tracing requests across services
6. **Log errors with stack traces**: Always pass Error objects to logger.error()
7. **Avoid sensitive data**: Never log passwords, tokens, or PII

## Querying Logs

### Console Format
```bash
# Filter by level
grep "\[ERROR\]" logs.txt

# Filter by service
grep "container-startup" logs.txt
```

### JSON Format
```bash
# Using jq to filter
cat logs.json | jq 'select(.level == "error")'
cat logs.json | jq 'select(.context.appId == "39")'
cat logs.json | jq 'select(.context.engine == "podman")'
```

### Splunk Queries
```spl
index=dyad level=error
index=dyad context.engine=podman context.appId=39
index=dyad service="container-startup" | timechart count by level
```

### Grafana Loki Queries
```logql
{service="container-startup"} |= "error"
{engine="podman", appId="39"}
{service="local-runner"} | json | level="error"
```

## Performance Considerations

1. **Batching**: HTTP transport batches logs to reduce network overhead
2. **Async writes**: HTTP transport doesn't block application flow
3. **Level filtering**: Set appropriate LOG_LEVEL to reduce log volume
4. **Sampling**: For high-traffic services, consider sampling debug logs

## Troubleshooting

### Logs not appearing in external platform
1. Check LOG_HTTP_ENDPOINT is correct
2. Verify LOG_HTTP_AUTH credentials
3. Ensure LOG_FORMAT=json for structured logging
4. Check network connectivity to endpoint
5. Review HTTP transport batch settings

### Performance degradation
1. Increase LOG_LEVEL (e.g., from debug to info)
2. Adjust HTTP transport batch size
3. Check external platform ingestion rate limits
4. Consider async log processing queue

### Missing context in logs
1. Use child loggers for consistent context
2. Set default context at handler initialization
3. Always pass context object to log methods
