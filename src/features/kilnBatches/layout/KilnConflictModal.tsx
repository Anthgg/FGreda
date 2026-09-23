import { useEffect, useRef } from "react";
import { ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon } from "./layoutIcons";

interface KilnConflictModalProps {
  isOpen: boolean;
  onReload: () => void;
  onClose: () => void;
}

export function KilnConflictModal({
  isOpen,
  onReload,
  onClose,
}: KilnConflictModalProps) {
  const reloadButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Enfocar acción principal
      const timer = setTimeout(() => {
        reloadButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-900/10">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2 text-amber-600">
            <ExclamationTriangleIcon className="h-6 w-6" />
            <h3 id="conflict-modal-title" className="text-base font-semibold text-zinc-900">
              Distribución modificada en otra sesión
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2 text-xs text-zinc-600">
          <p>
            La distribución física de esta hornada fue guardada con una versión más reciente
            en otra sesión o por otro usuario mientras trabajabas en este borrador.
          </p>
          <p className="font-medium text-zinc-800">
            Para evitar sobrescribir los cambios recientes, puedes recargar la versión actual del
            servidor o cerrar esta ventana para revisar tu borrador local antes de decidir.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cerrar y revisar borrador
          </button>
          <button
            ref={reloadButtonRef}
            type="button"
            onClick={onReload}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Recargar desde servidor
          </button>
        </div>
      </div>
    </div>
  );
}
