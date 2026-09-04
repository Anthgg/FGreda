/**
 * Qué puede hacer cada rol, en un solo sitio.
 *
 * **Esto NO es seguridad.** La autoridad es el backend, que rechaza cualquier
 * mutación no autorizada aunque el botón llegara a aparecer —y hay pruebas de
 * integración que lo comprueban con un 403 y con la base de datos intacta
 * detrás—. Lo que se decide aquí es otra cosa: qué se le ofrece a alguien, para
 * no enseñarle un botón que se sabe que va a fallar.
 *
 * Está centralizado porque la alternativa era repetir `role === "ADMIN"` en
 * cada pantalla, y una regla escrita en catorce sitios se escribe de catorce
 * maneras: el día que una cambie, las otras trece siguen diciendo lo anterior.
 */

import type { SessionUser } from "@/types/auth";

/** Roles del sistema. Hoy solo hay dos. */
type Role = SessionUser["role"];

/**
 * El taller: quien ejecuta la fabricación.
 *
 * Prepara receta, ajusta existencia y lleva una orden de principio a fin. Es la
 * cadena física completa: dar sólo una parte dejaría al operario pudiendo
 * gastar barniz y sin poder fabricarlo.
 */
function esTaller(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

function esAdmin(role: Role | undefined): boolean {
  return role === "ADMIN";
}

export interface Capabilities {
  crearPrototipo: boolean;
  editarPrototipo: boolean;
  gestionarMaterialesPrototipo: boolean;
  arrancarPrototipo: boolean;
  completarPrototipo: boolean;
  decidirPrototipo: boolean;
  anularPrototipo: boolean;
  /**
   * Crear la cotización final desde una muestra aprobada, y poner o quitar
   * conceptos comerciales. Cotizar es decidir un precio, y eso es
   * administración: el taller ejecuta. El backend lo bloquea igual — esto solo
   * evita ofrecer un botón que iba a devolver 403.
   */
  cotizarDesdePrototipo: boolean;
  gestionarConceptosComerciales: boolean;
  /** Crear la orden desde una cotización confirmada. */
  crearOrdenProduccion: boolean;
  /** Arrancar: el único punto que descuenta material. */
  arrancarProduccion: boolean;
  completarProduccion: boolean;
  /**
   * Anular. Sigue siendo administrativa: no es ejecución sino deshacer un
   * compromiso ya tomado, y deja la cotización de origen ocupada para siempre,
   * porque no admite una segunda orden.
   */
  anularProduccion: boolean;
  /** Cargar o corregir existencia de un material. */
  ajustarInventario: boolean;
  /** Registrar un lote de preparación. */
  prepararReceta: boolean;
  /** Abrir un almacén nuevo: decisión administrativa, no de taller. */
  crearAlmacen: boolean;
  /** Lo comercial —confirmar, cobrar, precios— no se mueve en 009J. */
  gestionComercial: boolean;
}

export function capabilitiesFor(role: Role | undefined): Capabilities {
  return {
    crearPrototipo: esTaller(role),
    editarPrototipo: esTaller(role),
    gestionarMaterialesPrototipo: esTaller(role),
    arrancarPrototipo: esTaller(role),
    completarPrototipo: esTaller(role),
    decidirPrototipo: esAdmin(role),
    anularPrototipo: esAdmin(role),
    cotizarDesdePrototipo: esAdmin(role),
    gestionarConceptosComerciales: esAdmin(role),
    crearOrdenProduccion: esTaller(role),
    arrancarProduccion: esTaller(role),
    completarProduccion: esTaller(role),
    anularProduccion: esAdmin(role),
    ajustarInventario: esTaller(role),
    prepararReceta: esTaller(role),
    crearAlmacen: esAdmin(role),
    gestionComercial: esAdmin(role),
  };
}
