import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowLeftIcon, ExclamationTriangleIcon } from "./layoutIcons";

import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import {
  useKilnBatch,
  useKilnBatchLayout,
  useSuggestKilnBatchLayout,
  useUpdateKilnBatchLayout,
} from "@/features/kilnBatches/useKilnBatches";
import type {
  KilnBatchAssignment,
  KilnBatchLayoutLevelIn,
  KilnBatchLayoutPlacementIn,
  KilnBatchLayoutSuggestion,
  SuggestedPlacement,
} from "@/types/kilnBatches";

import {
  canonicalLayoutFingerprint,
  checkCollision,
  checkPlacementBounds,
  getReservedFootprint,
  toDecimal6,
  validateLevelMove,
} from "./kilnLayoutMath";
import { KilnConflictModal } from "./KilnConflictModal";
import { KilnLayoutHeader } from "./KilnLayoutHeader";
import { KilnLayoutSvg } from "./KilnLayoutSvg";
import { KilnLayoutToolbar } from "./KilnLayoutToolbar";
import { KilnLevelModal } from "./KilnLevelModal";
import { KilnLevelSelector } from "./KilnLevelSelector";
import { KilnPendingPanel } from "./KilnPendingPanel";
import { type DisplayPlacement } from "./KilnPlacementItem";
import { KilnSelectedPiecePanel } from "./KilnSelectedPiecePanel";
import { KilnSuggestionBanner } from "./KilnSuggestionBanner";

export function KilnBatchLayoutPage() {
  const { batchId: rawBatchId } = useParams<{ batchId: string }>();
  const batchId = rawBatchId ? parseInt(rawBatchId, 10) : null;

  const batchQuery = useKilnBatch(batchId);
  const layoutQuery = useKilnBatchLayout(batchId);

  const updateMutation = useUpdateKilnBatchLayout(batchId ?? 0);
  const suggestMutation = useSuggestKilnBatchLayout(batchId ?? 0);

  // Estados locales de borrador
  const [draftLevels, setDraftLevels] = useState<KilnBatchLayoutLevelIn[]>([]);
  const [draftPlacements, setDraftPlacements] = useState<DisplayPlacement[]>([]);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number>(0);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | number | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Estados de sugerencia M3
  const [suggestion, setSuggestion] = useState<KilnBatchLayoutSuggestion | null>(null);

  // Modales y diálogos
  const [isLevelModalOpen, setIsLevelModalOpen] = useState<boolean>(false);
  const [editingLevel, setEditingLevel] = useState<KilnBatchLayoutLevelIn | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);

  // Referencias para reintentos de guardado idempotentes
  const pendingSaveFingerprintRef = useRef<string | null>(null);
  const pendingIdempotencyKeyRef = useRef<string | null>(null);

  // Mensajes de error o éxito
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const batch = batchQuery.data;
  const layout = layoutQuery.data;

  // Mapa de asignaciones para enriquecer nombres y etiquetas
  const assignmentMap = useMemo(() => {
    const map = new Map<number, KilnBatchAssignment>();
    batch?.assignments?.forEach((a) => map.set(a.id, a));
    return map;
  }, [batch?.assignments]);

  // Inicializar estado local cuando se carga el layout del backend
  useEffect(() => {
    if (layout) {
      const initialLevels: KilnBatchLayoutLevelIn[] = layout.levels.map((lvl) => ({
        level_index: lvl.level_index,
        name: lvl.name,
        z_cm: lvl.z_cm,
        usable_height_cm: lvl.usable_height_cm,
        plate_label: lvl.plate_label,
        plate_thickness_cm: lvl.plate_thickness_cm,
      }));

      // Si no hay niveles definidos pero hay dimensiones del horno, crear nivel 0 por defecto
      const kilnH = Number(layout.kiln_height_cm_snapshot);
      if (initialLevels.length === 0 && kilnH > 0) {
        initialLevels.push({
          level_index: 0,
          name: "Nivel 1 - Base",
          z_cm: "0",
          usable_height_cm: toDecimal6(kilnH),
        });
      }

      setDraftLevels(initialLevels);

      const initialPlacements: DisplayPlacement[] = layout.placements.map((p) => {
        const asgn = assignmentMap.get(p.batch_assignment_id);
        const orderLabel = asgn?.production_order_id
          ? `OP #${asgn.production_order_id}`
          : asgn?.internal_load_id
          ? `CI #${asgn.internal_load_id}`
          : `Asignación #${p.batch_assignment_id}`;

        return {
          id: p.id ?? `placement-${p.batch_assignment_id}-${p.unit_index ?? 0}-${p.group_index}`,
          batch_assignment_id: p.batch_assignment_id,
          group_index: p.group_index,
          unit_index: p.unit_index,
          quantity: p.quantity,
          level_index: p.level_index,
          x_cm: p.x_cm,
          y_cm: p.y_cm,
          rotation_degrees: p.rotation_degrees,
          piece_length_cm_snapshot: p.piece_length_cm_snapshot,
          piece_width_cm_snapshot: p.piece_width_cm_snapshot,
          piece_height_cm_snapshot: p.piece_height_cm_snapshot,
          separation_cm_snapshot: p.separation_cm_snapshot,
          orderLabel,
          productName: asgn?.product_name || "Pieza en horno",
        };
      });

      setDraftPlacements(initialPlacements);
      setIsDirty(false);
      setSuggestion(null);
      setSelectedPlacementId(null);

      // Si el nivel seleccionado no existe en los niveles iniciales, seleccionar el primero
      if (initialLevels.length > 0) {
        setSelectedLevelIndex((prev) =>
          initialLevels.some((l) => l.level_index === prev)
            ? prev
            : initialLevels[0]?.level_index ?? 0,
        );
      }
    } else if (layout === null) {
      // Layout aún no existe (404) - Inicializar borrador vacío
      setDraftLevels([]);
      setDraftPlacements([]);
      setIsDirty(false);
      setSuggestion(null);
      setSelectedPlacementId(null);
    }
  }, [layout, assignmentMap]);

  // Dimensiones útiles del horno
  const kilnWidth = Number(layout?.kiln_width_cm_snapshot || 0);
  const kilnDepth = Number(layout?.kiln_depth_cm_snapshot || 0);
  const kilnHeight = Number(layout?.kiln_height_cm_snapshot || 0);

  const hasMissingDimensions = Boolean(
    layout && (kilnWidth <= 0 || kilnDepth <= 0 || kilnHeight <= 0),
  );
  const isReadOnly = batch?.status !== "PLANNED";

  // Placements del nivel actualmente activo
  const currentLevelPlacements = useMemo(() => {
    return draftPlacements.filter((p) => p.level_index === selectedLevelIndex);
  }, [draftPlacements, selectedLevelIndex]);

  // Pieza seleccionada
  const selectedPlacement = useMemo(() => {
    return draftPlacements.find((p) => p.id === selectedPlacementId) || null;
  }, [draftPlacements, selectedPlacementId]);

  // Manejador para actualizar la posición de una pieza tras arrastrar en SVG
  const handleUpdatePlacementPosition = (
    id: string | number,
    new_x_cm: string,
    new_y_cm: string,
  ) => {
    if (isReadOnly) return;
    setDraftPlacements((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x_cm: new_x_cm, y_cm: new_y_cm } : p)),
    );
    setIsDirty(true);
    setLocalError(null);
  };

  // Manejador para rotar una pieza (0° <-> 90°)
  const handleRotatePlacement = (id: string | number) => {
    if (isReadOnly) return;
    const target = draftPlacements.find((p) => p.id === id);
    if (!target) return;

    const newRotation = target.rotation_degrees === 0 ? 90 : 0;
    const fp = getReservedFootprint(
      target.piece_length_cm_snapshot,
      target.piece_width_cm_snapshot,
      target.piece_height_cm_snapshot,
      target.separation_cm_snapshot,
      newRotation,
    );

    const xNum = Number(target.x_cm);
    const yNum = Number(target.y_cm);

    // Validar si entra en los límites del horno al rotar
    const inBounds = checkPlacementBounds(xNum, yNum, fp.x_size, fp.y_size, kilnWidth, kilnDepth);
    if (!inBounds) {
      setLocalError(
        `No se puede rotar la pieza a ${newRotation}°: superaría los límites físicos del horno.`,
      );
      return;
    }

    // Validar colisión con otras piezas en el mismo nivel
    const targetBox = {
      left: xNum,
      right: xNum + fp.x_size,
      bottom: yNum,
      top: yNum + fp.y_size,
    };

    for (const other of currentLevelPlacements) {
      if (other.id === id) continue;
      const otherFp = getReservedFootprint(
        other.piece_length_cm_snapshot,
        other.piece_width_cm_snapshot,
        other.piece_height_cm_snapshot,
        other.separation_cm_snapshot,
        other.rotation_degrees,
      );
      const otherBox = {
        left: Number(other.x_cm),
        right: Number(other.x_cm) + otherFp.x_size,
        bottom: Number(other.y_cm),
        top: Number(other.y_cm) + otherFp.y_size,
      };
      if (checkCollision(targetBox, otherBox)) {
        setLocalError(
          `No se puede rotar la pieza a ${newRotation}°: colisionaría con otra pieza en este nivel.`,
        );
        return;
      }
    }

    setDraftPlacements((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation_degrees: newRotation } : p)),
    );
    setIsDirty(true);
    setLocalError(null);
  };

  // Mover pieza a otro nivel con validación geométrica completa M2
  const handleMoveLevel = (id: string | number, targetLevelIndex: number) => {
    if (isReadOnly) return;
    const target = draftPlacements.find((p) => p.id === id);
    if (!target) return;

    const destLevel = draftLevels.find((l) => l.level_index === targetLevelIndex);
    if (!destLevel) {
      setLocalError("El nivel destino seleccionado no existe.");
      return;
    }

    const otherPlacementsInDest = draftPlacements.filter(
      (p) => p.id !== id && p.level_index === targetLevelIndex,
    );

    const validation = validateLevelMove(
      target,
      destLevel,
      otherPlacementsInDest,
      kilnWidth,
      kilnDepth,
    );

    if (!validation.valid) {
      setLocalError(validation.error ?? "La pieza no cabe en ese nivel.");
      return;
    }

    setDraftPlacements((prev) =>
      prev.map((p) => (p.id === id ? { ...p, level_index: targetLevelIndex } : p)),
    );
    setSelectedLevelIndex(targetLevelIndex);
    setIsDirty(true);
    setLocalError(null);
    setSuccessMessage(`Pieza movida al nivel ${destLevel.name || targetLevelIndex}.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Quitar pieza del layout (volver a pendientes)
  const handleRemovePlacement = (id: string | number) => {
    if (isReadOnly) return;
    setDraftPlacements((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlacementId === id) {
      setSelectedPlacementId(null);
    }
    setIsDirty(true);
    setLocalError(null);
  };

  // Añadir / Editar Nivel
  const handleSaveLevel = (level: KilnBatchLayoutLevelIn) => {
    if (isReadOnly) return;
    setDraftLevels((prev) => {
      const exists = prev.some((l) => l.level_index === level.level_index);
      if (exists) {
        return prev.map((l) => (l.level_index === level.level_index ? level : l));
      }
      return [...prev, level];
    });
    setIsLevelModalOpen(false);
    setEditingLevel(null);
    setIsDirty(true);
    setSelectedLevelIndex(level.level_index);
  };

  // Eliminar Nivel
  const handleDeleteLevel = (levelIndex: number) => {
    if (isReadOnly) return;
    const piecesInLevel = draftPlacements.filter((p) => p.level_index === levelIndex);
    if (piecesInLevel.length > 0) {
      setLocalError(
        `No se puede eliminar el nivel ${levelIndex} porque contiene ${piecesInLevel.length} piezas. Quítalas primero o muévelas a otro nivel.`,
      );
      return;
    }
    setDraftLevels((prev) => prev.filter((l) => l.level_index !== levelIndex));
    setIsDirty(true);
    // Cambiar a otro nivel si el eliminado era el seleccionado
    const remaining = draftLevels.filter((l) => l.level_index !== levelIndex);
    if (remaining.length > 0) {
      const firstRemaining = remaining[0];
      if (firstRemaining) {
        setSelectedLevelIndex(firstRemaining.level_index);
      }
    }
  };

  // Solicitar sugerencia de auto-packing M3
  const handleSuggest = async () => {
    if (isReadOnly) return;
    setLocalError(null);
    try {
      const expectedVersion = layout ? layout.version : 0;
      const res = await suggestMutation.mutateAsync({
        expected_version: expectedVersion,
        levels: draftLevels,
      });
      setSuggestion(res);

      // Previsualizar placements sugeridos combinados con los existentes
      const suggestedDisplayPlacements: DisplayPlacement[] = res.suggested_placements.map(
        (sp: SuggestedPlacement) => {
          const asgn = assignmentMap.get(sp.batch_assignment_id);
          const orderLabel = asgn?.production_order_id
            ? `OP #${asgn.production_order_id}`
            : asgn?.internal_load_id
            ? `CI #${asgn.internal_load_id}`
            : `Asignación #${sp.batch_assignment_id}`;

          return {
            id: `sug-${sp.batch_assignment_id}-${sp.unit_index}`,
            batch_assignment_id: sp.batch_assignment_id,
            group_index: sp.group_index,
            unit_index: sp.unit_index,
            quantity: sp.quantity,
            level_index: sp.level_index,
            x_cm: sp.x_cm,
            y_cm: sp.y_cm,
            rotation_degrees: sp.rotation_degrees,
            piece_length_cm_snapshot: sp.piece_length_cm_snapshot,
            piece_width_cm_snapshot: sp.piece_width_cm_snapshot,
            piece_height_cm_snapshot: sp.piece_height_cm_snapshot,
            separation_cm_snapshot: sp.separation_cm_snapshot,
            orderLabel,
            productName: asgn?.product_name || "Pieza sugerida",
            isSuggested: true,
          };
        },
      );

      // En el preview, mostramos las piezas actuales + las sugeridas
      setDraftPlacements([...draftPlacements, ...suggestedDisplayPlacements]);
    } catch (err: unknown) {
      setLocalError(describeError(err));
    }
  };

  // Aplicar sugerencia al borrador
  const handleApplySuggestion = () => {
    if (!suggestion) return;
    // Marcar como piezas normales del borrador
    setDraftPlacements((prev) =>
      prev.map((p) => (p.isSuggested ? { ...p, isSuggested: false } : p)),
    );
    setSuggestion(null);
    setIsDirty(true);
    setSuccessMessage("Sugerencia de acomodo aplicada al borrador local.");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Descartar sugerencia
  const handleDismissSuggestion = () => {
    // Remover las piezas sugeridas y restaurar borrador
    setDraftPlacements((prev) => prev.filter((p) => !p.isSuggested));
    setSuggestion(null);
  };

  // Guardar layout persistido (PUT)
  const handleSave = async () => {
    if (isReadOnly) return;
    setLocalError(null);
    setSuccessMessage(null);

    // Si había una sugerencia sin confirmar, limpiar flag
    const cleanPlacements = draftPlacements.filter((p) => !p.isSuggested);

    // Preparar payload de placements
    const placementsPayload: KilnBatchLayoutPlacementIn[] = cleanPlacements.map((p) => ({
      batch_assignment_id: p.batch_assignment_id,
      group_index: p.group_index,
      unit_index: p.unit_index,
      quantity: p.quantity,
      level_index: p.level_index,
      x_cm: toDecimal6(p.x_cm),
      y_cm: toDecimal6(p.y_cm),
      rotation_degrees: p.rotation_degrees,
    }));

    const expectedVersion = layout ? layout.version : 0;
    const currentFingerprint = canonicalLayoutFingerprint(
      expectedVersion,
      draftLevels,
      placementsPayload,
    );

    let idempotencyKey: string;
    if (
      pendingSaveFingerprintRef.current === currentFingerprint &&
      pendingIdempotencyKeyRef.current
    ) {
      idempotencyKey = pendingIdempotencyKeyRef.current;
    } else {
      idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `save-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      pendingSaveFingerprintRef.current = currentFingerprint;
      pendingIdempotencyKeyRef.current = idempotencyKey;
    }

    try {
      await updateMutation.mutateAsync({
        expected_version: expectedVersion,
        idempotency_key: idempotencyKey,
        levels: draftLevels,
        placements: placementsPayload,
      });
      pendingSaveFingerprintRef.current = null;
      pendingIdempotencyKeyRef.current = null;
      setIsDirty(false);
      setSuccessMessage("Distribución física del horno guardada exitosamente.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "status" in err) {
        const status = (err as { status: number }).status;
        if (status === 409) {
          pendingSaveFingerprintRef.current = null;
          pendingIdempotencyKeyRef.current = null;
          setIsConflictModalOpen(true);
          return;
        }
        if (status === 422) {
          pendingSaveFingerprintRef.current = null;
          pendingIdempotencyKeyRef.current = null;
          setLocalError(describeError(err));
          return;
        }
      }
      setLocalError(describeError(err));
    }
  };

  // Recargar layout desde el servidor
  const handleReload = () => {
    void layoutQuery.refetch();
    setIsConflictModalOpen(false);
    setLocalError(null);
  };

  if (batchQuery.isPending || layoutQuery.isPending) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Spinner className="size-6" label="Cargando mapa físico del horno…" />
      </div>
    );
  }

  if (batchQuery.isError) {
    return (
      <div className="space-y-4">
        <Link
          to="/produccion/hornadas"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Volver a Hornadas
        </Link>
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {describeError(batchQuery.error)}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Navegación y enlace de retorno */}
      <div className="flex items-center justify-between">
        <Link
          to="/produccion/hornadas"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Volver a Hornadas
        </Link>
      </div>

      {/* Alerta de dimensiones faltantes en el horno */}
      {hasMissingDimensions && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Horno sin dimensiones físicas útiles configuradas</p>
              <p className="mt-1 text-amber-800">
                El horno de esta hornada no tiene configuradas sus dimensiones lineales útiles
                (ancho, profundidad o altura). Debe configurar estas medidas en la ficha del horno
                para habilitar la distribución física interactiva.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes de notificación */}
      {localError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          {localError}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium"
        >
          {successMessage}
        </div>
      )}

      {/* Cabecera operativa */}
      {batch && (
        <KilnLayoutHeader
          batch={batch}
          version={layout ? layout.version : 0}
          kilnWidth={Number(layout?.kiln_width_cm_snapshot || 0)}
          kilnDepth={Number(layout?.kiln_depth_cm_snapshot || 0)}
          kilnHeight={Number(layout?.kiln_height_cm_snapshot || 0)}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Barra de herramientas */}
      <KilnLayoutToolbar
        isDirty={isDirty}
        isReadOnly={isReadOnly}
        isSaving={updateMutation.isPending}
        isSuggesting={suggestMutation.isPending}
        hasLevels={draftLevels.length > 0}
        onSuggest={handleSuggest}
        onSave={handleSave}
        onReload={handleReload}
        onAddLevel={() => {
          setEditingLevel(null);
          setIsLevelModalOpen(true);
        }}
      />

      {/* Banner de previsualización de sugerencia M3 */}
      {suggestion && (
        <KilnSuggestionBanner
          suggestion={suggestion}
          onApply={handleApplySuggestion}
          onDismiss={handleDismissSuggestion}
        />
      )}

      {/* Selector de Niveles */}
      <KilnLevelSelector
        levels={draftLevels.map((l) => ({
          level_index: l.level_index,
          name: l.name ?? null,
          z_cm: l.z_cm,
          usable_height_cm: l.usable_height_cm,
          plate_label: l.plate_label ?? null,
          plate_thickness_cm: l.plate_thickness_cm ?? null,
        }))}
        selectedLevelIndex={selectedLevelIndex}
        placements={draftPlacements}
        isReadOnly={isReadOnly}
        onSelectLevel={setSelectedLevelIndex}
        onAddLevel={() => {
          setEditingLevel(null);
          setIsLevelModalOpen(true);
        }}
        onEditLevel={(lvl) => {
          setEditingLevel(lvl);
          setIsLevelModalOpen(true);
        }}
        onDeleteLevel={handleDeleteLevel}
      />

      {/* Grid principal: Lienzo SVG + Panel lateral de piezas pendientes */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Columna Izquierda: Mapa SVG + Panel de inspección de pieza */}
        <div className="space-y-4">
          <KilnLayoutSvg
            kilnWidth={kilnWidth > 0 ? kilnWidth : 50}
            kilnDepth={kilnDepth > 0 ? kilnDepth : 50}
            placements={currentLevelPlacements}
            selectedPlacementId={selectedPlacementId}
            isReadOnly={isReadOnly}
            onSelectPlacement={(p) => setSelectedPlacementId(p ? p.id! : null)}
            onUpdatePlacementPosition={handleUpdatePlacementPosition}
          />

          {/* Panel de inspección de pieza seleccionada */}
          {selectedPlacement && (
            <KilnSelectedPiecePanel
              placement={selectedPlacement}
              levels={draftLevels.map((l) => ({
                level_index: l.level_index,
                name: l.name ?? null,
                z_cm: l.z_cm,
                usable_height_cm: l.usable_height_cm,
                plate_label: l.plate_label ?? null,
                plate_thickness_cm: l.plate_thickness_cm ?? null,
              }))}
              currentLevelIndex={selectedLevelIndex}
              isReadOnly={isReadOnly}
              onRotate={handleRotatePlacement}
              onMoveLevel={handleMoveLevel}
              onRemovePlacement={handleRemovePlacement}
              onClose={() => setSelectedPlacementId(null)}
            />
          )}
        </div>

        {/* Columna Derecha: Panel de Piezas Pendientes */}
        <div>
          <KilnPendingPanel
            assignments={batch?.assignments || []}
            placements={draftPlacements
              .filter((p) => !p.isSuggested)
              .map((p) => ({
                batch_assignment_id: p.batch_assignment_id,
                quantity: p.quantity,
              }))}
          />
        </div>
      </div>

      {/* Modal para Crear / Editar Nivel */}
      <KilnLevelModal
        isOpen={isLevelModalOpen}
        kilnHeight={kilnHeight > 0 ? kilnHeight : 100}
        initialLevel={editingLevel}
        existingLevels={draftLevels}
        onSave={handleSaveLevel}
        onClose={() => {
          setIsLevelModalOpen(false);
          setEditingLevel(null);
        }}
      />

      {/* Modal para Conflicto de Versión Concurrente (409) */}
      <KilnConflictModal
        isOpen={isConflictModalOpen}
        onReload={handleReload}
        onClose={() => setIsConflictModalOpen(false)}
      />
    </div>
  );
}
