import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/fixtures";

/**
 * Fase 009A — accesibilidad basica (no un audit completo axe-core): botones
 * sin nombre accesible, inputs sin etiqueta, y que Tab no deje el foco
 * "perdido" (fuera del documento o en un elemento invisible).
 */

const PAGES: Array<{ label: string; path: string }> = [
  { label: "Inicio", path: "/" },
  { label: "Cotizador", path: "/cotizador/nuevo" },
  { label: "Cotizaciones", path: "/cotizaciones" },
  { label: "Productos", path: "/productos" },
  { label: "Inventario", path: "/inventario" },
  { label: "Recetas", path: "/recetas" },
];

test.describe("Accesibilidad basica", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  for (const { label, path } of PAGES) {
    test(`${label}: botones e inputs tienen nombre accesible`, async ({ page }) => {
      await login(page);
      await page.goto(path, { waitUntil: "networkidle" });

      const unnamedButtons = await page.evaluate(() => {
        const hasAccessibleName = (el: Element): boolean => {
          if (el.getAttribute("aria-label")?.trim()) return true;
          if (el.getAttribute("aria-labelledby")) return true;
          if (el.getAttribute("title")?.trim()) return true;
          return (el.textContent ?? "").trim().length > 0;
        };
        return Array.from(document.querySelectorAll("button"))
          .filter((btn) => {
            const style = window.getComputedStyle(btn);
            const visible = style.display !== "none" && style.visibility !== "hidden" && btn.offsetParent !== null;
            return visible && !hasAccessibleName(btn);
          })
          .map((btn) => btn.outerHTML.slice(0, 150));
      });

      const unlabeledInputs = await page.evaluate(() => {
        const hasLabel = (el: HTMLElement): boolean => {
          if (el.getAttribute("aria-label")?.trim()) return true;
          if (el.getAttribute("aria-labelledby")) return true;
          const id = el.getAttribute("id");
          if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return true;
          if (el.closest("label")) return true;
          return false;
        };
        const controls = Array.from(document.querySelectorAll("input, textarea, select")) as HTMLElement[];
        return controls
          .filter((el) => {
            const type = (el.getAttribute("type") ?? "").toLowerCase();
            if (["hidden", "submit", "button"].includes(type)) return false;
            const style = window.getComputedStyle(el);
            const visible = style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
            return visible && !hasLabel(el);
          })
          .map((el) => el.outerHTML.slice(0, 150));
      });

      expect(unnamedButtons, `botones sin nombre accesible en ${label}`).toEqual([]);
      expect(unlabeledInputs, `inputs sin etiqueta en ${label}`).toEqual([]);
    });
  }

  test("Inicio: Tab no pierde el foco (permanece en un elemento visible del documento)", async ({ page }) => {
    await login(page);
    await page.goto("/", { waitUntil: "networkidle" });

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          visible: style.display !== "none" && style.visibility !== "hidden",
        };
      });
      expect(focused, `foco perdido tras ${i + 1} Tab(s)`).not.toBeNull();
      expect(focused?.visible, `foco en elemento invisible tras ${i + 1} Tab(s)`).toBe(true);
    }
  });
});
