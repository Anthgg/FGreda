import { ChoiceCardGroup } from "@/components/ChoiceCardGroup";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Spinner } from "@/components/Spinner";
import type { ResultadoDeGuardado } from "@/components/borradores";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import { formatCosto } from "@/features/cotizadorV2/moneda";
import {
  useSetV2Firing,
  useV2Firing,
} from "@/features/cotizadorV2/useQuoterV2Firing";
import type { FiringDeferredPatch } from "@/features/cotizadorV2Next/steps/kiln/KilnAdvanced";
import { KilnAdvanced } from "@/features/cotizadorV2Next/steps/kiln/KilnAdvanced";
import { KilnOptionCard } from "@/features/cotizadorV2Next/steps/kiln/KilnOptionCard";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  CUSTOMER_KIND_LABEL,
  FIRING_MODE_LABEL,
  FIRING_WARNING_LABEL,
  type V2Firing,
  type V2FiringInput,
  type V2FiringMode,
} from "@/types/quoterV2Firing";
import { V2_PRODUCTION_TYPE_LABEL, type V2ProductionType } from "@/types/quoterV2";

/**
 * Paso «Horno» del Cotizador V2 rediseñado.
 *
 * Este paso solo manda decisiones: horno, modo, ciclos y acuerdos puntuales de
 * tarifa. La ocupación, las hornadas y cada importe vienen del backend; por eso
 * aquí no se calcula dinero ni se reconstruyen reglas comerciales.
 */

const MODOS: readonly { value: V2FiringMode; label: string }[] = [
  { value: "SHARED", label: "Compartido" },
  { value: "EXCLUSIVE", label: "Solo este pedido (exclusiva o urgente)" },
];

const RECOMENDACIONES = new Set([
  "V2_FIRING_SMALLER_KILN_FITS",
  "V2_FIRING_LARGER_KILN_SUGGESTED",
]);

function maxCapacity(quema: V2Firing): string {
  const capacidades = quema.kilns.map((horno) => Number(horno.capacity_cm3));
  const maximo = Math.max(1, ...capacidades.filter(Number.isFinite));
  return String(maximo);
}

function etiquetaProduccion(valor: string): string {
  return V2_PRODUCTION_TYPE_LABEL[valor as V2ProductionType] ?? valor;
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
      <dd className="mt-0.5 text-sm text-zinc-800">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[11.5px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

function ResumenSoloLectura({
  quema,
  irACliente,
}: {
  quema: V2Firing;
  irACliente: () => void;
}) {
  const elegido = quema.kilns.find((horno) => horno.kiln_id === quema.kiln_id);
  const recomendado = quema.kilns.find((horno) => horno.kiln_id === quema.recommended_kiln_id);
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Dato label="Horno elegido" value={elegido?.name ?? quema.kiln_name ?? "Sin horno"} />
        <Dato label="Modo de quema" value={FIRING_MODE_LABEL[quema.firing_mode]} />
        <Dato label="Primera quema (baja)" value={quema.low_fire_enabled ? "Sí" : "No"} />
        <Dato label="Segunda quema (alta)" value={quema.high_fire_enabled ? "Sí" : "No"} />
        <Dato label="Horno recomendado" value={recomendado?.name ?? "—"} hint="No se aplica solo." />
        <Dato label="Tarifa de quema" value={formatCosto(quema.commercial_total)} />
        <Dato label="Gas real" value={formatCosto(quema.gas_total)} />
        <Dato
          label="Tipo de cliente"
          value={quema.customer_kind ? CUSTOMER_KIND_LABEL[quema.customer_kind] : "Sin definir"}
        />
        <Dato label="Tipo de producción" value={etiquetaProduccion(quema.production_type)} />
      </dl>
      <button
        type="button"
        onClick={irACliente}
        className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-white"
      >
        Cambiar en Cliente
      </button>
    </section>
  );
}

function ContextoCliente({
  quema,
  irACliente,
}: {
  quema: V2Firing;
  irACliente: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <dl className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <Dato
            label="Tipo de cliente"
            value={quema.customer_kind ? CUSTOMER_KIND_LABEL[quema.customer_kind] : "Sin definir"}
            hint="Se edita en el paso Cliente."
          />
          <Dato
            label="Tipo de producción"
            value={etiquetaProduccion(quema.production_type)}
            hint="El sistema no lo cambia solo."
          />
        </dl>
        <button
          type="button"
          onClick={irACliente}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white/70 px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-white"
        >
          Cambiar en Cliente
        </button>
      </div>
    </section>
  );
}

function SwitchQuema({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={[
        "flex min-h-10 items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2",
        disabled ? "opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span className="text-sm font-semibold text-zinc-900">{label}</span>
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

function AvisosDeQuema({ codigos }: { codigos: readonly string[] }) {
  if (codigos.length === 0) return null;
  return (
    <ul data-testid="v2next-avisos-horno" className="space-y-2">
      {codigos.map((codigo, indice) => {
        const recomendacion = RECOMENDACIONES.has(codigo);
        return (
          <li
            key={`${codigo}-${indice}`}
            className={[
              "rounded-xl border px-3 py-2 text-xs",
              recomendacion
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            ].join(" ")}
          >
            <span className="font-semibold">{recomendacion ? "Recomendación: " : "Aviso: "}</span>
            {FIRING_WARNING_LABEL[codigo] ??
              "Hay un aviso de quema para esta cotización. Revise los datos anteriores."}
          </li>
        );
      })}
    </ul>
  );
}

export function V2NextKilnStep({
  quotationId,
  canEdit,
  irAPaso,
}: PasoDelAsistenteProps) {
  const query = useV2Firing(quotationId);
  const guardar = useSetV2Firing(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  if (query.isPending) {
    return (
      <Panel>
        <Spinner className="size-5" label="Cargando horno..." />
      </Panel>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Panel>
        <p role="alert" className="text-sm text-red-700">
          {describeError(query.error)}
        </p>
      </Panel>
    );
  }

  const quema = query.data;
  const capacidadMaxima = maxCapacity(quema);
  const irACliente = () => irAPaso("cliente");

  const mutar = (payload: V2FiringInput) => {
    guardar.mutate(payload);
  };
  const guardarDiferido = (payload: FiringDeferredPatch): void | Promise<ResultadoDeGuardado> =>
    esperarGuardado(
      guardar as { mutateAsync: (variables: FiringDeferredPatch) => Promise<unknown> },
      "quema",
      payload,
    );

  return (
    <Panel>
      <div data-testid="v2next-paso-horno" className="space-y-5">
        <p className="max-w-[64ch] text-[13px] text-zinc-600">
          Compara cuánto se llena cada horno con este pedido. En quema compartida se cobra solo
          la parte que ocupa.
        </p>

        {quema.cheaper_kiln ? (
          <p
            data-testid="v2next-sugerencia-horno"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            «{quema.cheaper_kiln.name}» reduce la quema en{" "}
            <strong>{formatCosto(quema.cheaper_kiln.savings)}</strong>. Es una sugerencia: el horno
            no se cambia solo.
          </p>
        ) : null}

        <AvisosDeQuema codigos={quema.warnings} />
        <ContextoCliente quema={quema} irACliente={irACliente} />

        {canEdit ? (
          <>
            <ChoiceCardGroup
              value={quema.kiln_id === null ? null : String(quema.kiln_id)}
              onChange={(valor) => {
                const kilnId = Number(valor);
                if (kilnId !== quema.kiln_id) mutar({ kiln_id: kilnId });
              }}
              label="Horno de esta cotización"
              columns="auto"
              showRadioIndicator={false}
              data-testid="v2next-hornos"
              options={quema.kilns.map((horno) => ({
                value: String(horno.kiln_id),
                title: horno.name,
                badge: horno.kiln_id === quema.recommended_kiln_id ? "Recomendado" : undefined,
                testId: `kiln-option-${horno.kiln_id}`,
                children: (
                  <KilnOptionCard
                    horno={horno}
                    seleccionado={horno.kiln_id === quema.kiln_id}
                    batchLoads={horno.kiln_id === quema.kiln_id ? quema.batch_loads : []}
                    maxCapacityCm3={capacidadMaxima}
                  />
                ),
              }))}
            />

            <section className="grid grid-cols-1 gap-4 rounded-2xl border border-black/[0.06] bg-white/60 p-4 lg:grid-cols-2">
              <div>
                <SegmentedControl
                  label="¿Comparte el horno?"
                  value={quema.firing_mode}
                  onChange={(valor) => {
                    if (valor !== quema.firing_mode) mutar({ firing_mode: valor });
                  }}
                  options={MODOS}
                  fullWidth
                  hint={
                    quema.firing_mode === "SHARED"
                      ? "Se cobra solo el espacio que ocupa."
                      : "Se cobran las hornadas completas."
                  }
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-800">Quemas</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <SwitchQuema
                    label="Primera quema (baja)"
                    checked={quema.low_fire_enabled}
                    disabled={!canEdit}
                    onChange={(checked) => mutar({ low_fire_enabled: checked })}
                  />
                  <SwitchQuema
                    label="Segunda quema (alta)"
                    checked={quema.high_fire_enabled}
                    disabled={!canEdit}
                    onChange={(checked) => mutar({ high_fire_enabled: checked })}
                  />
                </div>
              </div>
            </section>
          </>
        ) : (
          <ResumenSoloLectura quema={quema} irACliente={irACliente} />
        )}

        <KilnAdvanced quema={quema} canEdit={canEdit} guardarDiferido={guardarDiferido} />

        {guardar.isError ? (
          <p role="alert" className="text-xs text-red-700">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
