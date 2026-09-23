/**
 * Menu principal previsto para todo el producto Cotizador GREDA.
 *
 * `Inicio`, `Productos`, `Terceros`, `Inventario`, `Importaciones`, `Recetas`,
 * `Quemas`, `Produccion`, `Cotizaciones`, `Cotizador` y
 * `Configuracion` estan operativos. El resto queda visible y
 * deshabilitado para fijar la estructura de navegacion: su logica de negocio
 * corresponde a fases posteriores y no se adelanta aqui.
 */

import { CREACION_LEGACY_HABILITADA } from "@/features/cotizador/legacyCutover";

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
    description: "El cotizador vigente: cotizar, emitir y enviar a producción.",
  },
  // Fase 010J: el «Cotizador Legacy» llevaba a CREAR una cotización Legacy.
  // Solo aparece si esa creación está encendida, que tras el corte no lo está.
  ...(CREACION_LEGACY_HABILITADA
    ? [
        {
          label: "Cotizador Legacy",
          to: "/cotizador/nuevo",
          enabled: true,
          icon: "file-text" as const,
          description: "Cotizador anterior.",
        },
      ]
    : []),
  {
    // Lo histórico se consulta desde aquí: abrir y ver el PDF.
    label: "Cotizaciones Legacy",
    to: "/cotizaciones",
    enabled: true,
    icon: "file-text",
    description: "Cotizaciones del cotizador anterior: consulta y PDF.",
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
    // Fase 010K. Va junto a «Quemas» porque ambas hablan de horno, pero no es
    // lo mismo: aquella registra hornadas hechas, esta cotiza el servicio de
    // quemar piezas que el cliente todavia no ha traido.
    label: "Solo quema",
    to: "/solo-quema",
    enabled: true,
    icon: "flame",
    description: "Cotizar la quema de piezas que trae el cliente.",
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
