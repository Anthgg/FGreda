/**
 * Listado de hojas de quema con su detalle al lado.
 *
 * Busqueda, filtros y paginacion son del servidor: filtrar solo la pagina
 * cargada daria resultados falsos en cuanto haya mas de una.
 */

import { useEffect, useMemo, useState } from "react";

import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Badge, EmptyState, Pagination, SearchInput } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { FiringDetailPanel } from "@/features/firings/FiringDetailPanel";
import {
  FIRING_STATUS_LABEL,
  FIRING_STATUS_TONE,
  formatDecimalString,
} from "@/features/firings/labels";
import {
  useCancelFiring,
  useConfirmFiring,
  useFiring,
  useFirings,
  useKilns,
} from "@/features/firings/useFirings";
import type { FiringFilters, FiringStatus, FiringType } from "@/types/firings";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const TODOS = "todos";

const ESTADO_OPCIONES = [
  { value: TODOS, label: "Todos" },
  { value: "DRAFT", label: FIRING_STATUS_LABEL.DRAFT },
  { value: "CONFIRMED", label: FIRING_STATUS_LABEL.CONFIRMED },
  { value: "CANCELLED", label: FIRING_STATUS_LABEL.CANCELLED },
] as const;

const TIPO_OPCIONES = [
  { value: TODOS, label: "Cualquiera" },
  { value: "LOW", label: "Baja" },
  { value: "HIGH", label: "Alta" },
] as const;

export function FiringListTab({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [estado, setEstado] = useState<string>(TODOS);
  const [horno, setHorno] = useState<string>(TODOS);
  const [tipo, setTipo] = useState<string>(TODOS);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debounced, estado, horno, tipo]);

  const kilns = useKilns({ limit: 200 });

  const filters = useMemo<FiringFilters>(
    () => ({
      ...(debounced.trim() ? { search: debounced.trim() } : {}),
      ...(estado !== TODOS ? { status: estado as FiringStatus } : {}),
      ...(horno !== TODOS ? { kiln_id: Number(horno) } : {}),
      ...(tipo !== TODOS ? { firing_type: tipo as FiringType } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [debounced, estado, horno, tipo, offset],
  );

  const firings = useFirings(filters);
  const items = useMemo(() => firings.data?.items ?? [], [firings.data]);

  useEffect(() => {
    if (!items.length) return;
    if (selectedId === null || !items.some((f) => f.id === selectedId)) {
      setSelectedId(items[0]!.id);
    }
  }, [items, selectedId]);

  const detalle = useFiring(selectedId);
  const confirmar = useConfirmFiring();
  const anular = useCancelFiring();

  const opcionesHorno = [
    { value: TODOS, label: "Todos" },
    ...(kilns.data?.items ?? []).map((k) => ({ value: String(k.id), label: k.name })),
  ];

  const seleccionar = (id: number) => {
    setSelectedId(id);
    setMobileDetail(true);
    setAviso(null);
  };

  return (
    <div className="space-y-4">
      {/* Filtros: solo lo que el backend sabe filtrar. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por código…"
            label="Buscar quemas"
          />
        </div>
        <SelectField
          label="Estado"
          value={estado}
          options={ESTADO_OPCIONES}
          onChange={setEstado}
          className="w-40"
        />
        <SelectField
          label="Horno"
          value={horno}
          options={opcionesHorno}
          onChange={setHorno}
          className="w-44"
        />
        <SelectField
          label="Tipo de quema"
          value={tipo}
          options={TIPO_OPCIONES}
          onChange={setTipo}
          className="w-40"
        />
        {firings.isFetching ? (
          <span className="pb-2 text-xs text-zinc-400">
            <Spinner className="size-3" label="Buscando…" />
          </span>
        ) : null}
      </div>

      {aviso ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {aviso}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Listado */}
        <section
          className={[
            "xl:col-span-5 rounded-2xl border border-zinc-200 bg-white/70",
            mobileDetail ? "hidden xl:block" : "block",
          ].join(" ")}
        >
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Quemas{firings.data ? ` (${firings.data.total})` : ""}
            </h2>
          </header>

          {firings.isPending ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-5" label="Cargando quemas…" />
            </div>
          ) : firings.isError ? (
            <p role="alert" className="py-12 text-center text-sm text-red-600">
              {describeError(firings.error)}
            </p>
          ) : items.length === 0 ? (
            <EmptyState message="No hay quemas que coincidan con la búsqueda." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Código</th>
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                      <th className="px-3 py-2 text-right font-semibold">Volumen</th>
                      <th className="px-3 py-2 text-right font-semibold">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((firing) => {
                      const activa = firing.id === selectedId;
                      return (
                        <tr
                          key={firing.id}
                          onClick={() => seleccionar(firing.id)}
                          aria-selected={activa}
                          className={[
                            "cursor-pointer border-l-[3px] transition-colors",
                            activa
                              ? "border-l-zinc-900 bg-zinc-50"
                              : "border-l-transparent hover:bg-zinc-50/60",
                          ].join(" ")}
                        >
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={(evento) => {
                                evento.stopPropagation();
                                seleccionar(firing.id);
                              }}
                              className="text-left font-mono text-[11px] font-medium text-zinc-900 hover:underline"
                            >
                              {firing.code}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-zinc-500">
                            {firing.firing_date ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={FIRING_STATUS_TONE[firing.status]}>
                              {FIRING_STATUS_LABEL[firing.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                            {formatDecimalString(firing.total_volume_cm3, 0)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                            {formatDecimalString(firing.total_cost, 2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {firings.data ? (
                <div className="px-4 pb-3">
                  <Pagination
                    total={firings.data.total}
                    limit={firings.data.limit}
                    offset={firings.data.offset}
                    onOffsetChange={setOffset}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Detalle */}
        <section
          className={[
            "xl:col-span-7",
            mobileDetail ? "block" : "hidden xl:block",
          ].join(" ")}
        >
          {detalle.isPending && selectedId !== null ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-5" label="Cargando detalle…" />
            </div>
          ) : detalle.isError ? (
            <p role="alert" className="py-16 text-center text-sm text-red-600">
              {describeError(detalle.error)}
            </p>
          ) : detalle.data ? (
            <FiringDetailPanel
              firing={detalle.data}
              canEdit={canEdit}
              isBusy={confirmar.isPending || anular.isPending}
              onBack={() => setMobileDetail(false)}
              onConfirm={(firing) => {
                setAviso(null);
                confirmar.mutate(firing.id, {
                  onError: (error) => setAviso(describeError(error)),
                });
              }}
              onCancel={(firing) => {
                setAviso(null);
                anular.mutate(firing.id, {
                  onError: (error) => setAviso(describeError(error)),
                });
              }}
            />
          ) : (
            <p className="py-16 text-center text-sm text-zinc-500">
              Seleccione una quema para ver su detalle.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
