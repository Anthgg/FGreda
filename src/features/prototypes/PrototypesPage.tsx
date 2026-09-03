import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { EmptyState, Pagination } from "@/features/masters/MasterTable";
import { useProducts } from "@/features/masters/useMasters";
import { ApprovalBadge, StatusBadge } from "@/features/prototypes/PrototypeUi";
import { describePrototypeError } from "@/features/prototypes/prototypeLabels";
import { usePrototypes } from "@/features/prototypes/usePrototypes";
import type { PrototypeApproval, PrototypeFilters, PrototypeStatus } from "@/types/prototypes";

const ALL = "ALL";
const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos los estados" },
  { value: "CREATED", label: "Creado" },
  { value: "STARTED", label: "En fabricación" },
  { value: "COMPLETED", label: "Completado" },
  { value: "CANCELLED", label: "Anulado" },
];

const APPROVAL_OPTIONS = [
  { value: ALL, label: "Todas las evaluaciones" },
  { value: "PENDING", label: "Pendiente" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "REJECTED", label: "Rechazado" },
];

export function PrototypesPage() {
  const [status, setStatus] = useState(ALL);
  const [approval, setApproval] = useState(ALL);
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [status, approval]);

  const filters: PrototypeFilters = {
    ...(status === ALL ? {} : { status: status as PrototypeStatus }),
    ...(approval === ALL ? {} : { approval: approval as PrototypeApproval }),
    limit: PAGE_SIZE,
    offset,
  };
  const prototypes = usePrototypes(filters);
  const products = useProducts({ active: true, limit: 200 });
  const productNames = useMemo(
    () => new Map((products.data?.items ?? []).map((product) => [product.id, product.name])),
    [products.data],
  );

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <TypewriterTitle text="Prototipos." className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl" />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Muestras físicas, disponibilidad, evaluación e iteraciones.</p>
        </div>
        <Link to="/prototipos/nuevo" className="inline-flex rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
          Crear prototipo
        </Link>
      </header>

      <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <SelectField label="Fabricación" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          <SelectField label="Evaluación" value={approval} options={APPROVAL_OPTIONS} onChange={setApproval} />
        </div>

        <div className="mt-5">
          {prototypes.isPending ? (
            <div className="flex justify-center py-16"><Spinner className="size-5" label="Cargando prototipos…" /></div>
          ) : prototypes.isError ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">{describePrototypeError(prototypes.error)}</p>
          ) : !prototypes.data?.items.length ? (
            <EmptyState message="Todavía no hay prototipos con estos filtros." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Código PRT</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Cotización</th><th className="px-4 py-3 text-right">Muestra</th><th className="px-4 py-3">Fabricación</th><th className="px-4 py-3">Evaluación</th><th className="px-4 py-3 text-right">Días objetivo</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {prototypes.data.items.map((prototype) => (
                      <tr key={prototype.id} className="hover:bg-zinc-50/70">
                        <td className="px-4 py-3 font-mono font-bold">{prototype.code}</td>
                        <td className="px-4 py-3 font-medium">{prototype.name}</td>
                        <td className="px-4 py-3 text-zinc-600">{prototype.product_id ? productNames.get(prototype.product_id) ?? "Producto vinculado" : "Sin producto"}</td>
                        <td className="px-4 py-3">{prototype.quotation_id ? <Link className="font-mono hover:underline" to={`/cotizaciones/${prototype.quotation_id}`}>{prototype.quotation_code ?? "Cotización vinculada"}</Link> : "Sin cotización"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{prototype.quantity}</td>
                        <td className="px-4 py-3"><StatusBadge status={prototype.status} /></td>
                        <td className="px-4 py-3"><ApprovalBadge approval={prototype.approval} /></td>
                        <td className="px-4 py-3 text-right">{prototype.target_days ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-500">{prototype.requested_at.slice(0, 10)}</td>
                        <td className="px-4 py-3 text-right"><Link to={`/prototipos/${prototype.id}`} className="font-medium hover:underline">Ver detalle</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination total={prototypes.data.total} limit={prototypes.data.limit} offset={prototypes.data.offset} onOffsetChange={setOffset} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

