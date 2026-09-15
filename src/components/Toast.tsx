"use client";

import { useCallback, useState } from "react";

export type ToastMsg = { id: number; text: string; kind: "ok" | "err" };
export type ToastApi = (text: string, kind?: "ok" | "err") => void;

export function useToast() {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const push: ToastApi = useCallback((text, kind = "ok") => {
    const id = Date.now() + Math.random();
    setMsgs((m) => [...m, { id, text, kind }]);
    setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 3400);
  }, []);
  (push as unknown as { list: ToastMsg[] }).list = msgs;
  return push as ToastApi & { list: ToastMsg[] };
}

export function ToastHost({ toast }: { toast: ToastApi & { list: ToastMsg[] } }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse gap-2 items-center pointer-events-none">
      {toast.list.map((m) => (
        <div
          key={m.id}
          className={`px-4 py-3 rounded-lg text-[13.5px] font-semibold shadow-lg max-w-[86vw] text-center ${
            m.kind === "err" ? "bg-bad text-white" : "bg-ink text-bg"
          }`}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
