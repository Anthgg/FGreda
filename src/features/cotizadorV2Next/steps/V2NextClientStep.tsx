import { Link } from "react-router-dom";
import { CustomerSelectField } from "@/components/CustomerSelectField";
import { SegmentedControl } from "@/components/SegmentedControl";
import { DecimalField } from "@/components/DecimalField";
import { DeferredTextField } from "@/components/DeferredTextField";
import { describeError } from "@/features/settings/messages";
import { esMonedaExtranjera } from "@/features/cotizadorV2/pasos";
import { useUpdateV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import { Panel } from "@/features/masters/MasterTable";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

export function V2NextClientStep({ quotationId, datos, canEdit }: PasoDelAsistenteProps) {
  const cotizacion = datos.cotizacion;
  const guardar = useUpdateV2Quotation(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  if (!cotizacion) return null;

  const esExtranjera = esMonedaExtranjera(cotizacion.currency_code);

  const condicionesFijas = (
    <details className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
      <summary className="cursor-pointer text-sm font-medium text-zinc-900 focus:outline-hidden">
        Condiciones fijas de esta cotización
      </summary>
      <div className="mt-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">Vigencia</dt>
            <dd className="text-sm font-medium text-zinc-800">
              {cotizacion.validity_days !== null ? `${cotizacion.validity_days} días` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">IGV</dt>
            <dd className="text-sm font-medium text-zinc-800">
              {cotizacion.tax_percent !== null ? `${Number(cotizacion.tax_percent)} %` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Jornada</dt>
            <dd className="text-sm font-medium text-zinc-800">
              {cotizacion.workday_hours !== null ? `${Number(cotizacion.workday_hours)} h` : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500">
          Se tomaron de Configuración al crearla. Si cambias Configuración, esta cotización no se altera.
        </p>
      </div>
    </details>
  );

  if (!canEdit) {
    return (
      <Panel>
        <div className="space-y-6">
          <header>
            <h2 className="text-lg font-semibold text-zinc-900">
              Cliente y datos de la cotización
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Elige el cliente y cómo se le cobra. Estos datos solo afectan a esta cotización.
            </p>
          </header>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-zinc-500">Cliente</dt>
              <dd className="mt-1 text-sm text-zinc-900">
                {cotizacion.customer_name ?? "Sin cliente"}
                <div className="mt-1 text-[11px]">
                  <Link to="/terceros" className="text-emerald-600 hover:text-emerald-700 hover:underline">
                    Ver en Terceros
                  </Link>
                </div>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-zinc-500">Tipo de cliente</dt>
              <dd className="mt-1 text-sm text-zinc-900">
                {cotizacion.customer_kind === "STUDENT" ? "Alumno" : "Cliente externo"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-zinc-500">Moneda</dt>
              <dd className="mt-1 text-sm text-zinc-900">
                {cotizacion.currency_code === "USD" ? "Dólares" : "Soles"}
              </dd>
            </div>
            {esExtranjera && (
              <div>
                <dt className="text-sm font-medium text-zinc-500">Tipo de cambio</dt>
                <dd className="mt-1 text-sm text-zinc-900">{cotizacion.exchange_rate}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-zinc-500">Tipo de pedido</dt>
              <dd className="mt-1 text-sm text-zinc-900">
                {cotizacion.production_type === "WHOLESALE" ? "Por mayor" : "Por menor"}
              </dd>
            </div>
            {cotizacion.name && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-zinc-500">Nombre de la cotización</dt>
                <dd className="mt-1 text-sm text-zinc-900">{cotizacion.name}</dd>
              </div>
            )}
            {cotizacion.client_notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-zinc-500">Mensaje para el cliente</dt>
                <dd className="mt-1 text-sm text-zinc-900 whitespace-pre-wrap">{cotizacion.client_notes}</dd>
              </div>
            )}
            {cotizacion.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-zinc-500">Notas internas</dt>
                <dd className="mt-1 text-sm text-zinc-900 whitespace-pre-wrap">{cotizacion.notes}</dd>
              </div>
            )}
          </dl>

          {condicionesFijas}
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-zinc-900">
            Cliente y datos de la cotización
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Elige el cliente y cómo se le cobra. Estos datos solo afectan a esta cotización.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <CustomerSelectField
            label="Cliente"
            requirement="required"
            value={cotizacion.customer_id}
            {...(cotizacion.customer_name ? { selectedLabel: cotizacion.customer_name } : {})}
            onChange={(id) => guardar.mutate({ customer_id: id })}
            hint={
              <>
                <Link to="/terceros" className="text-emerald-600 hover:text-emerald-700 hover:underline">
                  Registrar cliente nuevo en Terceros
                </Link>
              </>
            }
          />

          <SegmentedControl
            label="Tipo de cliente"
            value={cotizacion.customer_kind ?? "EXTERNAL"}
            options={[
              { value: "EXTERNAL", label: "Cliente externo" },
              { value: "STUDENT", label: "Alumno" },
            ]}
            onChange={(valor) => guardar.mutate({ customer_kind: valor })}
            hint="Cambia la tarifa de horno que se cobra. El gas que se consume es el mismo."
            fullWidth
          />

          <SegmentedControl
            label="Moneda"
            value={cotizacion.currency_code ?? "PEN"}
            options={[
              { value: "PEN", label: "Soles" },
              { value: "USD", label: "Dólares" },
            ]}
            onChange={(valor) => guardar.mutate({ currency_code: valor })}
            fullWidth
          />

          {esExtranjera && (
            <DecimalField
              label="Tipo de cambio"
              requirement="required"
              value={cotizacion.exchange_rate}
              onCommit={(valor) => 
                valor !== null
                  ? esperarGuardado(guardar, "cabecera", { exchange_rate: valor })
                  : undefined
              }
              hint="Se congela en esta cotización: el precio pactado no cambia porque mañana cambie el dólar."
            />
          )}

          <SegmentedControl
            label="Tipo de pedido"
            value={cotizacion.production_type}
            options={[
              { value: "RETAIL", label: "Por menor" },
              { value: "WHOLESALE", label: "Por mayor" },
            ]}
            onChange={(valor) => guardar.mutate({ production_type: valor })}
            hint="Sugiere un horno: chico para por menor, grande para por mayor. Se puede cambiar en el paso Horno."
            fullWidth
          />

          <DeferredTextField
            label="Nombre de la cotización"
            requirement="optional"
            value={cotizacion.name ?? ""}
            onCommit={(name) =>
              esperarGuardado(guardar, "cabecera", {
                name: name === null || name.trim() === "" ? null : name.trim(),
              })
            }
            maxLength={200}
            hint="Solo para tu lista. No sale en el PDF."
          />
        </div>

        <div className="space-y-6">
          <DeferredTextField
            multiline
            label="Mensaje para el cliente"
            requirement="optional"
            value={cotizacion.client_notes ?? ""}
            onCommit={(client_notes) =>
              esperarGuardado(guardar, "cabecera", {
                client_notes: client_notes === null || client_notes.trim() === "" ? null : client_notes.trim(),
              })
            }
            hint="Sale en el PDF junto a las condiciones."
          />

          <DeferredTextField
            multiline
            label="Notas internas"
            requirement="optional"
            value={cotizacion.notes ?? ""}
            onCommit={(notes) =>
              esperarGuardado(guardar, "cabecera", {
                notes: notes === null || notes.trim() === "" ? null : notes.trim(),
              })
            }
            hint="Solo las ve el taller."
          />
        </div>

        {condicionesFijas}

        {guardar.isError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {describeError(guardar.error)}
          </p>
        )}
      </div>
    </Panel>
  );
}
