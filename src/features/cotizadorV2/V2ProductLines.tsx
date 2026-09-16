import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProducts } from "@/api/masters";
import { PrimaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import {
  seguirEnvio,
  useBorradorProtegido,
  useUltimoDescarte,
  type ResultadoDeGuardado,
} from "@/components/borradores";
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
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
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
  onCommit: (valor: string) => void | Promise<ResultadoDeGuardado>;
  disabled: boolean;
  hint?: string | undefined;
}) {
  const [borrador, setBorrador] = useState(value);
  const [escribiendo, setEscribiendo] = useState(false);
  // Lo enviado: se sigue enseñando hasta que lo guardado coincida con ello.
  // Ver `DecimalField`.
  const [enviado, setEnviado] = useState<{ valor: string } | null>(null);
  // Si el valor guardado cambia por fuera —otra edición, un refetch— el campo
  // lo sigue, pero NO mientras alguien lo tiene abierto: desde que cambiar
  // cualquier cosa invalida la cotización entera, un refresco puede resolverse
  // a mitad de una palabra, y borrarla sería peor que enseñar un valor viejo
  // durante los segundos que dura la edición. Al salir se sincroniza igual.
  useEffect(() => {
    if (escribiendo) return;
    if (enviado !== null) {
      // Solo si COINCIDE: que lo guardado cambie por un envío anterior no
      // alcanza este. Ver `DecimalField`.
      const alcanzado = value.trim() === enviado.valor;
      if (!alcanzado) return;
      setEnviado(null);
    }
    setBorrador(value);
  }, [value, escribiendo, enviado]);

  // Cada envío lleva un número; solo el resultado del ÚLTIMO dice algo de lo
  // que el campo enseña. Si el servidor lo aceptó Y la pantalla ya tiene el
  // dato posterior al guardado (`fresco`), el campo enseña lo guardado tal cual
  // lo normalizó el backend: `20,5000004` pasa a `20.5`. Aceptado sin dato
  // fresco, sigue enseñando lo enviado. Si falla, se recuerda su firma para que
  // un descarte sepa que es este campo el que tiene que revertir.
  const envios = useRef(0);
  const [firmaFallida, setFirmaFallida] = useState<string | null>(null);
  const seguir = (resultado: unknown) => {
    const secuencia = ++envios.current;
    seguirEnvio(
      resultado,
      () => envios.current === secuencia,
      (final) => {
        if (final.ok) {
          setFirmaFallida(null);
          // Solo con un dato posterior a ESTE guardado. Si el refetch no llegó,
          // se sigue enseñando lo enviado: alinearse con lo que hay pintaría
          // el valor viejo, y quien volviera a entrar editaría lo obsoleto.
          if (final.fresco !== false) setEnviado(null);
        } else {
          setFirmaFallida(final.firma);
        }
      },
    );
  };

  const confirmar = () => {
    setEscribiendo(false);
    // Se compara y se manda ya recortado: un nombre con espacios al final es el
    // mismo nombre y no merece ni una petición ni una fila distinta.
    const limpio = borrador.trim();
    if (limpio !== value.trim()) {
      setEnviado({ valor: limpio });
      seguir(onCommit(limpio));
    }
  };
  // Lo tecleado sin salir del campo cuenta como cambio sin guardar, y se
  // confirma si el campo se desmonta sin blur. Lo YA enviado no cuenta —si no,
  // un desmontaje con el envío en vuelo lo mandaba dos veces— y un campo
  // deshabilitado no declara ni confirma nada. Ver `DecimalField`.
  const limpioAhora = borrador.trim();
  const sucio =
    !disabled &&
    limpioAhora !== value.trim() &&
    (enviado === null || limpioAhora !== enviado.valor.trim());
  useBorradorProtegido(sucio, confirmar);

  // El descarte es DIRIGIDO: solo vuelve a lo guardado el campo cuyo último
  // envío falló con la firma descartada. Un campo con un envío en vuelo no lo
  // escucha, porque su guardado todavía puede salir bien.
  const descarte = useUltimoDescarte();
  const descarteVisto = useRef(descarte.n);
  useEffect(() => {
    if (descarte.n === descarteVisto.current) return;
    descarteVisto.current = descarte.n;
    if (escribiendo || firmaFallida === null || firmaFallida !== descarte.firma) return;
    setFirmaFallida(null);
    setEnviado(null);
  }, [descarte, escribiendo, firmaFallida]);

  return (
    <TextField
      label={label}
      requirement="required"
      value={borrador}
      onFocus={() => setEscribiendo(true)}
      onChange={setBorrador}
      onBlur={confirmar}
      disabled={disabled}
      {...(hint ? { hint } : {})}
    />
  );
}

import { formatMoney, formatPercent, formatVolume, formatNumber } from "@/utils/formatters";

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
  const esperarGuardado = useEsperarGuardado(quotationId);
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
  // Para los campos diferidos: el campo recibe el resultado de SU guardado y,
  // al terminar bien, enseña lo guardado tal cual lo normalizó el backend.
  const guardarYEsperar = (cambios: Record<string, unknown>) =>
    esperarGuardado(actualizar, "linea-editar", { lineId: linea.id, payload: cambios });

  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-xs p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            {linea.product_name ?? "Línea sin nombre"}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {linea.product_id !== null ? "Producto de catálogo" : "Pieza de encargo"}
          </p>
        </div>
        {canEdit && vista === "piezas" ? (
          <button
            type="button"
            onClick={() => borrar.mutate(linea.id)}
            disabled={borrar.isPending}
            className="text-xs font-semibold text-red-600 hover:text-red-700 underline underline-offset-2 cursor-pointer disabled:opacity-40 transition-colors"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {vista === "piezas" ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DecimalField
                label="Cantidad"
                requirement="required"
              value={String(linea.quantity)}
              onCommit={(valor) => {
                return valor !== null ? guardarYEsperar({ quantity: Number(valor) }) : undefined;
              }}
              disabled={!canEdit}
              entero
            />
            
            <div className="sm:col-span-1">
              {linea.product_id === null ? (
                <CampoDeTexto
                  label="Nombre de la pieza"
                  value={linea.product_name ?? ""}
                  onCommit={(valor) => guardarYEsperar({ product_name: valor })}
                  disabled={!canEdit}
                />
              ) : null}
            </div>
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Medidas</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {MEDIDAS.map(({ campo, etiqueta }) => (
                <DecimalField
                  key={campo}
                  label={etiqueta}
                  value={linea[campo]}
                  onCommit={(valor) => guardarYEsperar({ [campo]: valor })}
                  disabled={!canEdit}
                />
              ))}
            </div>
          </div>
          
          <div className="mt-5 bg-zinc-50 rounded-xl p-4 flex flex-wrap gap-x-8 gap-y-4">
            <Dato label="Volumen unitario" value={formatVolume(linea.unit_volume_cm3)} />
            <Dato label="Volumen total" value={formatVolume(linea.total_volume_cm3)} />
            <Dato
              label="Ocupación estimada"
              value={formatPercent(linea.firing_occupancy_percent)}
            />
            <Dato
              label="Quema asignada"
              value={formatMoney(linea.firing_commercial_cost)}
            />
          </div>
        </>
      ) : null}

      {vista === "materiales" ? (
        <>
          <div className="border-l-2 border-emerald-500 pl-4 py-1 mb-5">
            <h4 className="text-sm font-semibold text-zinc-900">PASTA</h4>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              onCommit={(valor) => guardarYEsperar({ body_unit_weight: valor })}
              disabled={!canEdit}
              hint="La unidad la fija el maestro del material."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4 bg-zinc-50 rounded-xl p-4">
            <Dato label="Peso total" value={`${formatNumber(linea.body_total_weight)} ${linea.body_uom ?? ""}`} />
            <Dato label="Costo de pasta" value={formatMoney(linea.body_cost)} />
          </div>

          <div className="mt-6 border-l-2 border-emerald-500 pl-4 py-1 mb-5">
            <h4 className="text-sm font-semibold text-zinc-900">ESMALTE</h4>
          </div>
          
          <div className="mb-4">
            <SelectField
                label="Requiere esmalte"
                requirement="required"
              value={linea.requires_glaze ? "SI" : "NO"}
              options={[
                { value: "NO", label: "Sin esmalte" },
                { value: "SI", label: "Con esmalte" },
              ]}
              onChange={(valor) => guardar({ requires_glaze: valor === "SI" })}
              disabled={!canEdit}
            />
          </div>

          {linea.requires_glaze ? (
            <div className="bg-zinc-50 rounded-xl p-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato
                  label="Esmalte usado"
                  value={linea.glaze_material_name ?? "—"}
                  hint={
                    linea.glaze_is_reference
                      ? "Referencia de costeo (más caro)"
                      : "Elegido explícitamente"
                  }
                />
                <Dato label="Proporción" value={formatPercent(linea.glaze_percent)} />
                <Dato label="Peso total" value={`${formatNumber(linea.glaze_total_weight)} g`} />
                <Dato label="Costo de esmalte" value={formatMoney(linea.glaze_cost)} />
              </dl>
              {linea.glaze_is_reference ? (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-100">
                  Esto es una <strong>referencia de costeo</strong>, no el esmalte final.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-medium text-zinc-500 italic mt-2">Sin esmalte</p>
          )}
        </>
      ) : null}

      {linea.warnings.length > 0 ? (
        <ul className="mt-5 space-y-1">
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
