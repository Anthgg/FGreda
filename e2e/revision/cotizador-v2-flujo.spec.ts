import { expect, test, type Page } from "@playwright/test";

import { login } from "../helpers/auth";
import { testName } from "../helpers/fixtures";
import {
  anadirPieza,
  botonDePaso,
  campo,
  configurarTiempoYMoldes,
  elegirArcilla,
  esperarGuardado,
  estadoDeGuardado,
  intentarRecargar,
  irAPaso,
  nuevoBorrador,
  tituloDelPaso,
} from "./support/cotizadorV2Ui";

/**
 * Fase 010G — el flujo de siete pasos del Cotizador V2, contra LA REVISIÓN.
 * Reescrita en el corte 010O.13 para la interfaz rediseñada: mismas garantías,
 * otra pantalla.
 *
 * Estas pruebas NO corren contra producción. Viven en `e2e/revision/`, que el
 * smoke de producción ignora, y las ejecuta `playwright.revision.config.ts`
 * contra la aplicación construida desde la propia rama y un backend levantado
 * desde la revisión compatible.
 *
 * Lo que solo se rompe de punta a punta, porque en las pruebas de componente el
 * backend es una respuesta escrita a mano:
 *
 * 1. **el flujo completo y su recarga**: nada se pierde al navegar ni al recargar;
 * 2. **multiproducto**: dos piezas, una sola quema repartida entre ellas;
 * 3. **dólares**: el tipo de cambio se congela y la moneda manda;
 * 4. **coma decimal**: «2,5» es dos y medio en todos los campos;
 * 5–7. **guardados**: en vuelo, rechazados o sin salir del campo, la salida
 *    está protegida y nada aparenta estar guardado cuando no lo está.
 *
 * Política no destructiva heredada de 009A: todo lo que se crea lleva el
 * prefijo E2E- y nada se borra.
 */

const RUTA_PIEZA = "**/api/v1/quotations-v2/*/products/*";

/**
 * Una cotización con una pieza y el horno por defecto, en el paso Trabajo.
 *
 * Los importes esperados salen de la siembra del backend de revisión y de las
 * reglas del Excel final (010J): 20 piezas de 18 × 12 × 3 con 3 cm de
 * separación ocupan 20 × 21 × 15 × 6 = 37.800 cm³, el 222,35 % del horno chico.
 * En quema COMPARTIDA se cobran 2,2235 hornadas a 200 + 250: S/1000,59.
 * Espacio a S/140 por día, administración S/200, factor ×3. Con 2 días:
 * producción 1000,59 + 280 + 200 = S/1480,59; ×3 = 4441,76; unitario 222,09
 * que sube al escalón de S/0,50: 222,50 × 20 = S/4450.
 */
async function cotizacionHastaPiezas(page: Page, etiqueta: string) {
  await login(page);
  const borrador = await nuevoBorrador(page, etiqueta);
  await anadirPieza(page, testName("Plato"), "20", ["18", "12", "3"]);
  await configurarTiempoYMoldes(page, { horas: "0", minutos: "1", moldes: "1" });
  await esperarGuardado(page);
  return borrador;
}

test.describe("Cotizador V2: flujo de siete pasos (Fase 010G, interfaz 010O)", () => {
  // Sin `test.skip` por falta de credenciales: en el gate de revisión las
  // credenciales las genera el propio workflow, y si faltan la configuración
  // aborta antes de empezar. Un salto aquí convertiría un entorno roto en verde.

  test("CASO 1 FLUJO COMPLETO: los siete pasos y una recarga que no pierde nada", async ({ page }) => {
    await login(page);
    const { base } = await nuevoBorrador(page, "V2-Flujo");

    await anadirPieza(page, testName("Plato"), "20", ["18", "12", "3"]);
    await configurarTiempoYMoldes(page, { horas: "0", minutos: "2", moldes: "1" });
    await elegirArcilla(page);
    await expect(page.getByText(/no descuenta inventario/i)).toBeVisible();
    await irAPaso(page, "Horno");
    await irAPaso(page, "Precio");
    await irAPaso(page, "Revisar y emitir");

    // Se espera lo mismo que ve una persona: que el pie diga «Guardado». Esta
    // prueba encontró en 010G que recargar antes perdía los días EN SILENCIO.
    await esperarGuardado(page);
    const total = page.getByTestId("v2next-total");
    await expect(total).not.toHaveText("—");
    const totalAntes = await total.innerText();

    // La recarga: el paso vive en la URL y los datos en el servidor.
    await page.reload();
    await expect(tituloDelPaso(page, "Revisar y emitir")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("v2next-total")).toHaveText(totalAntes);
    await expect(page).toHaveURL(new RegExp(`${base}/resumen$`));

    // El tiempo activo por pieza llegó al servidor y vuelve.
    await irAPaso(page, "Piezas");
    await expect(page.getByLabel("Minutos").first()).toHaveValue("2");

    // Y volver al primer paso no reescribe nada: navegar no es editar.
    await irAPaso(page, "Cliente");
    await irAPaso(page, "Revisar y emitir");
    await expect(page.getByTestId("v2next-total")).toHaveText(totalAntes);
    await expect(estadoDeGuardado(page)).toHaveText("Guardado");
  });

  test("CASO 2 MULTIPRODUCTO: dos piezas se reparten UNA quema", async ({ page }) => {
    await login(page);
    await nuevoBorrador(page, "V2-Multi");
    await anadirPieza(page, testName("Taza"), "10", ["10", "10", "10"]);
    await anadirPieza(page, testName("Fuente"), "5", ["30", "20", "10"]);

    // Una sola quema para las dos: el horno se llena con el volumen de ambas.
    await irAPaso(page, "Horno");
    await expect(page.getByTestId("v2next-hornos")).toBeVisible();

    // El precio reparte el costo por pieza: una fila por producto.
    await irAPaso(page, "Precio");
    const porPieza = page.getByTestId("v2next-precio-por-pieza");
    await expect(porPieza.locator("tbody tr")).toHaveCount(2);
    // La quema aparece una vez en el costo de producción, no una por pieza.
    await expect(page.getByTestId("v2next-costo").getByText("Horno (tarifa)")).toHaveCount(1);
  });

  test("CASO 3 DÓLARES: el tipo de cambio se congela y la moneda manda", async ({ page }) => {
    await login(page);
    await nuevoBorrador(page, "V2-USD");
    await irAPaso(page, "Cliente");

    await page.getByRole("radiogroup", { name: "Moneda" }).getByRole("radio", { name: "Dólares" }).click();
    const cambio = campo(page, "Tipo de cambio");
    await expect(cambio).toBeVisible({ timeout: 15_000 });
    await cambio.fill("3.75");
    await cambio.blur();
    await esperarGuardado(page);

    await anadirPieza(page, testName("Bowl"), "12", ["15", "15", "8"]);
    await irAPaso(page, "Revisar y emitir");
    // El número correcto bajo la etiqueta equivocada es lo peor que puede
    // llevar un documento que el cliente firma.
    await expect(page.getByTestId("v2next-documento-total")).toContainText("US$");

    // Y sigue congelado al recargar.
    await page.reload();
    await irAPaso(page, "Cliente");
    await expect(campo(page, "Tipo de cambio")).toHaveValue("3.75", { timeout: 15_000 });
  });

  test("CASO 4 COMA DECIMAL: «2,5» es dos y medio en todos los campos", async ({ page }) => {
    await login(page);
    await nuevoBorrador(page, "V2-Coma");
    await anadirPieza(page, testName("Jarra"), "8", ["12", "12", "20"]);

    // Una medida con coma: se espera a «Guardado» y luego al valor exacto, que
    // vuelve normalizado del backend.
    const alto = campo(page, "Alto").last();
    await alto.fill("20,5");
    await alto.blur();
    await esperarGuardado(page);
    await expect(alto).toHaveValue("20.5");

    // Un peso con coma, en otro paso y otro componente: la regla es una sola.
    await elegirArcilla(page);
    const peso = campo(page, "Arcilla por pieza").first();
    await peso.fill("1,25");
    await peso.blur();
    await esperarGuardado(page);
    await expect(peso).toHaveValue("1.25");

    // Un valor que la COLUMNA normaliza (`NUMERIC(..., 6)`): al terminar el
    // guardado el campo enseña lo que de verdad quedó en la base.
    await irAPaso(page, "Piezas");
    const altoNormalizado = campo(page, "Alto").last();
    await altoNormalizado.fill("20,5000004");
    await altoNormalizado.blur();
    await esperarGuardado(page);
    await expect(altoNormalizado).toHaveValue("20.5");

    // Una cantidad de piezas no admite decimales: truncar «10,5» dejaría media
    // pieza menos sin que nada lo dijera. El campo solo acepta dígitos.
    const cantidad = page.getByRole("textbox", { name: "Cantidad" }).last();
    await cantidad.fill("");
    await cantidad.pressSequentially("10,5");
    await expect(cantidad).not.toHaveValue(/[,.]/);
  });

  test("CASO 5 RECARGA CON GUARDADO EN VUELO: el navegador pregunta, y lo guardado persiste con sus importes", async ({
    page,
  }) => {
    const borrador = await cotizacionHastaPiezas(page, "V2-Recarga");

    // El guardado de los días se queda retenido hasta que la prueba lo suelte.
    let soltar: () => void = () => undefined;
    const retenido = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    // Se espera a que el manejador CONTINÚE la petición antes de retirar la
    // ruta: retirarla con la petición retenida la da por atendida.
    let continuada: () => void = () => undefined;
    const peticionContinuada = new Promise<void>((resolver) => {
      continuada = resolver;
    });
    await page.route(RUTA_PIEZA, async (ruta) => {
      if (ruta.request().method() !== "PUT") {
        await ruta.continue();
        return;
      }
      await retenido;
      await ruta.continue();
      continuada();
    });

    const minutos = page.getByLabel("Minutos").first();
    await minutos.fill("2");
    await minutos.blur();
    await expect(estadoDeGuardado(page)).toHaveText("Guardando…");

    // Recargar con el guardado en vuelo: el navegador tiene que preguntar.
    const dialogo = await intentarRecargar(page);
    expect(dialogo.type()).toBe("beforeunload");
    await dialogo.dismiss();
    await expect(tituloDelPaso(page, "Piezas")).toBeVisible();
    await expect(minutos).toHaveValue("2");

    soltar();
    await peticionContinuada;
    await page.unroute(RUTA_PIEZA);
    await esperarGuardado(page);

    // Ahora sí se recarga, y sin diálogo: el valor guardado vuelve del backend.
    await page.reload();
    await expect(page.getByLabel("Minutos").first()).toHaveValue("2", { timeout: 15_000 });

    // El precio que muestra React coincide con la respuesta autoritativa del backend.
    const respuesta = await page.request.get(`/api/v1/quotations-v2/${borrador.id}/pricing`);
    expect(respuesta.ok()).toBeTruthy();
    const precio = await respuesta.json();
    await page.goto(`${borrador.base}/precio`);
    const costoProduccion = await page.getByTestId("v2next-costo-produccion").innerText();
    expect(Number(costoProduccion.replace(/[^\d,.-]/g, "").replaceAll(",", ""))).toBeCloseTo(
      Number(precio.production_cost),
      2,
    );
    await page.goto(`${borrador.base}/resumen`);
    const total = await page.getByTestId("v2next-total").innerText();
    expect(Number(total.replace(/[^\d,.-]/g, "").replaceAll(",", ""))).toBeCloseTo(Number(precio.total), 2);
  });

  test("CASO 6 GUARDADO RECHAZADO: no aparenta guardado, sobrevive al cambio de paso y protege la salida", async ({
    page,
  }) => {
    await cotizacionHastaPiezas(page, "V2-Error");

    await page.route(RUTA_PIEZA, (ruta) =>
      ruta.request().method() === "PUT"
        ? ruta.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL", message: "Fallo simulado" } }),
          })
        : ruta.continue(),
    );

    const minutos = page.getByLabel("Minutos").first();
    await minutos.fill("3");
    await minutos.blur();

    const aviso = page.getByTestId("v2next-guardados-fallidos");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("Fallo simulado");
    await expect(estadoDeGuardado(page)).toHaveText("Error al guardar");

    // Cambiar de paso desmonta la tarjeta que falló: el aviso sigue.
    await irAPaso(page, "Revisar y emitir");
    await expect(aviso).toBeVisible();

    // Y recargar pregunta.
    const dialogo = await intentarRecargar(page);
    expect(dialogo.type()).toBe("beforeunload");
    await dialogo.dismiss();
    await expect(aviso).toBeVisible();

    // El backend vuelve a aceptar; guardar el MISMO dato resuelve el aviso.
    await page.unroute(RUTA_PIEZA);
    await aviso.getByRole("button", { name: "Ir a corregirlo" }).click();
    await expect(tituloDelPaso(page, "Piezas")).toBeVisible();
    const minutosOtraVez = page.getByLabel("Minutos").first();
    await minutosOtraVez.fill("3");
    await minutosOtraVez.blur();
    await expect(aviso).toBeHidden({ timeout: 30_000 });
    await esperarGuardado(page);

    await page.reload();
    await expect(page.getByLabel("Minutos").first()).toHaveValue("3", { timeout: 15_000 });
  });

  test("CASO 7 TECLEADO SIN SALIR DEL CAMPO: recargar también pregunta", async ({ page }) => {
    // Sin blur no hay petición; la protección no puede depender solo de ellas.
    await cotizacionHastaPiezas(page, "V2-SinBlur");

    const minutos = page.getByLabel("Minutos").first();
    await minutos.fill("4");
    await expect(minutos).toBeFocused();
    await expect(estadoDeGuardado(page)).toHaveText("Cambios sin guardar");

    const dialogo = await intentarRecargar(page);
    expect(dialogo.type()).toBe("beforeunload");
    await dialogo.dismiss();
    await expect(minutos).toHaveValue("4");

    // Al salir del campo se guarda, y entonces sí se puede recargar.
    await minutos.blur();
    await esperarGuardado(page);
    await page.reload();
    await expect(page.getByLabel("Minutos").first()).toHaveValue("4", { timeout: 15_000 });
    // Y la barra mantiene el paso Piezas con el valor confirmado.
    await expect(botonDePaso(page, "Piezas")).toBeVisible();
  });
});
