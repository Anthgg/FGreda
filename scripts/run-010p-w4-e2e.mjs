import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createConnection, createServer } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BACKEND_ROOT = resolve(FRONTEND_ROOT, "../../../../BGreda-010p-w2");
const BACKEND_ROOT = resolve(process.env.GREDA_BACKEND_W4_ROOT ?? DEFAULT_BACKEND_ROOT);
const EXPECTED_BACKEND_BASE = "47cf50b7218c220f74716545ca93cbfe8fed501c";
const EXPECTED_FRONTEND_BASE = "523245c2473299b3aed4667745132b9dc72614f9";
const EXPECTED_BRANCH = "feat/010p-w4-integration";
const EXPECTED_ALEMBIC_REVISION = "0045";
const POSTGRES_IMAGE = "postgres:16-alpine";

function runSync(command, args, { cwd, env = process.env, input, maxBuffer = 4 * 1024 * 1024 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} exited ${result.status ?? result.signal ?? "unknown"}${detail ? `\n${detail}` : ""}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function writeInventoryAuditArtifacts(containerName, databaseName, env, python) {
  const artifactsPath = join(BACKEND_ROOT, "artifacts", "010P_W4");
  const auditSql = readFileSync(join(artifactsPath, "inventory_invariants.sql"), "utf8");
  const auditOutput = runSync(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      databaseName,
      "-X",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { cwd: FRONTEND_ROOT, env, input: auditSql },
  );
  const invariants = JSON.parse(auditOutput.stdout.trim());
  if (invariants.database !== databaseName || invariants.alembic_head !== EXPECTED_ALEMBIC_REVISION) {
    throw new Error("Inventory audit did not read the active disposable database at Alembic 0045");
  }
  const invariantKeys = [
    "negative_stock_balances",
    "negative_lot_balances",
    "prepared_aggregate_lot_mismatches",
    "lot_groups_without_aggregate",
    "movements_missing_required_origin",
    "last_movement_balance_mismatches",
    "production_in_result_quantity_mismatches",
    "invalid_production_result_totals",
    "completed_v2_orders_without_results",
    "delivery_out_invalid_rows",
  ];
  const invariantFailures = invariantKeys.filter((key) => Number(invariants[key]) !== 0);
  if (invariantFailures.length > 0) {
    throw new Error(`Inventory invariants failed: ${invariantFailures.map((key) => `${key}=${invariants[key]}`).join(", ")}`);
  }
  writeFileSync(join(artifactsPath, "inventory_invariants.json"), `${JSON.stringify(invariants, null, 2)}\n`);

  const lotOutput = runSync(python, ["scripts/lot_reconciliation_report.py"], {
    cwd: BACKEND_ROOT,
    env,
  }).stdout.trim();
  const lotPrefix = "LOT_RECONCILIATION_REPORT: ";
  const lotLine = lotOutput.split(/\r?\n/).find((line) => line.startsWith(lotPrefix));
  if (!lotLine) throw new Error("Lot reconciliation command did not emit a report");
  const reconciliation = JSON.parse(lotLine.slice(lotPrefix.length));
  const unreconciledRows = reconciliation.rows.filter((row) => row.status === "UNRECONCILED").length;
  const lotArtifact = {
    report: "010P W4 lot reconciliation after full revision E2E",
    generated_at_utc: new Date().toISOString(),
    source_database: databaseName,
    alembic_revision: EXPECTED_ALEMBIC_REVISION,
    unreconciled_rows: unreconciledRows,
    lot_balance_count: reconciliation.lot_balances.length,
    reconciliation,
  };
  if (unreconciledRows !== 0) throw new Error(`Lot reconciliation found ${unreconciledRows} UNRECONCILED rows`);
  writeFileSync(join(artifactsPath, "lot_reconciliation.json"), `${JSON.stringify(lotArtifact, null, 2)}\n`);
  console.log(`[w4-e2e-runner] Inventory audit passed: ${invariants.movement_rows} movements, ${invariants.lot_balance_rows} lot rows; lot reconciliation ${unreconciledRows} UNRECONCILED`);
}

function git(cwd, ...args) {
  return runSync("git", ["-C", cwd, ...args], { cwd }).stdout.trim();
}

function reserveLoopbackPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a loopback port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function startProcess(command, args, { cwd, env }) {
  const child = spawn(command, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const recentLines = [];
  const capture = (chunk) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/)) {
      if (!line) continue;
      recentLines.push(line);
      if (recentLines.length > 100) recentLines.shift();
    }
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  child.on("error", (error) => capture(`${error.message}\n`));
  return { child, recentLines };
}

async function waitForHttp(url, server, label, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(`${label} exited early:\n${server.recentLines.join("\n")}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process may still be binding its loopback socket.
    }
    await sleep(300);
  }
  throw new Error(`${label} did not become ready at ${url}:\n${server.recentLines.join("\n")}`);
}

async function stopProcess(server) {
  if (!server || server.child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.child.once("close", resolveExit));
  server.child.kill("SIGTERM");
  const didExit = await Promise.race([exited.then(() => true), sleep(5_000).then(() => false)]);
  if (!didExit && process.platform === "win32" && server.child.pid) {
    spawnSync("taskkill", ["/PID", String(server.child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    await Promise.race([exited, sleep(5_000)]);
  }
}

function portIsOpen(port) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(750);
    socket.once("connect", () => {
      socket.destroy();
      resolveOpen(true);
    });
    socket.once("error", () => resolveOpen(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolveOpen(false);
    });
  });
}

async function waitForPortClosed(port) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!(await portIsOpen(port))) return;
    await sleep(250);
  }
  throw new Error(`Runner-owned loopback port ${port} is still listening after shutdown`);
}

async function waitForPostgres(containerName, databaseName) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const ready = spawnSync(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName],
      { encoding: "utf8", windowsHide: true, stdio: ["ignore", "ignore", "ignore"] },
    );
    if (ready.status === 0) return;
    await sleep(400);
  }
  throw new Error("Disposable PostgreSQL did not become ready");
}

function removeContainer(containerName) {
  const inspected = spawnSync("docker", ["inspect", containerName], {
    windowsHide: true,
    stdio: "ignore",
  });
  if (inspected.status !== 0) return;
  runSync("docker", ["rm", "--force", containerName], { cwd: FRONTEND_ROOT });
}

function safeRemoveTempDir(path) {
  const tempRoot = resolve(tmpdir());
  const resolvedPath = resolve(path);
  if (
    !resolvedPath.startsWith(`${tempRoot}${sep}`) ||
    !resolvedPath.slice(tempRoot.length + 1).startsWith("greda-solo-quema-e2e-")
  ) {
    throw new Error("Refusing to remove a path outside this runner's unique temporary directory");
  }
  rmSync(resolvedPath, { recursive: true, force: true });
}

async function main() {
  const allRevision = process.argv.includes("--all-revision");
  const backendDbSuite = process.argv.includes("--backend-db-suite");
  const backendDbTestsMarker = process.argv.indexOf("--backend-db-tests");
  const backendDbTests = backendDbTestsMarker < 0
    ? []
    : process.argv.slice(backendDbTestsMarker + 1).filter((argument) => !argument.startsWith("--"));
  if (backendDbTestsMarker >= 0 && (!backendDbSuite || backendDbTests.length === 0)) {
    throw new Error("--backend-db-tests requires --backend-db-suite and at least one pytest target");
  }
  if (backendDbTests.some((target) => !target.startsWith("tests/db/") || !target.includes("::"))) {
    throw new Error("Backend DB targets must be tests/db/<file>.py::... pytest node IDs");
  }
  const filesMarker = process.argv.indexOf("--files");
  const selectedFiles = filesMarker < 0
    ? []
    : process.argv.slice(filesMarker + 1).filter((argument) => !argument.startsWith("--"));
  const includeExisting = process.argv.includes("--include-existing") || allRevision || selectedFiles.length > 0;
  if (git(BACKEND_ROOT, "branch", "--show-current") !== EXPECTED_BRANCH) {
    throw new Error(`Backend worktree is not on ${EXPECTED_BRANCH}: ${BACKEND_ROOT}`);
  }
  runSync("git", ["-C", BACKEND_ROOT, "merge-base", "--is-ancestor", EXPECTED_BACKEND_BASE, "HEAD"], {
    cwd: BACKEND_ROOT,
  });
  if (git(FRONTEND_ROOT, "branch", "--show-current") !== EXPECTED_BRANCH) {
    throw new Error(`Frontend worktree is not on ${EXPECTED_BRANCH}: ${FRONTEND_ROOT}`);
  }
  runSync("git", ["-C", FRONTEND_ROOT, "merge-base", "--is-ancestor", EXPECTED_FRONTEND_BASE, "HEAD"], {
    cwd: FRONTEND_ROOT,
  });
  runSync("docker", ["image", "inspect", POSTGRES_IMAGE], { cwd: FRONTEND_ROOT });

  const python = process.env.SOLO_QUEMA_E2E_PYTHON ?? join(BACKEND_ROOT, ".venv", "Scripts", "python.exe");
  const viteCli = join(FRONTEND_ROOT, "node_modules", "vite", "bin", "vite.js");
  const playwrightCli = join(FRONTEND_ROOT, "node_modules", "@playwright", "test", "cli.js");
  const helper = join(BACKEND_ROOT, "tests", "e2e", "preparar_solo_quema.py");
  for (const path of [python, viteCli, playwrightCli, helper]) {
    if (!existsSync(path)) throw new Error(`Required local test dependency is missing: ${path}`);
  }

  const runTag = randomBytes(6).toString("hex");
  const containerName = `greda-010p-solo-quema-${runTag}`;
  const databaseName = `bgreda_test_010p_sq_${runTag}`;
  const tempDir = mkdtempSync(join(tmpdir(), "greda-solo-quema-e2e-"));
  let containerStarted = false;
  let backendServer;
  let frontendServer;
  let backendPort;
  let frontendPort;
  let postgresPort;

  try {
    const containerId = runSync(
      "docker",
      [
        "run",
        "--pull=never",
        "--rm",
        "--detach",
        "--name",
        containerName,
        "--env",
        "POSTGRES_USER=postgres",
        "--env",
        "POSTGRES_HOST_AUTH_METHOD=trust",
        "--env",
        `POSTGRES_DB=${databaseName}`,
        "--publish",
        "127.0.0.1::5432",
        POSTGRES_IMAGE,
      ],
      { cwd: FRONTEND_ROOT },
    ).stdout.trim();
    containerStarted = Boolean(containerId);
    await waitForPostgres(containerName, databaseName);
    const portText = runSync("docker", ["port", containerName, "5432/tcp"], { cwd: FRONTEND_ROOT }).stdout.trim();
    const portMatch = /127\.0\.0\.1:(\d+)/.exec(portText);
    if (!portMatch) throw new Error("Docker did not bind the disposable database to loopback");
    postgresPort = Number(portMatch[1]);

    backendPort = await reserveLoopbackPort();
    frontendPort = await reserveLoopbackPort();
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const backendUrl = `http://127.0.0.1:${backendPort}`;
    const databaseUrl = `postgresql+asyncpg://postgres@127.0.0.1:${postgresPort}/${databaseName}`;
    const loginSuffix = randomBytes(7).toString("hex");
    const env = {
      ...process.env,
      APP_ENV: "local",
      APP_NAME: "Cotizador Greda API (Solo Quema W3 E2E)",
      LEGACY_CREATION_ENABLED: "true",
      LOG_LEVEL: "WARNING",
      DATABASE_URL: databaseUrl,
      TEST_DATABASE_URL: databaseUrl,
      FRONTEND_ORIGINS: frontendUrl,
      COOKIE_SECURE: "false",
      COOKIE_SAMESITE: "lax",
      COOKIE_DOMAIN: "",
      CSRF_SECRET: randomBytes(48).toString("base64url"),
      IDENTITY_HASH_SECRET: randomBytes(48).toString("base64url"),
      SUPABASE_URL: "https://local-auth-double.invalid",
      SUPABASE_PUBLISHABLE_KEY: "local-test-publishable-key",
      SUPABASE_SECRET_KEY: "",
      PERU_API_TOKEN: "",
      DECOLECTA_API_TOKEN: "",
      GREDA_E2E_REVISION: "1",
      E2E_EMAIL: `solo-quema-admin-${loginSuffix}@example.com`,
      E2E_PASSWORD: randomBytes(32).toString("base64url"),
      E2E_OPERATOR_EMAIL: `010p-operator-${loginSuffix}@example.com`,
      E2E_OPERATOR_PASSWORD: randomBytes(32).toString("base64url"),
      E2E_QUICK_CREATE_OPERATOR_EMAIL: `010p-quick-create-operator-${loginSuffix}@example.com`,
      E2E_QUICK_CREATE_OPERATOR_PASSWORD: randomBytes(32).toString("base64url"),
      E2E_BASE_URL: frontendUrl,
      E2E_BACKEND_URL: backendUrl,
      VITE_API_BASE_URL: frontendUrl,
      VITE_API_PROXY_TARGET: backendUrl,
      SOLO_QUEMA_E2E_BACKEND_ROOT: BACKEND_ROOT,
      SOLO_QUEMA_E2E_PYTHON: python,
      E2E_PDF_PYTHON: python,
      SOLO_QUEMA_E2E_DATABASE_NAME: databaseName,
      SOLO_QUEMA_E2E_EXPECTED_REVISION: EXPECTED_ALEMBIC_REVISION,
      SOLO_QUEMA_E2E_BACKEND_PORT: String(backendPort),
      PLAYWRIGHT_HTML_OUTPUT_DIR: join(tempDir, "html-report"),
      PLAYWRIGHT_OUTPUT_DIR: join(tempDir, "test-results"),
      PYTHONUNBUFFERED: "1",
    };

    console.log(`[solo-quema-runner] Disposable DB ${databaseName} on local port ${postgresPort}`);
    runSync(python, ["-m", "alembic", "upgrade", EXPECTED_ALEMBIC_REVISION], {
      cwd: BACKEND_ROOT,
      env,
    });
    const current = runSync(python, ["-m", "alembic", "current"], { cwd: BACKEND_ROOT, env }).stdout.trim();
    if (!new RegExp(`\\b${EXPECTED_ALEMBIC_REVISION}\\b`).test(current)) {
      throw new Error(`Expected Alembic ${EXPECTED_ALEMBIC_REVISION}; found ${current}`);
    }
    const verified = runSync(python, [helper, "verify"], { cwd: BACKEND_ROOT, env });
    const databaseCheck = JSON.parse(verified.stdout.trim());
    if (databaseCheck.database !== databaseName || databaseCheck.revision !== EXPECTED_ALEMBIC_REVISION) {
      throw new Error("Backend helper rejected the database name or Alembic revision");
    }

    if (backendDbSuite) {
      const pytestTargets = backendDbTests.length > 0 ? backendDbTests : ["tests/db"];
      const suiteLabel = backendDbTests.length > 0
        ? `${backendDbTests.length} focused backend DB target(s)`
        : "the full backend DB suite";
      console.log(`[w4-e2e-runner] Running ${suiteLabel} on isolated local DB ${databaseName}`);
      runSync(python, ["-m", "pytest", ...pytestTargets, "-q"], {
        cwd: BACKEND_ROOT,
        env,
        maxBuffer: 8 * 1024 * 1024,
      });
      console.log("[w4-e2e-runner] Backend DB tests passed; disposable DB cleanup follows");
      return;
    }

    const serverArgs = ["-m", "tests.e2e.servidor_revision", "--port", String(backendPort)];
    if (!includeExisting) serverArgs.push("--sin-siembra");
    backendServer = startProcess(python, serverArgs, { cwd: BACKEND_ROOT, env });
    await waitForHttp(`${backendUrl}/api/v1/auth/csrf`, backendServer, "local backend");

    frontendServer = startProcess(
      process.execPath,
      [viteCli, "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
      { cwd: FRONTEND_ROOT, env },
    );
    await waitForHttp(`${frontendUrl}/`, frontendServer, "local frontend");

    const testFiles = allRevision
      ? []
      : selectedFiles.length > 0
        ? selectedFiles
        : includeExisting
          ? [
          "e2e/revision/produccion-010i.spec.ts",
          "e2e/revision/production-w3-explicit-lot.spec.ts",
          "e2e/revision/production-w3-labor-parallel.spec.ts",
          "e2e/revision/production-w3-prototype-results.spec.ts",
          "e2e/revision/production-w4-functional.spec.ts",
          "e2e/revision/solo-quema-real-e2e.spec.ts",
          ]
          : ["e2e/revision/solo-quema-real-e2e.spec.ts"];
    console.log(
      `[w4-e2e-runner] Running ${allRevision ? "the full revision suite" : selectedFiles.length ? "selected revision E2E files" : includeExisting ? "the W3/010I regression set" : "the real Solo Quema browser E2E"}`,
    );
    let revisionFailure;
    const playwrightLogPath = join(
      BACKEND_ROOT,
      "artifacts",
      "010P_W4",
      allRevision ? "playwright_revision.log" : "playwright_focused.log",
    );
    try {
      const playwrightOutput = runSync(process.execPath, [playwrightCli, "test", "--config=playwright.revision.config.ts", "--project=chromium", ...testFiles], {
        cwd: FRONTEND_ROOT,
        env,
        maxBuffer: 8 * 1024 * 1024,
      });
      writeFileSync(playwrightLogPath, `${playwrightOutput.stdout}${playwrightOutput.stderr}`);
    } catch (error) {
      revisionFailure = error;
      writeFileSync(
        playwrightLogPath,
        error instanceof Error ? error.message : String(error),
      );
      console.error("[w4-e2e-runner] Playwright failed; continuing local contract and inventory audits before cleanup");
    }

    await stopProcess(frontendServer);
    frontendServer = undefined;
    await stopProcess(backendServer);
    backendServer = undefined;
    await waitForPortClosed(frontendPort);
    await waitForPortClosed(backendPort);

    console.log("[solo-quema-runner] Running the focused PostgreSQL contract test");
    let contractFailure;
    const contractLogPath = join(BACKEND_ROOT, "artifacts", "010P_W4", "focused_solo_quema_contract.log");
    try {
      const contractOutput = runSync(
        python,
        [
          "-m",
          "pytest",
          "tests/db/test_firing_quotation_v2_api.py::test_solo_quema_get_result_lines_roundtrip_does_not_add_stock",
          "-q",
        ],
        { cwd: BACKEND_ROOT, env },
      );
      if (allRevision) {
        writeFileSync(contractLogPath, `${contractOutput.stdout}${contractOutput.stderr}`);
      }
    } catch (error) {
      contractFailure = error;
      if (allRevision) {
        writeFileSync(
          contractLogPath,
          error instanceof Error ? error.message : String(error),
        );
      }
      console.error("[w4-e2e-runner] Focused PostgreSQL contract test failed; continuing the inventory audit");
    }
    if (allRevision) writeInventoryAuditArtifacts(containerName, databaseName, env, python);
    console.log("[w4-e2e-runner] E2E, backend contract test, server shutdown, and disposable DB cleanup complete");
    if (revisionFailure || contractFailure) {
      throw new AggregateError(
        [revisionFailure, contractFailure].filter(Boolean),
        "W4 acceptance checks failed; local audit artifacts were still collected",
      );
    }
  } finally {
    const cleanupErrors = [];
    await stopProcess(frontendServer).catch((error) => cleanupErrors.push(error));
    await stopProcess(backendServer).catch((error) => cleanupErrors.push(error));
    if (frontendPort) await waitForPortClosed(frontendPort).catch((error) => cleanupErrors.push(error));
    if (backendPort) await waitForPortClosed(backendPort).catch((error) => cleanupErrors.push(error));
    if (containerStarted) {
      try {
        removeContainer(containerName);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    const inspected = spawnSync("docker", ["inspect", containerName], {
      windowsHide: true,
      stdio: "ignore",
    });
    if (inspected.status === 0) cleanupErrors.push(new Error(`Disposable container ${containerName} remains after cleanup`));
    try {
      safeRemoveTempDir(tempDir);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, "E2E resource cleanup failed");
  }
}

main().catch((error) => {
  console.error(`[w4-e2e-runner] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
