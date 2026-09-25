import { DecimalField } from "@/components/DecimalField";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import { formatCosto, MONEDA_BASE } from "@/features/cotizadorV2/moneda";
import { useUpdateV2QuotationProduct } from "@/features/cotizadorV2/useQuoterV2Materials";
import { formatMoney } from "@/features/quotations/money";
import { describeError } from "@/features/settings/messages";
import {
  WARNING_LABEL,
  type V2Material,
  type V2QuotationProduct,
  type V2QuotationProductInput,
} from "@/types/quoterV2Materials";

const SIN_ARCILLA = "";
const ESMALTE_AUTOMATICO = "__automatico__";
const AVISO_DESCONOCIDO = "Hay un aviso de materiales para esta pieza.";

function etiquetaMaterial(material: V2Material): string {
  const unidad = material.uom_code ?? "u.";
  const estado = material.active ? "" : " (inactiva)";
  return `${material.product_name} · ${formatMoney(material.effective_cost_per_unit, MONEDA_BASE, {
    decimals: 4,
  })}/${unidad}${estado}`;
}

function opcionesDeMateriales(
  materiales: readonly V2Material[],
  actual: { id: number | null; nombre: string | null; respaldo: string },
  primera: SelectOption,
): SelectOption[] {
  const opciones: SelectOption[] = [
    primera,
    ...materiales.map((material) => ({
      value: String(material.product_id),
      label: etiquetaMaterial(material),
    })),
  ];
  if (actual.id !== null && !opciones.some((opcion) => opcion.value === String(actual.id))) {
    opciones.push({
      value: String(actual.id),
      label: actual.nombre ?? actual.respaldo,
    });
  }
  return opciones;
}

function textoConUnidad(valor: string | null | undefined, unidad: string | null | undefined): string {
  const numero = valor ?? "—";
  return unidad ? `${numero} ${unidad}` : numero;
}

function Dato({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800 tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[11.5px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

function AvisosDeLinea({ codigos }: { codigos: readonly string[] }) {
  if (codigos.length === 0) return null;
  return (
    <ul className="mt-4 space-y-2">
      {codigos.map((codigo, indice) => (
        <li
          key={`${codigo}-${indice}`}
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <span className="font-semibold">Aviso: </span>
          {WARNING_LABEL[codigo] ?? AVISO_DESCONOCIDO}
        </li>
      ))}
    </ul>
  );
}

function LlevaEsmalteSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={[
        "mt-4 flex min-h-10 items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-white/50 px-3 py-2",
        disabled ? "opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-900">Lleva esmalte</span>
        <span className="block text-xs text-zinc-500">
          Al apagarlo, su peso y su costo quedan en cero.
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-900",
          checked ? "bg-emerald-600" : "bg-zinc-300",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition",
            checked ? "translate-x-5" : "",
          ].join(" ")}
        />
      </span>
    </label>
  );
}

function DetallePasta({ linea }: { linea: V2QuotationProduct }) {
  return (
    <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Dato
        label="Peso total de arcilla"
        value={textoConUnidad(linea.body_total_weight, linea.body_uom)}
      />
      <Dato label="Costo de arcilla" value={formatCosto(linea.body_cost)} />
    </dl>
  );
}

function DetalleEsmalte({ linea }: { linea: V2QuotationProduct }) {
  if (!linea.requires_glaze) {
    return (
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Dato label="Esmalte" value="No lleva esmalte" />
        <Dato label="Costo de esmalte" value={formatCosto(linea.glaze_cost)} />
      </dl>
    );
  }

  const tipo = linea.glaze_is_reference || linea.glaze_material_id === null
    ? "Referencia de costeo"
    : "Elegido";
  const nombre = linea.glaze_material_name ?? "Pendiente del sistema";
  return (
    <>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Dato label="Esmalte usado" value={nombre} hint={tipo} />
        <Dato label="Proporción" value={`${linea.glaze_percent ?? "—"} %`} />
        <Dato label="Peso de esmalte" value={`${linea.glaze_total_weight} g`} />
        <Dato
          label="Volumen"
          value={`${linea.glaze_volume_ml} ml`}
          hint={linea.glaze_conversion_is_fallback ? "Conversión de reserva 1 g = 1 ml" : undefined}
        />
        <Dato label="Costo de esmalte" value={formatCosto(linea.glaze_cost)} />
      </dl>
      {linea.glaze_is_reference ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Esto es una referencia de costeo, no el esmalte final. Producción elegirá el real y
          el precio de esta cotización no cambiará por eso.
        </p>
      ) : null}
    </>
  );
}

function ValoresSoloLectura({ linea }: { linea: V2QuotationProduct }) {
  return (
    <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Dato label="Arcilla" value={linea.body_material_name ?? "Sin arcilla"} />
      <Dato
        label="Arcilla por pieza"
        value={textoConUnidad(linea.body_unit_weight, linea.body_uom ?? "g")}
      />
      <Dato label="Lleva esmalte" value={linea.requires_glaze ? "Sí" : "No"} />
      {linea.requires_glaze ? (
        <Dato
          label="Esmalte elegido"
          value={linea.glaze_material_name ?? "Automático"}
          hint={linea.glaze_is_reference ? "Referencia de costeo" : "Elegido"}
        />
      ) : null}
    </dl>
  );
}

export function MaterialLineCard({
  quotationId,
  canEdit,
  linea,
  arcillas,
  esmaltes,
}: {
  quotationId: number;
  canEdit: boolean;
  linea: V2QuotationProduct;
  arcillas: readonly V2Material[];
  esmaltes: readonly V2Material[];
}) {
  const actualizar = useUpdateV2QuotationProduct(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  const opcionesArcilla = opcionesDeMateriales(
    arcillas,
    {
      id: linea.body_material_id,
      nombre: linea.body_material_name,
      respaldo: "Arcilla fuera de la lista",
    },
    { value: SIN_ARCILLA, label: "Sin arcilla" },
  );
  const opcionesEsmalte = opcionesDeMateriales(
    esmaltes,
    {
      id: linea.glaze_material_id,
      nombre: linea.glaze_material_name,
      respaldo: "Esmalte fuera de la lista",
    },
    {
      value: ESMALTE_AUTOMATICO,
      label: "Automático — referencia de costeo (el más caro)",
    },
  );

  const guardar = (payload: V2QuotationProductInput) => {
    actualizar.mutate({ lineId: linea.id, payload });
  };
  // Los decimales se guardan al salir del campo y esperan el refetch de la
  // cotización; así el shell puede contar el guardado real sin peticiones por tecla.
  const guardarYEsperar = (payload: V2QuotationProductInput) =>
    esperarGuardado(actualizar, "linea-editar", { lineId: linea.id, payload });

  const valorEsmalte =
    linea.glaze_is_reference || linea.glaze_material_id === null
      ? ESMALTE_AUTOMATICO
      : String(linea.glaze_material_id);

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-900">
            {linea.product_name ?? "Pieza sin nombre"}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">{linea.quantity} piezas</p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-zinc-900">
          {formatCosto(linea.materials_cost)}
        </p>
      </div>

      {canEdit ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Arcilla"
              value={linea.body_material_id === null ? SIN_ARCILLA : String(linea.body_material_id)}
              options={opcionesArcilla}
              onChange={(valor) =>
                guardar({ body_material_id: valor === SIN_ARCILLA ? null : Number(valor) })
              }
              searchable
            />
            <DecimalField
              label="Arcilla por pieza"
              value={linea.body_unit_weight}
              onCommit={(valor) => guardarYEsperar({ body_unit_weight: valor })}
              sufijo={linea.body_uom ?? "g"}
              hint="La unidad la fija el material elegido."
            />
          </div>

          <LlevaEsmalteSwitch
            checked={linea.requires_glaze}
            disabled={!canEdit}
            onChange={(checked) => guardar({ requires_glaze: checked })}
          />

          {linea.requires_glaze ? (
            <div className="mt-4">
              <SelectField
                label="Esmalte"
                value={valorEsmalte}
                options={opcionesEsmalte}
                onChange={(valor) =>
                  guardar({
                    glaze_material_id: valor === ESMALTE_AUTOMATICO ? null : Number(valor),
                  })
                }
                searchable
              />
            </div>
          ) : null}
        </>
      ) : (
        <ValoresSoloLectura linea={linea} />
      )}

      <DetallePasta linea={linea} />
      <DetalleEsmalte linea={linea} />
      <AvisosDeLinea codigos={linea.warnings} />

      {actualizar.isError ? (
        <p role="alert" className="mt-4 text-xs text-red-700">
          {describeError(actualizar.error)}
        </p>
      ) : null}
    </article>
  );
}
