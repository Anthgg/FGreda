import { expect, type Page } from "@playwright/test";

export const W3_VIEWPORT_WIDTHS = [375, 768, 1024, 1440] as const;

/** Structural Playwright checks for names, labels, dialogs, and visible focus. */
export async function assertW3AccessibleControls(page: Page, surface: string): Promise<void> {
  await page.keyboard.press("Tab");
  const findings = await page.evaluate(() => {
    const visible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" &&
        (element as HTMLElement).offsetParent !== null;
    };
    const referencedText = (element: Element, attribute: string): string =>
      (element.getAttribute(attribute) ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
    const accessibleName = (element: Element): string =>
      element.getAttribute("aria-label")?.trim() ||
      referencedText(element, "aria-labelledby") ||
      element.getAttribute("title")?.trim() ||
      element.textContent?.trim() || "";

    const unnamedButtons = Array.from(document.querySelectorAll("button,[role=button]"))
      .filter((element) => visible(element) && !accessibleName(element))
      .map((element) => element.outerHTML.slice(0, 160));
    const unlabeledControls = Array.from(
      document.querySelectorAll("input,textarea,select,[role=combobox]")
    ).filter((element) => {
      if (!visible(element)) return false;
      const type = (element.getAttribute("type") ?? "").toLowerCase();
      if (["hidden", "submit", "button"].includes(type)) return false;
      const htmlControl = element as HTMLInputElement;
      return !accessibleName(element) && !(htmlControl.labels?.length) && !element.closest("label");
    }).map((element) => element.outerHTML.slice(0, 160));
    const unnamedDialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
      .filter((element) => visible(element) && !accessibleName(element))
      .map((element) => element.outerHTML.slice(0, 160));
    const unassociatedErrors = Array.from(document.querySelectorAll('[aria-invalid="true"]'))
      .filter((element) => {
        const ids = (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
        return ids.length === 0 || ids.every((id) => !document.getElementById(id));
      })
      .map((element) => element.outerHTML.slice(0, 160));
    const active = document.activeElement;
    const focusedInDialog = !document.querySelector('[role="dialog"]') ||
      Boolean(active && document.querySelector('[role="dialog"]')?.contains(active));
    const visibleFocus = Boolean(active && active !== document.body && visible(active));
    return { unnamedButtons, unlabeledControls, unnamedDialogs, unassociatedErrors, focusedInDialog, visibleFocus };
  });

  expect(findings.unnamedButtons, `${surface}: botones sin nombre`).toEqual([]);
  expect(findings.unlabeledControls, `${surface}: controles sin etiqueta`).toEqual([]);
  expect(findings.unnamedDialogs, `${surface}: diálogos sin nombre`).toEqual([]);
  expect(findings.unassociatedErrors, `${surface}: errores sin aria-describedby válido`).toEqual([]);
  expect(findings.visibleFocus, `${surface}: foco ausente u oculto`).toBe(true);
  expect(findings.focusedInDialog, `${surface}: foco fuera del diálogo modal`).toBe(true);

  const dialog = page.locator('[role="dialog"]:visible').last();
  if (await dialog.count()) {
    const focusable = dialog.locator(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const focusableCount = await focusable.count();
    expect(focusableCount, `${surface}: diálogo con controles enfocables`).toBeGreaterThan(0);
    const first = focusable.first();
    const last = focusable.nth(focusableCount - 1);
    await last.focus();
    await page.keyboard.press("Tab");
    await expect(first, `${surface}: Tab envuelve al primer control`).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(last, `${surface}: Shift+Tab envuelve al último control`).toBeFocused();
  }
}

export async function assertW3Responsive(page: Page, surface: string): Promise<void> {
  for (const width of W3_VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth, `${surface}: overflow horizontal a ${width}px`).toBeLessThanOrEqual(width);
  }
}
