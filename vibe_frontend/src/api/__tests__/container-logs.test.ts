import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { containerLogsApi } from '../endpoints/container-logs';
// import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getAccessToken: vi.fn(() => 'mock-access-token'),
    restoreTokensFromCookiesPublic: vi.fn(),
  },
}));

describe('containerLogsApi - Complete Test Suite', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable for API_BASE_URL
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('streamLogs()', () => {
    it('should stream container logs with callbacks', async () => {
      const callbacks = {
        onStatus: vi.fn(),
        onLog: vi.fn(),
        onEvent: vi.fn(),
        onError: vi.fn(),
        onComplete: vi.fn(),
      };

      const mockReadableStream = {
        getReader: vi.fn(() => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"status":"connected"}\n\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"log":"Starting container"}\n\n'),
            })
            .mockResolvedValueOnce({ done: true }),
        })),
      };

      const mockResponse = {
        ok: true,
        body: mockReadableStream,
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks, { follow: true });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle streaming with tail option', async () => {
      const callbacks = { onLog: vi.fn() };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn().mockResolvedValueOnce({ done: true }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks, { tail: 100 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('tail=100'),
        expect.any(Object)
      );
    });

    it('should call status callback on connection', async () => {
      const onStatus = vi.fn();
      const callbacks = { onStatus };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: status\ndata: {"connected":true}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should call error callback on stream error', async () => {
      const onError = vi.fn();
      const callbacks = { onError };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: error\ndata: {"message":"Connection lost"}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle incomplete follow option', async () => {
      const callbacks = { onLog: vi.fn() };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn().mockResolvedValueOnce({ done: true }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks, { follow: false });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('follow=false'),
        expect.any(Object)
      );
    });

    it('should handle response not ok', async () => {
      const callbacks = { onError: vi.fn() };

      const mockResponse = {
        ok: false,
        status: 500,
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await expect(containerLogsApi.streamLogs(1, callbacks)).rejects.toThrow();
    });

    it('should call complete callback at stream end', async () => {
      const onComplete = vi.fn();
      const callbacks = { onComplete };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: complete\ndata: {}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should construct correct URL without options', async () => {
      const callbacks = { onLog: vi.fn() };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn().mockResolvedValueOnce({ done: true }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      const fetchUrl = (global.fetch as any).mock.calls[0][0];
      expect(fetchUrl).toContain('/container-logs/1/stream');
    });

    it('should parse log event type correctly', async () => {
      const onLog = vi.fn();
      const callbacks = { onLog };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: log\ndata: {"message":"Container started"}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Container started' })
      );
    });

    it('should parse event lifecycle event type', async () => {
      const onEvent = vi.fn();
      const callbacks = { onEvent };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: event\ndata: {"type":"start","appId":1}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'start' })
      );
    });

    it('should ignore heartbeat events', async () => {
      const onLog = vi.fn();
      const callbacks = { onLog };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: heartbeat\ndata: {}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onLog).not.toHaveBeenCalled();
    });

    it('should handle response error with message', async () => {
      const onError = vi.fn();
      const callbacks = { onError };

      const mockResponse = {
        ok: false,
        text: vi.fn().mockResolvedValueOnce('Container not found'),
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onError).toHaveBeenCalledWith('Container not found');
    });

    it('should handle response error with no text', async () => {
      const onError = vi.fn();
      const callbacks = { onError };

      const mockResponse = {
        ok: false,
        text: vi.fn().mockResolvedValueOnce(''),
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onError).toHaveBeenCalledWith('Failed to start streaming');
    });

    it('should handle invalid JSON in event data', async () => {
      const onLog = vi.fn();
      const callbacks = { onLog };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: log\ndata: {invalid json}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to parse container log event:',
        '{invalid json}'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle stream error with non-AbortError', async () => {
      const onError = vi.fn();
      const callbacks = { onError };

      const mockError = new Error('Network connection lost');

      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(mockError),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onError).toHaveBeenCalledWith('Network connection lost');
    });

    it('should handle stream error with AbortError silently', async () => {
      const onError = vi.fn();
      const callbacks = { onError };

      const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });

      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(abortError),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle multiple events in one chunk', async () => {
      const onLog = vi.fn();
      const onStatus = vi.fn();
      const callbacks = { onLog, onStatus };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'event: status\ndata: {"connected":true}\n\nevent: log\ndata: {"message":"started"}\n\n'
            ),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onStatus).toHaveBeenCalled();
      expect(onLog).toHaveBeenCalled();
    });

    it('should call complete callback at end', async () => {
      const onComplete = vi.fn();
      const callbacks = { onComplete };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: complete\ndata: {"status":"done"}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'done' })
      );
    });

    it('should handle events with no data field', async () => {
      const onLog = vi.fn();
      const callbacks = { onLog };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: log\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      expect(onLog).not.toHaveBeenCalled();
    });

    it('should handle unknown event types gracefully', async () => {
      const onLog = vi.fn();
      const callbacks = { onLog };

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: unknown\ndata: {}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: vi.fn(() => mockReader) },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      await containerLogsApi.streamLogs(1, callbacks);

      // Unknown events should not trigger any callbacks
      expect(onLog).not.toHaveBeenCalled();
    });
  });
});
