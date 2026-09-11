/**
 * Menu principal previsto para todo el producto Cotizador GREDA.
 *
 * `Inicio`, `Productos`, `Terceros`, `Inventario`, `Importaciones`, `Recetas`,
 * `Quemas`, `Produccion`, `Cotizaciones`, `Cotizador` y
 * `Configuracion` estan operativos. El resto queda visible y
 * deshabilitado para fijar la estructura de navegacion: su logica de negocio
 * corresponde a fases posteriores y no se adelanta aqui.
 */

export type NavigationIconKey =
  | "home"
  | "users"
  | "upload"
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
    label: "Cotizador V2",
    to: "/cotizador-v2",
    enabled: true,
    icon: "file-text",
    description: "Motor nuevo del cotizador. En construcción por fases (familia 010).",
  },
  {
    // Fase 010A: el Cotizador de siempre pasa a llamarse Legacy mientras dure
    // la transicion. Sigue operativo y sus cotizaciones no se tocan; el nombre
    // solo deja de ser ambiguo ahora que hay dos motores.
    label: "Cotizador Legacy",
    to: "/cotizador/nuevo",
    enabled: true,
    icon: "file-text",
    description: "Cotizador histórico. Se mantiene durante la transición a V2.",
  },
  {
    label: "Cotizaciones",
    to: "/cotizaciones",
    enabled: true,
    icon: "file-text",
    description: "Crear y administrar cotizaciones de piezas y pedidos.",
  },
  {
    label: "Productos",
    to: "/productos",
    enabled: true,
    icon: "package",
    description: "Catálogo de productos e insumos del taller.",
  },
  {
    label: "Terceros",
    to: "/terceros",
    enabled: true,
    icon: "users",
    description: "Clientes y proveedores en un único maestro.",
  },
  {
    label: "Inventario",
    to: "/inventario",
    enabled: true,
    icon: "boxes",
    description: "Control de stock, materias primas y movimientos.",
  },
  {
    label: "Importaciones",
    to: "/importaciones",
    enabled: true,
    icon: "upload",
    description: "Carga controlada de maestros desde Excel.",
  },
  {
    label: "Recetas",
    to: "/recetas",
    enabled: true,
    icon: "flask",
    description: "Preparaciones y composiciones de pastas y esmaltes.",
  },
  {
    label: "Producción",
    to: "/produccion",
    enabled: true,
    icon: "boxes",
    description: "Órdenes de fabricación y consumo de material preparado.",
  },
  {
    label: "Prototipos",
    to: "/prototipos",
    enabled: true,
    icon: "flask",
    description: "Cotizaciones de prototipo y desarrollo previo a producción.",
  },
  {
    label: "Quemas",
    to: "/quemas",
    enabled: true,
    icon: "flame",
    description: "Registro de horneadas, curvas térmicas y costos de energía.",
  },
  {
    label: "Configuracion",
    to: "/configuracion",
    enabled: true,
    icon: "settings",
    description: "Datos de la empresa, parámetros y documentos.",
  },
];
