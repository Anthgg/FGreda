import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PrimaryButton, SecondaryButton, SelectField, TextAreaField, TextField } from "@/components/form";
import { useConsumableProducts, useLocations, useProducts } from "@/features/masters/useMasters";
import { useQuotations } from "@/features/quotations/useQuotations";
import { Alert } from "@/features/prototypes/PrototypeUi";
import {
  MATERIAL_ROLE_OPTIONS,
  MATERIAL_STAGE_OPTIONS,
  describePrototypeError,
} from "@/features/prototypes/prototypeLabels";
import { useCreatePrototype } from "@/features/prototypes/usePrototypes";
import type {
  PrototypeEvaluationCriterion,
  PrototypeMaterialInput,
  PrototypeMaterialRole,
  PrototypeMaterialStage,
  PrototypeTechnicalSpecifications,
} from "@/types/prototypes";

const YES_NO_OPTIONS = [
  { value: "No", label: "No" },
  { value: "Sí", label: "Sí" },
];

const PRIORITY_OPTIONS = [
  { value: "Alta", label: "Alta" },
  { value: "Media", label: "Media" },
  { value: "Baja", label: "Baja" },
];

const EVALUATION_RESULT_OPTIONS = [
  { value: "Pendiente", label: "Pendiente" },
  { value: "Conforme", label: "Conforme" },
  { value: "No conforme", label: "No conforme" },
  { value: "Requiere ajuste", label: "Requiere ajuste" },
];

/**
 * La ficha se manda ESTRUCTURADA, no compuesta como texto dentro de `notes`.
 *
 * Antes esta pantalla escribía «Ancho cm: 24» en un bloque de observaciones. El
 * backend nunca parsea `notes` —y hace bien: sería atarse a un formato que no
 * controla—, así que todo lo que aquí se tecleaba quedaba fuera del alcance de
 * cualquier automatismo. Las medidas de la muestra sólo pueden precargar una
 * cotización final si llegan como datos.
 *
 * Se descarta lo vacío: un campo que nadie rellenó no es un campo declarado
 * vacío, y esa diferencia es la que decide si hay algo que precargar.
 */
function limpiar<T extends Record<string, unknown>>(valores: T): Partial<T> {
  const salida: Record<string, unknown> = {};
  Object.entries(valores).forEach(([clave, valor]) => {
    if (typeof valor === "string" && !valor.trim()) return;
    if (valor === null || valor === undefined) return;
    salida[clave] = typeof valor === "string" ? valor.trim() : valor;
  });
  return salida as Partial<T>;
}

export function PrototypeFormPage() {
  const navigate = useNavigate();
  const create = useCreatePrototype();
  const products = useProducts({ active: true, limit: 200 });
  const locations = useLocations();
  const quotations = useQuotations({ limit: 200 });
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productId, setProductId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [targetDays, setTargetDays] = useState("");
  const [responsible, setResponsible] = useState("");
  const [needsNewSample, setNeedsNewSample] = useState("No");
  const [priority, setPriority] = useState("Media");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [length, setLength] = useState("");
  const [depth, setDepth] = useState("");
  const [estimatedWeight, setEstimatedWeight] = useState("");
  const [technique, setTechnique] = useState("");
  const [finish, setFinish] = useState("");
  const [mold, setMold] = useState("");
  const [color, setColor] = useState("");
  const [reference, setReference] = useState("");
  const [technicalNotes, setTechnicalNotes] = useState("");
  const [materials, setMaterials] = useState<PrototypeMaterialInput[]>([]);
  // La misma muestra se juzga por medidas, por acabado, por forma y por color,
  // cada uno con su resultado. Un solo criterio obligaría a elegir cuál se
  // guarda, y en el cuaderno del taller están los cuatro.
  const [evaluation, setEvaluation] = useState<PrototypeEvaluationCriterion[]>([]);
  const [notes, setNotes] = useState("");

  // El catalogo de materiales se pide filtrado por tipo al servidor. Filtrarlo
  // aqui, sobre una pagina ya recortada, dejaba fuera del selector las
  // arcillas y las pastas: justo el material del cuerpo de la muestra.
  const consumables = useConsumableProducts().items;
  const consumablesById = useMemo(() => new Map(consumables.map((product) => [product.id, product])), [consumables]);

  const ficha = (): PrototypeTechnicalSpecifications => ({
    ...limpiar({
      responsible,
      priority,
      width_cm: width,
      height_cm: height,
      length_cm: length,
      depth_cm: depth,
      estimated_weight_g: estimatedWeight,
      technique,
      finish,
      mold,
      color,
      reference,
      technical_notes: technicalNotes,
      requires_new_sample: needsNewSample === "Sí",
    }),
    ...(evaluation.length
      ? { evaluation: evaluation.filter((fila) => fila.criterion.trim()) }
      : {}),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(), quantity: Number(quantity), materials: materials.filter((line) => line.product_id > 0 && Number(line.quantity) > 0),
        ...(productId ? { product_id: Number(productId) } : {}),
        ...(quotationId ? { quotation_id: Number(quotationId) } : {}),
        ...(locationId ? { stock_location_id: Number(locationId) } : {}),
        ...(targetDays ? { target_days: Number(targetDays) } : {}),
        // `notes` vuelve a ser lo que dice ser: observaciones humanas. La ficha
        // va aparte, estructurada, y es de donde lee el puente al Cotizador.
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(Object.keys(ficha()).length ? { technical_specifications: ficha() } : {}),
      },
      { onSuccess: (prototype) => navigate(`/prototipos/${prototype.id}`, { state: { createdCode: prototype.code } }) },
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header><Link to="/prototipos" className="text-sm text-zinc-500 hover:underline">← Prototipos</Link><h1 className="mt-2 text-2xl font-semibold">Crear prototipo</h1><p className="mt-1 text-sm text-zinc-500">Ficha basada en el control de prototipos del taller. El código lo asignará el backend.</p></header>
      <form onSubmit={submit} className="glass-panel space-y-6 rounded-3xl border border-white/60 p-6 shadow-sm">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-950">Datos del prototipo</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Nombre / producto" requirement="required" value={name} onChange={setName} maxLength={200} />
            <TextField label="Cantidad de muestra" requirement="required" type="number" inputMode="numeric" value={quantity} onChange={setQuantity} />
            <SelectField label="Producto vinculado" requirement="optional" value={productId} onChange={setProductId} placeholder="Producto nuevo o sin catálogo" options={(products.data?.items ?? []).map((p) => ({ value: String(p.id), label: `${p.internal_reference} · ${p.name}` }))} />
            <SelectField label="Cotización" requirement="optional" value={quotationId} onChange={setQuotationId} placeholder="Sin cotización" options={(quotations.data?.items ?? []).map((q) => ({ value: String(q.id), label: `${q.code} · ${q.name ?? q.product_name ?? "Sin nombre"}` }))} />
            <SelectField label="Almacén" requirement="optional" value={locationId} onChange={setLocationId} placeholder="Sin almacén" options={(locations.data ?? []).filter((l) => l.active).map((l) => ({ value: String(l.id), label: l.name }))} />
            <TextField label="Días prototipo" requirement="optional" type="number" inputMode="numeric" value={targetDays} onChange={setTargetDays} />
            <TextField label="Responsable" requirement="optional" value={responsible} onChange={setResponsible} />
            <SelectField label="Requiere nueva muestra" requirement="optional" value={needsNewSample} onChange={setNeedsNewSample} options={YES_NO_OPTIONS} />
            <SelectField label="Prioridad" requirement="optional" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-950">Especificaciones</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Ancho cm" requirement="optional" type="number" inputMode="decimal" value={width} onChange={setWidth} />
            <TextField label="Alto cm" requirement="optional" type="number" inputMode="decimal" value={height} onChange={setHeight} />
            <TextField label="Largo cm" requirement="optional" type="number" inputMode="decimal" value={length} onChange={setLength} />
            <TextField label="Profundidad cm" requirement="optional" type="number" inputMode="decimal" value={depth} onChange={setDepth} />
            <TextField label="Peso estimado g" requirement="optional" type="number" inputMode="decimal" value={estimatedWeight} onChange={setEstimatedWeight} />
            <TextField label="Técnica" requirement="optional" value={technique} onChange={setTechnique} />
            <TextField label="Esmalte / acabado" requirement="optional" value={finish} onChange={setFinish} />
            <TextField label="Molde" requirement="optional" value={mold} onChange={setMold} />
            <TextField label="Color" requirement="optional" value={color} onChange={setColor} />
            <TextField label="Referencia" requirement="optional" value={reference} onChange={setReference} />
          </div>
          <TextAreaField label="Observaciones técnicas" requirement="optional" value={technicalNotes} onChange={setTechnicalNotes} rows={3} />
        </section>

        <section className="space-y-4">
          <div><h2 className="text-sm font-semibold text-zinc-950">Materiales y consumos</h2><p className="mt-1 text-xs text-zinc-500">Se guardan como consumo físico inicial. La unidad la conserva el catálogo del material.</p></div>
          <div className="space-y-3">
            {materials.map((line, index) => {
              const product = consumablesById.get(line.product_id);
              return <div key={`material-${index}`} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 sm:grid-cols-[1fr_180px_auto] lg:grid-cols-[1fr_180px_auto_180px_180px]">
                <SelectField label="Material" value={line.product_id ? String(line.product_id) : ""} placeholder="Seleccione del catálogo" options={consumables.map((p) => ({ value: String(p.id), label: `${p.internal_reference} · ${p.name}` }))} onChange={(value) => setMaterials((rows) => rows.map((row, i) => i === index ? { ...row, product_id: Number(value) } : row))} />
                <TextField label={`Cantidad prevista${product?.base_uom_code ? ` (${product.base_uom_code})` : ""}`} requirement="required" type="number" inputMode="decimal" value={line.quantity} onChange={(value) => setMaterials((rows) => rows.map((row, i) => i === index ? { ...row, quantity: value } : row))} />
                <SecondaryButton className="self-end" onClick={() => setMaterials((rows) => rows.filter((_, i) => i !== index))}>Quitar</SecondaryButton>
                {/* Rol y etapa son campos DISTINTOS: uno dice qué es el
                    material dentro de la pieza y el otro cuándo se gasta. Sin
                    el rol declarado no hay forma de saber cuál es el cuerpo, y
                    la cotización final no puede heredar el material base. */}
                <SelectField label="Rol" requirement="optional" placeholder="Sin declarar" value={line.material_role ?? ""} options={MATERIAL_ROLE_OPTIONS} onChange={(value) => setMaterials((rows) => rows.map((row, i) => i === index ? { ...row, material_role: (value || null) as PrototypeMaterialRole | null } : row))} />
                <SelectField label="Etapa" requirement="optional" placeholder="Sin declarar" value={line.stage ?? ""} options={MATERIAL_STAGE_OPTIONS} onChange={(value) => setMaterials((rows) => rows.map((row, i) => i === index ? { ...row, stage: (value || null) as PrototypeMaterialStage | null } : row))} />
              </div>;
            })}
          </div>
          <SecondaryButton type="button" onClick={() => setMaterials((rows) => [...rows, { product_id: 0, quantity: "1" }])}>Añadir material</SecondaryButton>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">Evaluación</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Una fila por criterio. Completarlos todos no aprueba la muestra: aprobar sigue siendo
              una decisión que alguien toma.
            </p>
          </div>
          <div className="space-y-3">
            {evaluation.map((fila, index) => (
              <div key={`evaluacion-${index}`} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 sm:grid-cols-[1fr_180px_1fr_auto]">
                <TextField label="Criterio" requirement="required" value={fila.criterion} onChange={(value) => setEvaluation((rows) => rows.map((row, i) => i === index ? { ...row, criterion: value } : row))} />
                <SelectField label="Resultado" requirement="optional" placeholder="Sin evaluar" value={fila.result ?? ""} options={EVALUATION_RESULT_OPTIONS} onChange={(value) => setEvaluation((rows) => rows.map((row, i) => i === index ? { ...row, result: value || null } : row))} />
                <TextField label="Responsable" requirement="optional" value={fila.responsible ?? ""} onChange={(value) => setEvaluation((rows) => rows.map((row, i) => i === index ? { ...row, responsible: value || null } : row))} />
                <SecondaryButton className="self-end" onClick={() => setEvaluation((rows) => rows.filter((_, i) => i !== index))}>Quitar</SecondaryButton>
              </div>
            ))}
          </div>
          <SecondaryButton type="button" onClick={() => setEvaluation((rows) => [...rows, { criterion: "" }])}>Añadir criterio</SecondaryButton>
          <TextAreaField label="Observaciones generales" requirement="optional" value={notes} onChange={setNotes} rows={3} />
        </section>
        {create.error ? <Alert>{describePrototypeError(create.error)}</Alert> : null}
        <div className="flex justify-end gap-2"><SecondaryButton onClick={() => navigate("/prototipos")}>Volver</SecondaryButton><PrimaryButton disabled={create.isPending || !name.trim() || Number(quantity) <= 0 || materials.some((line) => !line.product_id || Number(line.quantity) <= 0)}>{create.isPending ? "Creando…" : "Crear prototipo"}</PrimaryButton></div>
      </form>
    </div>
  );
}
