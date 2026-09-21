import { useQuery } from "@tanstack/react-query";

import { fetchV2Materials } from "@/api/quoterV2Materials";
import { fetchV2Techniques, fetchV2Workers } from "@/api/quoterV2Labor";
import { DecimalField } from "@/components/DecimalField";
import { SelectField } from "@/components/form";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { useUpdateFiringQuotation } from "@/features/soloQuema/useSoloQuema";
import {
  GLAZE_SOURCE_LABEL,
  type V2FiringQuotation,
  type V2GlazeCostSource,
} from "@/types/firingQuotationV2";

/**
 * El vidriado de un servicio de Solo Quema. Fase 010K. OPCIONAL.
 *
 * Hay clientes que traen la pieza ya esmaltada y solo quieren el horno; hay
 * otros que piden además el esmalte, y algunos que piden que se lo apliquen.
 * Son tres casos distintos y aquí se distinguen: el esmalte (gramos por costo
 * por gramo) y la mano de obra de vidriarlo se encienden por separado.
 *
 * ## De dónde sale el costo por gramo
 *
 * Del maestro, tomando el esmalte activo más caro, o escrito a mano para este
 * servicio. Lo escrito a mano se marca como tal y NO toca el maestro: un
 * acuerdo puntual no puede cambiar el precio de todas las demás cotizaciones.
 * Un costo manual en cero no vale —no es un esmalte gratis, es un campo a medio
 * llenar— y el backend vuelve al del maestro avisando.
 *
 * ## La mano de obra de vidriado sí cuesta
 *
 * A diferencia de la mano de obra interna del Cotizador V2, aquí vidriar es un
 * servicio que se presta y se cobra; el backend la valoriza con el jornal de
 * quien vidria y el rendimiento de la técnica.
 */

const SIN_ESMALTE = "";
const SIN_PERSONA = "";
const SIN_TECNICA = "";

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

export function SQVidriadoPanel({
  cotizacion,
  canEdit,
}: {
  cotizacion: V2FiringQuotation;
  canEdit: boolean;
}) {
  const guardar = useUpdateFiringQuotation(cotizacion.id);
  const activo = cotizacion.glaze_enabled;

  const esmaltes = useQuery({
    queryKey: ["solo-quema", "esmaltes"],
    queryFn: () => fetchV2Materials("GLAZE"),
    enabled: activo,
  });
  const personas = useQuery({
    queryKey: ["solo-quema", "trabajadores"],
    queryFn: () => fetchV2Workers(true),
    enabled: activo && cotizacion.glaze_labor_enabled,
  });
  const tecnicas = useQuery({
    queryKey: ["solo-quema", "tecnicas"],
    queryFn: () => fetchV2Techniques(true),
    enabled: activo && cotizacion.glaze_labor_enabled,
  });

  const opcionesEsmalte = [
    { value: SIN_ESMALTE, label: "El más caro activo (referencia)" },
    ...(esmaltes.data?.items ?? [])
      .filter((material) => material.active)
      .map((material) => ({
        value: String(material.product_id),
        label: `${material.product_name} · ${material.effective_cost_per_unit} por gramo`,
      })),
  ];

  return (
    <Panel>
      <div data-testid="panel-vidriado-quema">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Vidriado (opcional)</h2>
          <span className="text-xs text-zinc-500">
            Esmalte: <strong>{cotizacion.glaze_material_cost}</strong> · Mano de obra:{" "}
            <strong>{cotizacion.glaze_labor_cost}</strong>
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Si el cliente trae la pieza ya esmaltada, esto se queda apagado y no cuesta nada.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="¿Lleva esmalte del taller?"
            requirement="optional"
            value={activo ? "SI" : "NO"}
            options={[
              { value: "NO", label: "No: la pieza viene esmaltada" },
              { value: "SI", label: "Sí: el taller pone el esmalte" },
            ]}
            onChange={(valor) => guardar.mutate({ glaze_enabled: valor === "SI" })}
            disabled={!canEdit}
          />

          {activo ? (
            <>
              <DecimalField
                label="Gramos de esmalte"
                requirement="required"
                value={cotizacion.glaze_grams}
                onCommit={(valor) => {
                  if (valor === null) return;
                  guardar.mutate({ glaze_grams: valor });
                }}
                disabled={!canEdit}
                hint="Para todo el pedido, no por pieza."
              />
              <SelectField
                label="De dónde sale el costo"
                requirement="required"
                value={cotizacion.glaze_cost_source}
                options={(["MASTER", "MANUAL"] as V2GlazeCostSource[]).map((valor) => ({
                  value: valor,
                  label: GLAZE_SOURCE_LABEL[valor],
                }))}
                onChange={(valor) =>
                  guardar.mutate({ glaze_cost_source: valor as V2GlazeCostSource })
                }
                disabled={!canEdit}
                hint="Lo escrito a mano vale solo aquí: nunca cambia el maestro."
              />

              {cotizacion.glaze_cost_source === "MASTER" ? (
                <SelectField
                  label="Esmalte"
                  requirement="optional"
                  value={
                    cotizacion.glaze_material_id === null
                      ? SIN_ESMALTE
                      : String(cotizacion.glaze_material_id)
                  }
                  options={opcionesEsmalte}
                  onChange={(valor) =>
                    guardar.mutate({
                      glaze_material_id: valor === SIN_ESMALTE ? null : Number(valor),
                    })
                  }
                  disabled={!canEdit}
                  searchable
                  {...(esmaltes.isPending ? { hint: "Cargando esmaltes..." } : {})}
                />
              ) : (
                <DecimalField
                  label="Costo por gramo acordado"
                  requirement="required"
                  value={cotizacion.glaze_manual_cost_per_gram}
                  onCommit={(valor) => guardar.mutate({ glaze_manual_cost_per_gram: valor })}
                  disabled={!canEdit}
                  hint="Mayor que cero. En cero, el backend vuelve al esmalte del maestro y avisa."
                />
              )}

              <SelectField
                label="¿Lo vidria el taller?"
                requirement="optional"
                value={cotizacion.glaze_labor_enabled ? "SI" : "NO"}
                options={[
                  { value: "NO", label: "No: solo se entrega el esmalte" },
                  { value: "SI", label: "Sí: el taller lo aplica" },
                ]}
                onChange={(valor) => guardar.mutate({ glaze_labor_enabled: valor === "SI" })}
                disabled={!canEdit}
                hint="Vidriar es un servicio que se presta: se valoriza y se cobra."
              />

              {cotizacion.glaze_labor_enabled ? (
                <>
                  <SelectField
                    label="Quién vidria"
                    requirement="required"
                    value={
                      cotizacion.glaze_labor_worker_id === null
                        ? SIN_PERSONA
                        : String(cotizacion.glaze_labor_worker_id)
                    }
                    options={[
                      { value: SIN_PERSONA, label: "Sin asignar" },
                      ...(personas.data?.items ?? []).map((persona) => ({
                        value: String(persona.id),
                        label: `${persona.name} · ${persona.hourly_rate} por hora`,
                      })),
                    ]}
                    onChange={(valor) =>
                      guardar.mutate({
                        glaze_labor_worker_id: valor === SIN_PERSONA ? null : Number(valor),
                      })
                    }
                    disabled={!canEdit}
                    searchable
                  />
                  <SelectField
                    label="Técnica"
                    requirement="required"
                    value={
                      cotizacion.glaze_labor_technique_id === null
                        ? SIN_TECNICA
                        : String(cotizacion.glaze_labor_technique_id)
                    }
                    options={[
                      { value: SIN_TECNICA, label: "Sin técnica" },
                      ...(tecnicas.data?.items ?? []).map((tecnica) => ({
                        value: String(tecnica.id),
                        label: `${tecnica.name} · ${tecnica.default_capacity_per_workday} por jornada`,
                      })),
                    ]}
                    onChange={(valor) =>
                      guardar.mutate({
                        glaze_labor_technique_id: valor === SIN_TECNICA ? null : Number(valor),
                      })
                    }
                    disabled={!canEdit}
                    searchable
                  />
                  <DecimalField
                    label="Piezas a vidriar"
                    requirement="required"
                    value={cotizacion.glaze_labor_quantity}
                    onCommit={(valor) => {
                      if (valor === null) return;
                      guardar.mutate({ glaze_labor_quantity: valor });
                    }}
                    disabled={!canEdit}
                    hint="De ahí y del rendimiento de la técnica salen las horas."
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>

        {activo ? (
          <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border border-black/[0.06] p-4 sm:grid-cols-4">
            <Dato
              label="Esmalte usado"
              value={
                cotizacion.glaze_cost_source === "MANUAL"
                  ? "Costo escrito a mano"
                  : (cotizacion.glaze_material_name ?? "—")
              }
            />
            <Dato label="Costo por gramo" value={cotizacion.glaze_cost_per_gram ?? "—"} />
            <Dato label="Costo del esmalte" value={cotizacion.glaze_material_cost} />
            <Dato label="Horas de vidriado" value={cotizacion.glaze_labor_hours} />
          </dl>
        ) : null}

        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
