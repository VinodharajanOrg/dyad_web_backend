/**
 * Local app runner service - runs apps as local processes without containers
 * Used when CONTAINERIZATION_ENABLED=false
 */

import { spawn, ChildProcess, exec } from 'node:child_process';
//import * as path from 'node:path';
import { logger } from '../utils/logger';
import { detectPackageManager, getAppStartupCommand } from '../utils/app_commands';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface RunningApp {
  process: ChildProcess;
  port: number;
  startTime: Date;
  logs: Array<{ timestamp: Date; message: string; level: 'stdout' | 'stderr' }>;
  logLimit: number;
}

export class LocalRunnerService {
  private static instance: LocalRunnerService;
  private readonly runningApps: Map<string, RunningApp> = new Map();
  private readonly MAX_LOGS = 1000; // Keep last 1000 log lines per app

  private constructor() {}

  static getInstance(): LocalRunnerService {
    if (!LocalRunnerService.instance) {
      LocalRunnerService.instance = new LocalRunnerService();
    }
    return LocalRunnerService.instance;
  }

  /**
   * Kill any process running on the specified port
   */
  private async killProcessOnPort(port: number): Promise<void> {
    try {
      // Find process using the port
      const { stdout } = await execAsync(`lsof -ti :${port}`).catch(() => ({ stdout: '' }));
      const pids = stdout.trim().split('\n').filter(Boolean);
      
      if (pids.length > 0) {
        logger.info('Killing processes on port', { service: 'local-runner', port, pids });
        for (const pid of pids) {
          try {
            process.kill(Number.parseInt(pid), 'SIGKILL');
          } catch (err) {
            // Process might already be dead
          }
        }
        // Wait a bit for port to be freed
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      // Port might not be in use, which is fine
    }
  }

  /**
   * Run an app locally as a child process
   */
  async runApp(appId: string, appPath: string, port: number = 32100): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      // Stop existing process if running
      if (this.runningApps.has(appId)) {
        await this.stopApp(appId);
      }

      // Kill any process on the target port if AUTO_KILL_PORT is enabled
      const autoKillPort = process.env.AUTO_KILL_PORT !== 'false'; // Default to true
      
      if (autoKillPort) {
        logger.info('AUTO_KILL_PORT enabled, cleaning up port', { service: 'local-runner', port });
        await this.killProcessOnPort(port);
      } else {
        // Check if port is in use
        try {
          const { stdout } = await execAsync(`lsof -ti :${port}`).catch(() => ({ stdout: '' }));
          if (stdout.trim()) {
            return {
              success: false,
              message: `Port ${port} is already in use`,
              error: `Port ${port} is already in use. Set AUTO_KILL_PORT=true in .env to automatically free the port. PIDs: ${stdout.trim()}`,
            };
          }
        } catch (error) {
          // Port not in use, continue
        }
      }

      // Build command using common utility
      const pm = detectPackageManager(appPath);
      
      // Clean install to fix optional dependencies (like @rollup/rollup-darwin-arm64)
      // For pnpm: Remove node_modules, use --no-frozen-lockfile to force install
      // Use --ignore-workspace to treat as standalone app, not part of parent workspace
      // For npm: Remove node_modules and package-lock.json, then fresh install
      let installCommand: string;
      if (pm === 'npm') {
        installCommand = 'rm -rf node_modules package-lock.json && npm install --legacy-peer-deps';
      } else if (pm === 'pnpm') {
        // Use --no-frozen-lockfile to ensure install happens even without lock file
        // Use --shamefully-hoist to handle React strict mode and peer dependencies
        // Use --ignore-workspace to prevent workspace mode (app is standalone)
        installCommand = 'rm -rf node_modules pnpm-lock.yaml && pnpm install --no-frozen-lockfile --shamefully-hoist --ignore-workspace';
      } else {
        installCommand = 'rm -rf node_modules yarn.lock && yarn install';
      }
      
      // Get dev command only (don't use getAppStartupCommand as we're adding custom install)
      const devCmd = pm === 'pnpm' 
        ? `pnpm run dev --host 0.0.0.0 --port ${port}`
        : pm === 'yarn'
        ? `yarn dev --host 0.0.0.0 --port ${port}`
        : `npm run dev -- --host 0.0.0.0 --port ${port}`;
      
      const fullCommand = `${installCommand} && ${devCmd}`;

      logger.info('Starting app', { 
        service: 'local-runner', 
        appId, 
        port, 
        packageManager: pm, 
        command: fullCommand, 
        workingDirectory: appPath 
      });

      const childProcess = spawn(fullCommand, {
        cwd: appPath,
        shell: true,
        stdio: 'pipe',
        env: {
          ...process.env,
          PORT: port.toString(),
          VITE_PORT: port.toString(),
          CI: 'true', // Tell pnpm we're in CI mode so it doesn't require TTY
        },
      });

      if (!childProcess.pid) {
        return {
          success: false,
          message: 'Failed to start app process',
          error: 'Process did not spawn',
        };
      }

      // Store running app info
      this.runningApps.set(appId, {
        process: childProcess,
        port,
        startTime: new Date(),
        logs: [],
        logLimit: this.MAX_LOGS,
      });

      const app = this.runningApps.get(appId)!;

      // Helper to add log entry
      const addLog = (message: string, level: 'stdout' | 'stderr') => {
        app.logs.push({
          timestamp: new Date(),
          message,
          level,
        });
        // Keep only last MAX_LOGS entries
        if (app.logs.length > this.MAX_LOGS) {
          app.logs.shift();
        }
      };

      // Handle process output
      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        addLog(output, 'stdout');
        logger.info('App output', { service: 'local-runner', appId, output });
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString().trim();
        addLog(error, 'stderr');
        logger.warn('App error output', { service: 'local-runner', appId, error });
      });

      childProcess.on('close', (code: number | null) => {
        logger.info('App process exited', { service: 'local-runner', appId, exitCode: code });
        this.runningApps.delete(appId);
      });

      childProcess.on('error', (err: Error) => {
        logger.error('App process error', err, { service: 'local-runner', appId });
        this.runningApps.delete(appId);
      });

      return {
        success: true,
        message: `App ${appId} started on port ${port}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to start app',
        error: error.message,
      };
    }
  }

  /**
   * Stop a running app
   */
  async stopApp(appId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const app = this.runningApps.get(appId);
    
    if (!app) {
      return {
        success: true,
        message: `App ${appId} is not running`,
      };
    }

    try {
      // Kill the process
      app.process.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force kill if still running
      if (!app.process.killed) {
        app.process.kill('SIGKILL');
      }

      this.runningApps.delete(appId);

      return {
        success: true,
        message: `App ${appId} stopped`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to stop app ${appId}`,
      };
    }
  }

  /**
   * Get app status
   */
  getAppStatus(appId: string): {
    isRunning: boolean;
    port?: number;
    uptime?: number;
  } {
    const app = this.runningApps.get(appId);
    
    if (!app) {
      return { isRunning: false };
    }

    const uptime = Math.floor((Date.now() - app.startTime.getTime()) / 1000);

    return {
      isRunning: true,
      port: app.port,
      uptime,
    };
  }

  /**
   * Get all running apps
   */
  getRunningApps(): string[] {
    return Array.from(this.runningApps.keys());
  }

  /**
   * Check if app is running
   */
  isAppRunning(appId: string): boolean {
    return this.runningApps.has(appId);
  }

  /**
   * Get logs for an app
   */
  getLogs(appId: string, tail?: number): Array<{ timestamp: Date; message: string; level: 'stdout' | 'stderr' }> {
    const app = this.runningApps.get(appId);
    if (!app) {
      return [];
    }

    if (tail && tail > 0) {
      return app.logs.slice(-tail);
    }

    return [...app.logs];
  }

  /**
   * Stream logs for an app (async generator)
   */
  async *streamLogs(appId: string, follow: boolean = true): AsyncGenerator<{ timestamp: Date; message: string; level: 'stdout' | 'stderr' }> {
    const app = this.runningApps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} is not running`);
    }

    // First yield existing logs
    for (const log of app.logs) {
      yield log;
    }

    if (!follow) {
      return;
    }

    // Then stream new logs as they come
    let lastIndex = app.logs.length;
    
    while (this.isAppRunning(appId)) {
      const currentApp = this.runningApps.get(appId);
      if (!currentApp) break;

      // Yield any new logs
      if (currentApp.logs.length > lastIndex) {
        for (let i = lastIndex; i < currentApp.logs.length; i++) {
          yield currentApp.logs[i];
        }
        lastIndex = currentApp.logs.length;
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get app process for an app
   */
  getAppProcess(appId: string): ChildProcess | undefined {
    return this.runningApps.get(appId)?.process;
  }
}
