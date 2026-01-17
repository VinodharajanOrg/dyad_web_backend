import { useCallback } from "react";
import { atom } from "jotai";
import { IpcClient } from "@/api/ipc_client";
import {
  appOutputAtom,
  appUrlAtom,
  currentAppAtom,
  previewPanelKeyAtom,
  previewErrorMessageAtom,
  selectedAppIdAtom,
} from "@/atoms/appAtoms";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AppOutput } from "@/types/ipc_types";
import { showInputRequest } from "@/lib/toast";
import { useRestartDockerApp, useRunDockerApp } from "./useDockerLifecycle";

const useRunAppLoadingAtom = atom(false);

export function useRunApp() {
  const [loading, setLoading] = useAtom(useRunAppLoadingAtom);
  const [app, setApp] = useAtom(currentAppAtom);
  const setAppOutput = useSetAtom(appOutputAtom);
  const [, setAppUrlObj] = useAtom(appUrlAtom);
  const setPreviewPanelKey = useSetAtom(previewPanelKeyAtom);
  const appId = useAtomValue(selectedAppIdAtom);
  const setPreviewErrorMessage = useSetAtom(previewErrorMessageAtom);
  const runDockerApp = useRunDockerApp();
  const restartDockerApp = useRestartDockerApp();

  const processProxyServerOutput = useCallback(
    (output: AppOutput) => {
      const matchesProxyServerStart = output.message.includes(
        "[dyad-proxy-server]started=[",
      );
      if (matchesProxyServerStart) {
        // Extract both proxy URL and original URL using regex
        const proxyUrlMatch = output.message.match(
          /\[dyad-proxy-server\]started=\[(.*?)\]/,
        );
        const originalUrlMatch = output.message.match(/original=\[(.*?)\]/);

        if (proxyUrlMatch && proxyUrlMatch[1]) {
          const proxyUrl = proxyUrlMatch[1];
          const originalUrl = originalUrlMatch && originalUrlMatch[1];
          setAppUrlObj({
            appUrl: proxyUrl,
            appId: output.appId,
            originalUrl: originalUrl!,
          });
        }
      }
    },
    [setAppUrlObj],
  );

  const processAppOutput = useCallback(
    (output: AppOutput) => {
      // Handle input requests specially
      if (output.type === "input-requested") {
        showInputRequest(output.message, async (response) => {
          try {
            const ipcClient = IpcClient.getInstance();
            if (!ipcClient) {
              console.error("Input response not available in web mode");
              return;
            }
            await (ipcClient as any).respondToAppInput({
              appId: output.appId,
              response,
            });
          } catch (error) {
            console.error("Failed to respond to app input:", error);
          }
        });
        return; // Don't add to regular output
      }

      // Add to regular app output
      setAppOutput((prev) => [...prev, output]);

      // Process proxy server output
      processProxyServerOutput(output);
    },
    [setAppOutput, processProxyServerOutput],
  );

  const runApp = useCallback(
    async (appId: number) => {
      setLoading(true);
      try {
        // Clear the URL and add restart message
        setAppUrlObj({ appUrl: null, appId: null, originalUrl: null });

        setAppOutput((prev) => [
          ...prev,
          {
            message: "Trying to start app...",
            type: "stdout",
            appId,
            timestamp: Date.now(),
          },
        ]);

        // useRunDockerApp handles setting app URL and logging success message
        await runDockerApp(appId);
        setPreviewErrorMessage(undefined);
      } catch (error) {
        console.error(`Error running app ${appId}:`, error);
        setPreviewErrorMessage(
          error instanceof Error
            ? { message: error.message, source: "dyad-app" }
            : {
                message: error?.toString() || "Unknown error",
                source: "dyad-app",
              },
        );
      } finally {
        setLoading(false);
      }
    },
    [
      processAppOutput,
      setAppOutput,
      setAppUrlObj,
      setPreviewErrorMessage,
      runDockerApp,
    ],
  );

  const stopApp = useCallback(async (appId: number) => {
    if (appId === null) {
      return;
    }

    // Check if IPC client is available (null in web mode)
    const ipcClient = IpcClient.getInstance();
    if (!ipcClient) {
      console.warn("App stopping not available in web mode");
      return; // Silently skip in web mode
    }

    setLoading(true);
    try {
      await (ipcClient as any).stopApp(appId);
      setPreviewErrorMessage(undefined);
    } catch (error) {
      console.error(`Error stopping app ${appId}:`, error);
      setPreviewErrorMessage(
        error instanceof Error
          ? { message: error.message, source: "dyad-app" }
          : {
              message: error?.toString() || "Unknown error",
              source: "dyad-app",
            },
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const onHotModuleReload = useCallback(() => {
    setPreviewPanelKey((prev) => prev + 1);
  }, [setPreviewPanelKey]);

  const restartApp = useCallback(
    async ({
      removeNodeModules = false,
    }: { removeNodeModules?: boolean } = {}) => {
      if (appId === null) {
        return;
      }

      setLoading(true);
      try {
        // Check if IPC client is available (null in web mode)
        const ipcClient = IpcClient.getInstance();

        if (!ipcClient) {
          // Web mode: restart Docker container for this appId
          await restartDockerApp(appId);
        }
        console.debug(
          "Restarting app",
          appId,
          removeNodeModules ? "with node_modules cleanup" : "",
        );

        // Clear the URL and add restart message
        setAppUrlObj({ appUrl: null, appId: null, originalUrl: null });
        setAppOutput((prev) => [
          ...prev,
          {
            message: "Restarting app...",
            type: "stdout",
            appId,
            timestamp: Date.now(),
          },
        ]);

        // const app = await (ipcClient as any).getApp(appId);
        // setApp(app);
        // await (ipcClient as any).restartApp(
        //   appId,
        //   (output: any) => {
        //     // Handle HMR updates before processing
        //     if (
        //       output.message.includes("hmr update") &&
        //       output.message.includes("[vite]")
        //     ) {
        //       onHotModuleReload();
        //     }
        //     // Process normally (including input requests)
        //     processAppOutput(output);
        //   },
        //   removeNodeModules,
        // );
      } catch (error) {
        console.error(`Error restarting app ${appId}:`, error);
        setPreviewErrorMessage(
          error instanceof Error
            ? { message: error.message, source: "dyad-app" }
            : {
                message: error?.toString() || "Unknown error",
                source: "dyad-app",
              },
        );
      } finally {
        setPreviewPanelKey((prev) => prev + 1);
        setLoading(false);
      }
    },
    [
      appId,
      setApp,
      setAppOutput,
      setAppUrlObj,
      setPreviewPanelKey,
      processAppOutput,
      onHotModuleReload,
      restartDockerApp,
    ],
  );

  const refreshAppIframe = useCallback(async () => {
    setPreviewPanelKey((prev) => prev + 1);
  }, [setPreviewPanelKey]);

  return {
    loading,
    runApp,
    stopApp,
    restartApp,
    app,
    refreshAppIframe,
  };
}
