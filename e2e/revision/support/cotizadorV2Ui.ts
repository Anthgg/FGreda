import { expect, type Locator, type Page } from "@playwright/test";

import { testName } from "../../helpers/fixtures";

/**
 * Cómo se maneja el Cotizador V2 desde el navegador, contra el backend real.
 * Desde el corte (010O.13) `/cotizador-v2` es la interfaz rediseñada: estas
 * acciones son las de una persona sobre ESA pantalla, compartidas por las
 * suites de flujo, ciclo de vida y pre-010I para que un cambio de etiqueta se
 * arregle en un solo sitio.
 */

export const RUTA_V2 = "/cotizador-v2";

/** El cliente que siembra `servidor_revision`. */
export const CLIENTE_E2E = "Cliente E2E";

/** Una cotización recién creada: su id y la base de sus direcciones. */
export interface Borrador {
  id: number;
  base: string;
  nombre: string;
}

/** Crea un borrador desde el listado, con el cliente de la siembra salvo que se pida sin él. */
export async function nuevoBorrador(
  page: Page,
  etiqueta: string,
  opciones: { sinCliente?: boolean; tipo?: RegExp } = {},
): Promise<Borrador> {
  const nombre = testName(etiqueta);
  await page.goto(RUTA_V2);
  await page.getByRole("button", { name: "Nueva cotización" }).click();
  const alta = page.getByRole("dialog", { name: "Nueva cotización" });
  if (!opciones.sinCliente) {
    await alta.getByRole("combobox", { name: /¿Para quién es\?/ }).click();
    await page.getByRole("option", { name: CLIENTE_E2E, exact: true }).click();
  }
  if (opciones.tipo) {
    await alta.getByRole("radio", { name: opciones.tipo }).click();
  }
  await alta.getByLabel(/Ponle un nombre/).fill(nombre);
  await alta.getByRole("button", { name: "Empezar cotización" }).click();
  await expect(page).toHaveURL(new RegExp(`${RUTA_V2}/\\d+/(cliente|productos)$`), { timeout: 20_000 });
  const id = Number(new URL(page.url()).pathname.split("/")[2]);
  return { id, base: `${RUTA_V2}/${id}`, nombre };
}

/** El botón de un paso en la barra de pasos. */
export function botonDePaso(page: Page, titulo: string): Locator {
  return page
    .getByRole("navigation", { name: "Pasos" })
    .getByRole("button", { name: new RegExp(`^Paso \\d: ${titulo}`) });
}

/** Va a un paso por la barra y espera su título. */
export async function irAPaso(page: Page, titulo: string): Promise<void> {
  await botonDePaso(page, titulo).click();
  await expect(tituloDelPaso(page, titulo)).toBeVisible({ timeout: 15_000 });
}

export function tituloDelPaso(page: Page, titulo: string): Locator {
  return page.getByRole("heading", { level: 2, name: titulo, exact: true });
}

export function estadoDeGuardado(page: Page): Locator {
  return page.getByTestId("v2next-estado-guardado");
}

/**
 * Lo que ve una persona: el pie dice «Guardado». Las escrituras de una
 * cotización van en fila detrás de su cabecera; recargar antes de que
 * terminen perdería datos, así que las pruebas esperan a este aviso.
 */
export async function esperarGuardado(page: Page): Promise<void> {
  await expect(estadoDeGuardado(page)).toHaveText("Guardado", { timeout: 30_000 });
}

/** Un campo de texto por el principio de su nombre accesible («Largo Opcional» → «Largo»). */
export function campo(ambito: Page | Locator, etiqueta: string): Locator {
  return ambito.getByRole("textbox", { name: new RegExp(`^${etiqueta}`) });
}

async function escribir(campoDeTexto: Locator, valor: string): Promise<void> {
  await campoDeTexto.fill(valor);
  await campoDeTexto.blur();
}

/** Añade una pieza a medida con su cantidad y medidas. Queda en el paso Piezas. */
export async function anadirPieza(
  page: Page,
  nombre: string,
  cantidad: string,
  medidas: [string, string, string],
): Promise<void> {
  if (!(await tituloDelPaso(page, "Piezas").isVisible())) await irAPaso(page, "Piezas");
  await page.getByRole("button", { name: /Agregar pieza/ }).click();
  const dialogo = page.getByRole("dialog", { name: /Agregar pieza/ });
  await dialogo.getByRole("combobox").click();
  await page.getByPlaceholder(/busca/i).last().fill(nombre);
  await page.getByRole("option", { name: new RegExp(`Pieza a medida «${nombre}»`) }).click();
  await expect(campo(page, "Nombre de la pieza").last()).toHaveValue(nombre, { timeout: 20_000 });
  await escribir(page.getByRole("textbox", { name: "Cantidad" }).last(), cantidad);
  for (const [indice, etiqueta] of ["Largo", "Ancho", "Alto"].entries()) {
    await escribir(campo(page, etiqueta).last(), medidas[indice] as string);
  }
  await esperarGuardado(page);
}

/** Añade una pieza del catálogo por su nombre. Queda en el paso Piezas. */
export async function anadirPiezaDelCatalogo(page: Page, nombre: string): Promise<void> {
  if (!(await tituloDelPaso(page, "Piezas").isVisible())) await irAPaso(page, "Piezas");
  await page.getByRole("button", { name: /Agregar pieza/ }).click();
  const dialogo = page.getByRole("dialog", { name: /Agregar pieza/ });
  await dialogo.getByRole("combobox").click();
  await page.getByPlaceholder(/busca/i).last().fill(nombre);
  // La opción lleva delante el código del maestro («LAB50001 …»).
  const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.getByRole("option", { name: new RegExp(`(^|\\s)${escapado}$`) }).click();
  // Del catálogo el nombre no se edita: se lee en la tarjeta.
  await expect(page.getByText("Del catálogo").last()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(nombre, { exact: true }).last()).toBeVisible();
  await esperarGuardado(page);
}

/** Elige la primera arcilla valorizada de la pieza `indice` y, si se da, su peso por pieza. */
export async function elegirArcilla(page: Page, indice = 0, peso?: string): Promise<void> {
  if (!(await tituloDelPaso(page, "Arcilla y esmalte").isVisible())) await irAPaso(page, "Arcilla y esmalte");
  await page.getByRole("combobox", { name: "Arcilla", exact: true }).nth(indice).click();
  await page.getByRole("option").nth(1).click();
  await esperarGuardado(page);
  if (peso !== undefined) {
    await escribir(campo(page, "Arcilla por pieza").nth(indice), peso);
    await esperarGuardado(page);
  }
}

/** Elige en un combobox con buscador: escribe si hay buscador y pulsa la opción. */
export async function elegir(page: Page, combobox: Locator, opcion: string | RegExp): Promise<void> {
  await combobox.click();
  const buscador = page.getByPlaceholder(/buscar/i).last();
  if (typeof opcion === "string" && (await buscador.isVisible().catch(() => false))) {
    await buscador.fill(opcion);
  }
  await page.getByRole("option", { name: opcion }).first().click();
}

/** La tarjeta de trabajo de la pieza `indice` en el paso Trabajo. */
export function tarjetaDeTrabajo(page: Page, indice = 0): Locator {
  return page.getByTestId("v2next-paso-trabajo").locator('[data-testid^="labor-piece-"]').nth(indice);
}

/** Añade una técnica a la pieza `indice` y, si se da, quién la hace. */
export async function agregarProceso(
  page: Page,
  tecnica: string,
  opciones: { indice?: number; trabajador?: RegExp } = {},
): Promise<void> {
  if (!(await tituloDelPaso(page, "Trabajo").isVisible())) await irAPaso(page, "Trabajo");
  const tarjeta = tarjetaDeTrabajo(page, opciones.indice ?? 0);
  await elegir(page, tarjeta.getByRole("combobox", { name: "Agregar proceso" }), tecnica);
  await tarjeta.getByRole("button", { name: "Agregar", exact: true }).click();
  await esperarGuardado(page);
  if (opciones.trabajador) {
    await elegir(page, tarjeta.getByRole("combobox", { name: "Lo hace" }).last(), opciones.trabajador);
    await esperarGuardado(page);
  }
}

export function campoDeDias(page: Page): Locator {
  return page.getByLabel("¿Cuántos días le dedicarás?");
}

/** Decide los días de taller. */
export async function decidirDias(page: Page, dias: string): Promise<void> {
  if (!(await tituloDelPaso(page, "Trabajo").isVisible())) await irAPaso(page, "Trabajo");
  await escribir(campoDeDias(page), dias);
  await esperarGuardado(page);
}

/**
 * Intenta recargar y devuelve el diálogo que levanta el navegador, sin aceptarlo.
 * No se usa `page.reload()`: con el diálogo rechazado esa promesa no se resuelve.
 */
export async function intentarRecargar(page: Page) {
  const dialogo = page.waitForEvent("dialog", { timeout: 10_000 });
  void page.evaluate(() => window.location.reload()).catch(() => undefined);
  return dialogo;
}

/** Emite desde «Revisar y emitir». Queda en la emitida, en solo lectura. */
export async function emitir(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/resumen`);
  const boton = page.getByRole("button", { name: "Emitir cotización" });
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
  await page
    .getByRole("dialog", { name: "¿Emitir la cotización?" })
    .getByRole("button", { name: "Confirmar y emitir" })
    .click();
  await expect(page.getByTestId("v2next-solo-lectura")).toBeVisible({ timeout: 20_000 });
}

export function cabecera(page: Page): Locator {
  return page.getByTestId("v2next-cabecera");
}
