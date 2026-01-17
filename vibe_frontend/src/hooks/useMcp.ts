import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IpcClient } from "@/api/ipc_client";

export type Transport = "stdio" | "http";

export type McpServer = any;
export type McpServerUpdate = any;
export type McpTool = any;
export type McpToolConsent = any;
export type CreateMcpServer = any;

export function useMcp() {
  const queryClient = useQueryClient();

  const serversQuery = useQuery<McpServer[], Error>({
    queryKey: ["mcp", "servers"],
    queryFn: async () => {
      const ipc = IpcClient.getInstance();
      if (!ipc) return [];
      // @ts-ignore
      const list = await ipc.listMcpServers();
      return (list || []) as McpServer[];
    },
    meta: { showErrorToast: false },
  });

  const serverIds = useMemo(
    () => (serversQuery.data || []).map((s) => s.id).sort((a, b) => a - b),
    [serversQuery.data],
  );

  const toolsByServerQuery = useQuery<Record<number, McpTool[]>, Error>({
    queryKey: ["mcp", "tools-by-server", serverIds],
    enabled: serverIds.length > 0,
    queryFn: async () => {
      const ipc = IpcClient.getInstance();
      if (!ipc) return {};
      const entries = await Promise.all(
        serverIds.map(async (id) => {
          // @ts-ignore
          return [id, await ipc.listMcpTools(id)] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<number, McpTool[]>;
    },
    meta: { showErrorToast: false },
  });

  const consentsQuery = useQuery<McpToolConsent[], Error>({
    queryKey: ["mcp", "consents"],
    queryFn: async () => {
      const ipc = IpcClient.getInstance();
      if (!ipc) return [];
      // @ts-ignore
      const list = await ipc.getMcpToolConsents();
      return (list || []) as McpToolConsent[];
    },
    meta: { showErrorToast: false },
  });

  const consentsMap = useMemo(() => {
    const map: Record<string, McpToolConsent["consent"]> = {};
    for (const c of consentsQuery.data || []) {
      map[`${c.serverId}:${c.toolName}`] = c.consent;
    }
    return map;
  }, [consentsQuery.data]);

  const createServerMutation = useMutation({
    mutationFn: async (params: CreateMcpServer) => {
      const ipc = IpcClient.getInstance();
      if (!ipc) throw new Error("IPC not available in web mode");
      // @ts-ignore
      return ipc.createMcpServer(params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      await queryClient.invalidateQueries({
        queryKey: ["mcp", "tools-by-server"],
      });
    },
    meta: { showErrorToast: true },
  });

  const updateServerMutation = useMutation({
    mutationFn: async (params: McpServerUpdate) => {
      const ipc = IpcClient.getInstance();
      if (!ipc) throw new Error("IPC not available in web mode");
      // @ts-ignore
      return ipc.updateMcpServer(params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      await queryClient.invalidateQueries({
        queryKey: ["mcp", "tools-by-server"],
      });
    },
    meta: { showErrorToast: true },
  });

  const deleteServerMutation = useMutation({
    mutationFn: async (id: number) => {
      const ipc = IpcClient.getInstance();
      if (!ipc) throw new Error("IPC not available in web mode");
      // @ts-ignore
      return ipc.deleteMcpServer(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      await queryClient.invalidateQueries({
        queryKey: ["mcp", "tools-by-server"],
      });
    },
    meta: { showErrorToast: true },
  });

  const setConsentMutation = useMutation({
    mutationFn: async (params: {
      serverId: number;
      toolName: string;
      consent: McpToolConsent["consent"];
    }) => {
      const ipc = IpcClient.getInstance();
      if (!ipc) throw new Error("IPC not available in web mode");
      // @ts-ignore
      return ipc.setMcpToolConsent(params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mcp", "consents"] });
    },
    meta: { showErrorToast: true },
  });

  const createServer = async (params: CreateMcpServer) =>
    createServerMutation.mutateAsync(params);

  const toggleEnabled = async (id: number, currentEnabled: boolean) =>
    updateServerMutation.mutateAsync({ id, enabled: !currentEnabled });

  const updateServer = async (params: McpServerUpdate) =>
    updateServerMutation.mutateAsync(params);

  const deleteServer = async (id: number) =>
    deleteServerMutation.mutateAsync(id);

  const setToolConsent = async (
    serverId: number,
    toolName: string,
    consent: McpToolConsent["consent"],
  ) => setConsentMutation.mutateAsync({ serverId, toolName, consent });

  const refetchAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] }),
      queryClient.invalidateQueries({ queryKey: ["mcp", "tools-by-server"] }),
      queryClient.invalidateQueries({ queryKey: ["mcp", "consents"] }),
    ]);
  };

  return {
    servers: serversQuery.data || [],
    toolsByServer: toolsByServerQuery.data || {},
    consentsList: consentsQuery.data || [],
    consentsMap,
    isLoading:
      serversQuery.isLoading ||
      toolsByServerQuery.isLoading ||
      consentsQuery.isLoading,
    error:
      serversQuery.error || toolsByServerQuery.error || consentsQuery.error,
    refetchAll,

    // Mutations
    createServer,
    toggleEnabled,
    updateServer,
    deleteServer,
    setToolConsent,

    // Status flags
    isCreating: createServerMutation.isPending,
    isToggling: updateServerMutation.isPending,
    isUpdatingServer: updateServerMutation.isPending,
    isDeleting: deleteServerMutation.isPending,
    isSettingConsent: setConsentMutation.isPending,
  } as const;
}
