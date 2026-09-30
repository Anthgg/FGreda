import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const W3_VIEWPORT_WIDTHS = [375, 768, 1024, 1280, 1440] as const;

// Known W3 findings inside the unchanged ProductionOrderDetailPage. Keep
// these visible in the report and deferred to 010Q; every other serious or
// critical finding remains a W4 test failure.
const BASELINE_W3_AXE_TARGETS: Record<string, Record<string, string[]>> = {
  "diálogo y selector de lote explícito": {
    // This W3 consumption dialog is covered by the existing order detail
    // surface. These selectors are retained as known findings; any other
    // failing node in the same axe rule must still fail the W4 check.
    "color-contrast": [".text-orange-600.font-semibold", ".text-zinc-400", ".font-normal"],
  },
  "diálogo de resultados de prototipo": {
    "color-contrast": [".text-zinc-400"],
  },
  "diálogo de resultados Solo Quema": {
    "color-contrast": [".text-zinc-400"],
    "link-name": [".hover\\:text-black"],
  },
  "cotizador alta de cliente W4": {
    // The existing client selector and result labels use the same zinc-400
    // contrast debt already tracked for follow-up in 010Q. Axe reduces these
    // two dialog nodes to positional `.mt-1` selectors, so keep their complete
    // paths here instead of filtering every `.mt-1` finding on the page.
    "color-contrast": [
      ".text-zinc-400",
      ".space-y-6.custom-scrollbar.p-6 > div:nth-child(1) > div:nth-child(1) > .mt-1",
      ".space-y-6.custom-scrollbar.p-6 > div:nth-child(2) > .mt-1",
    ],
  },
};

/** Axe scan for the serious and critical WCAG A/AA findings on a live surface. */
export async function assertNoSeriousAxeViolations(page: Page, surface: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockers = violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    }));
  const baselineTargets = BASELINE_W3_AXE_TARGETS[surface] ?? {};
  const baseline: typeof blockers = [];
  const introduced: typeof blockers = [];
  for (const violation of blockers) {
    const allowedTargets = baselineTargets[violation.id] ?? [];
    const knownNodes = violation.nodes.filter((node) =>
      node.target.some((target) => allowedTargets.some((allowed) => target.includes(allowed))),
    );
    const newNodes = violation.nodes.filter((node) => !knownNodes.includes(node));
    if (knownNodes.length > 0) baseline.push({ ...violation, nodes: knownNodes });
    if (newNodes.length > 0) introduced.push({ ...violation, nodes: newNodes });
  }
  if (baseline.length > 0) {
    console.warn(`[a11y-baseline] ${surface}: ${JSON.stringify(baseline)}`);
  }
  expect(introduced, `${surface}: violaciones axe serious/critical nuevas`).toEqual([]);
}

/** Structural Playwright checks for names, labels, dialogs, and visible focus. */
export async function assertW3AccessibleControls(page: Page, surface: string): Promise<void> {
  await page.keyboard.press("Tab");
  const findings = await page.evaluate(() => {
    const visible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" &&
        element.getClientRects().length > 0;
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

  await assertNoSeriousAxeViolations(page, surface);
}

export async function assertW3Responsive(page: Page, surface: string): Promise<void> {
  for (const width of W3_VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth, `${surface}: overflow horizontal a ${width}px`).toBeLessThanOrEqual(width);
  }
}
