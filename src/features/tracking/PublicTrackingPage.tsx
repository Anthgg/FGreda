import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { fetchTrackingDocument } from "@/api/tracking";
import { Spinner } from "@/components/Spinner";
import {
  type EstadoTono,
  estadoPublico,
  fechaLegible,
  hitosDe,
} from "@/features/tracking/estado";
import { TrackingShell } from "@/features/tracking/TrackingShell";
import { useTracking, useTrackingInternalLink } from "@/features/tracking/useTracking";

const TONOS: Record<EstadoTono, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  active: "bg-blue-50 text-blue-800 ring-blue-200",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  void: "bg-red-50 text-red-800 ring-red-200",
};

/**
 * Seguimiento público de una orden de producción.
 *
 * **Sólo lectura, y por construcción.** No hay aquí ni un botón que arranque,
 * complete, anule, edite o ajuste nada: no es que estén ocultos, es que no
 * existen en este árbol. La autoridad sigue siendo el backend, que no expone
 * ninguna escritura bajo `/tracking`.
 *
 * Lo que se enseña es lo que el backend deja salir sin sesión: el código de la
 * orden, en qué punto va y qué piezas son. Ni el almacén, ni el material, ni
 * los gramos, ni la cotización de origen, ni el cliente.
 */
export function PublicTrackingPage() {
  const seguimiento = useTracking();
  const puente = useTrackingInternalLink(seguimiento.isSuccess);

  const [documento, setDocumento] = useState<{ url: string; filename: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);
  // En una ref además del estado para poder revocar la URL al desmontar sin
  // que el efecto dependa del propio documento y se reejecute.
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  if (seguimiento.isPending) {
    return (
      <TrackingShell>
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-600">
          <Spinner className="size-4" />
          <span>Cargando el seguimiento…</span>
        </div>
      </TrackingShell>
    );
  }

  if (seguimiento.isError || !seguimiento.data) {
    return (
      <TrackingShell>
        <p className="text-sm font-medium text-zinc-900">No hay ningún seguimiento abierto.</p>
        <p className="mt-2 text-sm text-zinc-600">
          Escanea el código QR de la hoja de producción para consultar el estado de tu pedido.
        </p>
      </TrackingShell>
    );
  }

  const datos = seguimiento.data;
  const estado = estadoPublico(datos.status);
  const hitos = hitosDe(datos);

  /**
   * Abre la constancia dentro de la página.
   *
   * No se usa `window.open`: el permiso del navegador para abrir una pestaña
   * caduca con el gesto del usuario, y aquí hay un `await` de por medio para
   * pedir el PDF. El resultado era un botón que no hacía nada, sin error
   * visible. Se descubrió en producción en 009I.
   */
  async function verDocumento(): Promise<void> {
    setErrorDocumento(null);
    setCargando(true);
    try {
      const { blob, filename } = await fetchTrackingDocument();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setDocumento({ url, filename: filename ?? "seguimiento.pdf" });
    } catch {
      setErrorDocumento("No se pudo abrir el documento. Vuelve a escanear el código.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <TrackingShell>
      <header className="border-b border-zinc-100 pb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {datos.company_name}
        </p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-900">Seguimiento de producción</h1>
        <p className="mt-1 font-mono text-sm text-zinc-600">{datos.order_code}</p>
        <p
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${TONOS[estado.tono]}`}
        >
          {estado.label}
        </p>
      </header>

      <section className="py-5" aria-label="Estado del proceso">
        <ol className="space-y-4">
          {hitos.map((hito) => {
            const cuando = fechaLegible(hito.fecha);
            return (
              <li key={hito.label} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={
                    hito.hecho
                      ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white"
                      : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-[11px] text-zinc-300"
                  }
                >
                  {hito.hecho ? "✓" : "○"}
                </span>
                <div>
                  <p
                    className={
                      hito.hecho
                        ? "text-sm font-medium text-zinc-900"
                        : "text-sm text-zinc-400"
                    }
                  >
                    {hito.label}
                  </p>
                  <p className="text-xs text-zinc-500">{cuando ?? "Pendiente"}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="border-t border-zinc-100 pt-5" aria-label="Piezas">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Piezas
        </h2>
        <ul className="divide-y divide-zinc-100">
          {datos.items.map((item, indice) => (
            <li
              key={`${item.product_name}-${indice}`}
              className="flex items-baseline justify-between gap-4 py-2"
            >
              <span className="text-sm text-zinc-900">{item.product_name}</span>
              <span className="shrink-0 text-sm font-semibold text-zinc-900">
                {item.quantity === null ? "—" : `${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 border-t border-zinc-100 pt-5">
        <button
          type="button"
          onClick={() => void verDocumento()}
          disabled={cargando}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-xs hover:bg-zinc-50 disabled:opacity-60 sm:w-auto"
        >
          {cargando ? "Generando…" : documento ? "Actualizar documento" : "Ver documento"}
        </button>

        {errorDocumento ? (
          <p className="mt-2 text-sm text-red-700">{errorDocumento}</p>
        ) : null}

        {documento ? (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap gap-2">
              {/* Enlaces y no `window.open`: son un gesto directo del usuario y
                  el navegador no los bloquea. */}
              <a
                href={documento.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
              >
                ↗ Abrir pestaña
              </a>
              <a
                href={documento.url}
                download={documento.filename}
                className="inline-flex min-h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
              >
                ⬇ Descargar
              </a>
            </div>
            <iframe
              src={documento.url}
              title={`Seguimiento ${datos.order_code}`}
              className="h-[60vh] w-full rounded-xl border border-zinc-200 bg-white"
            />
          </div>
        ) : null}
      </section>

      {/* Sólo aparece para quien ya tiene sesión: el backend responde 401 a
          cualquier otro y entonces esto sencillamente no se dibuja. Lo que esa
          persona pueda hacer después con la orden lo decide la matriz de 009J,
          no esta pantalla. */}
      {puente.isSuccess ? (
        <div className="mt-5 border-t border-zinc-100 pt-5">
          <Link
            to={`/produccion/${puente.data.production_order_id}`}
            className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
          >
            Abrir esta orden en la aplicación →
          </Link>
        </div>
      ) : null}
    </TrackingShell>
  );
}
