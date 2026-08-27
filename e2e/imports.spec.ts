import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/fixtures";

test.describe("Importaciones", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/importaciones");
  });

  test("archivo corrupto: error controlado, nunca 500 (no se confirma nada)", async ({ page }) => {
    const responses: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/imports")) responses.push(response.status());
    });

    await page.getByLabel("Archivo de maestros").setInputFiles({
      name: "corrupto.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("esto no es un xlsx real, solo texto plano"),
    });

    // El backend debe rechazar con un 4xx controlado y la UI debe mostrarlo,
    // nunca un 500 ni un crash silencioso.
    await expect(page.getByText(/no se pudo|invalido|inv[aá]lido|error/i).first()).toBeVisible({ timeout: 15_000 });
    expect(responses.some((status) => status >= 500)).toBe(false);

    // Nada de esto debe llegar a un boton de confirmacion real.
    await expect(page.getByRole("button", { name: /confirmar importaci[oó]n/i })).toHaveCount(0);
  });
});
