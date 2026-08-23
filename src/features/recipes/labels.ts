/**
 * Vocabulario del módulo de recetas.
 *
 * La API habla en constantes (`BASE`, `PREPARED_MATERIAL`, `REVIEW_REQUIRED`).
 * La interfaz nunca las muestra en crudo: aquí se traducen una sola vez para
 * que ninguna pantalla invente su propia versión.
 */

import type { RecipeComponentType, RecipeStatus } from "@/types/recipes";

export const COMPONENT_LABEL: Record<RecipeComponentType, string> = {
  BASE: "Base",
  COLORANT: "Colorante",
  ADDITIVE: "Aditivo",
};

/**
 * Color por significado, no por decoración: la base es lo que suma hasta el
 * 100 %, y colorantes y aditivos son lo que se añade por encima.
 */
export const COMPONENT_TONE: Record<RecipeComponentType, string> = {
  BASE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COLORANT: "bg-violet-50 text-violet-700 ring-violet-200",
  ADDITIVE: "bg-amber-50 text-amber-700 ring-amber-200",
};

export const VERSION_STATUS_LABEL: Record<RecipeStatus, string> = {
  ACTIVE: "Activa",
  DRAFT: "Borrador",
  ARCHIVED: "Archivada",
};

export const VERSION_STATUS_TONE: Record<RecipeStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DRAFT: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  ARCHIVED: "bg-zinc-50 text-zinc-400 ring-zinc-200",
};

/** Traduce los términos técnicos del staging a lenguaje del taller. */
export const STAGING_LABEL: Record<string, string> = {
  PREPARED_MATERIAL: "Material preparado",
  SOURCE_STRUCTURE: "Estructura del maestro",
  HUMAN_RESOLUTION: "Decisión humana",
  UNRESOLVED: "Pendiente",
  REVIEW_REQUIRED: "Requiere revisión",
  READY: "Lista",
  ERROR: "Con error",
  COMMITTED: "Confirmada",
  PENDING: "Pendiente",
};

/** Devuelve la etiqueta legible, o el propio código si no hay traducción. */
export function humanize(code: string | null | undefined): string {
  if (!code) return "—";
  return STAGING_LABEL[code] ?? code;
}
