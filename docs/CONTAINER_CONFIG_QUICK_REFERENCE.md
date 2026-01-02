# Container Configuration Quick Reference

## Auto-Shutdown Configuration

### Set Inactivity Timeout

Add to your `.env` file:

```bash
# Timeout in milliseconds
CONTAINER_INACTIVITY_TIMEOUT=600000  # 10 minutes (default)
```

**Common Values:**
- 5 minutes: `300000`
- 10 minutes: `600000` (default)
- 15 minutes: `900000`
- 30 minutes: `1800000`
- 1 hour: `3600000`

## Resource Limits Configuration

### Set CPU Limit

```bash
# Number of CPUs (can be fractional)
CONTAINER_CPU_LIMIT=1  # Default
```

**Examples:**
- Half CPU: `0.5`
- One CPU: `1` (default)
- Two CPUs: `2`
- Four CPUs: `4`

### Set Memory Limit

```bash
# Memory with unit (m=megabytes, g=gigabytes)
CONTAINER_MEMORY_LIMIT=1g  # Default
```

**Examples:**
- 256 MB: `256m`
- 512 MB: `512m`
- 1 GB: `1g` (default)
- 2 GB: `2g`
- 4 GB: `4g`

## Complete Example

### Development Environment (.env)

```bash
# Container Configuration
CONTAINERIZATION_ENABLED=true
CONTAINER_INACTIVITY_TIMEOUT=300000  # 5 min for dev
CONTAINER_CPU_LIMIT=0.5              # Half CPU for dev
CONTAINER_MEMORY_LIMIT=512m          # 512 MB for dev
```

### Staging Environment

```bash
# Container Configuration
CONTAINERIZATION_ENABLED=true
CONTAINER_INACTIVITY_TIMEOUT=900000  # 15 min
CONTAINER_CPU_LIMIT=1                # 1 CPU
CONTAINER_MEMORY_LIMIT=1g            # 1 GB
```

### Production Environment

```bash
# Container Configuration
CONTAINERIZATION_ENABLED=true
CONTAINER_INACTIVITY_TIMEOUT=1800000 # 30 min
CONTAINER_CPU_LIMIT=2                # 2 CPUs
CONTAINER_MEMORY_LIMIT=2g            # 2 GB
```

## Verification

### Check Current Settings

Restart your application and check the logs:

```
INFO: Container Lifecycle Service initialized
  - inactivityTimeout: 600000
  - inactivityMinutes: 10
```

### Monitor Container Resources

**Docker:**
```bash
docker stats
```

**Podman:**
```bash
podman stats
```

You should see the CPU and memory limits applied to your containers.

### Monitor Container Activity

Check the logs for activity tracking:

```
INFO: Recorded container activity
  - appId: my-app

INFO: Container inactive, scheduling cleanup
  - appId: my-app
  - inactiveDuration: 10 minutes

INFO: Inactive container stopped
  - appId: my-app
```

## Troubleshooting

### Containers stopping too quickly?

Increase the timeout:
```bash
CONTAINER_INACTIVITY_TIMEOUT=1800000  # 30 minutes
```

### Containers not stopping?

Check if the lifecycle service is running. Look for this in logs:
```
INFO: Container lifecycle manager started
  - checkInterval: 120s
```

### Out of memory errors?

Increase memory limit:
```bash
CONTAINER_MEMORY_LIMIT=2g  # or higher
```

### CPU throttling?

Increase CPU limit:
```bash
CONTAINER_CPU_LIMIT=2  # or higher
```

## Best Practices

1. **Development**: Use lower timeouts (5-10 min) and lower resources
2. **Production**: Use higher timeouts (30-60 min) and adequate resources
3. **Monitor**: Use `docker stats` or `podman stats` to track actual usage
4. **Test**: Change settings and verify they take effect after restart
5. **Log**: Monitor logs to see when containers are auto-stopped

## Notes

- Changes to these settings require an application restart
- Activity tracking is automatic - no code changes needed
- Containers can be restarted on-demand when accessed after auto-shutdown
- Resource limits prevent runaway processes from consuming all resources
