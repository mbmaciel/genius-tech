import { useEffect, useState } from "react";
import { ToastProps, ToasterToast } from "@/hooks/use-toast";

export function Toaster() {
  const [toasts, setToasts] = useState<ToasterToast[]>([]);

  useEffect(() => {
    // Obtém toasts do estado global
    const handleToastChange = (state: { toasts: ToasterToast[] }) => {
      setToasts(state.toasts);
    };

    // Registra um ouvinte global
    window.addEventListener("toast-update", ((event: CustomEvent) => {
      handleToastChange(event.detail);
    }) as EventListener);

    return () => {
      window.removeEventListener("toast-update", ((event: CustomEvent) => {
        handleToastChange(event.detail);
      }) as EventListener);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-md shadow-lg transition-all transform animate-in fade-in slide-in-from-right-5 duration-300 
            ${toast.variant === "destructive" ? "bg-red-600 text-white" : 
              toast.variant === "success" ? "bg-green-600 text-white" : 
              "bg-[#1d2a45] text-white"}`}
        >
          {toast.title && (
            <div className="font-medium mb-1">{toast.title}</div>
          )}
          {toast.description && (
            <div className="text-sm">{toast.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}