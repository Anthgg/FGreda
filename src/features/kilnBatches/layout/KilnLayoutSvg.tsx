import React, { useMemo, useRef, useState } from "react";

import {
  checkCollision,
  checkPlacementBounds,
  getReservedFootprint,
  toDecimal6,
} from "./kilnLayoutMath";
import { type DisplayPlacement, KilnPlacementItem } from "./KilnPlacementItem";

interface KilnLayoutSvgProps {
  kilnWidth: number;
  kilnDepth: number;
  placements: DisplayPlacement[];
  selectedPlacementId: string | number | null;
  isReadOnly: boolean;
  onSelectPlacement: (p: DisplayPlacement | null) => void;
  onUpdatePlacementPosition: (id: string | number, new_x_cm: string, new_y_cm: string) => void;
}

interface DragState {
  placement: DisplayPlacement;
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  origX_cm: number;
  origY_cm: number;
  currentX_cm: number;
  currentY_cm: number;
  isValid: boolean;
}

export function KilnLayoutSvg({
  kilnWidth,
  kilnDepth,
  placements,
  selectedPlacementId,
  isReadOnly,
  onSelectPlacement,
  onUpdatePlacementPosition,
}: KilnLayoutSvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Helper para convertir coordenadas de evento del mouse a coordenadas SVG del viewBox
  const getSvgCoordinates = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    if (typeof svg.getScreenCTM !== "function" || typeof svg.createSVGPoint !== "function") {
      return { x: 0, y: 0 };
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const handlePointerDownPlacement = (
    e: React.PointerEvent<SVGGElement>,
    placement: DisplayPlacement,
  ) => {
    if (isReadOnly || !svgRef.current) return;
    e.stopPropagation();

    const coords = getSvgCoordinates(e as unknown as React.PointerEvent<SVGSVGElement>);
    const origX = Number(placement.x_cm);
    const origY = Number(placement.y_cm);

    try {
      if (typeof svgRef.current.setPointerCapture === "function") {
        svgRef.current.setPointerCapture(e.pointerId);
      }
    } catch {
      // Si el navegador no soporta capture en ese elemento, continuar
    }

    setDragState({
      placement,
      pointerId: e.pointerId,
      startSvgX: coords.x,
      startSvgY: coords.y,
      origX_cm: origX,
      origY_cm: origY,
      currentX_cm: origX,
      currentY_cm: origY,
      isValid: true,
    });

    onSelectPlacement(placement);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState || isReadOnly) return;
    const coords = getSvgCoordinates(e);

    const dx = coords.x - dragState.startSvgX;
    const dy = coords.y - dragState.startSvgY;

    // En SVG el eje Y está invertido (dy positivo es hacia abajo en pantalla -> decrementa y_cm)
    const rawNewX = dragState.origX_cm + dx;
    const rawNewY = dragState.origY_cm - dy;

    // Redondear a decimales razonables durante drag
    const newX = Math.round(rawNewX * 100) / 100;
    const newY = Math.round(rawNewY * 100) / 100;

    const fp = getReservedFootprint(
      dragState.placement.piece_length_cm_snapshot,
      dragState.placement.piece_width_cm_snapshot,
      dragState.placement.piece_height_cm_snapshot,
      dragState.placement.separation_cm_snapshot,
      dragState.placement.rotation_degrees,
    );

    // 1. Validar límites del horno
    const inBounds = checkPlacementBounds(newX, newY, fp.x_size, fp.y_size, kilnWidth, kilnDepth);

    // 2. Validar colisión con las demás piezas en este nivel
    let hasCollision = false;
    if (inBounds) {
      const movingBox = {
        left: newX,
        right: newX + fp.x_size,
        bottom: newY,
        top: newY + fp.y_size,
      };

      for (const other of placements) {
        if (other.id === dragState.placement.id) continue;
        const otherFp = getReservedFootprint(
          other.piece_length_cm_snapshot,
          other.piece_width_cm_snapshot,
          other.piece_height_cm_snapshot,
          other.separation_cm_snapshot,
          other.rotation_degrees,
        );
        const otherX = Number(other.x_cm);
        const otherY = Number(other.y_cm);
        const otherBox = {
          left: otherX,
          right: otherX + otherFp.x_size,
          bottom: otherY,
          top: otherY + otherFp.y_size,
        };

        if (checkCollision(movingBox, otherBox)) {
          hasCollision = true;
          break;
        }
      }
    }

    const isValid = inBounds && !hasCollision;

    setDragState((prev) =>
      prev
        ? {
            ...prev,
            currentX_cm: newX,
            currentY_cm: newY,
            isValid,
          }
        : null,
    );
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) return;

    if (
      svgRef.current &&
      typeof svgRef.current.hasPointerCapture === "function" &&
      svgRef.current.hasPointerCapture(e.pointerId)
    ) {
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar
      }
    }

    // Si es válido y cambió de posición, aplicar cambio al borrador
    if (
      dragState.isValid &&
      (dragState.currentX_cm !== dragState.origX_cm ||
        dragState.currentY_cm !== dragState.origY_cm)
    ) {
      onUpdatePlacementPosition(
        dragState.placement.id!,
        toDecimal6(dragState.currentX_cm),
        toDecimal6(dragState.currentY_cm),
      );
    }
    // Si fue inválido, automáticamente se descarta la posición provisional (revertir al orig)
    setDragState(null);
  };

  const handlePointerCancel = () => {
    setDragState(null);
  };

  // Cuadrícula en centímetros (líneas cada 10 cm y cada 5 cm)
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let x = 10; x < kilnWidth; x += 10) {
      lines.push(
        <line
          key={`vx-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={kilnDepth}
          stroke="#e4e4e7"
          strokeWidth={0.15}
          strokeDasharray="0.5 0.5"
        />,
      );
    }
    for (let y = 10; y < kilnDepth; y += 10) {
      lines.push(
        <line
          key={`hy-${y}`}
          x1={0}
          y1={y}
          x2={kilnWidth}
          y2={y}
          stroke="#e4e4e7"
          strokeWidth={0.15}
          strokeDasharray="0.5 0.5"
        />,
      );
    }
    return lines;
  }, [kilnWidth, kilnDepth]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-inner select-none">
      {/* Contenedor SVG responsive con viewBox exacto en centímetros */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${kilnWidth} ${kilnDepth}`}
        className="w-full h-auto max-h-[70vh] cursor-default touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={() => onSelectPlacement(null)}
      >
        {/* Fondo del horno */}
        <rect
          x={0}
          y={0}
          width={kilnWidth}
          height={kilnDepth}
          fill="#fafafa"
          stroke="#71717a"
          strokeWidth={0.4}
        />

        {/* Cuadrícula tenue en cm */}
        {gridLines}

        {/* Ejes y marcas de orientación */}
        <g pointerEvents="none" opacity={0.6}>
          <text
            x={1}
            y={kilnDepth - 1}
            fontSize={1.2}
            fill="#71717a"
            fontFamily="monospace"
            fontWeight="bold"
          >
            (0,0) Frente / Base
          </text>
          <text
            x={kilnWidth - 1}
            y={kilnDepth - 1}
            textAnchor="end"
            fontSize={1.2}
            fill="#71717a"
            fontFamily="monospace"
          >
            {kilnWidth} cm Ancho →
          </text>
          <text
            x={1}
            y={2}
            fontSize={1.2}
            fill="#71717a"
            fontFamily="monospace"
          >
            ↑ Fondo ({kilnDepth} cm)
          </text>
        </g>

        {/* Renderizado de Placements */}
        {placements.map((p) => {
          const isSelected = p.id === selectedPlacementId;
          const isCurrentDragging = dragState?.placement.id === p.id;

          // Si es la pieza que se está arrastrando, usar coordenadas provisionales
          const displayP: DisplayPlacement =
            isCurrentDragging && dragState
              ? {
                  ...p,
                  x_cm: dragState.currentX_cm,
                  y_cm: dragState.currentY_cm,
                  isDragging: true,
                  isInvalid: !dragState.isValid,
                }
              : p;

          return (
            <KilnPlacementItem
              key={p.id ?? `${p.batch_assignment_id}-${p.unit_index}`}
              placement={displayP}
              kilnDepth={kilnDepth}
              isSelected={isSelected}
              isReadOnly={isReadOnly}
              onSelect={onSelectPlacement}
              onPointerDown={handlePointerDownPlacement}
            />
          );
        })}
      </svg>
    </div>
  );
}
