import type { ReactNode } from "react";

import { Spinner } from "@/components/Spinner";

interface StatusScreenProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

/** Pantalla centrada para estados de carga o de error a nivel de aplicacion. */
export function StatusScreen({ title, description, children }: StatusScreenProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-base font-medium text-zinc-900 dark:text-zinc-100">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </div>
  );
}

/** Estado de carga mientras se verifica la sesion contra el backend. */
export function LoadingScreen({ message = "Verificando sesion" }: { message?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Spinner className="size-4" />
        <span>{message}</span>
      </div>
    </div>
  );
}
