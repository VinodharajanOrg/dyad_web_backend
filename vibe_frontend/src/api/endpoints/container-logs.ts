import { apiClient } from "../client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export interface ContainerLogEvent {
  event: string;
  data: any;
}

export const containerLogsApi = {
  /**
   * Stream container logs using HTTP streaming
   *
   * Events streamed as SSE format:
   * - status: Connection status
   * - log: Regular container logs
   * - event: Container lifecycle events
   * - error: Error messages
   * - heartbeat: Keep-alive signal
   * - complete: Stream end
   */
  streamLogs: async (
    appId: number,
    callbacks: {
      onStatus?: (status: any) => void;
      onLog?: (log: any) => void;
      onEvent?: (event: any) => void;
      onError?: (error: any) => void;
      onComplete?: (data: any) => void;
    },
    options?: { follow?: boolean; tail?: number },
    retryCount = 0,
  ): Promise<void> => {
    const params = new URLSearchParams();
    if (options?.follow !== undefined)
      params.append("follow", String(options.follow));
    if (options?.tail) params.append("tail", String(options.tail));

    const url = `${API_BASE_URL}/container-logs/${appId}/stream${params.toString() ? "?" + params.toString() : ""}`;

    // Get fresh token - this will pull from memory or cookies
    let token = apiClient.getAccessToken();

    // If no token in memory and this is a retry, try to restore from cookies
    if (!token && retryCount > 0) {
      apiClient.restoreTokensFromCookiesPublic();
      token = apiClient.getAccessToken();
    }

    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    // Handle 401 - token expired, retry once after restoring tokens
    if (response.status === 401 && retryCount === 0) {
      apiClient.restoreTokensFromCookiesPublic();
      // Retry once
      return containerLogsApi.streamLogs(appId, callbacks, options, 1);
    }

    if (!response.ok) {
      const error = await response.text();
      callbacks.onError?.(error || "Failed to start streaming");
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventLines = line.split("\n");
          let eventType = "log";
          let data = "";

          for (const eventLine of eventLines) {
            if (eventLine.startsWith("event:")) {
              eventType = eventLine.substring(6).trim();
            } else if (eventLine.startsWith("data:")) {
              data = eventLine.substring(5).trim();
            }
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            switch (eventType) {
              case "status":
                callbacks.onStatus?.(parsed);
                break;
              case "log":
                callbacks.onLog?.(parsed);
                break;
              case "event":
                callbacks.onEvent?.(parsed);
                break;
              case "error":
                callbacks.onError?.(parsed);
                break;
              case "heartbeat":
                // Ignore heartbeats
                break;
              case "complete":
                callbacks.onComplete?.(parsed);
                break;
            }
          } catch {
            console.error("Failed to parse container log event:", data);
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        callbacks.onError?.(error.message || "Stream failed");
      }
    }
  },

  /**
   * Get historical container logs (non-streaming)
   */
  async getHistory(
    appId: number,
    options?: { lines?: number; since?: string },
  ) {
    const params = new URLSearchParams();
    if (options?.lines) params.append("lines", String(options.lines));
    if (options?.since) params.append("since", options.since);

    const response = await apiClient.get<{
      success: boolean;
      data: {
        appId: string;
        type?: string;
        totalLines: number;
        logs: Array<{
          timestamp: string;
          message: string;
          level: "info" | "error" | "warn";
          raw: string;
        }>;
      };
    }>(
      `/api/container-logs/${appId}/history${params.toString() ? "?" + params.toString() : ""}`,
    );

    return response.data;
  },

  /**
   * Get container lifecycle events
   */
  async getEvents(appId: number) {
    const response = await apiClient.get<{
      success: boolean;
      data: {
        appId: string;
        type: string;
        containerName?: string;
        events: Array<{
          type: string;
          timestamp: string;
          uptime?: number;
          port?: number;
        }>;
        message?: string;
      };
    }>(`/api/container-logs/${appId}/events`);

    return response.data;
  },
};
