import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { useSetV2Pricing, useV2Pricing } from "@/features/cotizadorV2/useQuoterV2Pricing";
import { PRICING_WARNING_LABEL, type V2Pricing } from "@/types/quoterV2Pricing";

/**
 * Margen y precio de una cotización V2: las cuatro salidas y el documento.
 *
 * Lo que esta pantalla enseña, y por qué así:
 *
 * - **el costo real y el costo de producción van separados**, uno al lado del
 *   otro. La diferencia entre ellos es exactamente la de la quema, y es lo
 *   primero que el taller mira. Sumarlos en un total la borraría;
 * - **el suelo, el objetivo y el negociado se ven a la vez.** La pregunta que
 *   se hace siempre es «¿esto está por encima del mínimo?», y esconder las
 *   tres cifras dentro de un único total la dejaría sin respuesta;
 * - **el factor se elige de una lista de multiplicadores**, no se teclea como
 *   porcentaje. «×2,5» y «+150 %» son el mismo número dicho de dos formas, y
 *   una de las dos se confunde con «+250 %».
 *
 * La pantalla no calcula: ni multiplica costos por factores, ni redondea, ni
 * suma IGV. Todo llega calculado del backend. Si lo rehiciera aquí habría dos
 * aritméticas —y la de aquí sería de coma flotante— y nadie sabría cuál manda.
 *
 * Los importes internos —costo, gas, factor, ganancia— NO van al PDF del
 * cliente. Ese documento es de 010H y lleva otros números.
 */

/** Los multiplicadores que el taller usa. El rango real lo impone el backend. */
const FACTORES = ["2", "2.25", "2.5", "2.75", "3"] as const;

/**
 * Las opciones del selector, con el factor guardado dentro venga como venga.
 *
 * El backend devuelve `3.000000` y la lista dice `3`: comparados como texto no
 * son el mismo valor, y el selector se quedaba en «Seleccionar...» enseñando
 * un factor vacío sobre una cotización que sí lo tiene. Se comparan como
 * NÚMEROS, y un factor pactado fuera de la lista —un ×2,1 -- se añade en vez
 * de desaparecer.
 */
function opcionesDeFactor(actual: string | null): { value: string; label: string }[] {
  const valores = [...FACTORES] as string[];
  if (actual !== null && !valores.some((valor) => Number(valor) === Number(actual))) {
    valores.push(actual);
  }
  return valores
    .sort((a, b) => Number(a) - Number(b))
    .map((valor) => ({ value: valor, label: `×${Number(valor).toFixed(2)}` }));
}

/** El valor de la lista que corresponde al factor guardado. */
function factorSeleccionado(actual: string | null): string {
  if (actual === null) return "3";
  return [...FACTORES].find((valor) => Number(valor) === Number(actual)) ?? actual;
}

function Aviso({ codigo }: { codigo: string }) {
  return <li className="text-xs text-amber-700">{PRICING_WARNING_LABEL[codigo] ?? codigo}</li>;
}

function Dato({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "positive" | "negative" | undefined;
}) {
  const color =
    tone === "positive"
      ? "text-emerald-800"
      : tone === "negative"
        ? "text-red-700"
        : "text-zinc-800";
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`text-sm font-medium ${color}`}>{value}</dd>
      {hint ? <dd className="text-[11px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

/** El reparto por producto: de dónde sale cada precio unitario. */
function Reparto({ precio }: { precio: V2Pricing }) {
  if (precio.lines.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.06]">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <caption className="px-4 pt-3 text-left text-xs text-zinc-500">
          Cada producto carga con lo suyo más la parte que le toca de lo que es de toda la
          cotización. La suma de los costos asignados es exactamente el costo de producción.
        </caption>
        <thead>
          <tr className="text-xs text-zinc-500">
            <th className="px-3 py-2 font-medium">Producto</th>
            <th className="px-3 py-2 font-medium">Piezas</th>
            <th className="px-3 py-2 font-medium">Costo directo</th>
            <th className="px-3 py-2 font-medium">Quema</th>
            <th className="px-3 py-2 font-medium">Espacio</th>
            <th className="px-3 py-2 font-medium">Generales</th>
            <th className="px-3 py-2 font-medium">Costo asignado</th>
            <th className="px-3 py-2 font-medium">Unit. sin redondear</th>
            <th className="px-3 py-2 font-medium">Unitario</th>
            <th className="px-3 py-2 font-medium">Total línea</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {precio.lines.map((linea) => (
            <tr key={linea.line_id}>
              <td className="px-3 py-2 text-zinc-800">
                {linea.product_name ?? `Línea ${linea.line_id}`}
              </td>
              <td className="px-3 py-2 text-zinc-600">{linea.quantity}</td>
              <td className="px-3 py-2 text-zinc-600">{linea.direct_cost}</td>
              <td className="px-3 py-2 text-zinc-600">{linea.firing_cost}</td>
              <td className="px-3 py-2 text-zinc-600">{linea.space_cost}</td>
              <td className="px-3 py-2 text-zinc-600">{linea.general_cost}</td>
              <td className="px-3 py-2 text-zinc-800">{linea.production_cost}</td>
              <td className="px-3 py-2 text-zinc-500">{linea.unit_price_raw}</td>
              <td className="px-3 py-2 font-medium text-zinc-900">{linea.unit_price}</td>
              <td className="px-3 py-2 text-zinc-800">{linea.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function V2PricingPanel({
  quotationId,
  canEdit,
}: {
  quotationId: number;
  canEdit: boolean;
}) {
  const query = useV2Pricing(quotationId);
  const guardar = useSetV2Pricing(quotationId);

  if (query.isPending) return <Spinner className="size-5" label="Calculando el precio..." />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        {describeError(query.error)}
      </div>
    );
  }

  const precio = query.data;
  const perdida = precio.estimated_profit.trimStart().startsWith("-");
  const moneda = precio.currency_code ?? "PEN";

  return (
    <Panel>
      {/* El identificador acota las consultas de las pruebas a ESTE bloque: la
          ficha monta varios paneles y varios tienen importes con la misma pinta. */}
      <div data-testid="panel-precio">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Margen y precio</h2>
          <span className="text-xs text-zinc-500">
            Total {moneda}: <strong>{precio.total}</strong>
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          El precio sale del costo de producción multiplicado por un factor único para toda la
          cotización. El IGV se aplica al final, sobre el subtotal ya redondeado.
        </p>

        {precio.warnings.length > 0 ? (
          <ul className="mt-3 space-y-1 rounded-2xl bg-amber-50 p-3" data-testid="avisos-precio">
            {precio.warnings.map((codigo) => (
              <Aviso key={codigo} codigo={codigo} />
            ))}
          </ul>
        ) : null}

        {/* ---- Lo que cuesta ---------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-black/[0.06] p-4">
          <h3 className="text-xs font-semibold text-zinc-700">Lo que cuesta</h3>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato label="Materiales" value={precio.materials_cost} />
            <Dato label="Mano de obra" value={precio.labor_cost} />
            <Dato label="Ilustración" value={precio.illustration_cost} />
            <Dato
              label="Espacio y servicios"
              value={precio.space_cost}
              hint="Por días efectivos de taller."
            />
            <Dato
              label="Administración"
              value={precio.administration_cost}
              hint="Una vez por cotización."
            />
            <Dato label="Gas real" value={precio.gas_cost} hint="Lo que de verdad se quema." />
            <Dato
              label="Tarifa de quema"
              value={precio.firing_commercial_cost}
              hint="Lo que se cobra por encender."
            />
            <Dato
              label="Diferencia de quema"
              value={precio.firing_difference}
              hint="No es el margen de la cotización."
            />
          </dl>
        </section>

        {/* ---- Las dos bases ---------------------------------------- */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold text-zinc-800">Costo real</h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              Lo que de verdad sale del bolsillo: lleva el gas que se quema.
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-900">{precio.real_cost}</p>
          </section>
          <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <h3 className="text-xs font-semibold text-sky-900">Costo de producción</h3>
            <p className="mt-1 text-[11px] text-sky-800">
              La base comercial: lleva la tarifa que el taller cobra por encender.
            </p>
            <p className="mt-2 text-lg font-semibold text-sky-950">{precio.production_cost}</p>
          </section>
        </div>

        {/* ---- El factor y las tres salidas ------------------------- */}
        <section className="mt-4 rounded-2xl border border-black/[0.06] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Factor comercial"
              requirement="required"
              value={factorSeleccionado(precio.commercial_factor)}
              options={opcionesDeFactor(precio.commercial_factor)}
              onChange={(valor) => guardar.mutate({ commercial_factor: valor })}
              disabled={!canEdit}
              hint={`Uno solo para toda la cotización. Mínimo ×${precio.factor_min ?? "2"}, máximo ×${precio.factor_max ?? "3"}.`}
            />
            <Dato
              label="Precio negociado"
              value={precio.negotiated_price}
              hint="Costo de producción por el factor elegido."
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato
              label="Precio mínimo ×2"
              value={precio.price_min}
              hint="Por debajo no se vende."
            />
            <Dato label="Precio objetivo ×3" value={precio.price_target} />
            <Dato
              label="Ajuste por redondeo"
              value={precio.rounding_adjustment}
              hint="Lo que el redondeo añadió sobre el precio negociado."
            />
            <Dato
              label="Margen efectivo"
              value={`${precio.effective_margin_percent} %`}
              hint="Sobre el precio, no sobre el costo."
              tone={perdida ? "negative" : "positive"}
            />
          </dl>
        </section>

        {/* ---- El documento ---------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h3 className="text-xs font-semibold text-emerald-900">
            Lo que irá al documento ({moneda})
          </h3>
          <p className="mt-1 text-[11px] text-emerald-800">
            El subtotal se reconstruye sumando las líneas ya redondeadas: quien sume el documento a
            mano llega al mismo total.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato label="Subtotal sin IGV" value={precio.subtotal} />
            <Dato
              label={`IGV ${precio.tax_percent ?? "0"} %`}
              value={precio.tax}
              hint="No es ingreso del taller."
            />
            <Dato label="Total" value={precio.total} />
            <Dato
              label="Ganancia estimada"
              value={precio.estimated_profit}
              hint="Precio sin IGV menos costo real."
              tone={perdida ? "negative" : "positive"}
            />
          </dl>
        </section>

        <Reparto precio={precio} />

        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
