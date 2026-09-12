import { formatMoney } from "@/features/quotations/money";
import {
  PASOS,
  type DatosDelFlujo,
  type EstadoPaso,
  type PasoId,
} from "@/features/cotizadorV2/pasos";
import { V2_PRODUCTION_TYPE_LABEL } from "@/types/quoterV2";
import { CUSTOMER_KIND_LABEL } from "@/types/quoterV2Firing";

/**
 * Paso 7: todo junto, antes de emitir. Fase 010G.
 *
 * Este paso no edita nada y no calcula nada. Es la única pantalla donde alguien
 * puede comprobar, de una vez, que el precio que va a dar al cliente sale de
 * unos costos que reconoce.
 *
 * ## Por qué enseña lo que falta en vez de esconderlo
 *
 * Un resumen que solo aparece cuando todo está listo no sirve para nada: la
 * pregunta «¿qué me falta?» es precisamente la que trae a alguien aquí. Así que
 * los pasos incompletos se listan con un enlace que lleva a arreglarlos.
 *
 * ## Los importes internos no son el documento del cliente
 *
 * Costo real, gas, factor y ganancia se ven aquí porque quien cotiza los
 * necesita. El PDF que se envía lleva otra cosa —producto, cantidad, unitario,
 * subtotal, IGV y total— y es de 010H.
 */

/** El título de un paso, para nombrarlo en los enlaces de «falta esto». */
const TITULO: Record<PasoId, string> = Object.fromEntries(
  PASOS.map((paso) => [paso.id, paso.titulo]),
) as Record<PasoId, string>;

function Cifra({
  label,
  value,
  hint,
  tone,
  grande,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "negativo" | undefined;
  grande?: boolean | undefined;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={[
          grande ? "text-lg font-semibold" : "text-sm font-medium",
          tone === "negativo" ? "text-red-700" : "text-zinc-900",
        ].join(" ")}
      >
        {value}
      </dd>
      {hint ? <dd className="text-[11px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

export function V2ResumenStep({
  datos,
  estados,
  irAPaso,
}: {
  datos: DatosDelFlujo;
  estados: readonly EstadoPaso[];
  irAPaso: (paso: PasoId) => void;
}) {
  const { cotizacion, productos, manoDeObra, quema, precio } = datos;
  const moneda = cotizacion?.currency_code ?? "PEN";
  const dinero = (valor: string | null | undefined) =>
    formatMoney(valor, moneda, {
      symbolSnapshot: cotizacion?.currency_symbol ?? null,
    });

  // Se listan los pasos incompletos ANTERIORES a este, no el resumen mismo.
  const pendientes = estados.filter((estado) => estado.id !== "resumen" && !estado.completo);
  // Un aviso o una recomendación no impiden emitir, pero verlos juntos aquí es
  // la última oportunidad de repasarlos antes de comprometer un precio.
  const senales = estados.flatMap((estado) =>
    estado.senales
      .filter((senal) => senal.severidad !== "error")
      .map((senal) => ({ ...senal, paso: estado.id })),
  );

  // Comparado como NÚMERO: un «-0.000000000000000000» no es una pérdida, y el
  // signo del texto lo pintaría de rojo.
  const perdida = Number(precio?.estimated_profit ?? 0) < 0;

  return (
    <div data-testid="paso-resumen" className="space-y-5">
      <header>
        <h2 className="text-sm font-semibold text-zinc-900">Resumen de la cotización</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Nada de esta pantalla se edita. Para cambiar algo, vuelva a su paso.
        </p>
      </header>

      {pendientes.length > 0 ? (
        <section
          data-testid="resumen-pendientes"
          className="rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <h3 className="text-xs font-semibold text-red-800">Falta esto para poder emitir</h3>
          <ul className="mt-2 space-y-1">
            {pendientes.map((estado) => (
              <li key={estado.id} className="text-xs text-red-700">
                <button
                  type="button"
                  onClick={() => irAPaso(estado.id)}
                  className="font-semibold underline underline-offset-2"
                >
                  {TITULO[estado.id]}
                </button>
                {": "}
                {estado.senales
                  .filter((senal) => senal.severidad === "error")
                  .map((senal) => senal.mensaje)
                  .join(" ")}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p
          data-testid="resumen-listo"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
        >
          Los seis pasos están completos. La cotización puede emitirse.
        </p>
      )}

      {/* ---- A quién y en qué condiciones ------------------------------ */}
      <section className="rounded-2xl border border-black/[0.06] p-4">
        <h3 className="text-xs font-semibold text-zinc-700">Cliente</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Cifra label="Cliente" value={cotizacion?.customer_name ?? "Sin cliente"} />
          <Cifra label="Código" value={cotizacion?.code ?? "—"} />
          <Cifra
            label="Tipo de producción"
            value={cotizacion ? V2_PRODUCTION_TYPE_LABEL[cotizacion.production_type] : "—"}
          />
          <Cifra
            label="Tipo de cliente"
            value={cotizacion?.customer_kind ? CUSTOMER_KIND_LABEL[cotizacion.customer_kind] : "—"}
            hint="Decide la tarifa de quema."
          />
        </dl>
        {cotizacion && cotizacion.currency_code !== "PEN" ? (
          <p className="mt-3 text-[11px] text-zinc-500">
            Emitida en {cotizacion.currency_code} con un tipo de cambio de{" "}
            {cotizacion.exchange_rate ?? "—"}, congelado en esta cotización.
          </p>
        ) : null}
      </section>

      {/* ---- Producto por producto ------------------------------------- */}
      <section className="rounded-2xl border border-black/[0.06]">
        <h3 className="px-4 pt-4 text-xs font-semibold text-zinc-700">Por producto</h3>
        <p className="px-4 pt-1 text-[11px] text-zinc-500">
          Cada producto carga con lo suyo más la parte que le toca de la quema, del espacio y de lo
          general. La suma de los costos asignados es exactamente el costo de producción.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Piezas</th>
                <th className="px-3 py-2 font-medium">Costo asignado</th>
                <th className="px-3 py-2 font-medium">Precio unitario</th>
                <th className="px-3 py-2 font-medium">Subtotal</th>
                <th className="px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {(precio?.lines ?? []).map((linea) => (
                <tr key={linea.line_id}>
                  <td className="px-3 py-2 text-zinc-800">
                    {linea.product_name ?? `Línea ${linea.line_id}`}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{linea.quantity}</td>
                  <td className="px-3 py-2 text-zinc-600">{dinero(linea.production_cost)}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900">
                    {dinero(linea.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{dinero(linea.line_subtotal)}</td>
                  <td className="px-3 py-2 text-zinc-800">{dinero(linea.line_total)}</td>
                </tr>
              ))}
              {(precio?.lines ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-xs text-zinc-500">
                    Todavía no hay productos que resumir.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- El costo, entero ------------------------------------------ */}
      <section className="rounded-2xl border border-black/[0.06] p-4">
        <h3 className="text-xs font-semibold text-zinc-700">De dónde sale el costo</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Cifra label="Materiales" value={dinero(precio?.materials_cost)} />
          <Cifra label="Mano de obra" value={dinero(precio?.labor_cost)} />
          <Cifra label="Ilustración" value={dinero(precio?.illustration_cost)} />
          <Cifra
            label="Espacio y servicios"
            value={dinero(precio?.space_cost)}
            hint={
              manoDeObra?.effective_work_days === null || manoDeObra === undefined
                ? "Faltan los días efectivos."
                : `Por ${manoDeObra.effective_work_days} días efectivos.`
            }
          />
          <Cifra label="Administración" value={dinero(precio?.administration_cost)} />
          <Cifra
            label="Gas real"
            value={dinero(precio?.gas_cost)}
            hint="Lo que de verdad se quema."
          />
          <Cifra
            label="Tarifa de quema"
            value={dinero(precio?.firing_commercial_cost)}
            hint="Lo que se cobra por encender."
          />
          <Cifra
            label="Diferencia de quema"
            value={dinero(precio?.firing_difference)}
            hint="No es el margen de la cotización."
          />
        </dl>
      </section>

      {/* ---- La quema, en una línea ------------------------------------ */}
      <section className="rounded-2xl border border-black/[0.06] p-4">
        <h3 className="text-xs font-semibold text-zinc-700">Quema</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Cifra label="Horno" value={quema?.kiln_name ?? "Sin horno"} />
          <Cifra
            label="Hornadas"
            value={String(quema?.firing_count ?? 0)}
            hint={
              (quema?.firing_count ?? 0) > 1
                ? "Cada hornada cuesta entera, vaya llena o no."
                : undefined
            }
          />
          <Cifra
            label="Ocupación"
            value={quema ? `${Number(quema.occupancy_percent).toFixed(1)} %` : "—"}
            hint="Cuánto horno se llena. No multiplica el costo."
          />
          <Cifra
            label="Piezas"
            value={String(
              (productos?.items ?? []).reduce((suma, linea) => suma + linea.quantity, 0),
            )}
          />
        </dl>
      </section>

      {/* ---- El precio -------------------------------------------------- */}
      <section
        data-testid="resumen-precio"
        className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4"
      >
        <h3 className="text-xs font-semibold text-sky-900">El precio</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Cifra
            label="Costo real"
            value={dinero(precio?.real_cost)}
            hint="Con el gas que se quema."
          />
          <Cifra
            label="Costo de producción"
            value={dinero(precio?.production_cost)}
            hint="Con la tarifa de quema."
          />
          <Cifra
            label="Factor comercial"
            value={
              precio?.commercial_factor ? `×${Number(precio.commercial_factor).toFixed(2)}` : "—"
            }
          />
          <Cifra
            label="Ganancia estimada"
            value={dinero(precio?.estimated_profit)}
            hint={`Margen efectivo ${Number(precio?.effective_margin_percent ?? 0).toFixed(2)} %`}
            {...(perdida ? { tone: "negativo" as const } : {})}
          />
        </dl>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-sky-200 pt-4 sm:grid-cols-3">
          <Cifra label="Subtotal" value={dinero(precio?.subtotal)} grande />
          <Cifra
            label="IGV"
            value={dinero(precio?.tax)}
            hint={
              precio?.tax_percent
                ? `${Number(precio.tax_percent).toFixed(2)} %`
                : "Sin IGV declarado"
            }
            grande
          />
          <Cifra label="Total" value={dinero(precio?.total)} grande />
        </dl>
        {perdida ? (
          <p role="alert" className="mt-3 text-xs font-medium text-red-700">
            Este precio está por debajo del costo real: la cotización se vendería a pérdida.
          </p>
        ) : null}
      </section>

      {senales.length > 0 ? (
        <section
          data-testid="resumen-senales"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <h3 className="text-xs font-semibold text-amber-900">
            Para revisar antes de emitir. Nada de esto impide hacerlo.
          </h3>
          <ul className="mt-2 space-y-1">
            {senales.map((senal, indice) => (
              <li key={`${senal.paso}-${indice}`} className="text-xs text-amber-800">
                <button
                  type="button"
                  onClick={() => irAPaso(senal.paso)}
                  className="font-semibold underline underline-offset-2"
                >
                  {TITULO[senal.paso]}
                </button>
                {": "}
                {senal.mensaje}
                {senal.severidad === "recomendacion" ? (
                  <span className="text-amber-600"> (recomendación)</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
