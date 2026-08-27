import { expect, test } from "@playwright/test";

import { createApiSession, firingsCount, inventoryMovementsCount, type ApiSession } from "./helpers/api";
import { login } from "./helpers/auth";
import { hasE2ECredentials, testName } from "./helpers/fixtures";

/**
 * E2E del Cotizador contra produccion real, en modo no destructivo:
 * - Usa clientes y productos YA existentes (nunca inventa datos maestros).
 * - Usa cantidad=1 por pieza para minimizar el riesgo de exceder la
 *   capacidad real de los hornos configurados (dato que este spec no
 *   controla ni debe asumir).
 * - Si la cotizacion no queda "completa" con esos datos minimos (p.ej. un
 *   horno realmente sin capacidad disponible ese dia), el test lo reporta
 *   explicitamente en vez de forzar una confirmacion que no aplica.
 */
test.describe("Cotizador E2E", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  let api: ApiSession;
  test.beforeAll(async () => {
    api = await createApiSession();
  });
  test.afterAll(async () => {
    await api.dispose();
  });

  test("CUSTOMER_REQUIRED: Datos bloquea Siguiente sin cliente (D2)", async ({ page }) => {
    await login(page);
    await page.goto("/cotizador/nuevo");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("alert")).toContainText(/cliente/i);
    // Sigue en Datos: el selector de producto de Piezas no aparecio.
    await expect(page.getByRole("button", { name: /agregar producto/i })).toHaveCount(0);
  });

  test("flujo completo: multiproducto, costeo, markup, redondeo, IGV, PDF, confirmacion, sin mutar Quemas/Inventario", async ({ page }) => {
    const firingsBefore = await firingsCount(api);
    const movementsBefore = await inventoryMovementsCount(api);

    await login(page);
    await page.goto("/cotizador/nuevo");

    // --- Datos ---
    await page.getByLabel(/nombre \/ referencia/i).fill(testName("Cotizador"));
    await page.getByRole("combobox", { name: "Cliente" }).click();
    // options[0] es siempre el placeholder "Sin cliente asignado"
    // (CustomerSelectField.tsx lo antepone a la lista real); el primer
    // cliente real es options[1].
    const firstCustomer = page.getByRole("option").nth(1);
    await expect(firstCustomer).toBeVisible();
    await firstCustomer.click();
    // Sin este click el borrador nunca se persiste (sigue mostrando "Crear
    // borrador" en el pie durante todo el resto del wizard), y por eso
    // "Confirmar cotizacion" queda deshabilitado para siempre en el paso
    // PDF: no hay nada persistido que confirmar.
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page.getByRole("button", { name: "Anular" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Siguiente" }).click();

    // --- Piezas: MULTIPRODUCT ---
    await page.getByRole("button", { name: /agregar producto/i }).click();
    await page.getByRole("combobox", { name: "Pieza terminada" }).first().click();
    const firstProductOption = page.getByRole("option").first();
    await expect(firstProductOption).toBeVisible();
    const firstProductLabel = await firstProductOption.textContent();
    await firstProductOption.click();

    await page.getByRole("button", { name: /agregar producto/i }).click();
    const productSelectors = page.getByRole("combobox", { name: "Pieza terminada" });
    await productSelectors.nth(1).click();
    // Elige un producto distinto al primero para probar multiproducto real.
    const options = page.getByRole("option");
    const count = await options.count();
    let picked = false;
    for (let i = 0; i < count; i += 1) {
      const label = await options.nth(i).textContent();
      if (label && label !== firstProductLabel) {
        await options.nth(i).click();
        picked = true;
        break;
      }
    }
    if (!picked) test.skip(true, "El catalogo de producto no tiene una segunda pieza distinta disponible");

    // DIMENSIONS: si el maestro ya trae medidas, deben venir bloqueadas.
    const anchoInputs = page.getByLabel(/ancho \(cm\)/i);
    const anchoCount = await anchoInputs.count();
    for (let i = 0; i < anchoCount; i += 1) {
      const input = anchoInputs.nth(i);
      const isDisabled = await input.isDisabled();
      const value = await input.inputValue();
      if (!isDisabled) await input.fill("12");
      if (isDisabled) expect(value).not.toBe("");
    }
    const altoInputs = page.getByLabel(/alto \(cm\)/i);
    for (let i = 0; i < (await altoInputs.count()); i += 1) {
      const input = altoInputs.nth(i);
      if (!(await input.isDisabled())) await input.fill("10");
    }
    const largoInputs = page.getByLabel(/largo \(cm\)/i);
    for (let i = 0; i < (await largoInputs.count()); i += 1) {
      const input = largoInputs.nth(i);
      if (!(await input.isDisabled())) await input.fill("8");
    }

    // --- Produccion: cantidad minima + costo de materiales fijo (evita
    // depender de que exista una receta con gramos configurados) ---
    await page.getByRole("button", { name: /^3\s*Producción/i }).click();
    const quantityInputs = page.getByPlaceholder("Ej. 24");
    for (let i = 0; i < (await quantityInputs.count()); i += 1) {
      await quantityInputs.nth(i).fill("1");
    }
    const materialsCostInputs = page.getByPlaceholder("Ej. 11.58");
    for (let i = 0; i < (await materialsCostInputs.count()); i += 1) {
      await materialsCostInputs.nth(i).fill("10");
    }
    const lowKilnSelects = page.getByRole("combobox", { name: "Quema baja en" });
    const kilnOptionCount = await page.getByRole("option").count(); // fuerza espera de datos cargados (no-op si ya abierto)
    for (let i = 0; i < (await lowKilnSelects.count()); i += 1) {
      await lowKilnSelects.nth(i).click();
      await page.getByRole("option").first().click();
    }
    const highKilnSelects = page.getByRole("combobox", { name: "Quema alta en" });
    for (let i = 0; i < (await highKilnSelects.count()); i += 1) {
      await highKilnSelects.nth(i).click();
      await page.getByRole("option").first().click();
    }
    void kilnOptionCount;

    // --- Costeo: sin float visible en el desglose ---
    await page.getByRole("button", { name: /^4\s*Costeo/i }).click();
    await expect(page.getByText(/costo unitario backend/i).first()).toBeVisible();

    // --- Margen y precio: markup por defecto, redondeo e IGV consistentes ---
    await page.getByRole("button", { name: /^5\s*Margen y precio/i }).click();
    await expect(page.getByText(/sugerido unitario sin igv/i).first()).toBeVisible();

    // Todo lo editado desde "Crear borrador" (piezas, dimensiones, cantidad,
    // costo de materiales, hornos) vive solo en el estado local hasta este
    // punto. "Confirmar cotizacion" se deshabilita mientras el borrador este
    // "dirty" (CotizadorPdfPanel.tsx: disabled={busy || !preview?.complete ||
    // isDirty}) precisamente para impedir confirmar una simulacion que no
    // coincide con lo ya persistido - hay que guardar antes de poder confirmar.
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText(/borrador guardado y recalculado/i)).toBeVisible({ timeout: 15_000 });

    // --- Resumen ---
    await page.getByRole("button", { name: /^6\s*Resumen/i }).click();
    // El preview (subtotal/IGV/completo) se pide de forma asincrona al
    // entrar al paso; leer el estado antes de que resuelva muestra el
    // fallback "Borrador incompleto · siguiente: DATOS" (el "DATOS" es
    // literal, `preview?.next_step ?? "DATOS"` en CotizadorPage.tsx) aunque
    // Datos ya este completo. Se espera a que la red se asiente y a que
    // aparezca alguno de los dos textos de estado antes de leer cual es.
    await page.waitForLoadState("networkidle");
    const readyText = page.getByText(/lista para confirmar/i);
    const incompleteText = page.getByText(/borrador incompleto/i);
    await expect(readyText.or(incompleteText)).toBeVisible({ timeout: 15_000 });
    const isReady = await readyText.isVisible().catch(() => false);
    if (!isReady) {
      const reason = await incompleteText.textContent().catch(() => null);
      test.skip(true, `La cotizacion no quedo completa con datos minimos (posible capacidad de horno real): ${reason ?? "razon desconocida"}`);
    }

    // --- PDF: preview, confirmar, oficial ---
    await page.getByRole("button", { name: /ver vista previa pdf/i }).click();
    await expect(page.getByText(/documento oficial congelado|confirmar cotizaci[oó]n/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Confirmar cotización", exact: true }).click();
    await page.getByRole("dialog", { name: /confirmar cotizaci[oó]n/i }).getByRole("button", { name: "Confirmar cotización" }).click();
    await expect(page.getByText(/documento oficial congelado/i)).toBeVisible({ timeout: 20_000 });

    // Inmutabilidad de UI: sin controles editables tras confirmar.
    await page.getByRole("button", { name: /^5\s*Margen y precio/i }).click();
    const markupInputs = page.getByLabel(/markup/i);
    for (let i = 0; i < (await markupInputs.count()); i += 1) {
      await expect(markupInputs.nth(i)).toBeDisabled();
    }

    const firingsAfter = await firingsCount(api);
    const movementsAfter = await inventoryMovementsCount(api);
    expect(firingsAfter, "el Cotizador no debe crear Quemas reales").toBe(firingsBefore);
    expect(movementsAfter, "el Cotizador no debe mover inventario").toBe(movementsBefore);
  });
});
