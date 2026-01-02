import { ContainerizationService } from './containerization_service';
import { logger } from '../utils/logger';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Container Lifecycle Service
 * Manages automatic cleanup of inactive containers and port allocation
 */
export class ContainerLifecycleService {
  private static instance: ContainerLifecycleService;
  private readonly containerActivity: Map<string, number> = new Map(); // appId -> lastActivityTimestamp
  private readonly containerPorts: Map<string, number> = new Map(); // appId -> port
  private readonly startingContainers: Set<string> = new Set(); // Track containers currently being started
  private readonly containerNetworkStats: Map<string, { received: number; sent: number; timestamp: number }> = new Map(); // Track network I/O over time
  private readonly inactivityTimeout: number;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly basePort: number = 32100;
  private readonly maxPort: number = 32200;
  private initialized: boolean = false;

  private constructor() {
    // Default inactivity timeout: 10 minutes (configurable via env)
    this.inactivityTimeout = Number.parseInt(process.env.CONTAINER_INACTIVITY_TIMEOUT || '600000', 10);
    logger.info('Container Lifecycle Service initialized', {
      service: 'lifecycle',
      inactivityTimeout: this.inactivityTimeout,
      inactivityMinutes: this.inactivityTimeout / 60000
    });
  }

  static getInstance(): ContainerLifecycleService {
    if (!ContainerLifecycleService.instance) {
      ContainerLifecycleService.instance = new ContainerLifecycleService();
    }
    return ContainerLifecycleService.instance;
  }

  /**
   * Initialize lifecycle service - discovers existing containers
   * Call this on server startup to restore state
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Lifecycle service already initialized', { service: 'lifecycle' });
      return;
    }

    logger.info('Discovering existing containers after server restart', { service: 'lifecycle' });
    
    try {
      await this.discoverExistingContainers();
      this.initialized = true;
      logger.info('Lifecycle service initialization complete', { 
        service: 'lifecycle',
        discoveredContainers: this.containerActivity.size,
        allocatedPorts: this.containerPorts.size
      });
    } catch (error: any) {
      logger.error('Failed to discover existing containers', error, { service: 'lifecycle' });
      // Continue anyway - not fatal
      this.initialized = true;
    }
  }

  /**
   * Discover and register existing containers
   * This restores state after server restarts
   */
  private async discoverExistingContainers(): Promise<void> {
    const containerService = ContainerizationService.getInstance();
    
    if (!containerService.isEnabled()) {
      logger.debug('Containerization disabled, skipping discovery', { service: 'lifecycle' });
      return;
    }

    try {
      const engine = process.env.CONTAINERIZATION_ENGINE || 'podman';
      const containerPrefix = 'dyad-app-';
      
      // List all containers (running and stopped) with our prefix
      const { stdout } = await execAsync(
        `${engine} ps -a --filter "name=${containerPrefix}" --format "{{.Names}}|||{{.Ports}}|||{{.Status}}|||{{.CreatedAt}}"`
      );

      if (!stdout.trim()) {
        logger.info('No existing containers found', { service: 'lifecycle' });
        return;
      }

      const lines = stdout.trim().split('\n');
      let discovered = 0;
      let runningCount = 0;

      for (const line of lines) {
        const [name, ports, status] = line.split('|||');
        
        if (!name || !name.startsWith(containerPrefix)) {
          continue;
        }

        // Extract appId from container name (dyad-app-{appId})
        const appId = name.replace(containerPrefix, '');
        
        // Extract port from ports string (e.g., "0.0.0.0:32100->32100/tcp")
        let port: number | null = null;
        if (ports) {
          const portMatch = ports.match(/0\.0\.0\.0:(\d+)/);
          if (portMatch) {
            port = Number.parseInt(portMatch[1], 10);
          }
        }

        const isRunning = status.toLowerCase().includes('up');
        
        // Register the container
        if (port) {
          this.containerPorts.set(appId, port);
        }
        
        // Set activity timestamp
        // For running containers, set to now (they're active)
        // For stopped containers, set to past (will be cleaned up if still stopped)
        const activityTime = isRunning ? Date.now() : Date.now() - this.inactivityTimeout - 60000;
        this.containerActivity.set(appId, activityTime);
        
        discovered++;
        if (isRunning) {
          runningCount++;
        }
        
        logger.info('Discovered container', {
          service: 'lifecycle',
          appId,
          port,
          status: isRunning ? 'running' : 'stopped',
          containerName: name
        });
      }

      logger.info('Container discovery complete', {
        service: 'lifecycle',
        totalDiscovered: discovered,
        running: runningCount,
        stopped: discovered - runningCount
      });
      
    } catch (error: any) {
      logger.error('Error during container discovery', error, { service: 'lifecycle' });
      throw error;
    }
  }

  /**
   * Start the lifecycle manager
   */
  async start(): Promise<void> {
    // Ensure we're initialized first
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.checkInterval) {
      logger.warn('Lifecycle manager already running', { service: 'lifecycle' });
      return;
    }

    // Check every 2 minutes for inactive containers
    const checkIntervalMs = 120000; // 2 minutes
    this.checkInterval = setInterval(() => {
      this.cleanupInactiveContainers();
    }, checkIntervalMs);

    logger.info('Container lifecycle manager started', {
      service: 'lifecycle',
      checkInterval: checkIntervalMs / 1000 + 's',
      managedContainers: this.containerActivity.size
    });
  }

  /**
   * Stop the lifecycle manager
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Container lifecycle manager stopped', { service: 'lifecycle' });
    }
  }

  /**
   * Record activity for an app's container
   */
  recordActivity(appId: string): void {
    this.containerActivity.set(appId, Date.now());
    logger.debug('Recorded container activity', {
      service: 'lifecycle',
      appId
    });
  }

  /**
   * Check if a container is currently being started
   */
  isStarting(appId: string): boolean {
    return this.startingContainers.has(appId);
  }

  /**
   * Mark container as starting
   */
  markAsStarting(appId: string): void {
    this.startingContainers.add(appId);
    logger.debug('Marked container as starting', {
      service: 'lifecycle',
      appId
    });
  }

  /**
   * Mark container as started (no longer in starting state)
   */
  markAsStarted(appId: string): void {
    this.startingContainers.delete(appId);
    this.recordActivity(appId);
    logger.debug('Marked container as started', {
      service: 'lifecycle',
      appId
    });
  }

  /**
   * Clear starting state (in case of failure)
   */
  clearStarting(appId: string): void {
    this.startingContainers.delete(appId);
  }

  /**
   * Get assigned port for an app
   */
  getPort(appId: string): number | undefined {
    return this.containerPorts.get(appId);
  }

  /**
   * Check if a port is actually available on the system
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      // Check if any RUNNING container is using this port
      //const containerService = ContainerizationService.getInstance();
      const engine = process.env.CONTAINERIZATION_ENGINE || 'podman';
      
      // Only check running containers, not stopped ones
      const { stdout } = await execAsync(`${engine} ps --format "{{.Ports}}"`);
      const portInUse = stdout.includes(`0.0.0.0:${port}`) || stdout.includes(`:${port}-`);
      
      if (portInUse) {
        logger.debug('Port in use by running container', {
          service: 'lifecycle',
          port
        });
        return false;
      }
      
      return true;
    } catch (error) {
      logger.warn('Error checking port availability', { 
        service: 'lifecycle',
        port 
      }, { error: String(error) });
      return true; // Assume available if check fails
    }
  }

  /**
   * Allocate a port for an app with fallback mechanism
   */
  async allocatePort(appId: string, forceNew: boolean = false): Promise<number> {
    // Check if app already has a port and it's still available
    const existingPort = this.containerPorts.get(appId);
    if (existingPort && !forceNew) {
      const isAvailable = await this.isPortAvailable(existingPort);
      if (isAvailable) {
        logger.debug('Reusing existing port allocation', {
          service: 'lifecycle',
          appId,
          port: existingPort
        });
        return existingPort;
      } else {
        logger.warn('Assigned port no longer available, reallocating', {
          service: 'lifecycle',
          appId,
          oldPort: existingPort
        });
        // Port is taken, need to find a new one
        this.containerPorts.delete(appId);
      }
    }

    // Find next available port
    const usedPorts = new Set(Array.from(this.containerPorts.values()));
    
    for (let port = this.basePort; port <= this.maxPort; port++) {
      if (!usedPorts.has(port)) {
        // Double-check port is actually available on system
        const isAvailable = await this.isPortAvailable(port);
        if (isAvailable) {
          this.containerPorts.set(appId, port);
          logger.info('Allocated port for app', {
            service: 'lifecycle',
            appId,
            port
          });
          return port;
        } else {
          logger.debug('Port marked available but in use, skipping', {
            service: 'lifecycle',
            appId,
            port
          });
        }
      }
    }

    throw new Error('No available ports in range');
  }

  /**
   * Release port allocation for an app
   */
  releasePort(appId: string): void {
    const port = this.containerPorts.get(appId);
    if (port) {
      this.containerPorts.delete(appId);
      logger.info('Released port for app', {
        service: 'lifecycle',
        appId,
        port
      });
    }
  }

  /**
   * Mark port as reserved but container stopped (for restart)
   */
  private markPortReserved(appId: string): void {
    const port = this.containerPorts.get(appId);
    if (port) {
      logger.debug('Port kept reserved for potential restart', {
        service: 'lifecycle',
        appId,
        port
      });
    }
  }

  /**
   * Get all active app IDs
   */
  getActiveApps(): string[] {
    return Array.from(this.containerActivity.keys());
  }

  /**
   * Check if container is actually being used by examining its stats
   * Returns true if container shows signs of activity (network traffic changes, recent connections)
   * Note: CPU usage is NOT checked as dev servers (Vite, etc.) always have high CPU due to file watching
   * Note: Network I/O stats are cumulative, so we compare with previous readings to detect actual activity
   */
  private async isContainerActivelyUsed(appId: string): Promise<boolean> {
    try {
      const containerService = ContainerizationService.getInstance();
      const containerName = containerService.getContainerName(appId);
      const engine = process.env.CONTAINERIZATION_ENGINE || 'podman';
      
      logger.debug('Checking container active usage', {
        service: 'lifecycle',
        appId,
        containerName,
        engine
      });
      
      // Get container stats (Memory usage, network I/O)
      // Note: We intentionally skip CPU check as dev servers always have high CPU
      const { stdout } = await execAsync(
        `${engine} stats --no-stream --format "{{.MemPerc}}|||{{.NetIO}}" ${containerName}`
      );
      
      if (!stdout.trim()) {
        logger.debug('No stats output from container, assuming inactive', {
          service: 'lifecycle',
          appId
        });
        return false;
      }
      
      const [memPerc, netIO] = stdout.trim().split('|||');
      
      logger.debug('Container stats retrieved', {
        service: 'lifecycle',
        appId,
        memPerc,
        netIO
      });
      
      // Check network I/O for RECENT activity (compare with previous reading)
      // Format is like "1.2kB / 3.4kB" (received / sent)
      if (netIO && netIO.includes('/')) {
        const [received, sent] = netIO.split('/').map(s => s.trim());
        
        const receivedBytes = this.parseNetworkSize(received);
        const sentBytes = this.parseNetworkSize(sent);
        
        // Get previous stats
        const previousStats = this.containerNetworkStats.get(appId);
        const now = Date.now();
        
        // Store current stats for next comparison
        this.containerNetworkStats.set(appId, {
          received: receivedBytes,
          sent: sentBytes,
          timestamp: now
        });
        
        if (previousStats) {
          // Calculate the CHANGE in network I/O since last check
          const receivedDelta = receivedBytes - previousStats.received;
          const sentDelta = sentBytes - previousStats.sent;
          const timeDelta = now - previousStats.timestamp;
          
          // Threshold: More than 50KB change in the last check interval indicates activity
          const changeThreshold = 51200; // 50KB
          
          logger.debug('Container network I/O delta check', {
            service: 'lifecycle',
            appId,
            receivedDelta,
            sentDelta,
            timeDelta: `${Math.round(timeDelta / 1000)}s`,
            threshold: '50KB',
            totalReceived: received,
            totalSent: sent
          });
          
          const hasSignificantChange = receivedDelta > changeThreshold || sentDelta > changeThreshold;
          
          if (hasSignificantChange) {
            logger.info('Container shows network activity change - keeping alive', {
              service: 'lifecycle',
              appId,
              receivedDelta: `${Math.round(receivedDelta / 1024)}KB`,
              sentDelta: `${Math.round(sentDelta / 1024)}KB`,
              timeSinceLastCheck: `${Math.round(timeDelta / 1000)}s`,
              reason: receivedDelta > changeThreshold ? 'incoming-traffic-change' : 'outgoing-traffic-change'
            });
            return true;
          } else {
            logger.debug('Container network I/O change below threshold', {
              service: 'lifecycle',
              appId,
              receivedDelta: `${Math.round(receivedDelta / 1024)}KB`,
              sentDelta: `${Math.round(sentDelta / 1024)}KB`,
              threshold: '50KB'
            });
          }
        } else {
          // First time checking this container, can't compare yet
          logger.debug('First network stats reading for container, will compare on next check', {
            service: 'lifecycle',
            appId,
            receivedBytes: `${Math.round(receivedBytes / 1024)}KB`,
            sentBytes: `${Math.round(sentBytes / 1024)}KB`
          });
          // Don't mark as inactive on first check - give it another cycle
          return true;
        }
      } else {
        logger.debug('No network I/O data available', {
          service: 'lifecycle',
          appId,
          netIO
        });
      }
      
      // Additional check: Check if there are active TCP connections to the container
      const port = this.containerPorts.get(appId);
      if (port) {
        const hasActiveConnections = await this.hasActiveTCPConnections(port);
        if (hasActiveConnections) {
          logger.info('Container has active TCP connections - keeping alive', {
            service: 'lifecycle',
            appId,
            port,
            reason: 'active-connections'
          });
          return true;
        }
      }
      
      logger.info('Container shows no significant activity (Network change < 50KB, No active connections)', {
        service: 'lifecycle',
        appId,
        decision: 'inactive'
      });
      
      return false;
    } catch (error) {
      logger.warn('Unable to check container stats, assuming inactive', {
        service: 'lifecycle',
        appId,
        error: String(error),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Check if there are active TCP connections to a port
   * This indicates someone is actively using the container
   */
  private async hasActiveTCPConnections(port: number): Promise<boolean> {
    try {
      // Check for ESTABLISHED connections on the port
      // This works on both macOS and Linux
      const { stdout } = await execAsync(
        `netstat -an | grep -E "tcp.*:${port}.*ESTABLISHED" || lsof -iTCP:${port} -sTCP:ESTABLISHED -n -P 2>/dev/null || true`
      );
      
      const hasConnections = stdout.trim().length > 0;
      
      if (hasConnections) {
        logger.debug('Found active TCP connections', {
          service: 'lifecycle',
          port,
          connections: stdout.trim().split('\n').length
        });
      }
      
      return hasConnections;
    } catch (error) {
      logger.debug('Could not check TCP connections', {
        service: 'lifecycle',
        port,
        error: String(error)
      });
      return false;
    }
  }

  /**
   * Parse network size string to bytes
   */
  private parseNetworkSize(sizeStr: string): number {
    if (!sizeStr) return 0;
    
    const match = sizeStr.match(/([0-9.]+)\s*([KMG]?B)/i);
    if (!match) return 0;
    
    const value = Number.parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
  }

  /**
   * Check and cleanup inactive containers
   */
  private async cleanupInactiveContainers(): Promise<void> {
    const now = Date.now();
    const containerService = ContainerizationService.getInstance();

    if (!containerService.isEnabled()) {
      return;
    }

    logger.debug('Checking for inactive containers', {
      service: 'lifecycle',
      activeContainers: this.containerActivity.size
    });

    const inactiveApps: string[] = [];

    // Find inactive apps
    for (const [appId, lastActivity] of this.containerActivity.entries()) {
      const inactiveDuration = now - lastActivity;
      
      if (inactiveDuration > this.inactivityTimeout) {
        inactiveApps.push(appId);
        logger.info('Container inactive, scheduling cleanup', {
          service: 'lifecycle',
          appId,
          inactiveDuration: Math.round(inactiveDuration / 60000) + ' minutes'
        });
      }
    }

    // Cleanup inactive containers
    for (const appId of inactiveApps) {
      try {
        const isRunning = await containerService.isContainerRunning(appId);
        
        if (!isRunning) {
          // Container already stopped, just cleanup tracking but keep port reserved
          this.containerActivity.delete(appId);
          this.markPortReserved(appId);
          continue;
        }
        
        // Double-check if container is actually being used
        const isActivelyUsed = await this.isContainerActivelyUsed(appId);
        
        if (isActivelyUsed) {
          logger.info('Container marked inactive but shows activity, keeping alive', {
            service: 'lifecycle',
            appId
          });
          // Update activity timestamp to prevent immediate re-check
          this.recordActivity(appId);
          continue;
        }
        
        // Container is truly inactive, safe to stop
        logger.info('Stopping inactive container (verified no activity)', {
          service: 'lifecycle',
          appId
        });

        const result = await containerService.stopContainer(appId);
        
        if (result.success) {
          logger.info('Inactive container stopped', {
            service: 'lifecycle',
            appId
          });
        } else {
          logger.warn('Failed to stop inactive container', {
            service: 'lifecycle',
            appId,
            error: result.error
          });
        }

        // Remove from activity tracking but keep port reserved for potential restart
        this.containerActivity.delete(appId);
        this.markPortReserved(appId);

      } catch (error: any) {
        logger.error('Error cleaning up inactive container', error, {
          service: 'lifecycle',
          appId
        });
      }
    }

    if (inactiveApps.length > 0) {
      logger.info('Inactive container cleanup complete', {
        service: 'lifecycle',
        cleanedCount: inactiveApps.length
      });
    }
  }

  /**
   * Get container status with activity info
   */
  async getContainerInfo(appId: string): Promise<{
    isRunning: boolean;
    port?: number;
    lastActivity?: Date;
    inactiveDuration?: number;
  }> {
    const containerService = ContainerizationService.getInstance();
    const isRunning = containerService.isEnabled() 
      ? await containerService.isContainerRunning(appId)
      : false;
    
    const port = this.containerPorts.get(appId);
    const lastActivity = this.containerActivity.get(appId);
    const inactiveDuration = lastActivity ? Date.now() - lastActivity : undefined;

    return {
      isRunning,
      port,
      lastActivity: lastActivity ? new Date(lastActivity) : undefined,
      inactiveDuration
    };
  }

  /**
   * Manually stop a container and cleanup
   */
  async stopContainer(appId: string): Promise<void> {
    const containerService = ContainerizationService.getInstance();
    
    if (containerService.isEnabled()) {
      await containerService.stopContainer(appId);
    }

    this.containerActivity.delete(appId);
    // Keep port reserved for potential restart
    this.markPortReserved(appId);

    logger.info('Container stopped and cleaned up (port reserved)', {
      service: 'lifecycle',
      appId
    });
  }

  /**
   * Fully remove a container and release all resources
   */
  async removeContainer(appId: string): Promise<void> {
    const containerService = ContainerizationService.getInstance();
    
    if (containerService.isEnabled()) {
      await containerService.removeContainer(appId, true);
    }

    this.containerActivity.delete(appId);
    this.releasePort(appId);

    logger.info('Container fully removed and resources released', {
      service: 'lifecycle',
      appId
    });
  }

  /**
   * Get lifecycle statistics
   */
  getStats(): {
    managedContainers: number;
    allocatedPorts: number;
    startingContainers: number;
    portRange: string;
    inactivityTimeout: number;
    initialized: boolean;
  } {
    return {
      managedContainers: this.containerActivity.size,
      allocatedPorts: this.containerPorts.size,
      startingContainers: this.startingContainers.size,
      portRange: `${this.basePort}-${this.maxPort}`,
      inactivityTimeout: this.inactivityTimeout,
      initialized: this.initialized
    };
  }
}
