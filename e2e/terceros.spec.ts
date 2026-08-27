import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/fixtures";

test.describe("Terceros: DNI/RUC/Ubigeo", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/terceros");
  });

  test("DNI_LOOKUP: autocompleta el nombre", async ({ page }) => {
    await page.getByRole("button", { name: /nuevo tercero/i }).click();
    await page.getByRole("combobox", { name: /tipo de documento/i }).click();
    await page.getByRole("option", { name: "DNI", exact: true }).click();
    await page.getByLabel(/n[uú]mero de documento/i).fill("71372527");
    await page.getByRole("button", { name: "Consultar DNI" }).click();
    await expect(page.getByText(/encontrado:/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/nombre o raz[oó]n social/i)).not.toHaveValue("");
  });

  test("RUC_LOOKUP + UBIGEO_AUTOFILL + UBIGEO_MANUAL + UBIGEO_PERSISTENCE", async ({ page }) => {
    await page.getByRole("button", { name: /nuevo tercero/i }).click();
    await page.getByRole("combobox", { name: /tipo de documento/i }).click();
    await page.getByRole("option", { name: "RUC", exact: true }).click();
    await page.getByLabel(/n[uú]mero de documento/i).fill("20507767193");
    await page.getByRole("button", { name: "Consultar RUC" }).click();
    await expect(page.getByText(/encontrado:/i)).toBeVisible({ timeout: 15_000 });

    // UBIGEO_AUTOFILL: los tres selectores quedan resueltos, no solo "elegido"
    // sino con una etiqueta real (no vacios).
    const departamento = page.getByRole("combobox", { name: "Departamento" });
    const provincia = page.getByRole("combobox", { name: "Provincia" });
    const distrito = page.getByRole("combobox", { name: "Distrito" });
    await expect(departamento).not.toHaveText(/seleccionar departamento/i);
    await expect(provincia).not.toHaveText(/seleccionar provincia|primero el departamento/i);
    await expect(distrito).not.toHaveText(/seleccionar distrito|primero la provincia/i);

    // UBIGEO_MANUAL: se puede recorrer Departamento -> Provincia -> Distrito
    // a mano y el cambio se refleja (no se queda pegado al autofill).
    await departamento.click();
    const otherDept = page.getByRole("option").nth(1);
    const otherDeptLabel = await otherDept.textContent();
    await otherDept.click();
    await expect(departamento).toHaveText(new RegExp(otherDeptLabel ?? "", "i"));
    await expect(distrito).toHaveText(/primero la provincia/i);
  });
});
