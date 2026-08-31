import { useState } from "react";

import { PrimaryButton, SecondaryButton, SelectField, TextAreaField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { formatDecimalString } from "@/features/firings/labels";
import {
  useAdditionals,
  useOtherCosts,
  useSaveAdditional,
  useSaveOtherCost,
  useSaveTechnique,
  useTechniques,
} from "@/features/quotations/useQuotations";
import { describeError } from "@/features/settings/messages";

/** La tabla no muestra valores del contrato: el taller no habla en enums. */
const FORMULA_TECNICA: Record<string, string> = { ONE_FACTOR: "Un factor", TWO_FACTORS: "Dos factores" };
const FORMULA_ADICIONAL: Record<string, string> = {
  PIECE_QUANTITY: "Cantidad de piezas",
  SIMPLE_QUANTITY: "Cantidad simple",
  PIECE_X_ADDITIONAL: "Piezas por adicional",
};
const TIPO_GASTO: Record<string, string> = { PER_DAY: "Por día", FIXED: "Fijo", PER_PIECE: "Por pieza" };
import { formatMoney } from "@/features/quotations/money";

/** Los factores se muestran sin la cola de ceros de la columna NUMERIC. */
const factor = (v: string | null | undefined) => (v ? formatDecimalString(v, 2).replace(/.00$/, "") : "—");
import type {
  AdditionalFormulaType,
  AdditionalInput,
  AdditionalOut,
  OtherCostCalculationType,
  OtherCostInput,
  OtherCostOut,
  TechniqueFormulaType,
  TechniqueInput,
  TechniqueOut,
} from "@/types/quotations";

type MasterTab = "techniques" | "additionals" | "other";

export function QuotationMastersTab({ canEdit }: { canEdit: boolean }) {
  const [tab, setTab] = useState<MasterTab>("techniques");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Maestros del cotizador">
        {([
          { id: "techniques", label: "Técnicas" },
          { id: "additionals", label: "Adicionales" },
          { id: "other", label: "Otros gastos" },
        ] as const).map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`min-h-10 rounded-xl px-4 text-sm font-medium ${tab === item.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>{item.label}</button>
        ))}
      </div>
      {tab === "techniques" ? <TechniqueMasters canEdit={canEdit} /> : null}
      {tab === "additionals" ? <AdditionalMasters canEdit={canEdit} /> : null}
      {tab === "other" ? <OtherCostMasters canEdit={canEdit} /> : null}
    </div>
  );
}

const shell = "rounded-2xl border border-zinc-200 bg-white/80 p-5";
const buttonClass = "text-xs font-semibold text-zinc-700 hover:text-black hover:underline";

function MasterTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: { id: number; cells: string[]; onEdit?: () => void }[];
}) {
  if (rows.length === 0) return <p className="rounded-xl bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">No hay registros maestros.</p>;
  return <div className="overflow-x-auto rounded-xl border border-zinc-200"><table className="min-w-full text-left text-xs"><thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}<th className="px-4 py-3 text-right font-semibold">Acción</th></tr></thead><tbody className="divide-y divide-zinc-100">{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={`${row.id}-${index}`} className="px-4 py-3 text-zinc-700">{cell}</td>)}<td className="px-4 py-3 text-right">{row.onEdit ? <button type="button" className={buttonClass} onClick={row.onEdit}>Editar</button> : "—"}</td></tr>)}</tbody></table></div>;
}

function LoadingOrError({ pending, error }: { pending: boolean; error: unknown }) {
  if (pending) return <div className="flex justify-center py-12"><Spinner className="size-5" label="Cargando maestros…" /></div>;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{describeError(error)}</p>;
  return null;
}

const emptyTechnique: TechniqueInput = { name: "", unit_price: "", formula_type: "ONE_FACTOR", factor_1: "", factor_2: null, active: true, notes: null };
function TechniqueMasters({ canEdit }: { canEdit: boolean }) {
  const query = useTechniques(undefined);
  const save = useSaveTechnique();
  const [editing, setEditing] = useState<{ id?: number; value: TechniqueInput } | null>(null);
  const state = <LoadingOrError pending={query.isPending} error={query.error} />;
  if (query.isPending || query.isError) return state;
  return <section className={shell}><MasterHeader title="Técnicas" description="Precios y factores que alimentan los cálculos oficiales." canEdit={canEdit} onNew={() => setEditing({ value: emptyTechnique })} />{editing ? <TechniqueForm state={editing} busy={save.isPending} error={save.error} onCancel={() => setEditing(null)} onSave={() => save.mutate({ id: editing.id, payload: editing.value }, { onSuccess: () => setEditing(null) })} onChange={(value) => setEditing({ ...editing, value })} /> : null}<MasterTable headers={["Código", "Nombre", "Precio", "Fórmula", "Factores", "Estado"]} rows={(query.data?.items ?? []).map((item) => ({ id: item.id, cells: [item.code, item.name, formatMoney(item.unit_price, "PEN"), FORMULA_TECNICA[item.formula_type] ?? item.formula_type, `${factor(item.factor_1)}${item.factor_2 ? ` / ${factor(item.factor_2)}` : ""}`, item.active ? "Activo" : "Archivado"], ...(canEdit ? { onEdit: () => setEditing({ id: item.id, value: techniqueInput(item) }) } : {}) }))} /></section>;
}
const techniqueInput = (item: TechniqueOut): TechniqueInput => ({ name: item.name, unit_price: item.unit_price, formula_type: item.formula_type, factor_1: item.factor_1, factor_2: item.factor_2, active: item.active, notes: item.notes });

function TechniqueForm({ state, busy, error, onCancel, onSave, onChange }: { state: { id?: number; value: TechniqueInput }; busy: boolean; error: unknown; onCancel: () => void; onSave: () => void; onChange: (value: TechniqueInput) => void }) {
  const v = state.value;
  return <EditorPanel title={state.id ? "Editar técnica" : "Nueva técnica"} busy={busy} valid={Boolean(v.name.trim() && v.unit_price && v.factor_1 && (v.formula_type === "ONE_FACTOR" || v.factor_2))} error={error} onCancel={onCancel} onSave={onSave}><TextField label="Nombre" requirement="required" value={v.name} onChange={(name) => onChange({ ...v, name })} /><TextField label="Precio unitario" requirement="required" value={v.unit_price} onChange={(unit_price) => onChange({ ...v, unit_price })} inputMode="decimal" /><SelectField label="Fórmula" value={v.formula_type} options={[{ value: "ONE_FACTOR", label: "Un factor" }, { value: "TWO_FACTORS", label: "Dos factores" }]} onChange={(formula_type: TechniqueFormulaType) => onChange({ ...v, formula_type, factor_2: formula_type === "ONE_FACTOR" ? null : (v.factor_2 ?? "") })} /><TextField label="Factor 1" requirement="required" value={v.factor_1} onChange={(factor_1) => onChange({ ...v, factor_1 })} inputMode="decimal" /><TextField label="Factor 2" requirement={v.formula_type === "TWO_FACTORS" ? "required" : "optional"} value={v.factor_2} onChange={(factor_2) => onChange({ ...v, factor_2: factor_2 || null })} inputMode="decimal" disabled={v.formula_type === "ONE_FACTOR"} /><TextAreaField label="Notas" requirement="optional" value={v.notes} onChange={(notes) => onChange({ ...v, notes: notes || null })} /><ActiveToggle active={v.active} onChange={(active) => onChange({ ...v, active })} /></EditorPanel>;
}

const emptyAdditional: AdditionalInput = { name: "", unit_price: "", formula_type: "PIECE_QUANTITY", factor_1: "", active: true, notes: null };
function AdditionalMasters({ canEdit }: { canEdit: boolean }) {
  const query = useAdditionals(undefined);
  const save = useSaveAdditional();
  const [editing, setEditing] = useState<{ id?: number; value: AdditionalInput } | null>(null);
  if (query.isPending || query.isError) return <LoadingOrError pending={query.isPending} error={query.error} />;
  return <section className={shell}><MasterHeader title="Adicionales" description="Aplicaciones, vidriado e ilustración con su regla de cálculo." canEdit={canEdit} onNew={() => setEditing({ value: emptyAdditional })} />{editing ? <AdditionalForm state={editing} busy={save.isPending} error={save.error} onCancel={() => setEditing(null)} onSave={() => save.mutate({ id: editing.id, payload: editing.value }, { onSuccess: () => setEditing(null) })} onChange={(value) => setEditing({ ...editing, value })} /> : null}<MasterTable headers={["Código", "Nombre", "Precio", "Fórmula", "Factor", "Estado"]} rows={(query.data?.items ?? []).map((item) => ({ id: item.id, cells: [item.code, item.name, formatMoney(item.unit_price, "PEN"), FORMULA_ADICIONAL[item.formula_type] ?? item.formula_type, factor(item.factor_1) ?? "—", item.active ? "Activo" : "Archivado"], ...(canEdit ? { onEdit: () => setEditing({ id: item.id, value: additionalInput(item) }) } : {}) }))} /></section>;
}
const additionalInput = (item: AdditionalOut): AdditionalInput => ({ name: item.name, unit_price: item.unit_price, formula_type: item.formula_type, factor_1: item.factor_1, active: item.active, notes: item.notes });
function AdditionalForm({ state, busy, error, onCancel, onSave, onChange }: { state: { id?: number; value: AdditionalInput }; busy: boolean; error: unknown; onCancel: () => void; onSave: () => void; onChange: (value: AdditionalInput) => void }) {
  const v = state.value; const requiresFactor = v.formula_type !== "SIMPLE_QUANTITY";
  return <EditorPanel title={state.id ? "Editar adicional" : "Nuevo adicional"} busy={busy} valid={Boolean(v.name.trim() && v.unit_price && (!requiresFactor || v.factor_1))} error={error} onCancel={onCancel} onSave={onSave}><TextField label="Nombre" requirement="required" value={v.name} onChange={(name) => onChange({ ...v, name })} /><TextField label="Precio unitario" requirement="required" value={v.unit_price} onChange={(unit_price) => onChange({ ...v, unit_price })} inputMode="decimal" /><SelectField label="Fórmula" value={v.formula_type} options={[{ value: "PIECE_QUANTITY", label: "Cantidad de piezas" }, { value: "SIMPLE_QUANTITY", label: "Cantidad simple" }, { value: "PIECE_X_ADDITIONAL", label: "Piezas por adicional" }]} onChange={(formula_type: AdditionalFormulaType) => onChange({ ...v, formula_type, factor_1: formula_type === "SIMPLE_QUANTITY" ? null : (v.factor_1 ?? "") })} /><TextField label="Factor" requirement={requiresFactor ? "required" : "optional"} value={v.factor_1} onChange={(factor_1) => onChange({ ...v, factor_1: factor_1 || null })} inputMode="decimal" disabled={!requiresFactor} /><TextAreaField label="Notas" requirement="optional" value={v.notes} onChange={(notes) => onChange({ ...v, notes: notes || null })} /><ActiveToggle active={v.active} onChange={(active) => onChange({ ...v, active })} /></EditorPanel>;
}

const emptyOther: OtherCostInput = { name: "", unit_price: "", calculation_type: "FIXED", active: true, notes: null };
function OtherCostMasters({ canEdit }: { canEdit: boolean }) {
  const query = useOtherCosts(undefined);
  const save = useSaveOtherCost();
  const [editing, setEditing] = useState<{ id?: number; value: OtherCostInput } | null>(null);
  if (query.isPending || query.isError) return <LoadingOrError pending={query.isPending} error={query.error} />;
  return <section className={shell}><MasterHeader title="Otros gastos" description="Valores comerciales editables sin desplegar código." canEdit={canEdit} onNew={() => setEditing({ value: emptyOther })} />{editing ? <OtherCostForm state={editing} busy={save.isPending} error={save.error} onCancel={() => setEditing(null)} onSave={() => save.mutate({ id: editing.id, payload: editing.value }, { onSuccess: () => setEditing(null) })} onChange={(value) => setEditing({ ...editing, value })} /> : null}<MasterTable headers={["Código", "Nombre", "Valor", "Cálculo", "Estado"]} rows={(query.data?.items ?? []).map((item) => ({ id: item.id, cells: [item.code, item.name, formatDecimalString(item.unit_price, 2), TIPO_GASTO[item.calculation_type] ?? item.calculation_type, item.active ? "Activo" : "Archivado"], ...(canEdit ? { onEdit: () => setEditing({ id: item.id, value: otherInput(item) }) } : {}) }))} /></section>;
}
const otherInput = (item: OtherCostOut): OtherCostInput => ({ name: item.name, unit_price: item.unit_price, calculation_type: item.calculation_type, active: item.active, notes: item.notes });
function OtherCostForm({ state, busy, error, onCancel, onSave, onChange }: { state: { id?: number; value: OtherCostInput }; busy: boolean; error: unknown; onCancel: () => void; onSave: () => void; onChange: (value: OtherCostInput) => void }) {
  const v = state.value;
  return <EditorPanel title={state.id ? "Editar otro gasto" : "Nuevo otro gasto"} busy={busy} valid={Boolean(v.name.trim() && v.unit_price)} error={error} onCancel={onCancel} onSave={onSave}><TextField label="Nombre" requirement="required" value={v.name} onChange={(name) => onChange({ ...v, name })} /><TextField label="Valor unitario" requirement="required" value={v.unit_price} onChange={(unit_price) => onChange({ ...v, unit_price })} inputMode="decimal" /><SelectField label="Tipo de cálculo" value={v.calculation_type} options={[{ value: "PER_DAY", label: "Por día" }, { value: "FIXED", label: "Fijo" }, { value: "PER_PIECE", label: "Por pieza" }]} onChange={(calculation_type: OtherCostCalculationType) => onChange({ ...v, calculation_type })} /><TextAreaField label="Notas" requirement="optional" value={v.notes} onChange={(notes) => onChange({ ...v, notes: notes || null })} /><ActiveToggle active={v.active} onChange={(active) => onChange({ ...v, active })} /></EditorPanel>;
}

function MasterHeader({ title, description, canEdit, onNew }: { title: string; description: string; canEdit: boolean; onNew: () => void }) {
  return <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-zinc-950">{title}</h2><p className="mt-1 text-xs text-zinc-500">{description}</p></div>{canEdit ? <PrimaryButton onClick={onNew}>Nuevo registro</PrimaryButton> : null}</header>;
}
function ActiveToggle({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  return <div><span className="mb-1 block text-xs font-medium text-zinc-700">Estado</span><button type="button" aria-pressed={active} onClick={() => onChange(!active)} className={`min-h-10 rounded-xl border px-4 text-sm font-medium ${active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-100 text-zinc-600"}`}>{active ? "Activo" : "Archivado"}</button></div>;
}
function EditorPanel({ title, children, busy, valid, error, onCancel, onSave }: { title: string; children: React.ReactNode; busy: boolean; valid: boolean; error: unknown; onCancel: () => void; onSave: () => void }) {
  return <div className="mb-5 rounded-2xl border border-zinc-300 bg-zinc-50 p-4"><h3 className="text-sm font-semibold text-zinc-900">{title}</h3><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{children}</div>{error ? <p role="alert" className="mt-4 text-xs text-red-700">{describeError(error)}</p> : null}<div className="mt-4 flex justify-end gap-2"><SecondaryButton onClick={onCancel}>Cancelar</SecondaryButton><PrimaryButton disabled={!valid || busy} onClick={onSave}>{busy ? "Guardando…" : "Guardar"}</PrimaryButton></div></div>;
}
