import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProducts } from "@/api/masters";
import { PrimaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { DecimalField } from "@/components/DecimalField";
import { EmptyState, Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useAddV2QuotationProduct,
  useDeleteV2QuotationProduct,
  useUpdateV2QuotationProduct,
  useV2Materials,
  useV2QuotationProducts,
} from "@/features/cotizadorV2/useQuoterV2Materials";
import { WARNING_LABEL, type V2QuotationProduct } from "@/types/quoterV2Materials";

/**
 * Las líneas de una cotización V2, en DOS vistas sobre los mismos datos.
 *
 * Desde 010G esto se mira en dos pasos del flujo y no en una pantalla larga:
 *
 * - **`vista="piezas"`** (paso 2) — qué se hace, cuántas y de qué medida. Es
 *   el único sitio donde se añaden y se quitan líneas;
 * - **`vista="materiales"`** (paso 3) — de qué está hecha cada una: pasta,
 *   cuánta lleva, y si va esmaltada.
 *
 * Son dos vistas y no dos componentes porque la línea es UNA. Partirla en dos
 * ficheros obligaría a duplicar el guardado, y dos guardados sobre la misma
 * fila es la forma conocida de que uno pise al otro. El paso de materiales no
 * deja añadir ni quitar: quien llega ahí ya decidió qué piezas hay, y ofrecer
 * el alta otra vez invita a crear la misma línea dos veces.
 *
 * Lo que se ve aquí son **importes ya calculados por el backend**. La pantalla
 * no multiplica pesos por costos ni suma los dos materiales: si lo hiciera,
 * habría dos aritméticas que podrían discrepar —y en JavaScript la segunda
 * sería de coma flotante— y nadie sabría cuál manda.
 *
 * Los campos numéricos son `DecimalField`, que es de toda la familia V2: acepta
 * la coma peruana, guarda al salir del campo y distingue el vacío del cero.
 * Hasta 010G esta pantalla llevaba su propia copia, y las copias divergen.
 *
 * El esmalte merece una nota. Cuando nadie elige uno, el sistema propone el
 * activo más caro por gramo: pecar por arriba es recuperable —si al final se
 * usa uno más barato, el taller gana— y al revés se pierde dinero sobre un
 * precio ya comprometido. Esa propuesta es una REFERENCIA DE COSTEO, no el
 * esmalte que se usará: producción elegirá el real y el precio no cambiará por
 * eso. La pantalla lo dice con todas sus letras.
 */

const SIN_MATERIAL = "";

/** Cuál de los dos pasos está pintando estas líneas. */
export type VistaDeLinea = "piezas" | "materiales";

/**
 * Las tres medidas de una pieza, en centímetros.
 *
 * Se declaran juntas porque son un solo dato en tres campos: de su producto
 * sale el volumen, y del volumen las hornadas. Vacío es «todavía sin medir» y
 * se manda como nulo; un cero sería una pieza plana, que no existe.
 */
const MEDIDAS = [
  { campo: "length_cm", etiqueta: "Largo (cm)" },
  { campo: "width_cm", etiqueta: "Ancho (cm)" },
  { campo: "height_cm", etiqueta: "Alto (cm)" },
] as const;

function Aviso({ codigo }: { codigo: string }) {
  return <li className="text-xs text-amber-700">{WARNING_LABEL[codigo] ?? codigo}</li>;
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
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-800">{value}</dd>
      {hint ? <dd className="text-[11px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

/**
 * Campo de TEXTO que solo avisa cuando el usuario termina.
 *
 * Queda aquí y no se comparte porque es para texto libre —el nombre de una
 * pieza de encargo—. Todo lo numérico usa `DecimalField`, que además acepta la
 * coma decimal y distingue un campo vacío de un cero.
 */
function CampoDeTexto({
  label,
  value,
  onCommit,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onCommit: (valor: string) => void;
  disabled: boolean;
  hint?: string | undefined;
}) {
  const [borrador, setBorrador] = useState(value);
  const [escribiendo, setEscribiendo] = useState(false);
  // Si el valor guardado cambia por fuera —otra edición, un refetch— el campo
  // lo sigue, pero NO mientras alguien lo tiene abierto: desde que cambiar
  // cualquier cosa invalida la cotización entera, un refresco puede resolverse
  // a mitad de una palabra, y borrarla sería peor que enseñar un valor viejo
  // durante los segundos que dura la edición. Al salir se sincroniza igual.
  useEffect(() => {
    if (!escribiendo) setBorrador(value);
  }, [value, escribiendo]);

  return (
    <TextField
      label={label}
      requirement="required"
      value={borrador}
      onFocus={() => setEscribiendo(true)}
      onChange={setBorrador}
      onBlur={() => {
        setEscribiendo(false);
        // Se compara y se manda ya recortado: un nombre con espacios al final
        // es el mismo nombre y no merece ni una petición ni una fila distinta.
        const limpio = borrador.trim();
        if (limpio !== value.trim()) onCommit(limpio);
      }}
      disabled={disabled}
      {...(hint ? { hint } : {})}
    />
  );
}

function Linea({
  linea,
  quotationId,
  canEdit,
  vista,
}: {
  linea: V2QuotationProduct;
  quotationId: number;
  canEdit: boolean;
  vista: VistaDeLinea;
}) {
  const actualizar = useUpdateV2QuotationProduct(quotationId);
  const borrar = useDeleteV2QuotationProduct(quotationId);
  const pastas = useV2Materials("BODY");

  const opcionesPasta = [
    { value: SIN_MATERIAL, label: "Sin pasta" },
    ...(pastas.data?.items ?? []).map((material) => ({
      value: String(material.product_id),
      label: material.product_name,
    })),
  ];

  const guardar = (cambios: Record<string, unknown>) =>
    actualizar.mutate({ lineId: linea.id, payload: cambios });

  return (
    <div className="rounded-2xl border border-black/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          {linea.product_name ?? "Línea sin nombre"}
        </h3>
        {canEdit && vista === "piezas" ? (
          <button
            type="button"
            onClick={() => borrar.mutate(linea.id)}
            disabled={borrar.isPending}
            className="text-xs font-semibold text-red-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {vista === "piezas" ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoDeTexto
              label="Nombre de la pieza"
              value={linea.product_name ?? ""}
              onCommit={(valor) => guardar({ product_name: valor })}
              disabled={!canEdit || linea.product_id !== null}
              {...(linea.product_id !== null
                ? { hint: "Lo fija el catálogo: esta línea cuelga de un producto." }
                : {})}
            />
            <DecimalField
              label="Cantidad"
              requirement="required"
              value={String(linea.quantity)}
              onCommit={(valor) => {
                // Siendo obligatorio, `DecimalField` nunca llama aquí con el
                // campo vacío: lo explica en pantalla. Mandar un 0 en su lugar
                // convertiría un borrado a medias en «cero piezas».
                if (valor !== null) guardar({ quantity: Number(valor) });
              }}
              disabled={!canEdit}
              entero
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {MEDIDAS.map(({ campo, etiqueta }) => (
              <DecimalField
                key={campo}
                label={etiqueta}
                value={linea[campo]}
                onCommit={(valor) => guardar({ [campo]: valor })}
                disabled={!canEdit}
              />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato label="Volumen unitario" value={`${linea.unit_volume_cm3} cm³`} />
            <Dato label="Volumen total" value={`${linea.total_volume_cm3} cm³`} />
            <Dato
              label="% del horno"
              value={`${linea.firing_occupancy_percent} %`}
              hint="Cuánto ocupa. No es un multiplicador de precio."
            />
            <Dato
              label="Quema asignada"
              value={linea.firing_commercial_cost}
              hint={`Gas real: ${linea.firing_gas_cost}`}
            />
          </dl>
        </>
      ) : null}

      {vista === "materiales" ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Pasta"
              requirement="required"
              value={linea.body_material_id ? String(linea.body_material_id) : SIN_MATERIAL}
              options={opcionesPasta}
              onChange={(valor) =>
                guardar({ body_material_id: valor === SIN_MATERIAL ? null : Number(valor) })
              }
              disabled={!canEdit}
            />
            <DecimalField
              label={`Pasta por pieza${linea.body_uom ? ` (${linea.body_uom})` : ""}`}
              value={linea.body_unit_weight}
              onCommit={(valor) => guardar({ body_unit_weight: valor })}
              disabled={!canEdit}
              hint="La unidad la fija el maestro del material."
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato
              label="Costo por unidad"
              value={linea.body_cost_per_unit ?? "—"}
              hint={linea.body_cost_is_override ? "Ajustado en esta cotización" : undefined}
            />
            <Dato label="Peso total" value={linea.body_total_weight} />
            <Dato label="Costo de pasta" value={linea.body_cost} />
            <Dato label="Costo de materiales" value={linea.materials_cost} />
          </dl>

          <div className="mt-4 border-t border-black/[0.04] pt-4">
        <SelectField
          label="Esmalte"
          requirement="required"
          value={linea.requires_glaze ? "SI" : "NO"}
          options={[
            { value: "NO", label: "Sin esmalte" },
            { value: "SI", label: "Con esmalte" },
          ]}
          onChange={(valor) => guardar({ requires_glaze: valor === "SI" })}
          disabled={!canEdit}
          hint="Apagado por defecto. Al apagarlo, su peso y su costo quedan en cero."
        />

        {linea.requires_glaze ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Dato
                label="Esmalte usado"
                value={linea.glaze_material_name ?? "—"}
                hint={
                  linea.glaze_is_reference
                    ? "Referencia de costeo: el activo más caro por gramo"
                    : "Elegido explícitamente"
                }
              />
              <Dato label="Proporción" value={`${linea.glaze_percent ?? "—"} %`} />
              <Dato label="Costo por gramo" value={linea.glaze_cost_per_unit ?? "—"} />
              <Dato label="Peso de esmalte" value={linea.glaze_total_weight} />
              <Dato
                label="Volumen"
                value={`${linea.glaze_volume_ml} ml`}
                hint={
                  linea.glaze_conversion_is_fallback
                    ? "Conversión de reserva 1 g = 1 ml: este material no declara la suya"
                    : `Conversión ${linea.glaze_ml_per_gram} ml/g`
                }
              />
              <Dato label="Costo de esmalte" value={linea.glaze_cost} />
            </dl>
            {linea.glaze_is_reference ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Esto es una <strong>referencia de costeo</strong>, no el esmalte final. Producción
                elegirá el esmalte real y el precio de esta cotización no cambiará por eso.
              </p>
            ) : null}
          </>
            ) : null}
          </div>
        </>
      ) : null}

      {linea.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {linea.warnings.map((codigo) => (
            <Aviso key={codigo} codigo={codigo} />
          ))}
        </ul>
      ) : null}

      {actualizar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(actualizar.error)}
        </p>
      ) : null}
    </div>
  );
}

export function V2ProductLines({
  quotationId,
  canEdit,
  vista = "materiales",
}: {
  quotationId: number;
  canEdit: boolean;
  vista?: VistaDeLinea;
}) {
  const query = useV2QuotationProducts(quotationId);
  const anadir = useAddV2QuotationProduct(quotationId);
  const [nombre, setNombre] = useState("");
  const [catalogo, setCatalogo] = useState(SIN_MATERIAL);

  // Las piezas del catálogo. Se ofrecen, no se imponen: la mitad del trabajo
  // del taller son encargos que no existen como producto.
  const piezas = useQuery({
    queryKey: ["quoter-v2", "catalog-pieces"],
    queryFn: () => fetchProducts({ product_type: "FINISHED_PRODUCT", active: true, limit: 200 }),
  });

  if (query.isPending) return <Spinner className="size-5" label="Cargando materiales..." />;
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

  const pagina = query.data;
  const opcionesPieza = [
    { value: SIN_MATERIAL, label: "Pieza de encargo (sin catálogo)" },
    ...(piezas.data?.items ?? []).map((pieza) => ({
      value: String(pieza.id),
      label: pieza.name,
    })),
  ];

  const anadirLinea = () => {
    const desdeCatalogo = catalogo !== SIN_MATERIAL;
    anadir.mutate(
      desdeCatalogo
        ? { product_id: Number(catalogo), quantity: 0 }
        : { product_name: nombre.trim() || null, quantity: 0 },
      {
        onSuccess: () => {
          setNombre("");
          setCatalogo(SIN_MATERIAL);
        },
      },
    );
  };

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          {vista === "piezas" ? "Productos y piezas" : "Materiales"}
        </h2>
        <span className="text-xs text-zinc-500">
          {vista === "piezas" ? (
            `${pagina.items.length} ${pagina.items.length === 1 ? "línea" : "líneas"}`
          ) : (
            <>
              Costo de materiales: <strong>{pagina.materials_cost}</strong>
            </>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {vista === "piezas"
          ? "Qué se hace, cuántas y de qué medida. De las medidas sale cuánto horno ocupa cada pieza."
          : "Cotizar no descuenta inventario. El consumo ocurre en producción."}
      </p>

      {pagina.items.length === 0 ? (
        <EmptyState
          message={
            vista === "piezas"
              ? "Todavía no hay líneas en esta cotización."
              : "No hay líneas que materializar. Añádalas en el paso de productos."
          }
        />
      ) : (
        <div className="mt-4 space-y-4">
          {pagina.items.map((linea) => (
            <Linea
              key={linea.id}
              linea={linea}
              quotationId={quotationId}
              canEdit={canEdit}
              vista={vista}
            />
          ))}
        </div>
      )}

      {canEdit && vista === "piezas" ? (
        <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-black/[0.04] pt-4">
          <SelectField
            label="Pieza del catálogo"
            requirement="optional"
            value={catalogo}
            options={opcionesPieza}
            onChange={setCatalogo}
            className="max-w-xs"
          />
          <TextField
            label="Nueva línea"
            requirement="optional"
            value={nombre}
            onChange={setNombre}
            placeholder="Plato palta"
            disabled={catalogo !== SIN_MATERIAL}
            hint="Para un encargo que no está en el catálogo."
            className="max-w-xs"
          />
          <PrimaryButton type="button" disabled={anadir.isPending} onClick={anadirLinea}>
            {anadir.isPending ? "Añadiendo..." : "Añadir línea"}
          </PrimaryButton>
          {anadir.isError ? (
            <span role="alert" className="text-xs text-red-600">
              {describeError(anadir.error)}
            </span>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
