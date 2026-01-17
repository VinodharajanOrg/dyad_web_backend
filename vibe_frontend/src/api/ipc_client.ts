// Stub for web mode - IPC not available
export class IpcClient {
  public static getInstance(): IpcClient | null {
    return null;
  }

  async checkAppName(_params: any): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async checkProblems(_params: any): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async getChatContextResults(_params: any): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async setChatContext(_params: any): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async getUserBudget(): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async listSupabaseProjects(): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async listSupabaseBranches(_params: any): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async setSupabaseAppProject(_params: any): Promise<any> {
    throw new Error("IPC not available in web mode");
  }

  async unsetSupabaseAppProject(_params: any): Promise<any> {
    throw new Error("IPC not available in web mode");
  }
}
