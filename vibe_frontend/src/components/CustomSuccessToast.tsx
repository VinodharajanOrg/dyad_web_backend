"use client";
import React from "react";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";

interface CustomSuccessToastProps {
  message: string;
  toastId: string | number;
}

export function CustomSuccessToast({
  message,
  toastId,
}: CustomSuccessToastProps) {
  const handleClose = () => {
    toast.dismiss(toastId);
  };

  return (
    <div className="relative bg-green-50/95 backdrop-blur-sm border border-green-200 rounded-xl shadow-lg min-w-[350px] max-w-[500px] overflow-hidden">
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                </div>
                <h3 className="ml-3 text-sm font-medium text-green-900">
                  Success
                </h3>
              </div>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-100/70 rounded-lg transition-all duration-150 flex-shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2">
              <p className="text-sm text-green-800 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
