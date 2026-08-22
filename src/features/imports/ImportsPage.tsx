/**
 * Importador de maestros.
 *
 * El flujo es visible y en pasos: subir, revisar el análisis, resolver lo que
 * el backend no puede decidir solo y recién entonces confirmar. No hay ningún
 * botón que importe todo antes del preview.
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import {
  Badge,
  EmptyState,
  MasterHeader,
  Panel,
  TableWrapper,
  Td,
  Th,
} from "@/features/masters/MasterTable";
import {
  useCommitImport,
  useImportBatch,
  useImportPreview,
  useImports,
  useResolveRows,
  useUnits,
  useUploadWorkbook,
} from "@/features/masters/useMasters";
import type {
  ImportEntity,
  ImportRow,
  ImportRowStatus,
  PartnerRole,
  RowResolution,
  UnitOfMeasure,
} from "@/types/masters";

const ENTITY_LABELS: Record<ImportEntity, string> = {
  PRODUCT_CATEGORY: "Categorías",
  POS_CATEGORY: "Categorías POS",
  UNIT: "Unidades",
  PRODUCT: "Productos",
  PARTNER: "Terceros",
  LOCATION: "Ubicaciones",
  STOCK: "Existencias",
  RECIPE: "Recetas",
};

const STATUS_TONES: Record<ImportRowStatus, "neutral" | "positive" | "warning" | "danger"> = {
  READY: "positive",
  RESOLVED: "positive",
  REVIEW_REQUIRED: "warning",
  BLOCKED: "danger",
  COMMITTED: "neutral",
};

function summaryTile(label: string, value: number, tone = "text-zinc-900") {
  return (
    <div key={label} className="rounded-xl border border-zinc-200 bg-white/70 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

/** Muestra el valor del archivo junto al que se guardará. */
function RowIssues({ row }: { row: ImportRow }) {
  if (row.errors.length === 0 && row.warnings.length === 0) return <span>—</span>;
  return (
    <ul className="space-y-1">
      {row.errors.map((issue, index) => (
        <li key={`e-${index}`} className="text-xs text-red-600">
          <span className="font-mono">{issue.code}</span> · {issue.message}
        </li>
      ))}
      {row.warnings.map((issue, index) => (
        <li key={`w-${index}`} className="text-xs text-amber-700">
          <span className="font-mono">{issue.code}</span> · {issue.message}
          {typeof issue.source === "string" && typeof issue.normalized === "string" ? (
            <span className="ml-1 font-mono text-zinc-500">
              ({issue.source} → {issue.normalized})
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function RowResolver({
  row,
  units,
  onResolve,
  disabled,
}: {
  row: ImportRow;
  units: UnitOfMeasure[];
  onResolve: (resolution: RowResolution) => void;
  disabled: boolean;
}) {
  const [choice, setChoice] = useState("");
  const [applySuggestion, setApplySuggestion] = useState(false);

  if (row.status !== "REVIEW_REQUIRED" && row.status !== "BLOCKED") {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  if (row.entity === "PARTNER") {
    const suggestion = row.normalized["document_suggestion"];
    const source = row.normalized["document_number"];
    return (
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          label="Clasificar"
          value={choice}
          options={[
            { value: "", label: "Elegir rol" },
            { value: "CLIENT", label: "Cliente" },
            { value: "SUPPLIER", label: "Proveedor" },
            { value: "BOTH", label: "Cliente y proveedor" },
          ]}
          onChange={setChoice}
          disabled={disabled}
          className="w-52"
        />
        {typeof suggestion === "string" ? (
          // Corregir un documento real es una decision aparte de clasificar el
          // rol: se marca a proposito o el numero del archivo se respeta.
          <label className="flex items-center gap-1.5 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={applySuggestion}
              onChange={(event) => setApplySuggestion(event.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Aplicar {suggestion}
            <span className="text-zinc-400">(el archivo trae {String(source)})</span>
          </label>
        ) : null}
        <SecondaryButton
          disabled={disabled || choice === ""}
          onClick={() =>
            onResolve({
              row_id: row.id,
              partner_role: choice as PartnerRole,
              ...(applySuggestion ? { accept_suggestion: true } : {}),
            })
          }
        >
          Aplicar
        </SecondaryButton>
        <SecondaryButton
          disabled={disabled}
          onClick={() => onResolve({ row_id: row.id, action: "SKIP" })}
        >
          Omitir
        </SecondaryButton>
      </div>
    );
  }

  if (row.entity === "PRODUCT") {
    // Lo unico que un producto puede necesitar del usuario es la unidad que
    // el archivo no trajo. No se le asigna una por parecido.
    return (
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          label="Unidad"
          value={choice}
          options={[
            { value: "", label: "Elegir unidad" },
            ...units.map((unit) => ({ value: unit.code, label: `${unit.name} (${unit.symbol})` })),
          ]}
          onChange={setChoice}
          disabled={disabled}
          className="w-52"
        />
        <SecondaryButton
          disabled={disabled || choice === ""}
          onClick={() => onResolve({ row_id: row.id, base_uom_code: choice })}
        >
          Aplicar
        </SecondaryButton>
        <SecondaryButton
          disabled={disabled}
          onClick={() => onResolve({ row_id: row.id, action: "SKIP" })}
        >
          Omitir
        </SecondaryButton>
      </div>
    );
  }

  if (row.entity === "STOCK") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {row.candidates.length > 0 ? (
          <>
            <SelectField
              label="Producto"
              value={choice}
              options={[
                { value: "", label: "Elegir producto" },
                ...row.candidates.map((candidate) => ({
                  value: String(candidate.product_id ?? ""),
                  label: candidate.label,
                })),
              ]}
              onChange={setChoice}
              disabled={disabled}
              searchPlaceholder="Buscar producto..."
              className="w-64"
            />
            <SecondaryButton
              disabled={disabled || choice === ""}
              onClick={() => onResolve({ row_id: row.id, product_id: Number(choice) })}
            >
              Aplicar
            </SecondaryButton>
          </>
        ) : (
          <span className="text-xs text-red-600">
            Sin producto en el maestro: créalo y vuelve a subir el archivo.
          </span>
        )}
        <SecondaryButton
          disabled={disabled}
          onClick={() => onResolve({ row_id: row.id, action: "SKIP" })}
        >
          Omitir
        </SecondaryButton>
      </div>
    );
  }

  return (
    <SecondaryButton
      disabled={disabled}
      onClick={() => onResolve({ row_id: row.id, action: "SKIP" })}
    >
      Omitir
    </SecondaryButton>
  );
}

export function ImportsPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [batchId, setBatchId] = useState<number | null>(null);
  const [entity, setEntity] = useState<ImportEntity | "">("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const history = useImports();
  const units = useUnits();
  const batch = useImportBatch(batchId);
  const preview = useImportPreview(batchId, {
    ...(entity !== "" ? { entity } : {}),
    ...(onlyPending ? { row_status: "REVIEW_REQUIRED" as ImportRowStatus } : {}),
    limit: 200,
  });
  const upload = useUploadWorkbook();
  const resolve = useResolveRows(batchId);
  const commit = useCommitImport(batchId);

  const summary = batch.data?.summary;
  const canCommit =
    isAdmin &&
    batch.data !== undefined &&
    batch.data.status !== "COMMITTED" &&
    (summary?.review_required ?? 1) === 0 &&
    (summary?.errors ?? 1) === 0;

  return (
    <div className="mx-auto w-full max-w-[1536px] px-4 py-2 sm:px-6 lg:px-8">
      <MasterHeader
        title={
          <TypewriterTitle
            text="Importar maestros."
            className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          />
        }
        subtitle="Subir, revisar y confirmar. Nada se escribe antes de tu confirmación."
      />

      <Panel>
        {/* Paso 1: subir */}
        <section className="border-b border-zinc-200 pb-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-800">1 · Subir archivo</h2>
          <input
            type="file"
            aria-label="Archivo de maestros"
            accept=".xlsx"
            disabled={!isAdmin || upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              upload.mutate(file, { onSuccess: (created) => setBatchId(created.id) });
            }}
            className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          />
          {!isAdmin ? (
            <p className="mt-2 text-xs text-zinc-500">
              Solo un administrador puede importar maestros.
            </p>
          ) : null}
          {upload.isPending ? <Spinner label="Analizando el archivo..." /> : null}
          {upload.error ? (
            <p className="mt-2 text-sm text-red-600">
              {describeError(upload.error)}
            </p>
          ) : null}
        </section>

        {/* Paso 2: resumen */}
        {batch.data && summary ? (
          <section className="border-b border-zinc-200 py-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">2 · Resumen del análisis</h2>
            {summary.duplicate_file ? (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Este archivo ya se importó antes (lote {summary.duplicate_of_batch_id}). Puedes
                continuar, pero revisa que no sea una doble importación.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {summaryTile("Creaciones", summary.creates)}
              {summaryTile("Actualizaciones", summary.updates)}
              {summaryTile("Omitidas", summary.skips)}
              {summaryTile("Errores", summary.errors, "text-red-600")}
              {summaryTile("Avisos", summary.warnings, "text-amber-700")}
              {summaryTile("Por revisar", summary.review_required, "text-amber-700")}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Recetas detectadas: {summary.recipes_detected} ({summary.recipe_lines_detected}{" "}
              líneas) · importadas: {summary.recipes_imported} — su modelo productivo es de Fase
              3.5.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pb-1 pr-4 font-medium">Hoja</th>
                    <th className="pb-1 pr-4 font-medium">Entidad</th>
                    <th className="pb-1 pr-4 font-medium">Filas</th>
                    <th className="pb-1 font-medium">Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sheets.map((sheet) => (
                    <tr key={sheet.name} className="border-t border-zinc-100">
                      <td className="py-1 pr-4 text-zinc-800">{sheet.name}</td>
                      <td className="py-1 pr-4 text-zinc-500">
                        {sheet.entity ? ENTITY_LABELS[sheet.entity] : "No reconocida"}
                      </td>
                      <td className="py-1 pr-4 text-zinc-500">{sheet.rows}</td>
                      <td className="py-1 text-amber-700">{sheet.warnings.join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Paso 3: preview */}
        {batchId !== null ? (
          <section className="py-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-800">3 · Vista previa</h2>
              <div className="flex flex-wrap items-end gap-3">
                <SelectField
                  label="Entidad"
                  value={entity}
                  options={[
                    { value: "", label: "Todas" },
                    ...(Object.keys(ENTITY_LABELS) as ImportEntity[]).map((value) => ({
                      value,
                      label: ENTITY_LABELS[value],
                    })),
                  ]}
                  onChange={(value) => setEntity(value as ImportEntity | "")}
                  className="w-52"
                />
                <label className="flex items-center gap-2 pb-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={onlyPending}
                    onChange={(event) => setOnlyPending(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Solo lo que requiere revisión
                </label>
              </div>
            </div>

            {preview.isPending ? (
              <Spinner label="Cargando vista previa..." />
            ) : (preview.data?.items.length ?? 0) === 0 ? (
              <EmptyState message="No hay filas que mostrar con este filtro." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Fila</Th>
                    <Th>Entidad</Th>
                    <Th>Detalle</Th>
                    <Th>Acción</Th>
                    <Th>Estado</Th>
                    <Th>Avisos y errores</Th>
                    <Th>Resolver</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data?.items.map((row) => (
                    <tr key={row.id}>
                      <Td mono>{row.source_row}</Td>
                      <Td muted>{ENTITY_LABELS[row.entity]}</Td>
                      <Td>
                        <span className="text-xs text-zinc-700">
                          {String(
                            row.normalized["name"] ??
                              row.raw["name"] ??
                              row.raw["product"] ??
                              row.raw["component"] ??
                              "—",
                          )}
                        </span>
                        {row.normalized["internal_reference"] ? (
                          <span className="ml-2 font-mono text-[11px] text-zinc-400">
                            {String(row.normalized["internal_reference"])}
                          </span>
                        ) : null}
                      </Td>
                      <Td muted>{row.action}</Td>
                      <Td>
                        <Badge tone={STATUS_TONES[row.status]}>{row.status}</Badge>
                      </Td>
                      <Td>
                        <RowIssues row={row} />
                      </Td>
                      <Td>
                        <RowResolver
                          row={row}
                          units={units.data ?? []}
                          disabled={!isAdmin || resolve.isPending}
                          onResolve={(resolution) => resolve.mutate([resolution])}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}

            {/* Paso 4: confirmacion */}
            <div className="mt-6 border-t border-zinc-200 pt-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-800">4 · Confirmación</h2>
              {batch.data?.status === "COMMITTED" ? (
                <p className="text-sm text-emerald-700">
                  Importación confirmada el{" "}
                  {batch.data.completed_at
                    ? new Date(batch.data.completed_at).toLocaleString()
                    : "—"}
                  .
                </p>
              ) : confirming ? (
                <div className="rounded-xl border border-zinc-200 bg-white/70 p-4">
                  <p className="text-sm text-zinc-800">
                    Se crearán {summary?.creates ?? 0} registros y se actualizarán{" "}
                    {summary?.updates ?? 0}. Las {summary?.recipes_detected ?? 0} recetas
                    detectadas no se importan.
                  </p>
                  {commit.error ? (
                    <p className="mt-2 text-sm text-red-600">
                      {describeError(commit.error)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton
                      type="button"
                      disabled={commit.isPending}
                      onClick={() => commit.mutate(undefined, { onSuccess: () => setConfirming(false) })}
                    >
                      {commit.isPending ? "Importando..." : "Confirmar importación"}
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={() => setConfirming(false)}
                      disabled={commit.isPending}
                    >
                      Cancelar
                    </SecondaryButton>
                  </div>
                </div>
              ) : (
                <>
                  <PrimaryButton
                    type="button"
                    disabled={!canCommit}
                    onClick={() => setConfirming(true)}
                  >
                    Revisar y confirmar
                  </PrimaryButton>
                  {!canCommit && isAdmin ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Quedan {summary?.review_required ?? 0} filas por resolver.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </section>
        ) : null}

        {/* Historial */}
        {(history.data?.items.length ?? 0) > 0 ? (
          <section className="border-t border-zinc-200 pt-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Importaciones anteriores</h2>
            <TableWrapper>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Archivo</Th>
                  <Th>Estado</Th>
                  <Th>Responsable</Th>
                  <Th align="right">Acción</Th>
                </tr>
              </thead>
              <tbody>
                {history.data?.items.map((item) => (
                  <tr key={item.id}>
                    <Td muted>{new Date(item.created_at).toLocaleString()}</Td>
                    <Td>{item.filename}</Td>
                    <Td>
                      <Badge tone={item.status === "COMMITTED" ? "positive" : "neutral"}>
                        {item.status}
                      </Badge>
                    </Td>
                    <Td muted>{item.created_by_name ?? "—"}</Td>
                    <Td align="right">
                      <SecondaryButton onClick={() => setBatchId(item.id)}>
                        Ver
                      </SecondaryButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </section>
        ) : null}
      </Panel>
    </div>
  );
}
