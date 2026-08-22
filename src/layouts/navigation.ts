/**
 * Menu principal previsto para todo el producto Cotizador GREDA.
 *
 * En la Fase 1 solo `Inicio` tiene contenido funcional. El resto queda visible
 * y deshabilitado para fijar la estructura de navegacion: su logica de negocio
 * corresponde a fases posteriores y no se adelanta aqui.
 */

export type NavigationIconKey =
  | "home"
  | "package"
  | "boxes"
  | "flask"
  | "flame"
  | "file-text"
  | "settings";

export interface NavigationItem {
  label: string;
  /** Ruta destino. Ausente mientras el modulo no exista. */
  to?: string;
  /** Si el modulo se encuentra habilitado y operativo. */
  enabled: boolean;
  /** Identificador de icono discretamente asociado. */
  icon: NavigationIconKey;
  /** Descripcion resumida para accesos rapidos. */
  description: string;
}

export const NAVIGATION: readonly NavigationItem[] = [
  {
    label: "Inicio",
    to: "/",
    enabled: true,
    icon: "home",
    description: "Panel principal y accesos rápidos del taller.",
  },
  {
    label: "Cotizaciones",
    enabled: false,
    icon: "file-text",
    description: "Crear y administrar cotizaciones de piezas y pedidos.",
  },
  {
    label: "Productos",
    enabled: false,
    icon: "package",
    description: "Catálogo de productos e insumos del taller.",
  },
  {
    label: "Inventario",
    enabled: false,
    icon: "boxes",
    description: "Control de stock, materias primas y movimientos.",
  },
  {
    label: "Recetas",
    enabled: false,
    icon: "flask",
    description: "Preparaciones y composiciones de pastas y esmaltes.",
  },
  {
    label: "Quemas",
    enabled: false,
    icon: "flame",
    description: "Registro de horneadas, curvas térmicas y costos de energía.",
  },
  {
    label: "Configuracion",
    enabled: false,
    icon: "settings",
    description: "Datos de la empresa, parámetros y documentos.",
  },
];
