import { Link } from "react-router-dom";

/**
 * Fase 010J. El corte de la creación de cotizaciones LEGACY.
 *
 * El Cotizador V2 es el flujo vigente. Lo Legacy queda para CONSULTAR lo que
 * ya existe: abrir una cotización, ver su PDF, terminar un borrador que ya
 * estaba empezado. Lo que se retira es EMPEZAR una nueva por las vías
 * generales —el formulario nuevo, la cotización heredada y el duplicado—.
 *
 * Esto no es la seguridad: el backend rechaza la creación con
 * `LEGACY_QUOTATION_CREATION_DISABLED` aunque alguien llegara al formulario.
 * Aquí se evita ofrecer algo que ya no se puede hacer.
 *
 * La cotización final de una muestra aprobada sigue creando Legacy: es la
 * excepción temporal de 010J, hasta que las muestras tengan camino V2, y no
 * pasa por aquí.
 */
export const CREACION_LEGACY_HABILITADA = false;

/** Lo que se ve al llegar a una dirección de creación Legacy tras el corte. */
export function CreacionLegacyRetirada() {
  return (
    <section
      data-testid="creacion-legacy-retirada"
      className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white/90 p-6 text-center shadow-xs"
    >
      <h1 className="text-lg font-semibold text-zinc-950">
        Las cotizaciones nuevas se hacen en el Cotizador V2
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        El Cotizador Legacy ya no crea cotizaciones. Las que ya existen siguen
        disponibles para consulta, con su PDF, tal como se emitieron.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to="/cotizador-v2"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-medium text-white shadow-xs hover:bg-zinc-800"
        >
          Nueva cotización V2
        </Link>
        <Link
          to="/cotizaciones"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
        >
          Ver cotizaciones Legacy
        </Link>
      </div>
    </section>
  );
}
