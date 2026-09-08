import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PrimaryButton, SecondaryButton, TextAreaField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { capabilitiesFor } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { StockLocationDialog } from "@/features/production/StockLocationDialog";
import { useCreateProductionOrder } from "@/features/production/useProductionOrders";
import { Alert, ApprovalBadge } from "@/features/prototypes/PrototypeUi";
import {
  MATERIAL_ROLE_OPTIONS,
  MATERIAL_STAGE_OPTIONS,
  describePrototypeError,
} from "@/features/prototypes/prototypeLabels";
import {
  useApprovePrototype,
  useCreateFinalQuotation,
  useCreatePrototypeSuccessor,
  usePrototype,
  usePrototypes,
  useRejectPrototype,
} from "@/features/prototypes/usePrototypes";
import type { Prototype } from "@/types/prototypes";

function etiqueta(options: readonly { value: string; label: string }[], value: string | null) {
  if (!value) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
}

/**
 * Lo que una orden de muestra necesita mostrar y su hermana de cotización no.
 *
 * Fase 009K.4. Vive AQUÍ, dentro de la ficha canónica de la orden, y no en una
 * pantalla aparte: la ejecución física es una sola y mandar a la gente a otro
 * sitio para ver el material o para aprobar la pieza recrearía el segundo flujo
 * que esta fase elimina.
 *
 * Los datos, en cambio, no se mudan. El material, la aprobación y la cadena de
 * iteraciones siguen viviendo en el prototipo, que es su autoridad; esta
 * pantalla los lee de allí. Copiarlos a la orden habría dado dos respuestas
 * para la misma pregunta.
 */
export function PrototypeOrderContext({ prototypeId }: { prototypeId: number }) {
  const prototype = usePrototype(prototypeId);

  if (prototype.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-5" label="Cargando la muestra…" />
      </div>
    );
  }
  if (prototype.isError || !prototype.data) {
    return <Alert>{describePrototypeError(prototype.error)}</Alert>;
  }

  const row = prototype.data;
  return (
    <>
      <Materiales prototype={row} />
      <Evaluacion prototype={row} />
      <Iteraciones prototype={row} />
    </>
  );
}

/**
 * El material de la muestra: lo previsto y lo que de verdad salió.
 *
 * No hay receta ni material preparado que enseñar, y no se inventa ninguno: el
 * material de una muestra lo eligió una persona línea por línea. Lo real
 * aparece en cuanto se arranca la orden, porque lo escribe el mismo movimiento
 * de inventario que lo descuenta.
 */
function Materiales({ prototype }: { prototype: Prototype }) {
  return (
    <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900">Materiales de la muestra</h2>
      <p className="mb-3 text-xs text-zinc-500">
        Lista física explícita: no se deduce de ninguna receta. Lo real lo escribe el arranque.
      </p>
      {prototype.materials.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
          La muestra no tiene materiales elegidos. Sin ellos no hay nada que descontar y la orden
          no puede arrancar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Material</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Etapa</th>
                <th className="px-4 py-3 text-right font-semibold">Previsto</th>
                <th className="px-4 py-3 text-right font-semibold">Real</th>
                <th className="px-4 py-3 font-semibold">Unidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {prototype.materials.map((line) => (
                <tr key={line.id} className="hover:bg-zinc-50/70">
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-900">{line.product_name}</span>
                    <span className="block font-mono text-[10px] text-zinc-400">
                      {line.product_internal_reference}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {etiqueta(MATERIAL_ROLE_OPTIONS, line.material_role)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {etiqueta(MATERIAL_STAGE_OPTIONS, line.stage)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{line.quantity_planned}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {line.quantity_actual ?? (
                      <span className="text-zinc-400">Aún no consta</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{line.uom_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Aprobar o rechazar la muestra. Eje distinto del físico, a propósito.
 *
 * Completar la orden dice que la pieza está hecha; no dice que valga. Por eso
 * completar no aprueba nada y la decisión sigue siendo un acto explícito de
 * quien administra.
 */
function Evaluacion({ prototype }: { prototype: Prototype }) {
  const navigate = useNavigate();
  const { data: user } = useSession();
  const caps = capabilitiesFor(user?.role);
  const approve = useApprovePrototype(prototype.id);
  const reject = useRejectPrototype(prototype.id);
  const cotizar = useCreateFinalQuotation(prototype.id);
  const [note, setNote] = useState("");

  const pendiente = prototype.status === "COMPLETED" && prototype.approval === "PENDING";
  const aprobada = prototype.status === "COMPLETED" && prototype.approval === "APPROVED";

  return (
    <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Evaluación de la muestra</h2>
        <ApprovalBadge approval={prototype.approval} />
      </div>

      {prototype.status !== "COMPLETED" ? (
        <p className="text-xs text-zinc-500">
          Se evalúa mirando la pieza terminada, así que estará disponible cuando la orden se
          complete.
        </p>
      ) : null}

      {pendiente && !caps.decidirPrototipo ? (
        <p className="text-xs text-zinc-600">La decisión corresponde a una persona administradora.</p>
      ) : null}

      {pendiente && caps.decidirPrototipo ? (
        <div className="space-y-3">
          <TextAreaField
            label="Nota de evaluación"
            requirement="optional"
            value={note}
            onChange={setNote}
          />
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              type="button"
              disabled={approve.isPending || reject.isPending}
              onClick={() => approve.mutate(note)}
            >
              Aprobar
            </PrimaryButton>
            <SecondaryButton
              className="border-red-200 text-red-700"
              disabled={approve.isPending || reject.isPending}
              onClick={() => reject.mutate(note)}
            >
              Rechazar
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {approve.error ? <Alert>{describePrototypeError(approve.error)}</Alert> : null}
      {reject.error ? <Alert>{describePrototypeError(reject.error)}</Alert> : null}

      {aprobada ? (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-900">Cotización final</p>
          <p className="mt-1 text-xs text-zinc-600">
            Se abre un borrador con lo que la muestra demostró: el producto, sus medidas y el
            material del cuerpo. La cantidad y el cliente los defines tú.
          </p>
          {caps.cotizarDesdePrototipo ? (
            <PrimaryButton
              type="button"
              className="mt-3"
              disabled={cotizar.isPending}
              onClick={() =>
                cotizar.mutate(undefined, {
                  onSuccess: (cotizacion) => navigate(`/cotizador/${cotizacion.id}`),
                })
              }
            >
              {cotizar.isPending ? "Creando…" : "Crear cotización final"}
            </PrimaryButton>
          ) : (
            <p className="mt-3 text-xs text-zinc-600">
              Cotizar corresponde a una persona administradora.
            </p>
          )}
          {cotizar.error ? <Alert>{describePrototypeError(cotizar.error)}</Alert> : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * La cadena de intentos, y la orden de la siguiente.
 *
 * Una muestra rechazada no se reescribe: se crea una sucesora. Y si hay que
 * volver a fabricarla, la sucesora recibe SU PROPIA orden. Reutilizar la de la
 * anterior mezclaría dos fabricaciones distintas —dos consumos, dos fechas, dos
 * hojas de taller— en un solo documento.
 */
function Iteraciones({ prototype }: { prototype: Prototype }) {
  const navigate = useNavigate();
  const successor = useCreatePrototypeSuccessor(prototype.id);
  const crearOrden = useCreateProductionOrder();
  const todas = usePrototypes({ limit: 200 });
  const [almacenAbierto, setAlmacenAbierto] = useState(false);

  const siguiente = todas.data?.items.find((row) => row.supersedes_prototype_id === prototype.id);

  return (
    <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900">Iteraciones</h2>
      <p className="mb-3 text-xs text-zinc-500">
        Cada intento conserva su historia. Una nueva iteración recibe otro código PRT.
      </p>

      <div className="space-y-1 text-xs text-zinc-700">
        <p>
          Muestra: <span className="font-mono font-semibold">{prototype.code}</span>
        </p>
        {prototype.supersedes_prototype_id ? (
          <p>
            Sustituye a{" "}
            <Link
              className="font-mono font-semibold hover:underline"
              to={`/produccion/prototipos/${prototype.supersedes_prototype_id}`}
            >
              la iteración anterior
            </Link>
          </p>
        ) : (
          <p className="text-zinc-500">Este es el primer intento.</p>
        )}
        {siguiente ? (
          <p>
            Iteración posterior:{" "}
            <Link
              className="font-mono font-semibold hover:underline"
              to={`/produccion/prototipos/${siguiente.id}`}
            >
              {siguiente.code}
            </Link>
          </p>
        ) : null}
      </div>

      {prototype.approval === "REJECTED" && !siguiente ? (
        <PrimaryButton
          type="button"
          className="mt-3"
          disabled={successor.isPending}
          onClick={() => successor.mutate(undefined)}
        >
          {successor.isPending ? "Creando…" : "Crear nueva iteración"}
        </PrimaryButton>
      ) : null}

      {/* La sucesora nace sin orden: crearla es una decisión aparte, porque
          exige elegir de qué almacén saldrá su material. */}
      {siguiente ? (
        <div className="mt-3">
          <SecondaryButton type="button" onClick={() => setAlmacenAbierto(true)}>
            Fabricar {siguiente.code}
          </SecondaryButton>
        </div>
      ) : null}

      {successor.error ? <Alert>{describePrototypeError(successor.error)}</Alert> : null}

      {almacenAbierto && siguiente ? (
        <StockLocationDialog
          title={`Fabricar ${siguiente.code}`}
          description={
            "Se creará una orden de producción propia para esta iteración. No se descuenta " +
            "ningún material: eso ocurre al arrancar la orden."
          }
          confirmLabel="Crear orden"
          pendingLabel="Creando…"
          onConfirm={(stockLocationId) =>
            crearOrden.mutate(
              { prototype_id: siguiente.id, stock_location_id: stockLocationId },
              {
                onSuccess: (orden) => {
                  setAlmacenAbierto(false);
                  navigate(`/produccion/${orden.id}`);
                },
              },
            )
          }
          onClose={() => setAlmacenAbierto(false)}
          pending={crearOrden.isPending}
          error={crearOrden.error}
        />
      ) : null}
    </section>
  );
}
