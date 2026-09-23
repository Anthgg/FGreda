import { chromium } from "@playwright/test";

const TARGET_URL = process.env.AUDIT_TARGET_URL || "http://localhost:4173/produccion/hornadas/1/mapa";

console.log(`[AUDIT PRECHECK] Iniciando verificación de página en ${TARGET_URL} ...`);

try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(TARGET_URL, { waitUntil: "networkidle" });

  const pathname = await page.evaluate(() => window.location.pathname);
  const bodyText = await page.innerText("body");

  console.log(`[AUDIT PRECHECK] Pathname actual: ${pathname}`);

  // 1. Verificación de redirección
  if (pathname.includes("/login")) {
    console.error("[AUDIT PRECHECK FAIL] Redirigido a la página de login (/login).");
    await browser.close();
    process.exit(1);
  }

  // 2. Verificación de mensaje de error de servidor
  if (bodyText.includes("No se pudo contactar con el servidor")) {
    console.error("[AUDIT PRECHECK FAIL] Mensaje de error de servidor presente en pantalla.");
    await browser.close();
    process.exit(1);
  }

  // 3. Verificación de elementos visuales del mapa
  const svg = await page.$("svg");
  const tablist = await page.$('[role="tablist"]');
  const suggestBtn = await page.$('button:has-text("Sugerir acomodo")');
  const saveBtn = await page.$('button:has-text("Guardar distribución")');
  const placements = await page.$$('[role="button"][aria-label*="Taza de café"], [role="button"][aria-label*="OP #"]');
  const hasBatchCode = bodyText.includes("KB-2026-000001");

  console.log(`[AUDIT PRECHECK] SVG presente: ${!!svg}`);
  console.log(`[AUDIT PRECHECK] Tablist de niveles presente: ${!!tablist}`);
  console.log(`[AUDIT PRECHECK] Botón 'Sugerir acomodo': ${!!suggestBtn}`);
  console.log(`[AUDIT PRECHECK] Botón 'Guardar distribución': ${!!saveBtn}`);
  console.log(`[AUDIT PRECHECK] Placements en lienzo: ${placements.length}`);
  console.log(`[AUDIT PRECHECK] Código de hornada (KB-2026-000001): ${hasBatchCode}`);

  if (
    pathname === "/produccion/hornadas/1/mapa" &&
    !!svg &&
    !!tablist &&
    !!suggestBtn &&
    !!saveBtn &&
    placements.length >= 1 &&
    hasBatchCode
  ) {
    console.log("[AUDIT PRECHECK PASS] Mapa interactivo real verificado con éxito.");
    await browser.close();
    process.exit(0);
  } else {
    console.error("[AUDIT PRECHECK FAIL] Elementos obligatorios del mapa ausentes.");
    await browser.close();
    process.exit(1);
  }
} catch (err) {
  console.error("[AUDIT PRECHECK ERROR]", err);
  process.exit(1);
}
