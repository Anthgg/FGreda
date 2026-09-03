import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { PrimaryButton, SecondaryButton, SelectField, TextAreaField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { capabilitiesFor } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { useConsumableProducts, useLocations, useProducts } from "@/features/masters/useMasters";
import { useQuotations } from "@/features/quotations/useQuotations";
import { Alert, ApprovalBadge, StatusBadge } from "@/features/prototypes/PrototypeUi";
import { describePrototypeError, describePrototypeIssue } from "@/features/prototypes/prototypeLabels";
import {
  useApprovePrototype,
  useCancelPrototype,
  useCompletePrototype,
  useCreatePrototypeSuccessor,
  usePrototype,
  usePrototypes,
  useRejectPrototype,
  useSetPrototypeMaterials,
  useStartPrototype,
  useUpdatePrototype,
} from "@/features/prototypes/usePrototypes";
import type { Prototype, PrototypeMaterialInput } from "@/types/prototypes";

export type PrototypeSection = "resumen" | "editar" | "materiales" | "operacion" | "evaluacion" | "iteraciones";

const SECTIONS: Array<{ key: PrototypeSection; label: string }> = [
  { key: "resumen", label: "Detalle" },
  { key: "editar", label: "Edición" },
  { key: "materiales", label: "Materiales" },
  { key: "operacion", label: "Disponibilidad y operación" },
  { key: "evaluacion", label: "Evaluación" },
  { key: "iteraciones", label: "Iteraciones" },
];

function routeFor(id: number, section: PrototypeSection) {
  return section === "resumen" ? `/prototipos/${id}` : `/prototipos/${id}/${section}`;
}

function Summary({ prototype }: { prototype: Prototype }) {
  const cancel = useCancelPrototype(prototype.id);
  const { data: user } = useSession();
  const canCancel = capabilitiesFor(user?.role).anularPrototipo && prototype.status === "CREATED";
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Código" value={prototype.code} mono />
        <Info label="Cantidad de muestra" value={String(prototype.quantity)} />
        <Info label="Días objetivo" value={prototype.target_days ? String(prototype.target_days) : "No definido"} />
        <Info label="Fecha" value={prototype.requested_at.slice(0, 10)} />
        <Info label="Producto" value={prototype.product_id ? "Producto vinculado" : "Sin producto"} />
        <Info label="Cotización" value={prototype.quotation_code ?? "Sin cotización"} mono={Boolean(prototype.quotation_code)} />
        <Info label="Almacén" value={prototype.stock_location_id ? "Almacén seleccionado" : "Sin almacén"} />
        <Info label="Materiales" value={String(prototype.material_count)} />
      </div>
      {prototype.notes ? <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700"><p className="text-xs font-semibold uppercase text-zinc-500">Notas</p><p className="mt-2 whitespace-pre-wrap">{prototype.notes}</p></div> : null}
      {cancel.error ? <Alert>{describePrototypeError(cancel.error)}</Alert> : null}
      {canCancel ? <SecondaryButton className="border-red-200 text-red-700" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? "Anulando…" : "Anular prototipo"}</SecondaryButton> : null}
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-2xl border border-zinc-100 bg-white/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 text-sm font-semibold text-zinc-900 ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}

function EditSection({ prototype }: { prototype: Prototype }) {
  const update = useUpdatePrototype(prototype.id);
  const products = useProducts({ active: true, limit: 200 });
  const locations = useLocations();
  const quotations = useQuotations({ limit: 200 });
  const [name, setName] = useState(prototype.name);
  const [quantity, setQuantity] = useState(String(prototype.quantity));
  const [productId, setProductId] = useState(prototype.product_id ? String(prototype.product_id) : "");
  const [quotationId, setQuotationId] = useState(prototype.quotation_id ? String(prototype.quotation_id) : "");
  const [locationId, setLocationId] = useState(prototype.stock_location_id ? String(prototype.stock_location_id) : "");
  const [targetDays, setTargetDays] = useState(prototype.target_days ? String(prototype.target_days) : "");
  const [notes, setNotes] = useState(prototype.notes ?? "");
  const locked = prototype.status !== "CREATED";

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    update.mutate({
      name: name.trim(), quantity: Number(quantity), notes,
      ...(productId ? { product_id: Number(productId) } : {}),
      ...(quotationId ? { quotation_id: Number(quotationId) } : {}),
      ...(locationId ? { stock_location_id: Number(locationId) } : {}),
      ...(targetDays ? { target_days: Number(targetDays) } : {}),
    });
  };

  return locked ? <Alert tone="amber">Los campos físicos quedaron bloqueados cuando inició la fabricación. El backend conserva la autoridad sobre esta regla.</Alert> : (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Nombre" requirement="required" value={name} onChange={setName} />
        <TextField label="Cantidad de muestra" requirement="required" type="number" value={quantity} onChange={setQuantity} />
        <SelectField label="Producto" requirement="optional" value={productId} onChange={setProductId} placeholder="Sin producto" options={(products.data?.items ?? []).map((p) => ({ value: String(p.id), label: `${p.internal_reference} · ${p.name}` }))} />
        <SelectField label="Cotización" requirement="optional" value={quotationId} onChange={setQuotationId} placeholder="Sin cotización" options={(quotations.data?.items ?? []).map((q) => ({ value: String(q.id), label: `${q.code} · ${q.name ?? q.product_name ?? "Sin nombre"}` }))} />
        <SelectField label="Almacén" requirement="optional" value={locationId} onChange={setLocationId} placeholder="Sin almacén" options={(locations.data ?? []).filter((l) => l.active).map((l) => ({ value: String(l.id), label: l.name }))} />
        <TextField label="Días objetivo" requirement="optional" type="number" value={targetDays} onChange={setTargetDays} />
      </div>
      <TextAreaField label="Notas" requirement="optional" value={notes} onChange={setNotes} />
      {update.error ? <Alert>{describePrototypeError(update.error)}</Alert> : null}
      {update.isSuccess ? <Alert tone="green">Cambios guardados.</Alert> : null}
      <PrimaryButton disabled={update.isPending || !name.trim() || Number(quantity) <= 0}>{update.isPending ? "Guardando…" : "Guardar cambios"}</PrimaryButton>
    </form>
  );
}

function MaterialsSection({ prototype }: { prototype: Prototype }) {
  const save = useSetPrototypeMaterials(prototype.id);
  const [materials, setMaterials] = useState<PrototypeMaterialInput[]>([]);
  useEffect(() => setMaterials(prototype.materials.map((line) => ({ product_id: line.product_id, quantity: line.quantity }))), [prototype.materials]);
  // Filtrado por tipo en el servidor: ver `useConsumableProducts`.
  const consumables = useConsumableProducts().items;
  const byId = useMemo(() => new Map(consumables.map((p) => [p.id, p])), [consumables]);
  const locked = prototype.status !== "CREATED";

  return (
    <div className="space-y-4">
      <div><h2 className="font-semibold">Materiales del prototipo</h2><p className="mt-1 text-sm text-zinc-500">Lista física explícita. No se deduce una receta ni se añade barniz automáticamente.</p></div>
      {locked ? <Alert tone="amber">Los materiales están bloqueados porque el prototipo ya inició o terminó.</Alert> : null}
      <div className="space-y-3">
        {materials.map((line, index) => {
          const product = byId.get(line.product_id);
          return <div key={`${line.product_id}-${index}`} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 sm:grid-cols-[1fr_180px_auto]">
            <SelectField label="Material" value={line.product_id ? String(line.product_id) : ""} disabled={locked} placeholder="Seleccione del catálogo" options={consumables.map((p) => ({ value: String(p.id), label: `${p.internal_reference} · ${p.name}` }))} onChange={(value) => setMaterials((rows) => rows.map((row, i) => i === index ? { ...row, product_id: Number(value) } : row))} />
            <TextField label={`Cantidad${product?.base_uom_code ? ` (${product.base_uom_code})` : ""}`} requirement="required" type="number" inputMode="decimal" disabled={locked} value={line.quantity} onChange={(value) => setMaterials((rows) => rows.map((row, i) => i === index ? { ...row, quantity: value } : row))} />
            {!locked ? <SecondaryButton className="self-end" onClick={() => setMaterials((rows) => rows.filter((_, i) => i !== index))}>Quitar</SecondaryButton> : null}
          </div>;
        })}
      </div>
      {!locked ? <div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => setMaterials((rows) => [...rows, { product_id: 0, quantity: "1" }])}>Añadir material</SecondaryButton><PrimaryButton type="button" disabled={save.isPending || materials.some((m) => !m.product_id || Number(m.quantity) <= 0)} onClick={() => save.mutate(materials)}>{save.isPending ? "Guardando…" : "Guardar materiales"}</PrimaryButton></div> : null}
      {save.error ? <Alert>{describePrototypeError(save.error)}</Alert> : null}
      {save.isSuccess ? <Alert tone="green">Materiales guardados.</Alert> : null}
    </div>
  );
}

function OperationSection({ prototype }: { prototype: Prototype }) {
  const { data: user } = useSession();
  const caps = capabilitiesFor(user?.role);
  const start = useStartPrototype(prototype.id);
  const complete = useCompletePrototype(prototype.id);
  const canStart = caps.arrancarPrototipo && prototype.status === "CREATED" && prototype.readiness.ready;
  const canComplete = caps.completarPrototipo && prototype.status === "STARTED";
  return <div className="space-y-5">
    <div><h2 className="font-semibold">Disponibilidad</h2><p className="mt-1 text-sm text-zinc-500">El backend recalcula cada condición; esta pantalla solo la explica.</p></div>
    {prototype.readiness.ready ? <Alert tone="green">Cotización pagada, almacén y materiales listos.</Alert> : <div className="grid gap-3 sm:grid-cols-2">{prototype.readiness.issues.map((issue, index) => <div key={`${issue.code}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">{issue.code === "NO_QUOTATION" ? "Cotización" : issue.code === "QUOTATION_UNPAID" ? "Pago" : issue.code === "NO_STOCK_LOCATION" ? "Almacén" : issue.code === "NO_MATERIALS" ? "Materiales" : "Stock"}</p><p className="mt-1 text-sm text-amber-900">{describePrototypeIssue(issue)}</p></div>)}</div>}
    <div className="flex gap-2">{canStart ? <PrimaryButton type="button" disabled={start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Iniciando…" : "Iniciar fabricación"}</PrimaryButton> : null}{canComplete ? <PrimaryButton type="button" disabled={complete.isPending} onClick={() => complete.mutate()}>{complete.isPending ? "Completando…" : "Completar prototipo"}</PrimaryButton> : null}</div>
    {start.error ? <Alert>{describePrototypeError(start.error)}</Alert> : null}{complete.error ? <Alert>{describePrototypeError(complete.error)}</Alert> : null}
    {start.isSuccess ? <Alert tone="green">Fabricación iniciada. La disponibilidad y el inventario se actualizaron.</Alert> : null}{complete.isSuccess ? <Alert tone="green">Prototipo completado.</Alert> : null}
  </div>;
}

function EvaluationSection({ prototype }: { prototype: Prototype }) {
  const { data: user } = useSession();
  const canDecide = capabilitiesFor(user?.role).decidirPrototipo;
  const approve = useApprovePrototype(prototype.id);
  const reject = useRejectPrototype(prototype.id);
  const [note, setNote] = useState("");
  const pending = prototype.status === "COMPLETED" && prototype.approval === "PENDING";
  return <div className="space-y-5">
    <div className="flex items-center gap-3"><h2 className="font-semibold">Evaluación</h2><ApprovalBadge approval={prototype.approval} /></div>
    {prototype.status !== "COMPLETED" ? <Alert tone="amber">La evaluación estará disponible después de completar la fabricación.</Alert> : null}
    {pending && !canDecide ? <p className="text-sm text-zinc-600">La decisión corresponde a una persona administradora.</p> : null}
    {pending && canDecide ? <><TextAreaField label="Nota de evaluación" requirement="optional" value={note} onChange={setNote} /><div className="flex gap-2"><PrimaryButton type="button" disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate(note)}>Aprobar</PrimaryButton><SecondaryButton className="border-red-200 text-red-700" disabled={approve.isPending || reject.isPending} onClick={() => reject.mutate(note)}>Rechazar</SecondaryButton></div></> : null}
    {approve.error ? <Alert>{describePrototypeError(approve.error)}</Alert> : null}{reject.error ? <Alert>{describePrototypeError(reject.error)}</Alert> : null}
    {approve.isSuccess ? <Alert tone="green">Prototipo aprobado. No se creó ninguna orden de producción.</Alert> : null}{reject.isSuccess ? <Alert tone="amber">Prototipo rechazado. Puede crear una nueva iteración.</Alert> : null}
  </div>;
}

function IterationsSection({ prototype }: { prototype: Prototype }) {
  const navigate = useNavigate();
  const successor = useCreatePrototypeSuccessor(prototype.id);
  const all = usePrototypes({ limit: 200 });
  const next = all.data?.items.find((row) => row.supersedes_prototype_id === prototype.id);
  return <div className="space-y-5">
    <div><h2 className="font-semibold">Iteraciones</h2><p className="mt-1 text-sm text-zinc-500">Cada intento conserva su historia. Una nueva iteración recibe otro código PRT.</p></div>
    {prototype.supersedes_prototype_id ? <p className="text-sm">Sustituye a: <Link className="font-mono font-semibold hover:underline" to={`/prototipos/${prototype.supersedes_prototype_id}`}>ver iteración anterior</Link></p> : <p className="text-sm text-zinc-500">Este es el primer intento.</p>}
    {next ? <p className="text-sm">Iteración posterior: <Link className="font-mono font-semibold hover:underline" to={`/prototipos/${next.id}`}>{next.code}</Link></p> : null}
    {prototype.approval === "REJECTED" && !next ? <PrimaryButton type="button" disabled={successor.isPending} onClick={() => successor.mutate(undefined, { onSuccess: (created) => navigate(`/prototipos/${created.id}`) })}>{successor.isPending ? "Creando…" : "Crear nueva iteración"}</PrimaryButton> : null}
    {successor.error ? <Alert>{describePrototypeError(successor.error)}</Alert> : null}
  </div>;
}

export function PrototypeDetailPage({ section }: { section: PrototypeSection }) {
  const params = useParams();
  const id = Number(params.id);
  const location = useLocation();
  const prototype = usePrototype(Number.isInteger(id) && id > 0 ? id : null);
  const createdCode = (location.state as { createdCode?: string } | null)?.createdCode;
  if (prototype.isPending) return <div className="flex justify-center py-20"><Spinner className="size-5" label="Cargando prototipo…" /></div>;
  if (prototype.isError || !prototype.data) return <Alert>{describePrototypeError(prototype.error)}</Alert>;
  const row = prototype.data;
  return <div className="mx-auto w-full max-w-6xl space-y-5">
    <header><Link to="/prototipos" className="text-sm text-zinc-500 hover:underline">← Prototipos</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">{row.name}</h1><span className="font-mono text-sm font-bold text-zinc-500">{row.code}</span><StatusBadge status={row.status} /><ApprovalBadge approval={row.approval} /></div></header>
    {createdCode ? <Alert tone="green">Prototipo creado con código {createdCode}.</Alert> : null}
    <nav aria-label="Secciones del prototipo" className="flex gap-2 overflow-x-auto pb-1">{SECTIONS.map((item) => <Link key={item.key} to={routeFor(id, item.key)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${section === item.key ? "bg-black text-white" : "border border-zinc-200 bg-white/70 text-zinc-700"}`}>{item.label}</Link>)}</nav>
    <section className="glass-panel rounded-3xl border border-white/60 p-5 shadow-sm sm:p-6">
      {section === "resumen" ? <Summary prototype={row} /> : section === "editar" ? <EditSection prototype={row} /> : section === "materiales" ? <MaterialsSection prototype={row} /> : section === "operacion" ? <OperationSection prototype={row} /> : section === "evaluacion" ? <EvaluationSection prototype={row} /> : <IterationsSection prototype={row} />}
    </section>
  </div>;
}
