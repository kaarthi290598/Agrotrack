"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  description: string;
  duration?: number;
}

interface ToastContextType {
  toast: (message: Omit<ToastMessage, "id">) => void;
  toasts: ToastMessage[];
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type, title, description, duration = 3000 }: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      
      setToasts((prev) => [...prev, { id, type, title, description, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, toasts, dismiss }}>
      {children}
      {/* Toast Portal/Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4">
        {toasts.map((t) => {
          const icons = {
            success: <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />,
            error: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />,
            info: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          };

          const borders = {
            success: "border-green-200 bg-green-50/95 text-green-900 dark:border-green-900/30 dark:bg-green-950/95 dark:text-green-100",
            error: "border-red-200 bg-red-50/95 text-red-900 dark:border-red-900/30 dark:bg-red-950/95 dark:text-red-100",
            info: "border-blue-200 bg-blue-50/95 text-blue-900 dark:border-blue-900/30 dark:bg-blue-950/95 dark:text-blue-100"
          };

          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 pointer-events-auto ${borders[t.type]}`}
              role="alert"
            >
              {icons[t.type]}
              <div className="flex-1 space-y-0.5">
                {t.title && <h4 className="text-sm font-semibold">{t.title}</h4>}
                <p className="text-xs font-medium leading-relaxed opacity-90">{t.description}</p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-lg p-0.5 hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
