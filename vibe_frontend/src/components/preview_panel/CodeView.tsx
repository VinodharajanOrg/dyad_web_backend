"use client";
import { FileEditor } from "./FileEditor";
import { FileTree } from "./FileTree";
import { RefreshCw, Download } from "lucide-react";
import { useLoadApp } from "@/hooks/useLoadApp";
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/viewAtoms";
import { previewPanelKeyAtom } from "@/atoms/appAtoms";
import { appsApi } from "@/api/endpoints/apps";
import { showError, showSuccess } from "@/lib/toast";
import { useState } from "react";

interface App {
  id?: number;
  name?: string;
  files?: string[];
}

export interface CodeViewProps {
  loading: boolean;
  app: App | null;
}

// Code view component that displays app files or status messages
export const CodeView = ({ loading, app }: CodeViewProps) => {
  const selectedFile = useAtomValue(selectedFileAtom);
  const { refreshApp } = useLoadApp(app?.id ?? null);
  const previewPanelKey = useAtomValue(previewPanelKeyAtom);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!app?.id) return;

    try {
      setIsExporting(true);
      const blob = await appsApi.export(app.id);
      
      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${app.name || 'app'}-export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess('App exported successfully!');
    } catch (error) {
      console.error('Failed to export app:', error);
      showError('Failed to export app');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading files...</div>;
  }

  if (!app) {
    return (
      <div className="text-center py-4 text-gray-500">No app selected</div>
    );
  }

  if (app.files && app.files.length > 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => refreshApp()}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !app.id}
              title="Refresh Files"
            >
              <RefreshCw size={16} />
            </button>
            <div className="text-sm text-gray-500">{app.files.length} files</div>
          </div>
          <button
            onClick={handleExport}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isExporting || !app.id}
            title="Export App"
          >
            <Download size={16} className={isExporting ? 'animate-pulse' : ''} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 overflow-auto border-r">
            <FileTree files={app.files} />
          </div>
          <div className="w-2/3">
            {selectedFile ? (
              <FileEditor
                key={`${app.id}-${selectedFile.path}-${previewPanelKey}`}
                appId={app.id ?? null}
                filePath={selectedFile.path}
              />
            ) : (
              <div className="text-center py-4 text-gray-500">
                Select a file to view
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <div className="text-center py-4 text-gray-500">No files found</div>;
};
