"use client";
import React from "react";
import { toast } from "sonner";
import { Info, X } from "lucide-react";

interface CustomInfoToastProps {
  message: string;
  toastId: string | number;
}

export function CustomInfoToast({ message, toastId }: CustomInfoToastProps) {
  const handleClose = () => {
    toast.dismiss(toastId);
  };

  return (
    <div className="relative bg-blue-50/95 backdrop-blur-sm border border-blue-200 rounded-xl shadow-lg min-w-[350px] max-w-[500px] overflow-hidden">
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Info className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
                <h3 className="ml-3 text-sm font-medium text-blue-900">Info</h3>
              </div>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100/70 rounded-lg transition-all duration-150 flex-shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2">
              <p className="text-sm text-blue-800 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
