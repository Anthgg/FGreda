import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("Reglas estructurales de Layout y AppShell", () => {
  it("APPSHELL_FULL_HEIGHT: AppShell ocupa 100vw y 100dvh con overflow-hidden", () => {
    const content = readFileSync(join(process.cwd(), "src/layouts/AppShell.tsx"), "utf-8");
    expect(content).toContain("h-dvh");
    expect(content).toContain("w-full");
    expect(content).toContain("overflow-hidden");
  });

  it("DESKTOP_SIDEBAR_FIXED: Sidebar desktop tiene altura completa y profile fijo abajo", () => {
    const content = readFileSync(join(process.cwd(), "src/layouts/AppShell.tsx"), "utf-8");
    expect(content).toContain("shrink-0");
    expect(content).toContain("h-dvh");
    expect(content).toContain("glass-sidebar");
    expect(content).toContain("mt-auto");
  });

  it("MAIN_SCROLL_CONTAINER: Main es el único contenedor de scroll vertical con padding controlado", () => {
    const content = readFileSync(join(process.cwd(), "src/layouts/AppShell.tsx"), "utf-8");
    expect(content).toContain("flex-1");
    expect(content).toContain("min-w-0");
    expect(content).toContain("overflow-y-auto");
    expect(content).toContain("overflow-x-hidden");
    expect(content).toContain("px-4");
    expect(content).toContain("lg:px-8");
  });

  it("PAGE_CONTENT_FULL_WIDTH: Las páginas no contienen contenedores estrechos mx-auto max-w-7xl/max-w-[1536px]", () => {
    const pageFiles = [
      "src/features/masters/ProductsPage.tsx",
      "src/features/masters/PartnersPage.tsx",
      "src/features/inventory/InventoryPage.tsx",
      "src/features/recipes/RecipesPage.tsx",
      "src/features/imports/ImportsPage.tsx",
      "src/features/firings/FiringsPage.tsx",
      "src/features/firings/NuevaQuemaPage.tsx",
      "src/features/firings/DetalleQuemaPage.tsx",
      "src/features/firings/EditarQuemaPage.tsx",
      "src/features/settings/SettingsPage.tsx",
      "src/routes/HomePage.tsx",
    ];

    for (const file of pageFiles) {
      const content = readFileSync(join(process.cwd(), file), "utf-8");
      expect(content).not.toContain("max-w-[1536px]");
      expect(content).not.toContain("max-w-7xl");
      expect(content).not.toContain("max-w-5xl");
    }
  });

  it("NATIVE_SELECT_COUNT: No existen elementos select nativos en el código fuente de componentes", () => {
    function getFiles(dir: string): string[] {
      const entries = readdirSync(dir);
      const results: string[] = [];
      for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          results.push(...getFiles(full));
        } else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx") && !full.endsWith(".spec.tsx")) {
          results.push(full);
        }
      }
      return results;
    }

    const tsxFiles = getFiles(join(process.cwd(), "src"));
    for (const file of tsxFiles) {
      const content = readFileSync(file, "utf-8");
      // Verifica que no haya <select> nativo
      expect(content).not.toMatch(/<select[\s>]/);
    }
  });

  it("NATIVE_DATE_INPUT_COUNT: No existen inputs nativos type=\"date\" en el código fuente de componentes", () => {
    function getFiles(dir: string): string[] {
      const entries = readdirSync(dir);
      const results: string[] = [];
      for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          results.push(...getFiles(full));
        } else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx") && !full.endsWith(".spec.tsx")) {
          results.push(full);
        }
      }
      return results;
    }

    const tsxFiles = getFiles(join(process.cwd(), "src"));
    for (const file of tsxFiles) {
      const content = readFileSync(file, "utf-8");
      // Verifica que no haya <input ... type="date">
      expect(content).not.toMatch(/<input[\s\S]*?type=["']date["']/);
    }
  });
});

