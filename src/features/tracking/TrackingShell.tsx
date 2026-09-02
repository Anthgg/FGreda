import type { ReactNode } from "react";

/**
 * Marco de la superficie pública.
 *
 * Deliberadamente **no** es el `AppShell`: no lleva menú, ni buscador, ni acceso
 * a inventario, ni nombre de usuario. Quien llega aquí viene de apuntar la
 * cámara a un papel, y lo único que ha pedido es saber cómo va su pieza.
 *
 * Está pensado para leerse de pie y con una mano: una columna estrecha, tipos
 * grandes y nada que pulsar por error. En escritorio no crece más que en el
 * móvil porque no hay más que enseñar.
 */
export function TrackingShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="flex min-h-dvh w-full justify-center bg-zinc-50 px-4 py-8 text-zinc-900 sm:py-14"
      style={{ colorScheme: "light" }}
    >
      <div className="w-full max-w-lg">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">
          Consulta de seguimiento · sólo lectura
        </p>
      </div>
    </main>
  );
}
