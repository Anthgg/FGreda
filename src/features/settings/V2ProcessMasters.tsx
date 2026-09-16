import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { fetchProducts } from "@/api/masters";
import { PrimaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { EmptyState, Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { useV2Techniques } from "@/features/cotizadorV2/useQuoterV2Labor";
import {
  useCreateV2Extra,
  useSetV2ProductTechniques,
  useUpdateV2Extra,
  useV2Extras,
} from "@/features/cotizadorV2/useQuoterV2Processes";
import { fetchV2ProductTechniques } from "@/api/quoterV2Processes";
import { V2_PRODUCT_TECHNIQUES_KEY } from "@/features/cotizadorV2/claves";

/**
 * Qué procesos necesita cada pieza del catálogo (corrección 010H).
 *
 * Hasta aquí nadie lo sabía: ni el Excel, ni la base, ni el backend. Producto,
 * técnica y trabajador eran tres listas sueltas, y quien cotizaba tenía que
 * acordarse de que una taza lleva asa y escribirlo a mano, una por una.
 *
 * Lo que se configura aquí es el ESTÁNDAR de la pieza. Cada cotización puede
 * quitar un proceso o añadir otro sin tocar esta ficha: un pedido raro no
 * cambia lo que la pieza necesita normalmente.
 */
export function V2ProductProcessesTable({ canEdit }: { canEdit: boolean }) {
  const piezas = useQuery({
    queryKey: ["products", "FINISHED_PRODUCT", "para-procesos"],
    queryFn: () => fetchProducts({ product_type: "FINISHED_PRODUCT", active: true, limit: 200 }),
  });
  const tecnicas = useV2Techniques();

  if (piezas.isPending || tecnicas.isPending) {
    return <Spinner className="size-5" label="Cargando piezas..." />;
  }
  if (piezas.isError) {
    return (
      <div role="alert" className="text-sm text-red-700">
        {describeError(piezas.error)}
      </div>
    );
  }

  const items = piezas.data?.items ?? [];

  return (
    <Panel>
      <div data-testid="procesos-por-pieza">
        <h2 className="text-sm font-semibold text-zinc-900">Procesos de cada pieza</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Lo que hay que hacerle a cada pieza del catálogo: torno, asa, acabado, esmaltado. Al
          añadirla a una cotización, estos procesos aparecen solos con sus piezas y sus horas. Cada
          cotización puede quitar o añadir sin cambiar esta ficha.
        </p>

        {items.length === 0 ? (
          <EmptyState message="No hay piezas de catálogo activas todavía." />
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((pieza) => (
              <ProcesosDeUnaPieza
                key={pieza.id}
                productId={pieza.id}
                nombre={pieza.name}
                canEdit={canEdit}
                tecnicas={(tecnicas.data?.items ?? []).map((una) => ({
                  id: una.id,
                  name: una.name,
                  active: una.active,
                }))}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function ProcesosDeUnaPieza({
  productId,
  nombre,
  canEdit,
  tecnicas,
}: {
  productId: number;
  nombre: string;
  canEdit: boolean;
  tecnicas: { id: number; name: string; active: boolean }[];
}) {
  const query = useQuery({
    queryKey: [...V2_PRODUCT_TECHNIQUES_KEY, productId],
    queryFn: () => fetchV2ProductTechniques(productId),
  });
  const guardar = useSetV2ProductTechniques();
  const [editando, setEditando] = useState<number[] | null>(null);

  const puestas = (query.data?.items ?? []).filter((fila) => fila.active);
  const marcadas = editando ?? puestas.map((fila) => fila.technique_id);
  const visibles = tecnicas.filter((una) => una.active || marcadas.includes(una.id));

  return (
    <li
      data-testid={`procesos-de-${productId}`}
      className="rounded-2xl border border-black/[0.06] p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900">{nombre}</p>
        {canEdit ? (
          editando === null ? (
            <button
              type="button"
              onClick={() => setEditando(puestas.map((fila) => fila.technique_id))}
              className="text-xs font-semibold text-zinc-700 underline underline-offset-2 cursor-pointer"
            >
              Editar procesos
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  guardar.mutate(
                    { productId, techniqueIds: editando },
                    { onSuccess: () => setEditando(null) },
                  )
                }
                disabled={guardar.isPending}
                className="text-xs font-semibold text-zinc-900 underline underline-offset-2 cursor-pointer disabled:opacity-40"
              >
                {guardar.isPending ? "Guardando..." : "Guardar procesos"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="text-xs text-zinc-600 underline underline-offset-2 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )
        ) : null}
      </div>

      {editando === null ? (
        <p className="mt-1 text-xs text-zinc-600">
          {puestas.length === 0 ? (
            <span className="text-amber-700">
              Sin procesos: al cotizarla habrá que elegirlos a mano cada vez.
            </span>
          ) : (
            puestas.map((fila) => fila.technique_name).join(" → ")
          )}
        </p>
      ) : (
        <fieldset className="mt-2 text-xs">
          <legend className="text-zinc-500">Procesos de {nombre}, en orden</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {visibles.map((una) => (
              <label key={una.id} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={marcadas.includes(una.id)}
                  disabled={guardar.isPending}
                  onChange={(evento) =>
                    setEditando(
                      evento.target.checked
                        ? [...marcadas, una.id]
                        : marcadas.filter((id) => id !== una.id),
                    )
                  }
                />
                {una.name}
                {una.active ? null : <span className="text-zinc-400">(retirada)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {guardar.isError ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {describeError(guardar.error)}
        </p>
      ) : null}
    </li>
  );
}

const EXTRA_NUEVO = { name: "", unit: "servicio", unit_cost: "" };

/**
 * Conceptos adicionales: empaque especial, molde, sello (corrección 010H).
 *
 * El Excel los tiene desde el principio y V2 no los tenía. Son costos que
 * alguien decide, no materiales ni técnicas: no se consumen del inventario y no
 * tienen rendimiento. Aquí se guarda lo que suele costar cada uno; la
 * cotización puede pactar otro precio y congela el suyo.
 */
export function V2ExtrasTable({ canEdit }: { canEdit: boolean }) {
  const query = useV2Extras();
  const crear = useCreateV2Extra();
  const actualizar = useUpdateV2Extra();
  const [draft, setDraft] = useState(EXTRA_NUEVO);
  const [error, setError] = useState<string | null>(null);

  if (query.isPending) return <Spinner className="size-5" label="Cargando adicionales..." />;
  if (query.isError) {
    return (
      <div role="alert" className="text-sm text-red-700">
        {describeError(query.error)}
      </div>
    );
  }

  const items = query.data?.items ?? [];

  const alta = () => {
    if (draft.name.trim() === "") {
      setError("El adicional necesita un nombre.");
      return;
    }
    if (draft.unit_cost.trim() === "") {
      setError("Escriba cuánto cuesta. Si todavía no se sabe, ponga cero.");
      return;
    }
    setError(null);
    crear.mutate(
      {
        name: draft.name.trim(),
        unit: draft.unit.trim() || "servicio",
        unit_cost: draft.unit_cost.trim(),
      },
      { onSuccess: () => setDraft(EXTRA_NUEVO) },
    );
  };

  return (
    <Panel>
      <div data-testid="conceptos-adicionales">
        <h2 className="text-sm font-semibold text-zinc-900">Adicionales</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Empaque especial, moldes, sellos, preparaciones. No son material ni técnica: son un costo
          que se decide. En la cotización suman al costo de producción y al costo real.
        </p>

        {items.length === 0 ? (
          <EmptyState message="Todavía no hay conceptos adicionales." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Concepto</th>
                  <th className="py-2 pr-3 font-semibold">Unidad</th>
                  <th className="py-2 pr-3 font-semibold">Costo unitario</th>
                  <th className="py-2 pr-3 font-semibold">Estado</th>
                  {canEdit ? <th className="py-2 font-semibold" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {items.map((extra) => (
                  <tr key={extra.id}>
                    <td className="py-2 pr-3 text-zinc-800">{extra.name}</td>
                    <td className="py-2 pr-3 text-zinc-600">{extra.unit}</td>
                    <td className="py-2 pr-3 text-zinc-800">{extra.unit_cost}</td>
                    <td className="py-2 pr-3 text-zinc-600">
                      {extra.active ? "Activo" : "Retirado"}
                    </td>
                    {canEdit ? (
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() =>
                            actualizar.mutate({
                              id: extra.id,
                              payload: { expected_version: extra.version, active: !extra.active },
                            })
                          }
                          disabled={actualizar.isPending}
                          className="text-xs font-semibold text-zinc-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
                        >
                          {extra.active ? "Retirar" : "Reactivar"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit ? (
          <div className="mt-4 border-t border-black/[0.04] pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField
                label="Concepto"
                requirement="required"
                value={draft.name}
                onChange={(valor) => setDraft({ ...draft, name: valor })}
                disabled={crear.isPending}
              />
              <SelectField
                label="Unidad"
                requirement="required"
                value={draft.unit}
                options={[
                  { value: "servicio", label: "servicio" },
                  { value: "unidad", label: "unidad" },
                  { value: "hora", label: "hora" },
                  { value: "kg", label: "kg" },
                ]}
                onChange={(valor) => setDraft({ ...draft, unit: valor })}
                disabled={crear.isPending}
              />
              <TextField
                label="Costo unitario"
                requirement="required"
                value={draft.unit_cost}
                onChange={(valor) => setDraft({ ...draft, unit_cost: valor })}
                disabled={crear.isPending}
                hint="Lo que suele costar. La cotización puede pactar otro."
              />
            </div>
            {error ? (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {error}
              </p>
            ) : null}
            {crear.isError ? (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {describeError(crear.error)}
              </p>
            ) : null}
            <div className="mt-3">
              <PrimaryButton type="button" onClick={alta} disabled={crear.isPending}>
                {crear.isPending ? "Guardando..." : "Añadir concepto"}
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {actualizar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(actualizar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
