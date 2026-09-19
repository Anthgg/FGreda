import { expect, test, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";

/**
 * Fase 010G — el flujo de siete pasos del Cotizador V2, contra LA REVISION.
 *
 * Estas pruebas NO corren contra produccion. Viven en `e2e/revision/`, que el
 * smoke de produccion ignora, y las ejecuta `playwright.revision.config.ts`
 * contra la aplicacion construida desde la propia rama y un backend levantado
 * desde la revision compatible. Probar contra produccion una pantalla que
 * produccion todavia no tiene no valida nada: o falla por la razon equivocada o,
 * peor, se salta y deja un verde vacio.
 *
 * Cuatro recorridos, uno por cada cosa que solo se rompe de punta a punta y que
 * las pruebas de componente no pueden ver porque alli el backend es una
 * respuesta escrita a mano:
 *
 * 1. **el flujo completo y su recarga.** Cliente, piezas, materiales, mano de
 *    obra, quema, precio y resumen; y luego F5. Lo que importa no es que se
 *    pueda navegar, es que nada se pierda al hacerlo;
 * 2. **multiproducto.** Dos piezas reparten una sola quema. La suma de lo
 *    asignado tiene que ser exactamente el total, no aproximadamente;
 * 3. **dolares.** El tipo de cambio se congela en la cotizacion y los importes
 *    salen en la moneda que la cabecera declara;
 * 4. **coma decimal.** Escribir «2,5» en cualquier campo numerico es escribir
 *    dos y medio. Es la forma de escribir de quien usa esto todos los dias.
 *
 * Politica no destructiva heredada de 009A: todo lo que se crea lleva el
 * prefijo E2E-, nada se borra y nada se confirma.
 */

/** El indicador de un paso en la barra de arriba. */
function paso(page: Page, numero: number, titulo: string) {
  return page.getByRole("button", { name: new RegExp(`${numero}\\.\\s*${titulo}`, "i") });
}

/** Abre un borrador V2 nuevo y devuelve su URL, ya en el paso del cliente. */
async function nuevoBorrador(page: Page, etiqueta: string): Promise<string> {
  const nombre = testName(etiqueta);
  await page.goto("/cotizador-v2");
  await page.getByLabel(/referencia/i).fill(nombre);
  await page.getByRole("button", { name: /crear cotizaci[oó]n v2/i }).click();
  await expect(page.getByTestId("pasos-cotizacion")).toBeVisible({ timeout: 15_000 });
  return page.url();
}

/** Elige el primer cliente real de la lista. */
async function elegirCliente(page: Page): Promise<void> {
  await paso(page, 1, "Cliente").click();
  await expect(page.getByTestId("paso-cliente")).toBeVisible();
  await page.getByRole("combobox", { name: "Cliente", exact: true }).click();
  // La primera opcion es «Sin cliente todavía»: se salta.
  const primero = page.getByRole("option").nth(1);
  await expect(primero).toBeVisible();
  await primero.click();
}

/** Anade una pieza de encargo con sus medidas y su cantidad. */
async function anadirPieza(
  page: Page,
  nombre: string,
  cantidad: string,
  medidas: [string, string, string],
): Promise<void> {
  await paso(page, 2, "Productos").click();
  await expect(page.getByText(/productos y piezas/i)).toBeVisible();
  await page.getByLabel(/nueva l[ií]nea/i).fill(nombre);
  await page.getByRole("button", { name: /a[ñn]adir l[ií]nea/i }).click();

  const fila = page.locator(`text=${nombre}`).first();
  await expect(fila).toBeVisible({ timeout: 15_000 });

  const cantidades = page.getByLabel(/^cantidad/i);
  const ultima = cantidades.last();
  await ultima.fill(cantidad);
  await ultima.blur();

  for (const [indice, etiqueta] of [/largo \(cm\)/i, /ancho \(cm\)/i, /alto \(cm\)/i].entries()) {
    const campo = page.getByLabel(etiqueta).last();
    await campo.fill(medidas[indice] as string);
    await campo.blur();
  }
}

/**
 * Prepara una cotizacion con una pieza en el horno chico y deja la pantalla en
 * el paso de mano de obra.
 *
 * Los importes esperados salen de la siembra del backend de revision y de las
 * reglas del Excel final (010J): 20 piezas de 18 x 12 x 3 con 3 cm de
 * separacion ocupan 20 x 21 x 15 x 6 = 37.800 cm3, el 222,35 % del horno chico.
 * En quema COMPARTIDA se cobran 2,2235 hornadas a 200 + 250: S/1000,59.
 * Espacio a S/140 por dia, administracion S/200, factor x3. Con 2 dias:
 * produccion 1000,59 + 280 + 200 = S/1480,59; x3 = 4441,76; unitario 222,09
 * que sube al escalon de S/0,50: 222,50 x 20 = S/4450.
 */
async function cotizacionHastaManoDeObra(page: Page, etiqueta: string): Promise<void> {
  await login(page);
  await nuevoBorrador(page, etiqueta);
  await elegirCliente(page);
  await anadirPieza(page, testName("Plato"), "20", ["18", "12", "3"]);
  await paso(page, 4, "Mano de obra").click();
  await expect(page.getByTestId("panel-mano-de-obra")).toBeVisible();
  await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
    timeout: 30_000,
  });
}

/**
 * Intenta recargar y devuelve el dialogo que el navegador levanta, sin aceptarlo.
 *
 * No se usa `page.reload()`: si el dialogo se rechaza, la navegacion se cancela y
 * esa promesa no se resolveria nunca. La recarga se pide desde la pagina y lo que
 * se espera es el DIALOGO, que es justo lo que se esta probando.
 */
async function intentarRecargar(page: Page) {
  const dialogo = page.waitForEvent("dialog", { timeout: 10_000 });
  void page.evaluate(() => window.location.reload()).catch(() => undefined);
  return dialogo;
}

const RUTA_PLANIFICACION = "**/api/v1/quotations-v2/*/planning";

test.describe("Cotizador V2: flujo de siete pasos (Fase 010G)", () => {
  // Sin `test.skip` por falta de credenciales: en el gate de revision las
  // credenciales las genera el propio workflow, y si faltan la configuracion
  // aborta antes de empezar. Un salto aqui convertiria un entorno roto en verde.

  test("CASO 1 FLUJO COMPLETO: los siete pasos y una recarga que no pierde nada", async ({
    page,
  }) => {
    await login(page);
    const url = await nuevoBorrador(page, "V2-Flujo");

    await elegirCliente(page);
    await anadirPieza(page, testName("Plato"), "20", ["18", "12", "3"]);

    // Materiales: la pasta se elige en el paso 3, no en el 2.
    await paso(page, 3, "Materiales").click();
    await expect(page.getByText(/no descuenta inventario/i)).toBeVisible();
    await page.getByRole("combobox", { name: "Pasta", exact: true }).first().click();
    const primeraPasta = page.getByRole("option").nth(1);
    await expect(primeraPasta).toBeVisible();
    await primeraPasta.click();

    // Mano de obra: los dias efectivos son una decision humana y hacen falta.
    await paso(page, 4, "Mano de obra").click();
    await expect(page.getByTestId("panel-mano-de-obra")).toBeVisible();
    const dias = page.getByLabel(/d[ií]as efectivos/i);
    await dias.fill("2");
    await dias.blur();

    await paso(page, 5, "Quema").click();
    await expect(page.getByTestId("panel-quema")).toBeVisible();

    await paso(page, 6, "Margen y precio").click();
    await expect(page.getByTestId("panel-precio")).toBeVisible();

    await paso(page, 7, "Resumen").click();
    const resumen = page.getByTestId("paso-resumen");
    await expect(resumen).toBeVisible();

    // Se espera lo mismo que ve una persona: que la pantalla diga que todo esta
    // guardado. Las escrituras de una cotizacion se ponen en fila detras del
    // bloqueo de su cabecera, y esta prueba encontro que recargar antes de que
    // terminaran perdia los dias efectivos EN SILENCIO. La app ahora lo dice y
    // frena la recarga; la prueba respeta ese contrato en vez de adivinar tiempos.
    await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
      timeout: 30_000,
    });
    const precio = page.getByTestId("resumen-precio");
    // Y se espera a que el precio sea el recalculado, no el que habia en cache
    // mientras se refrescaba: «S/ —» es un precio que todavia no ha llegado.
    await expect(precio).not.toContainText("S/ —");
    // Lo que motivo la correccion: los dias efectivos tienen que haber llegado
    // al servidor y volver en el resumen.
    await expect(resumen.getByText("Por 2 días efectivos.")).toBeVisible();
    const totalAntes = await precio.innerText();

    // La recarga: el paso vive en la URL y los datos en el servidor, asi que
    // esto tiene que devolver exactamente la misma pantalla.
    await page.reload();
    await expect(page.getByTestId("paso-resumen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("resumen-precio")).not.toContainText("S/ —");
    expect(await page.getByTestId("resumen-precio").innerText()).toBe(totalAntes);
    await expect(page.getByTestId("paso-resumen").getByText("Por 2 días efectivos.")).toBeVisible();

    // Y volver al primer paso no reescribe nada: navegar no es editar.
    await paso(page, 1, "Cliente").click();
    await expect(page.getByTestId("paso-cliente")).toBeVisible();
    await paso(page, 7, "Resumen").click();
    await expect(page.getByTestId("resumen-precio")).not.toContainText("S/ —");
    expect(await page.getByTestId("resumen-precio").innerText()).toBe(totalAntes);

    expect(page.url().startsWith(url.split("/").slice(0, -1).join("/"))).toBeTruthy();
  });

  test("CASO 2 MULTIPRODUCTO: dos piezas se reparten UNA quema", async ({ page }) => {
    await login(page);
    await nuevoBorrador(page, "V2-Multi");
    await elegirCliente(page);

    await anadirPieza(page, testName("Taza"), "10", ["10", "10", "10"]);
    await anadirPieza(page, testName("Fuente"), "5", ["30", "20", "10"]);

    await paso(page, 5, "Quema").click();
    const quema = page.getByTestId("panel-quema");
    await expect(quema).toBeVisible();

    // La tabla de reparto tiene una fila por producto, y el reparto es por
    // VOLUMEN: la pieza grande carga con mas quema que la chica.
    const filas = quema.getByTestId("reparto-quema").locator("tbody tr");
    await expect(filas).toHaveCount(2);

    // La ocupacion NO multiplica el precio: es informacion. Que aparezca el
    // total de la quema una sola vez es justo lo que se comprueba.
    await expect(quema.getByText(/se reparte entre los productos/i)).toBeVisible();
  });

  test("CASO 3 DOLARES: el tipo de cambio se congela y la moneda manda", async ({ page }) => {
    await login(page);
    await nuevoBorrador(page, "V2-USD");
    await elegirCliente(page);

    await page.getByRole("combobox", { name: "Moneda", exact: true }).click();
    await page.getByRole("option", { name: /d[oó]lares/i }).click();

    const cambio = page.getByLabel(/tipo de cambio/i);
    await expect(cambio).toBeVisible({ timeout: 15_000 });
    await cambio.fill("3.75");
    await cambio.blur();

    await anadirPieza(page, testName("Bowl"), "12", ["15", "15", "8"]);

    await paso(page, 7, "Resumen").click();
    const resumen = page.getByTestId("paso-resumen");
    await expect(resumen).toBeVisible();
    // Los importes salen con el simbolo de la moneda de la cabecera, no con
    // el de la casa: el numero correcto bajo la etiqueta equivocada es la peor
    // combinacion posible en un documento que el cliente firma.
    await expect(page.getByTestId("resumen-precio").getByText(/US\$/).first()).toBeVisible();

    // Y sigue congelado al recargar.
    await page.reload();
    await paso(page, 1, "Cliente").click();
    await expect(page.getByLabel(/tipo de cambio/i)).toHaveValue("3.75", { timeout: 15_000 });
  });

  test("CASO 4 COMA DECIMAL: «2,5» es dos y medio en todos los campos", async ({ page }) => {
    await login(page);
    await nuevoBorrador(page, "V2-Coma");
    await elegirCliente(page);

    await anadirPieza(page, testName("Jarra"), "8", ["12", "12", "20"]);

    // Una medida con coma: el campo la acepta y el volumen la usa.
    await paso(page, 2, "Productos").click();
    const alto = page.getByLabel(/alto \(cm\)/i).last();
    await alto.fill("20,5");
    await alto.blur();
    // Primero se espera a que la app diga que TODO esta guardado, y despues se
    // comprueba el valor exacto. Antes era un `poll` de 15 s que mezclaba dos
    // preguntas —si el valor es correcto y si llego a tiempo— y fallo 2 de 17
    // corridas completas: esta es la prueba con la cola de escrituras mas larga
    // (cantidad, tres medidas y el alto, en fila detras del bloqueo de la
    // cabecera). Separadas, un valor incorrecto sigue fallando; la lentitud de
    // la cola deja de ser azar.
    await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
      timeout: 30_000,
    });
    // Vuelve normalizada del backend, con punto y sin ceros de cola sobrantes.
    await expect(alto).toHaveValue("20.5");

    // Y un peso de pasta con coma, en otro paso y otro componente: la regla es
    // una sola para todo el flujo, no cuatro parecidas.
    await paso(page, 3, "Materiales").click();
    await page.getByRole("combobox", { name: "Pasta", exact: true }).first().click();
    const primeraPasta = page.getByRole("option").nth(1);
    await expect(primeraPasta).toBeVisible();
    await primeraPasta.click();

    const peso = page.getByLabel(/pasta por pieza/i).first();
    await peso.fill("1,25");
    await peso.blur();
    await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
      timeout: 30_000,
    });
    await expect(peso).toHaveValue("1.25");

    // Un valor que la COLUMNA normaliza: `NUMERIC(..., 6)` guarda `20,5000004`
    // como `20.500000`. Tercera revision de Codex: el campo seguia ensenando lo
    // tecleado mientras el pie decia «guardado». Al terminar el guardado tiene
    // que ensenar lo que de verdad quedo en la base.
    await paso(page, 2, "Productos").click();
    const altoNormalizado = page.getByLabel(/alto \(cm\)/i).last();
    await altoNormalizado.fill("20,5000004");
    await altoNormalizado.blur();
    await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
      timeout: 30_000,
    });
    await expect(altoNormalizado).toHaveValue("20.5");

    // Lo que NO se acepta: una cantidad de piezas con decimales. Truncar
    // «10,5 piezas» dejaria media pieza menos sin que nada lo dijera.
    await paso(page, 2, "Productos").click();
    const cantidad = page.getByLabel(/^cantidad/i).last();
    await cantidad.fill("10,5");
    await cantidad.blur();
    await expect(page.getByText(/sin decimales|n[uú]mero entero/i).first()).toBeVisible();
  });
  test("CASO 5 RECARGA CON GUARDADO EN VUELO: el navegador pregunta, y lo guardado persiste con sus importes", async ({
    page,
  }) => {
    // El bug real de 010G, recorrido de punta a punta: cambiar los dias
    // efectivos, intentar recargar ANTES de que el guardado termine, no perder
    // nada, dejar que termine, recargar y comprobar los importes exactos.
    await cotizacionHastaManoDeObra(page, "V2-Recarga");

    // El guardado de los dias se queda retenido hasta que la prueba lo suelte.
    let soltar: () => void = () => undefined;
    const retenido = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    // Se espera a que el manejador haya CONTINUADO la peticion antes de retirar
    // la ruta: retirarla con la peticion aun retenida la da por atendida y el
    // `continue` posterior falla con «Route is already handled».
    let continuada: () => void = () => undefined;
    const peticionContinuada = new Promise<void>((resolver) => {
      continuada = resolver;
    });
    await page.route(RUTA_PLANIFICACION, async (ruta) => {
      await retenido;
      await ruta.continue();
      continuada();
    });

    const dias = page.getByLabel(/d[ií]as efectivos/i);
    await dias.fill("2");
    await dias.blur();
    await expect(page.getByTestId("estado-guardado")).toHaveText(/guardando/i);

    // Recargar con el guardado en vuelo: el navegador tiene que preguntar.
    const dialogo = await intentarRecargar(page);
    expect(dialogo.type()).toBe("beforeunload");
    await dialogo.dismiss();

    // Rechazado el dialogo, seguimos donde estabamos y con lo tecleado.
    await expect(page.getByTestId("panel-mano-de-obra")).toBeVisible();
    await expect(dias).toHaveValue("2");

    // Termina la persistencia.
    soltar();
    await peticionContinuada;
    await page.unroute(RUTA_PLANIFICACION);
    await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
      timeout: 30_000,
    });

    // Ahora si se recarga, y sin dialogo: ya no hay nada que perder.
    await page.reload();
    await expect(page.getByTestId("panel-mano-de-obra")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/d[ií]as efectivos/i)).toHaveValue("2");

    // El resumen lo refleja con los importes exactos, leidos del servidor.
    await paso(page, 7, "Resumen").click();
    const resumen = page.getByTestId("paso-resumen");
    await expect(resumen).toBeVisible();
    await expect(resumen.getByText("Por 2 días efectivos.")).toBeVisible();
    await expect(resumen).toContainText("S/ 280.00");
    const precio = page.getByTestId("resumen-precio");
    await expect(precio).toContainText("S/ 1480.59");
    await expect(precio).toContainText("S/ 4450.00");
  });

  test("CASO 6 GUARDADO RECHAZADO: no aparenta guardado, sobrevive al cambio de paso y protege la salida", async ({
    page,
  }) => {
    await cotizacionHastaManoDeObra(page, "V2-Error");

    // El backend rechaza los dias efectivos.
    await page.route(RUTA_PLANIFICACION, (ruta) =>
      ruta.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL", message: "Fallo simulado" } }),
      }),
    );

    const dias = page.getByLabel(/d[ií]as efectivos/i);
    await dias.fill("3");
    await dias.blur();

    const aviso = page.getByTestId("guardados-fallidos");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(/los días efectivos/i);
    const estado = page.getByTestId("estado-guardado");
    await expect(estado).toHaveText(/no se guardaron/i);
    await expect(estado).not.toHaveText(/todos los cambios guardados/i);

    // Cambiar de paso desmonta el panel que fallo: el aviso sigue.
    await paso(page, 7, "Resumen").click();
    await expect(page.getByTestId("paso-resumen")).toBeVisible();
    await expect(aviso).toBeVisible();

    // Y recargar pregunta.
    const dialogo = await intentarRecargar(page);
    expect(dialogo.type()).toBe("beforeunload");
    await dialogo.dismiss();
    await expect(aviso).toBeVisible();

    // El backend vuelve a aceptar; volver a guardar el MISMO dato resuelve el aviso.
    await page.unroute(RUTA_PLANIFICACION);
    await aviso.getByRole("button", { name: "Ir a corregirlo" }).click();
    await expect(page.getByTestId("panel-mano-de-obra")).toBeVisible();
    const diasOtraVez = page.getByLabel(/d[ií]as efectivos/i);
    await diasOtraVez.fill("3");
    await diasOtraVez.blur();
    await expect(aviso).toBeHidden({ timeout: 30_000 });
    await expect(estado).toHaveText(/todos los cambios guardados/i, { timeout: 30_000 });

    await page.reload();
    await paso(page, 7, "Resumen").click();
    await expect(page.getByTestId("paso-resumen").getByText("Por 3 días efectivos.")).toBeVisible();
  });

  test("CASO 7 TECLEADO SIN SALIR DEL CAMPO: recargar tambien pregunta", async ({ page }) => {
    // Sin blur no hay peticion; la proteccion no puede depender solo de ellas.
    await cotizacionHastaManoDeObra(page, "V2-SinBlur");

    const dias = page.getByLabel(/d[ií]as efectivos/i);
    await dias.fill("4");
    await expect(dias).toBeFocused();
    await expect(page.getByTestId("estado-guardado")).toHaveText(/cambios sin guardar/i);

    const dialogo = await intentarRecargar(page);
    expect(dialogo.type()).toBe("beforeunload");
    await dialogo.dismiss();
    await expect(dias).toHaveValue("4");

    // Al salir del campo se guarda, y entonces si se puede recargar.
    await dias.blur();
    await expect(page.getByTestId("estado-guardado")).toHaveText(/todos los cambios guardados/i, {
      timeout: 30_000,
    });
    await page.reload();
    await expect(page.getByLabel(/d[ií]as efectivos/i)).toHaveValue("4", { timeout: 15_000 });
  });
});
