"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";
type Toast = {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number; // ms
};

type ToastContextValue = {
  show: (
    message: string,
    opts?: { type?: ToastType; duration?: number; id?: string }
  ) => string;
  update: (
    id: string,
    message: string,
    opts?: { type?: ToastType; duration?: number }
  ) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (
      message: string,
      opts?: { type?: ToastType; duration?: number; id?: string }
    ) => {
      const id = opts?.id ?? Math.random().toString(36).slice(2);
      const duration = opts?.duration ?? 2500;
      const type = opts?.type ?? "info";
      const toast: Toast = { id, message, type, duration };
      setToasts((prev) => [...prev, toast]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const update = useCallback(
    (
      id: string,
      message: string,
      opts?: { type?: ToastType; duration?: number }
    ) => {
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, message, type: opts?.type ?? t.type } : t
        )
      );
      const duration = opts?.duration;
      if (duration && duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({ show, update, dismiss }),
    [show, update, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport - optimized for screen recording */}
      <div className="fixed top-4 right-4 z-[1000] space-y-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              `min-w-[240px] max-w-[360px] rounded-lg px-4 py-3 shadow-lg border will-change-transform ` +
              (t.type === "success"
                ? "bg-green-600/90 border-green-400 text-white"
                : t.type === "error"
                  ? "bg-red-700/90 border-red-400 text-white"
                  : "bg-gray-800/90 border-gray-600 text-white")
            }
            role="status"
          >
            <div className="text-sm leading-snug">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
