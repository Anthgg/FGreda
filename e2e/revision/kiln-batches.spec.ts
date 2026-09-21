import { expect, test } from "@playwright/test";

import { login } from "../helpers/auth";

type KilnBatchPage = {
  items: Array<{ code: string }>;
  total: number;
};

test.describe("Planificacion de hornadas (Fase 010L)", () => {
  test("abre la pantalla y renderiza el listado respaldado por la API", async ({ page }) => {
    await login(page);

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/kiln-batches") &&
        response.request().method() === "GET" &&
        !response.url().includes("/production-orders/"),
    );
    await page.goto("/produccion/hornadas");

    await expect(page.getByRole("heading", { name: "Hornadas." })).toBeVisible();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const payload = (await response.json()) as KilnBatchPage;
    expect(payload).toEqual(expect.objectContaining({ items: expect.any(Array), total: expect.any(Number) }));

    if (payload.items.length === 0) {
      await expect(page.getByText("No hay hornadas con esos filtros.")).toBeVisible();
    } else {
      await expect(page.getByText(payload.items[0]!.code, { exact: true })).toBeVisible();
    }
  });
});
