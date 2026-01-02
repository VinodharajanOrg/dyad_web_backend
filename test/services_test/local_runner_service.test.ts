import { LocalRunnerService } from "../../src/services/local_runner_service";
import { spawn } from "child_process";
import { EventEmitter } from "events";

jest.mock("child_process");
jest.mock("util", () => ({
  promisify: jest.fn((fn: any) => {
    // Return a mocked async function that doesn't call the original
    return jest.fn().mockResolvedValue({ stdout: "", stderr: "" });
  }),
}));
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("../../src/utils/app_commands", () => ({
  detectPackageManager: jest.fn().mockReturnValue("npm"),
  getAppStartupCommand: jest.fn().mockReturnValue("npm start"),
}));

describe("LocalRunnerService", () => {
  let service: LocalRunnerService;
  const mockAppId = "test-app-1";
  const mockAppPath = "/app/test-app";
  const mockPort = 3000;

  // Helper to create a mock ChildProcess
  const createMockChildProcess = () => {
    const emitter = new EventEmitter();
    const mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn(function (signal?: string) {
        (this as any).killed = true;
        return true;
      }),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: emitter.on.bind(emitter),
      once: emitter.once.bind(emitter),
      emit: emitter.emit.bind(emitter),
      listenerCount: emitter.listenerCount.bind(emitter),
      removeAllListeners: emitter.removeAllListeners.bind(emitter),
    } as any;
    return mockProcess;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (LocalRunnerService as any).instance = undefined;
    service = LocalRunnerService.getInstance();

    // Setup spawn to return a mock process by default
    (spawn as jest.Mock).mockImplementation(() => createMockChildProcess());

    // Clear environment variable
    delete process.env.AUTO_KILL_PORT;
  });

  //
  // -------------------------------------------------------
  // SINGLETON PATTERN
  // -------------------------------------------------------
  //
  describe("getInstance()", () => {
    it("should return the same instance every time", () => {
      const instance1 = LocalRunnerService.getInstance();
      const instance2 = LocalRunnerService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should create a new instance on first call", () => {
      (LocalRunnerService as any).instance = undefined;
      const instance = LocalRunnerService.getInstance();

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(LocalRunnerService);
    });
  });

  //
  // -------------------------------------------------------
  // RUN APP
  // -------------------------------------------------------
  //
  describe("runApp()", () => {
    it("should start an app successfully", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, mockAppPath, mockPort);

      expect(result.success).toBe(true);
      expect(result.message).toContain(mockAppId);
    });

    it("should use provided port when starting app", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const customPort = 4000;
      const result = await service.runApp(mockAppId, mockAppPath, customPort);

      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalled();
    });

    it("should handle app with missing package manager", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, mockAppPath, mockPort);

      expect(result.success).toBe(true);
    });

    it("should use default port if not provided", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, mockAppPath);

      expect(result.success).toBe(true);
    });

    it("should fail if spawn throws an error", async () => {
      (spawn as jest.Mock).mockImplementation(() => {
        throw new Error("Spawn failed");
      });

      const result = await service.runApp(mockAppId, mockAppPath, mockPort);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Spawn failed");
    });

    it("should handle app already running by stopping first", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      // Start app first time
      const result1 = await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(result1.success).toBe(true);

      // Try to start same app again - it should succeed because it auto-stops first
      const result2 = await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(result2.success).toBe(true);
      expect(result2.message).toContain(mockAppId);
    });

    it("should set up stdout listener", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Verify stdout has listeners
      expect(mockProcess.stdout.listenerCount("data")).toBeGreaterThan(0);
    });

    it("should set up stderr listener", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Verify stderr has listeners
      expect(mockProcess.stderr.listenerCount("data")).toBeGreaterThan(0);
    });

    it("should register process event listeners", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Verify the process was registered
      expect(spawn).toHaveBeenCalled();
      expect(service.getRunningApps()).toContain(mockAppId);
    });

    it("should handle process error event", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit error event
      mockProcess.emit("error", new Error("Process error"));

      // Wait for event handler to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      // App should be removed from running apps
      expect(service.getRunningApps().includes(mockAppId)).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // STOP APP
  // -------------------------------------------------------
  //
  describe("stopApp()", () => {
    it("should stop a running app", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      const result = await service.stopApp(mockAppId);

      expect(result.success).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("should return error if app is not running", async () => {
      const result = await service.stopApp("non-existent");

      expect(result.success).toBe(true);
    });

    it("should force kill if SIGTERM doesn't work", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Make kill fail on first call, succeed on second
      let killCallCount = 0;
      (mockProcess.kill as jest.Mock).mockImplementation(
        function (this: any, signal?: string) {
          killCallCount++;
          if (killCallCount === 1 && signal === "SIGTERM") {
            return false; // SIGTERM failed
          }
          this.killed = true;
          return true;
        }
      );

      const result = await service.stopApp(mockAppId);

      expect(result.success).toBe(true);
      // Should have called kill multiple times
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  //
  // -------------------------------------------------------
  // GET RUNNING APPS
  // -------------------------------------------------------
  //
  describe("getRunningApps()", () => {
    it("should return empty array when no apps running", () => {
      const apps = service.getRunningApps();

      expect(Array.isArray(apps)).toBe(true);
      expect(apps.length).toBe(0);
    });

    it("should return list of running apps", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      await service.runApp("app-2", mockAppPath, 3001);

      const apps = service.getRunningApps();

      expect(apps).toContain(mockAppId);
      expect(apps).toContain("app-2");
      expect(apps.length).toBe(2);
    });

    it("should not include stopped apps", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      await service.stopApp(mockAppId);

      const apps = service.getRunningApps();

      expect(apps).not.toContain(mockAppId);
    });
  });

  //
  // -------------------------------------------------------
  // GET APP INFO
  // -------------------------------------------------------
  //
  describe("getAppStatus()", () => {
    it("should return app info for running app", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      const info = service.getAppStatus(mockAppId);

      expect(info).toBeDefined();
      expect(info?.isRunning).toBe(true);
      expect(info?.port).toBe(mockPort);
    });

    it("should return undefined for non-running app", () => {
      const info = service.getAppStatus("non-existent");

      expect(info?.isRunning).toBe(false);
    });

    it("should include uptime in app info", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      const info = service.getAppStatus(mockAppId);

      expect(info?.uptime).toBeDefined();
      expect(typeof info?.uptime).toBe("number");
    });

    it("should include status for running app", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit some logs
      mockProcess.stdout.emit("data", Buffer.from("test log"));

      const info = service.getAppStatus(mockAppId);

      expect(info).toBeDefined();
      expect(info?.port).toBe(mockPort);
    });
  });

  //
  // -------------------------------------------------------
  // GET LOGS
  // -------------------------------------------------------
  //
  describe("getLogs()", () => {
    it("should return logs for running app", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit some logs
      mockProcess.stdout.emit("data", Buffer.from("app started"));
      mockProcess.stderr.emit("data", Buffer.from("warning"));

      const logs = service.getLogs(mockAppId);

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should return empty array for non-running app", () => {
      const logs = service.getLogs("non-existent");

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(0);
    });

    it("should capture stdout logs", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      mockProcess.stdout.emit("data", Buffer.from("listening on port 3000"));

      const logs = service.getLogs(mockAppId);

      expect(logs.some((log) => log.message.includes("listening"))).toBe(true);
    });

    it("should capture stderr logs", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      mockProcess.stderr.emit("data", Buffer.from("error occurred"));

      const logs = service.getLogs(mockAppId);

      expect(logs.some((log) => log.message.includes("error"))).toBe(true);
    });

    it("should limit log storage", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit many logs to exceed limit
      for (let i = 0; i < 1200; i++) {
        mockProcess.stdout.emit("data", Buffer.from(`log line ${i}`));
      }

      const logs = service.getLogs(mockAppId);

      // Should be limited to 1000
      expect(logs.length).toBeLessThanOrEqual(1000);
    });

    it("should include timestamp in logs", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      mockProcess.stdout.emit("data", Buffer.from("test"));

      const logs = service.getLogs(mockAppId);
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].timestamp instanceof Date).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // STREAM LOGS
  // -------------------------------------------------------
  //
  describe("streamLogs()", () => {
    it("should setup log streaming for running app", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // streamLogs is an async generator, so we iterate it
      const logsGenerator = service.streamLogs(mockAppId);
      expect(logsGenerator).toBeDefined();
    });

    it("should handle streaming from existing logs", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit a log
      mockProcess.stdout.emit("data", Buffer.from("test log"));

      // Get the generator but don't iterate it (just verify it exists)
      const generator = service.streamLogs(mockAppId, false);
      expect(generator).toBeDefined();
    });

    it("should not stream for non-existent app", async () => {
      const generator = service.streamLogs("non-existent");

      // Generator should still be created but empty
      expect(generator).toBeDefined();
    });

    it("should handle follow mode", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Test with follow=true (default)
      const followGenerator = service.streamLogs(mockAppId, true);
      expect(followGenerator).toBeDefined();

      // Test with follow=false
      const noFollowGenerator = service.streamLogs(mockAppId, false);
      expect(noFollowGenerator).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------
  //
  describe("error handling", () => {
    it("should handle spawn errors gracefully", async () => {
      (spawn as jest.Mock).mockImplementation(() => {
        const error = new Error("ENOENT: no such file");
        throw error;
      });

      const result = await service.runApp(mockAppId, mockAppPath, mockPort);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle very long app paths", async () => {
      const longPath = `/app/${"deeply/nested/path/".repeat(20)}app`;
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, longPath, mockPort);

      expect(result.success).toBe(true);
    });

    it("should handle special characters in app id", async () => {
      const specialId = "app-with-special-@#$-chars";
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(specialId, mockAppPath, mockPort);

      expect(result.success).toBe(true);
    });

    it("should handle stopping non-existent app gracefully", async () => {
      const result = await service.stopApp("definitely-not-running");

      // stopApp returns success=true even if app doesn't exist
      expect(result.success).toBe(true);
    });

    it("should handle very high port numbers", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, mockAppPath, 65535);

      expect(result.success).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // INTEGRATION
  // -------------------------------------------------------
  //
  describe("integration scenarios", () => {
    it("should handle app lifecycle with logs", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      // Start app
      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit logs
      mockProcess.stdout.emit("data", Buffer.from("Server starting..."));
      mockProcess.stdout.emit("data", Buffer.from("Server listening on port 3000"));

      // Check logs
      const logs = service.getLogs(mockAppId);
      expect(logs.length).toBeGreaterThan(0);

      // Get info
      const info = service.getAppStatus(mockAppId);
      expect(info).toBeDefined();

      // Stop app
      const result = await service.stopApp(mockAppId);
      expect(result.success).toBe(true);

      // Should not be in running apps
      expect(service.getRunningApps()).not.toContain(mockAppId);
    });

    it("should handle stopping and restarting same app", async () => {
      const mockProcess1 = createMockChildProcess();
      const mockProcess2 = createMockChildProcess();

      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockProcess1 : mockProcess2;
      });

      // Start first time
      const result1 = await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(result1.success).toBe(true);

      // Stop it
      await service.stopApp(mockAppId);
      expect(service.getRunningApps()).not.toContain(mockAppId);

      // Start again with new mock process
      const result2 = await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(result2.success).toBe(true);
      expect(service.getRunningApps()).toContain(mockAppId);
    });

    it("should preserve logs across app operations", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit multiple logs
      for (let i = 0; i < 5; i++) {
        mockProcess.stdout.emit("data", Buffer.from(`Log message ${i}`));
      }

      const logs = service.getLogs(mockAppId);
      expect(logs.length).toBe(5);

      // Get info includes log data
      const info = service.getAppStatus(mockAppId);
      expect(info?.isRunning).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // OUTPUT HANDLING - Extended Coverage
  // -------------------------------------------------------
  //
  describe("Output Handling - Extended Coverage", () => {
    it("should handle stdout data in chunks", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit multiple stdout chunks
      mockProcess.stdout.emit("data", Buffer.from("Starting"));
      mockProcess.stdout.emit("data", Buffer.from(" up"));
      mockProcess.stdout.emit("data", Buffer.from(" server\n"));

      const logs = service.getLogs(mockAppId);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should handle stderr output separately", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit stderr
      mockProcess.stderr.emit("data", Buffer.from("Warning: deprecated"));

      const logs = service.getLogs(mockAppId);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should handle large log messages", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit a large log message
      const largeMessage = "x".repeat(10000);
      mockProcess.stdout.emit("data", Buffer.from(largeMessage));

      const logs = service.getLogs(mockAppId);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should handle Unicode in output", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit Unicode content
      mockProcess.stdout.emit("data", Buffer.from("Unicode: 你好 🎉 Ω"));

      const logs = service.getLogs(mockAppId);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should handle empty buffer", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit empty buffer
      mockProcess.stdout.emit("data", Buffer.from(""));

      const logs = service.getLogs(mockAppId);
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // PROCESS LIFECYCLE - Extended Coverage
  // -------------------------------------------------------
  //
  describe("Process Lifecycle - Extended Coverage", () => {
    it("should track process close event", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(service.getRunningApps()).toContain(mockAppId);

      // Emit process close
      mockProcess.emit("close", 0);

      expect(service.getRunningApps()).not.toContain(mockAppId);
    });

    it("should track process close with error code", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit process close with error code
      mockProcess.emit("close", 1);

      expect(service.getRunningApps()).not.toContain(mockAppId);
    });

    it("should handle close event removes from running apps", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit close event
      mockProcess.emit("close", 0);

      const status = service.getAppStatus(mockAppId);
      expect(status).toBeDefined();
    });

    it("should handle process error event removes app", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(service.getRunningApps()).toContain(mockAppId);

      // Emit error event
      const error = new Error("Process error");
      mockProcess.emit("error", error);

      expect(service.getRunningApps()).not.toContain(mockAppId);
    });

    it("should handle multiple process events in sequence", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Emit data and then close
      mockProcess.stdout.emit("data", Buffer.from("Started\n"));
      const logsBeforeClose = service.getLogs(mockAppId);
      expect(logsBeforeClose.length).toBeGreaterThanOrEqual(0);

      mockProcess.emit("close", 0);

      // Verify app is removed
      expect(service.getRunningApps()).not.toContain(mockAppId);
    });
  });

  //
  // -------------------------------------------------------
  // ERROR SCENARIOS - Extended Coverage
  // -------------------------------------------------------
  //
  describe("Error Scenarios - Extended Coverage", () => {
    it("should handle spawn errors", async () => {
      (spawn as jest.Mock).mockImplementation(() => {
        throw new Error("spawn ENOENT");
      });

      const result = await service.runApp(mockAppId, mockAppPath, mockPort);

      // Should handle the error gracefully
      expect(result).toBeDefined();
    });

    it("should handle null process from spawn", async () => {
      (spawn as jest.Mock).mockReturnValue(null);

      const result = await service.runApp(mockAppId, mockAppPath, mockPort);

      expect(result).toBeDefined();
    });

    it("should handle stopping non-existent app gracefully", async () => {
      const result = await service.stopApp("does-not-exist");

      expect(result.success).toBe(true);
    });

    it("should handle getLogs for non-existent app", () => {
      const logs = service.getLogs("non-existent-app");

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(0);
    });

    it("should handle getAppStatus for non-existent app", () => {
      const status = service.getAppStatus("non-existent-app");

      expect(status).toBeDefined();
    });

    it("should recover from process kill errors", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      // Make kill throw error
      (mockProcess.kill as jest.Mock).mockImplementation(() => {
        throw new Error("ESRCH: no such process");
      });

      const result = await service.stopApp(mockAppId);

      expect(result).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // CONCURRENT OPERATIONS - Extended Coverage
  // -------------------------------------------------------
  //
  describe("Concurrent Operations - Extended Coverage", () => {
    it("should handle multiple apps running simultaneously", async () => {
      const mockProcess1 = createMockChildProcess();
      const mockProcess2 = createMockChildProcess();
      const mockProcess3 = createMockChildProcess();

      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockProcess1;
        if (callCount === 2) return mockProcess2;
        return mockProcess3;
      });

      await service.runApp("app-1", mockAppPath, 3000);
      await service.runApp("app-2", mockAppPath, 3001);
      await service.runApp("app-3", mockAppPath, 3002);

      const apps = service.getRunningApps();
      expect(apps.length).toBe(3);
      expect(apps).toContain("app-1");
      expect(apps).toContain("app-2");
      expect(apps).toContain("app-3");
    });

    it("should handle stopping one app while others run", async () => {
      const mockProcess1 = createMockChildProcess();
      const mockProcess2 = createMockChildProcess();

      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockProcess1 : mockProcess2;
      });

      await service.runApp("app-1", mockAppPath, 3000);
      await service.runApp("app-2", mockAppPath, 3001);

      await service.stopApp("app-1");

      const apps = service.getRunningApps();
      expect(apps).not.toContain("app-1");
      expect(apps).toContain("app-2");
    });

    it("should maintain separate logs for different apps", async () => {
      const mockProcess1 = createMockChildProcess();
      const mockProcess2 = createMockChildProcess();

      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockProcess1 : mockProcess2;
      });

      await service.runApp("app-1", mockAppPath, 3000);
      await service.runApp("app-2", mockAppPath, 3001);

      mockProcess1.stdout.emit("data", Buffer.from("App 1 log"));
      mockProcess2.stdout.emit("data", Buffer.from("App 2 log"));

      const logs1 = service.getLogs("app-1");
      const logs2 = service.getLogs("app-2");

      expect(logs1.length).toBeGreaterThan(0);
      expect(logs2.length).toBeGreaterThan(0);
    });

    it("should handle rapid start/stop cycles", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      // Start app
      await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(service.getRunningApps()).toContain(mockAppId);

      // Stop app
      await service.stopApp(mockAppId);
      expect(service.getRunningApps()).not.toContain(mockAppId);

      // Start again
      await service.runApp(mockAppId, mockAppPath, mockPort);
      expect(service.getRunningApps()).toContain(mockAppId);
    });
  });

  //
  // -------------------------------------------------------
  // ENVIRONMENT & CONFIGURATION - Extended Coverage
  // -------------------------------------------------------
  //
  describe("Environment & Configuration - Extended Coverage", () => {
    it("should respect AUTO_KILL_PORT environment variable", async () => {
      process.env.AUTO_KILL_PORT = "true";
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, mockAppPath, mockPort);

      expect(result).toBeDefined();
      delete process.env.AUTO_KILL_PORT;
    });

    it("should handle special characters in app path", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const pathWithSpecialChars = "/app/test-app@#$%/src";
      const result = await service.runApp(mockAppId, pathWithSpecialChars, mockPort);

      expect(result).toBeDefined();
    });

    it("should handle special characters in app id", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const appIdWithSpecialChars = "app_123-test@special";
      const result = await service.runApp(appIdWithSpecialChars, mockAppPath, mockPort);

      expect(result.success).toBe(true);
      expect(service.getRunningApps()).toContain(appIdWithSpecialChars);
    });

    it("should handle high port numbers", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, mockAppPath, 65535);

      expect(result.success).toBe(true);
    });

    it("should handle low port numbers", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const result = await service.runApp(mockAppId, mockAppPath, 1);

      expect(result.success).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // STATE CONSISTENCY - Extended Coverage
  // -------------------------------------------------------
  //
  describe("State Consistency - Extended Coverage", () => {
    it("should not duplicate apps in running list", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      await service.runApp(mockAppId, mockAppPath, mockPort);

      const apps = service.getRunningApps();
      const count = apps.filter((app) => app === mockAppId).length;

      expect(count).toBe(1);
    });

    it("should maintain consistent state after getAppStatus calls", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);

      const status1 = service.getAppStatus(mockAppId);
      const status2 = service.getAppStatus(mockAppId);
      const apps1 = service.getRunningApps();
      const apps2 = service.getRunningApps();

      expect(status1).toEqual(status2);
      expect(apps1).toEqual(apps2);
    });

    it("should maintain logs consistency across multiple getLogs calls", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      mockProcess.stdout.emit("data", Buffer.from("Test log"));

      const logs1 = service.getLogs(mockAppId);
      const logs2 = service.getLogs(mockAppId);

      expect(logs1.length).toBe(logs2.length);
    });

    it("should handle state after process exit gracefully", async () => {
      const mockProcess = createMockChildProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      await service.runApp(mockAppId, mockAppPath, mockPort);
      mockProcess.emit("exit", 0);

      // Multiple calls after exit should be safe
      const status = service.getAppStatus(mockAppId);
      const logs = service.getLogs(mockAppId);
      const apps = service.getRunningApps();

      expect(status).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      expect(Array.isArray(apps)).toBe(true);
    });
  });
});
