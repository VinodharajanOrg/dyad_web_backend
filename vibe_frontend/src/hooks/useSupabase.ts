import { useCallback } from "react";
import { useAtom } from "jotai";
import {
  supabaseProjectsAtom,
  supabaseBranchesAtom,
  supabaseLoadingAtom,
  supabaseErrorAtom,
  selectedSupabaseProjectAtom,
} from "@/atoms/supabaseAtoms";
import { IpcClient } from "@/api/ipc_client";
import { SetSupabaseAppProjectParams } from "@/types/ipc_types";

export function useSupabase() {
  const [projects, setProjects] = useAtom(supabaseProjectsAtom);
  const [branches, setBranches] = useAtom(supabaseBranchesAtom);
  const [loading, setLoading] = useAtom(supabaseLoadingAtom);
  const [error, setError] = useAtom(supabaseErrorAtom);
  const [selectedProject, setSelectedProject] = useAtom(
    selectedSupabaseProjectAtom,
  );

  /**
   * Load Supabase projects from the API
   */
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const client = IpcClient.getInstance();
      if (!client) throw new Error("IPC client is not available");
      const projectList = await client.listSupabaseProjects();
      setProjects(projectList);
      setError(null);
    } catch (error) {
      console.error("Error loading Supabase projects:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [setProjects, setError, setLoading]);

  /**
   * Load branches for a Supabase project
   */
  const loadBranches = useCallback(
    async (projectId: string) => {
      setLoading(true);
      try {
        const client = IpcClient.getInstance();
        if (!client) throw new Error("IPC client is not available");
        const list = await client.listSupabaseBranches({ projectId });
        setBranches(Array.isArray(list) ? list : []);
        setError(null);
      } catch (error) {
        console.error("Error loading Supabase branches:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    },
    [setBranches, setError, setLoading],
  );

  /**
   * Associate a Supabase project with an app
   */
  const setAppProject = useCallback(
    async (params: SetSupabaseAppProjectParams) => {
      setLoading(true);
      try {
        const client = IpcClient.getInstance();
        if (!client) throw new Error("IPC client is not available");
        await client.setSupabaseAppProject(params);
        setError(null);
      } catch (error) {
        console.error("Error setting Supabase project for app:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading],
  );

  /**
   * Remove a Supabase project association from an app
   */
  const unsetAppProject = useCallback(
    async (appId: number) => {
      setLoading(true);
      try {
        const client = IpcClient.getInstance();
        if (!client) throw new Error("IPC client is not available");
        await client.unsetSupabaseAppProject(appId);
        setError(null);
      } catch (error) {
        console.error("Error unsetting Supabase project for app:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading],
  );

  /**
   * Select a project for current use
   */
  const selectProject = useCallback(
    (projectId: string | null) => {
      setSelectedProject(projectId);
    },
    [setSelectedProject],
  );

  return {
    projects,
    branches,
    loading,
    error,
    selectedProject,
    loadProjects,
    loadBranches,
    setAppProject,
    unsetAppProject,
    selectProject,
  };
}
