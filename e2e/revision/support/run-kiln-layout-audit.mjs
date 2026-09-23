import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const AUDIT_SERVER_SCRIPT = path.join(__dirname, "kiln-layout-audit-server.cjs");
const VERIFY_SCRIPT = path.join(__dirname, "verify-kiln-layout-audit-page.mjs");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const DIST_CONFIG = path.join(DIST_DIR, "runtime-config.js");

const MOCK_URL = "http://127.0.0.1:8000";
const PREVIEW_URL = "http://127.0.0.1:4173";
const MAP_URL = `${PREVIEW_URL}/produccion/hornadas/1/mapa`;

const args = process.argv.slice(2);
const isServeMode = args.includes("--serve") || args.includes("--watch");
const isLighthouseMode = args.includes("--lighthouse");
const isE2EMode = args.includes("--e2e");

let spawnedMock = null;
let spawnedPreview = null;
let originalConfigContent = null;

function log(msg) {
  console.log(`[AUDIT RUNNER] ${msg}`);
}

function errorLog(msg) {
  console.error(`[AUDIT RUNNER ERROR] ${msg}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUrl(url, timeoutMs = 20000, validator = (res) => res.ok) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (validator(res)) return true;
    } catch {
      // Intentionally silent while waiting for server startup
    }
    await sleep(400);
  }
  return false;
}

function killProcess(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
    } else {
      proc.kill("SIGTERM");
    }
  } catch {
    // Process might have already terminated
  }
}

function cleanup() {
  log("Limpiando procesos y configuración temporal...");
  if (spawnedPreview) {
    killProcess(spawnedPreview);
    spawnedPreview = null;
  }
  if (spawnedMock) {
    killProcess(spawnedMock);
    spawnedMock = null;
  }
  // Restaurar dist/runtime-config.js a su placeholder para dejar git limpio
  if (fs.existsSync(DIST_CONFIG)) {
    try {
      fs.writeFileSync(
        DIST_CONFIG,
        "/* runtime-config.js — en desarrollo local este archivo es un placeholder.\n   En produccion (Cloud Run), el entrypoint del contenedor lo sobrescribe\n   con el valor de la variable de entorno API_BASE_URL. */\nwindow.__GREDA_CONFIG__ = window.__GREDA_CONFIG__ || {};\n",
        "utf8",
      );
    } catch {
      // Ignorar errores en cleanup
    }
  }
}

process.on("SIGINT", () => {
  log("Recibida señal SIGINT");
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("Recibida señal SIGTERM");
  cleanup();
  process.exit(0);
});

async function main() {
  log("Iniciando suite de auditoría autocontenida (Fase 010M)...");

  // 1. Verificar o construir dist/
  if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
    log("Directorio dist/ no encontrado. Ejecutando npm run build...");
    execSync("npm run build", { cwd: ROOT_DIR, stdio: "inherit" });
  }

  // 2. Configurar dist/runtime-config.js para apuntar al mock local
  log("Configurando dist/runtime-config.js con API_BASE_URL=http://127.0.0.1:8000 ...");
  fs.writeFileSync(
    DIST_CONFIG,
    'window.__GREDA_CONFIG__ = { API_BASE_URL: "http://127.0.0.1:8000" };\n',
    "utf8",
  );

  // 3. Comprobar / iniciar Mock Server (puerto 8000)
  log("Comprobando disponibilidad de servidor mock en :8000 ...");
  let mockAlreadyRunning = false;
  try {
    const res = await fetch(`${MOCK_URL}/health`);
    if (res.ok) {
      const data = await res.json();
      if (data.service === "kiln-layout-audit-mock") {
        mockAlreadyRunning = true;
        log("Servidor mock ya activo y respondiendo en http://127.0.0.1:8000");
      }
    }
  } catch {
    // Puerto libre o no responde
  }

  if (!mockAlreadyRunning) {
    log("Iniciando kiln-layout-audit-server.cjs ...");
    spawnedMock = spawn(process.execPath, [AUDIT_SERVER_SCRIPT], {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env: { ...process.env, AUDIT_MOCK_PORT: "8000" },
    });

    const mockReady = await pollUrl(`${MOCK_URL}/health`, 15000);
    if (!mockReady) {
      errorLog("Tiempo de espera agotado al iniciar servidor mock.");
      cleanup();
      process.exit(1);
    }
    log("Servidor mock listo en http://127.0.0.1:8000");
  }

  // 4. Comprobar / iniciar Preview Server (puerto 4173)
  log("Comprobando disponibilidad de servidor preview en :4173 ...");
  let previewAlreadyRunning = false;
  try {
    const res = await fetch(PREVIEW_URL);
    if (res.status === 200) {
      previewAlreadyRunning = true;
      log("Servidor preview ya activo en http://127.0.0.1:4173");
    }
  } catch {
    // Puerto libre
  }

  if (!previewAlreadyRunning) {
    log("Iniciando vite preview ...");
    const viteScript = path.join(ROOT_DIR, "node_modules/vite/bin/vite.js");

    spawnedPreview = spawn(
      process.execPath,
      [viteScript, "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
      {
        cwd: ROOT_DIR,
        stdio: "inherit",
      },
    );

    const previewReady = await pollUrl(PREVIEW_URL, 20000, (r) => r.status === 200);
    if (!previewReady) {
      errorLog("Tiempo de espera agotado al iniciar servidor preview.");
      cleanup();
      process.exit(1);
    }
    log("Servidor preview listo en http://127.0.0.1:4173");
  }

  // 5. Ejecutar Precheck Automatizado
  log("Ejecutando verify-kiln-layout-audit-page.mjs ...");
  const precheckResult = spawn(process.execPath, [VERIFY_SCRIPT], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: { ...process.env, AUDIT_TARGET_URL: MAP_URL },
  });

  const precheckExitCode = await new Promise((resolve) => {
    precheckResult.on("close", resolve);
  });

  if (precheckExitCode !== 0) {
    errorLog(`El precheck automatizado falló con código ${precheckExitCode}.`);
    cleanup();
    process.exit(precheckExitCode || 1);
  }

  log("Precheck automatizado: PASS (100%).");

  // 6. Acciones según modo solicitado
  if (isServeMode) {
    console.log("\n============================================================");
    console.log(`KILN_LAYOUT_AUDIT_READY ${MAP_URL}`);
    console.log("Servidores mock y preview activos.");
    console.log("Presiona Ctrl+C para detener y limpiar.");
    console.log("============================================================\n");
    // Mantener proceso vivo hasta interrupción
    await new Promise(() => {});
    return;
  }

  if (isLighthouseMode) {
    log("Ejecutando auditoría de Lighthouse sobre " + MAP_URL + " ...");
    const reportPath = path.join(ROOT_DIR, "lighthouse-report.json");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);

    try {
      execSync(
        `npx --yes lighthouse ${MAP_URL} --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=lighthouse-report.json`,
        { cwd: ROOT_DIR, stdio: "inherit", shell: true },
      );
    } catch (err) {
      // En Windows, chrome-launcher a veces lanza EPERM al limpiar su carpeta temporal
      // cuando Chrome acaba de cerrarse, incluso si el reporte JSON ya fue escrito por completo.
      if (!fs.existsSync(reportPath)) {
        errorLog("Fallo al ejecutar Lighthouse: " + err.message);
        cleanup();
        process.exit(1);
      }
    }

    if (fs.existsSync(reportPath)) {
      const lhReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      fs.unlinkSync(reportPath);

      console.log("\n=== RESULTADOS LIGHTHOUSE AUDIT ===");
      console.log(`URL: ${lhReport.finalUrl}`);
      console.log(`Accesibilidad: ${(lhReport.categories.accessibility?.score || 0) * 100} / 100`);
      console.log(`label-content-name-mismatch: score ${lhReport.audits["label-content-name-mismatch"]?.score}`);
      console.log(`aria-required-children: score ${lhReport.audits["aria-required-children"]?.score}`);
      console.log(`target-size: score ${lhReport.audits["target-size"]?.score}`);
      console.log(`button-name: score ${lhReport.audits["button-name"]?.score}`);
      console.log("===================================\n");
    }
  }

  if (isE2EMode) {
    log("Ejecutando suite E2E de Playwright revision (kiln-layout-map.spec.ts)...");
    const playwrightCli = path.join(ROOT_DIR, "node_modules/@playwright/test/cli.js");
    try {
      execSync(
        `"${process.execPath}" "${playwrightCli}" test --config=playwright.revision.config.ts e2e/revision/kiln-layout-map.spec.ts --reporter=list`,
        {
          cwd: ROOT_DIR,
          stdio: "inherit",
          env: {
            ...process.env,
            E2E_BASE_URL: "http://localhost:4173",
            E2E_EMAIL: "audit-admin@example.invalid",
            E2E_PASSWORD: "audit-local-only-password",
            E2E_OPERATOR_EMAIL: "audit-operator@example.invalid",
            E2E_OPERATOR_PASSWORD: "audit-local-only-password",
          },
        },
      );
    } catch (err) {
      errorLog("Fallo al ejecutar suite E2E: " + err.message);
      cleanup();
      process.exit(1);
    }
  }

  // Finalización exitosa
  cleanup();
  console.log("\n============================================================");
  console.log("KILN_LAYOUT_AUDIT_PASS");
  console.log("============================================================\n");
  process.exit(0);
}

main().catch((err) => {
  errorLog("Error inesperado en runner: " + err.message);
  cleanup();
  process.exit(1);
});
