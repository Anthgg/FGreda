import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { PrimaryButton, SelectField, TextAreaField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { V2Wizard } from "@/features/cotizadorV2/V2Wizard";
import { esPasoValido, type PasoId } from "@/features/cotizadorV2/pasos";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { Badge, EmptyState, MasterHeader, Panel } from "@/features/masters/MasterTable";
import {
  useCreateV2Quotation,
  useV2Quotation,
  useV2Quotations,
} from "@/features/cotizadorV2/useQuoterV2";
import {
  V2_PRODUCTION_TYPE_LABEL,
  V2_STATUS_LABEL,
  type V2ProductionType,
} from "@/types/quoterV2";

/**
 * Cotizador V2: alta, listado y la ficha de siete pasos.
 *
 * Esta pantalla no es una copia del Cotizador histórico. Clonar aquella
 * interfaz para ir modificándola habría traído de vuelta, campo a campo, las
 * decisiones de las que V2 nace libre —el factor por ocupación de horno, entre
 * otras—.
 *
 * Desde 010G la ficha es un camino y no una pila de paneles: el asistente vive
 * en `V2Wizard` y el paso actual viaja en la URL. Aquí queda lo de alrededor
 * —crear una cotización, listarlas y la cabecera de la ficha—, que no es parte
 * del flujo.
 *
 * Sigue sin calcular nada: todos los importes llegan del backend. Una pantalla
 * que multiplicara por su cuenta tendría una aritmética de coma flotante
 * compitiendo con la de `Decimal`, y nadie sabría cuál manda.
 */

const PRODUCTION_TYPE_OPTIONS: readonly { value: V2ProductionType; label: string }[] = [
  { value: "RETAIL", label: V2_PRODUCTION_TYPE_LABEL.RETAIL },
  { value: "WHOLESALE", label: V2_PRODUCTION_TYPE_LABEL.WHOLESALE },
];

/**
 * De qué se ocupa cada fase de la familia 010, y cuál falta.
 *
 * Se enseña por la misma razón por la que el menú principal lista módulos que
 * aún no existen: quien usa el sistema ve a dónde va. Lo pendiente se marca
 * como pendiente y no se pinta apagado sin más: siete casillas grises no
 * distinguen lo que falta de lo que ya funciona.
 */
const FLOW_STEPS: readonly {
  phase: string;
  title: string;
  detail: string;
  listo: boolean;
}[] = [
  {
    phase: "010B",
    title: "Configuración comercial",
    detail: "IGV, moneda, vigencia y factor.",
    listo: true,
  },
  {
    phase: "010C",
    title: "Pastas, materiales y esmaltes",
    detail: "Costo por gramo y vidriado.",
    listo: true,
  },
  {
    phase: "010D",
    title: "Trabajadores y técnicas",
    detail: "Jornada, rendimiento e ilustración.",
    listo: true,
  },
  {
    phase: "010E",
    title: "Quema",
    detail: "Horno, hornadas, gas real y tarifa.",
    listo: true,
  },
  {
    phase: "010F",
    title: "Motor económico",
    detail: "Costo, factor, redondeo, IGV y moneda.",
    listo: true,
  },
  {
    phase: "010G",
    title: "Flujo de siete pasos",
    detail: "Del cliente al resumen, en orden.",
    listo: true,
  },
  {
    phase: "010H",
    title: "Vigencia y PDF",
    detail: "Snapshots y documento del cliente.",
    listo: false,
  },
];

function EngineBadge() {
  return (
    <span
      data-testid="v2-engine-badge"
      className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
    >
      Motor V2
    </span>
  );
}

function FlowOutline() {
  return (
    <Panel>
      <h2 className="text-sm font-semibold text-zinc-900">Qué hay construido</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Lo que no está disponible no se calcula: no hay importes provisionales.
      </p>
      <ol className="mt-4 space-y-2">
        {FLOW_STEPS.map((step) => (
          <li
            key={step.phase}
            className={[
              "flex items-start gap-3 rounded-xl border border-black/5 px-3 py-2",
              step.listo ? "" : "opacity-60",
            ].join(" ")}
          >
            <span className="mt-0.5 rounded-md bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
              {step.phase}
            </span>
            <span>
              <span className="block text-sm font-medium text-zinc-800">
                {step.title}
                {step.listo ? null : (
                  <span className="ml-2 text-[11px] font-normal text-zinc-500">(pendiente)</span>
                )}
              </span>
              <span className="block text-xs text-zinc-500">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function V2QuotationDetail({ id }: { id: number }) {
  const query = useV2Quotation(id);

  if (query.isPending) return <Spinner label="Cargando cotización V2" />;
  if (query.isError) {
    const message =
      query.error instanceof ApiError && query.error.status === 404
        ? "Esa cotización V2 no existe. Comprueba el enlace."
        : "No se pudo cargar la cotización V2.";
    return <EmptyState message={message} />;
  }

  const quotation = query.data;
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/cotizador-v2" className="text-xs text-zinc-500 hover:underline">
          &larr; Cotizaciones V2
        </Link>
        <h2 className="text-base font-semibold text-zinc-900">{quotation.code}</h2>
        <EngineBadge />
        <Badge tone={quotation.status === "CONFIRMED" ? "positive" : "warning"}>
          {V2_STATUS_LABEL[quotation.status]}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500">Tipo de producción</dt>
          <dd className="text-sm text-zinc-800">
            {V2_PRODUCTION_TYPE_LABEL[quotation.production_type]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Cliente</dt>
          <dd className="text-sm text-zinc-800">{quotation.customer_name ?? "Sin cliente"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Referencia</dt>
          <dd className="text-sm text-zinc-800">{quotation.name ?? "Sin referencia"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Motor de cálculo</dt>
          <dd className="text-sm text-zinc-800">{quotation.pricing_engine_version}</dd>
        </div>
      </dl>
    </Panel>
  );
}

/**
 * La ficha: la cabecera de la cotización y, debajo, el asistente.
 *
 * La cabecera va aparte del flujo a propósito: dice de quién es la cotización
 * y en qué estado está, y eso vale en los siete pasos. Meterla dentro del paso
 * uno la escondería en los otros seis.
 */
function V2QuotationDetailPage({ id, paso }: { id: number; paso: PasoId | null }) {
  const query = useV2Quotation(id);

  return (
    <div className="space-y-6">
      <V2QuotationDetail id={id} />
      {query.data ? <V2Wizard quotationId={id} paso={paso} /> : null}
    </div>
  );
}

export function CotizadorV2Page() {
  const { id, step } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [productionType, setProductionType] = useState<V2ProductionType>("RETAIL");
  const [notes, setNotes] = useState("");

  // `/cotizador-v2/loquesea` es una FICHA que no existe, no un alta nueva.
  // Sin esta distincion la pantalla mostraria el formulario de creacion con
  // una direccion de detalle en la barra, y nadie entenderia por que.
  const parsedId = id === undefined ? null : Number(id);
  const isDetail = id !== undefined;
  const validId = parsedId !== null && Number.isInteger(parsedId) && parsedId > 0;
  // Un paso que no existe no es un error que merezca una pantalla: se cae al
  // primero que falte, que es lo mismo que hace una ficha abierta sin paso.
  const paso = esPasoValido(step) ? step : null;

  const create = useCreateV2Quotation();
  // Solo en la vista de listado: entrar directo a una ficha no tiene por que
  // traerse ademas las diez ultimas cotizaciones que nadie va a mirar.
  const listado = useV2Quotations({ limit: 10 }, { enabled: !isDetail });

  const handleCreate = () => {
    create.mutate(
      {
        name: name.trim() || null,
        production_type: productionType,
        notes: notes.trim() || null,
      },
      { onSuccess: (data) => navigate(`/cotizador-v2/${data.id}`) },
    );
  };

  return (
    <div className="space-y-6">
      <MasterHeader
        title={
          <TypewriterTitle
            text="Cotizador V2."
            className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          />
        }
        subtitle="Motor nuevo. El Cotizador anterior sigue disponible como Legacy y sus cotizaciones no se recalculan."
        actions={<EngineBadge />}
      />

      {isDetail ? (
        validId ? (
          <V2QuotationDetailPage id={parsedId} paso={paso} />
        ) : (
          <EmptyState message="Esa cotización V2 no existe. Comprueba el enlace." />
        )
      ) : (
        <>
          <Panel>
            <h2 className="text-sm font-semibold text-zinc-900">Nueva cotización V2</h2>
            <p className="mt-1 text-xs text-zinc-500">
              El tipo de producción se elige aquí y no cambia solo. Modificarlo afecta únicamente
              a esta cotización, nunca a la configuración general.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Referencia"
                requirement="optional"
                value={name}
                onChange={setName}
                maxLength={200}
                placeholder="Pedido de platos, feria de octubre..."
              />
              <SelectField
                label="Tipo de producción"
                requirement="required"
                value={productionType}
                options={PRODUCTION_TYPE_OPTIONS}
                onChange={setProductionType}
                hint="Por menor sugiere horno chico; por mayor, horno grande."
              />
              <TextAreaField
                label="Notas internas"
                requirement="optional"
                value={notes}
                onChange={setNotes}
                rows={2}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <PrimaryButton type="button" onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? "Creando..." : "Crear cotización V2"}
              </PrimaryButton>
              {create.isError ? (
                <span role="alert" className="text-xs text-red-600">
                  No se pudo crear la cotización V2.
                </span>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-sm font-semibold text-zinc-900">Últimas cotizaciones V2</h2>
            {listado.isPending ? (
              <div className="mt-4">
                <Spinner label="Cargando cotizaciones V2" />
              </div>
            ) : listado.isError ? (
              <EmptyState message="No se pudieron cargar las cotizaciones V2." />
            ) : listado.data.items.length === 0 ? (
              <EmptyState message="Todavía no hay cotizaciones V2." />
            ) : (
              <ul className="mt-4 divide-y divide-black/5">
                {listado.data.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/cotizador-v2/${item.id}`)}
                      className="text-sm font-medium text-zinc-800 hover:underline cursor-pointer"
                    >
                      {item.code}
                    </button>
                    <span className="text-xs text-zinc-500">
                      {V2_PRODUCTION_TYPE_LABEL[item.production_type]} ·{" "}
                      {V2_STATUS_LABEL[item.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <FlowOutline />
        </>
      )}
    </div>
  );
}
