import { chromium } from "@playwright/test";

const TARGET_URL = process.env.AUDIT_TARGET_URL || "http://localhost:4173/produccion/hornadas/1/mapa";

console.log(`[AUDIT PRECHECK] Iniciando verificación de página en ${TARGET_URL} ...`);

const failedRequests = [];
const badResponses = [];
const consoleErrors = [];
const pageErrors = [];

try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      error: req.failure()?.errorText,
    });
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      badResponses.push({
        url: res.url(),
        method: res.request().method(),
        status: res.status(),
      });
    }
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await page.goto(TARGET_URL, { waitUntil: "networkidle" });

  const pathname = await page.evaluate(() => window.location.pathname);
  const bodyText = await page.innerText("body");
  const gredaConfig = await page.evaluate(() => window.__GREDA_CONFIG__ || null);

  console.log(`[AUDIT PRECHECK] Pathname actual: ${pathname}`);
  console.log(`[AUDIT PRECHECK] Effective window.__GREDA_CONFIG__: ${JSON.stringify(gredaConfig)}`);

  const dumpDiagnostics = () => {
    console.error("\n=== [AUDIT PRECHECK FAILURE DIAGNOSTICS] ===");
    console.error(`Target URL: ${TARGET_URL}`);
    console.error(`Current pathname: ${pathname}`);
    console.error(`Config __GREDA_CONFIG__: ${JSON.stringify(gredaConfig, null, 2)}`);
    console.error(`Body snippet: ${bodyText.slice(0, 300).replace(/\n+/g, " ")}`);

    if (failedRequests.length > 0) {
      console.error("\nFailed Network Requests:");
      failedRequests.forEach((r) => console.error(`  ${r.method} ${r.url} -> Error: ${r.error}`));
    }
    if (badResponses.length > 0) {
      console.error("\nHTTP 4xx/5xx Responses:");
      badResponses.forEach((r) => console.error(`  ${r.method} ${r.url} -> HTTP ${r.status}`));
    }
    if (pageErrors.length > 0) {
      console.error("\nUncaught Page Errors:");
      pageErrors.forEach((e) => console.error(`  ${e}`));
    }
    if (consoleErrors.length > 0) {
      console.error("\nBrowser Console Errors:");
      consoleErrors.forEach((e) => console.error(`  ${e}`));
    }
    console.error("============================================\n");
  };

  // 1. Verificación de redirección
  if (pathname.includes("/login")) {
    dumpDiagnostics();
    console.error("[AUDIT PRECHECK FAIL] Redirigido a la página de login (/login).");
    await browser.close();
    process.exit(1);
  }

  // 2. Verificación de mensaje de error de servidor
  if (bodyText.includes("No se pudo contactar con el servidor")) {
    dumpDiagnostics();
    console.error("[AUDIT PRECHECK FAIL] Mensaje de error de servidor presente en pantalla.");
    await browser.close();
    process.exit(1);
  }

  // 3. Verificación de elementos visuales del mapa
  const svg = await page.$("svg");
  const tablist = await page.$('[role="tablist"]');
  const suggestBtn = await page.$('button:has-text("Sugerir acomodo")');
  const saveBtn = await page.$('button:has-text("Guardar distribución")');
  const placementCount = await page.getByRole("button", { name: /OP #5/ }).count();
  const hasBatchCode = bodyText.includes("KB-2026-000001");

  console.log(`[AUDIT PRECHECK] SVG presente: ${!!svg}`);
  console.log(`[AUDIT PRECHECK] Tablist de niveles presente: ${!!tablist}`);
  console.log(`[AUDIT PRECHECK] Botón 'Sugerir acomodo': ${!!suggestBtn}`);
  console.log(`[AUDIT PRECHECK] Botón 'Guardar distribución': ${!!saveBtn}`);
  console.log(`[AUDIT PRECHECK] Placement localizable por role='button' y name=/OP #5/: ${placementCount >= 1} (count: ${placementCount})`);
  console.log(`[AUDIT PRECHECK] Código de hornada (KB-2026-000001): ${hasBatchCode}`);

  if (
    pathname === "/produccion/hornadas/1/mapa" &&
    !!svg &&
    !!tablist &&
    !!suggestBtn &&
    !!saveBtn &&
    placementCount >= 1 &&
    hasBatchCode
  ) {
    console.log("[AUDIT PRECHECK PASS] Mapa interactivo real verificado con éxito.");
    await browser.close();
    process.exit(0);
  } else {
    dumpDiagnostics();
    console.error("[AUDIT PRECHECK FAIL] Elementos obligatorios del mapa ausentes.");
    await browser.close();
    process.exit(1);
  }
} catch (err) {
  console.error("[AUDIT PRECHECK ERROR]", err);
  process.exit(1);
}
