import React from "react";

import {
  cmToSvgY,
  getOrderStyle,
  getReservedFootprint,
} from "./kilnLayoutMath";

export interface DisplayPlacement {
  id?: number | string;
  batch_assignment_id: number;
  group_index: number;
  unit_index: number | null;
  quantity: number;
  level_index: number;
  x_cm: string | number;
  y_cm: string | number;
  rotation_degrees: number;
  piece_length_cm_snapshot: string | number;
  piece_width_cm_snapshot: string | number;
  piece_height_cm_snapshot: string | number;
  separation_cm_snapshot: string | number;
  orderLabel?: string;
  productName?: string;
  isSuggested?: boolean;
  isDragging?: boolean;
  isInvalid?: boolean;
}

interface KilnPlacementItemProps {
  placement: DisplayPlacement;
  kilnDepth: number;
  isSelected: boolean;
  isReadOnly: boolean;
  onSelect: (placement: DisplayPlacement) => void;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>, placement: DisplayPlacement) => void;
}

export function KilnPlacementItem({
  placement,
  kilnDepth,
  isSelected,
  isReadOnly,
  onSelect,
  onPointerDown,
}: KilnPlacementItemProps) {
  const fp = getReservedFootprint(
    placement.piece_length_cm_snapshot,
    placement.piece_width_cm_snapshot,
    placement.piece_height_cm_snapshot,
    placement.separation_cm_snapshot,
    placement.rotation_degrees,
  );

  const x_cm = Number(placement.x_cm);
  const y_cm = Number(placement.y_cm);
  const svg_x = x_cm;
  const svg_y = cmToSvgY(y_cm, fp.y_size, kilnDepth);

  const inner_x = svg_x + fp.separation / 2;
  const inner_y = svg_y + fp.separation / 2;

  const orderKey = placement.orderLabel || placement.batch_assignment_id;
  const style = getOrderStyle(orderKey);

  const ariaLabel = `${placement.productName || "Pieza"} ${fp.piece_x}×${fp.piece_y} cm, ${
    placement.orderLabel || `Asignación #${placement.batch_assignment_id}`
  }${placement.unit_index ? `, unidad ${placement.unit_index}` : ""}, x=${placement.x_cm}, y=${
    placement.y_cm
  }, rot=${placement.rotation_degrees}°`;

  // Colores y bordes según estado
  let outerStroke = "stroke-zinc-400/60";
  let outerFill = "fill-zinc-50/40";
  if (placement.isInvalid) {
    outerStroke = "stroke-red-500";
    outerFill = "fill-red-100/40";
  } else if (isSelected) {
    outerStroke = "stroke-amber-500";
    outerFill = "fill-amber-50/50";
  } else if (placement.isSuggested) {
    outerStroke = "stroke-purple-500/80";
    outerFill = "fill-purple-50/40";
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={`cursor-pointer transition-opacity ${
        placement.isDragging ? "opacity-80" : "opacity-100"
      } outline-none focus:ring-2 focus:ring-amber-400`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(placement);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(placement);
        }
      }}
      onPointerDown={(e) => {
        if (!isReadOnly && onPointerDown) {
          onPointerDown(e, placement);
        }
      }}
    >
      {/* 1. Rectángulo exterior: Área reservada de seguridad (Separación) */}
      <rect
        x={svg_x}
        y={svg_y}
        width={fp.x_size}
        height={fp.y_size}
        rx={0.5}
        ry={0.5}
        className={`${outerFill} ${outerStroke}`}
        strokeWidth={isSelected ? 0.35 : 0.2}
        strokeDasharray={placement.isSuggested ? "1 0.5" : "0.6 0.4"}
      />

      {/* 2. Rectángulo interior: Pieza física real */}
      <rect
        x={inner_x}
        y={inner_y}
        width={fp.piece_x}
        height={fp.piece_y}
        rx={0.4}
        ry={0.4}
        fill={style.fillColor}
        fillOpacity={placement.isSuggested ? 0.65 : 0.85}
        stroke={isSelected ? "#b45309" : style.strokeColor}
        strokeWidth={isSelected ? 0.4 : 0.25}
        strokeDasharray={style.borderStyle === "dashed" ? "1 0.5" : undefined}
      />

      {/* 3. Etiquetas visuales accesibles (Etiqueta de orden y unidad) */}
      {fp.piece_x >= 3 && fp.piece_y >= 2 && (
        <g pointerEvents="none">
          <text
            x={inner_x + fp.piece_x / 2}
            y={inner_y + fp.piece_y / 2 - (fp.piece_y >= 4 ? 0.6 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize={Math.min(1.6, Math.max(0.9, fp.piece_x / 5))}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {placement.orderLabel || `#${placement.batch_assignment_id}`}
          </text>
          {fp.piece_y >= 4 && (
            <text
              x={inner_x + fp.piece_x / 2}
              y={inner_y + fp.piece_y / 2 + 1.1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fillOpacity={0.9}
              fontSize={Math.min(1.2, Math.max(0.7, fp.piece_x / 6))}
              fontFamily="sans-serif"
            >
              {placement.unit_index ? `u:${placement.unit_index}` : `${fp.piece_x}×${fp.piece_y}`}
            </text>
          )}
        </g>
      )}

      {/* 4. Badge "Sugerido" si es un preview */}
      {placement.isSuggested && fp.x_size >= 4 && (
        <rect
          x={svg_x + 0.2}
          y={svg_y + 0.2}
          width={Math.min(fp.x_size - 0.4, 3.5)}
          height={1.0}
          rx={0.3}
          fill="#9333ea"
          fillOpacity={0.9}
          pointerEvents="none"
        />
      )}
      {placement.isSuggested && fp.x_size >= 4 && (
        <text
          x={svg_x + 0.5}
          y={svg_y + 0.8}
          fill="#ffffff"
          fontSize={0.65}
          fontWeight="bold"
          fontFamily="sans-serif"
          pointerEvents="none"
        >
          PREVIEW
        </text>
      )}
    </g>
  );
}
