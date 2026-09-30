import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createConnection, createServer } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BACKEND_ROOT = resolve(FRONTEND_ROOT, "../../../../BGreda-010p-w2");
const BACKEND_ROOT = resolve(process.env.GREDA_BACKEND_W3_ROOT ?? DEFAULT_BACKEND_ROOT);
const EXPECTED_BACKEND_SHA = "b5d55caa58a6f7c76df52c666c85858d1467d6e2";
const EXPECTED_FRONTEND_BASE = "705b6b436448bac6a0e2b77d9704c70a2be2562e";
const EXPECTED_ALEMBIC_REVISION = "0045";
const POSTGRES_IMAGE = "postgres:16-alpine";

function runSync(command, args, { cwd, env = process.env, maxBuffer = 4 * 1024 * 1024 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} exited ${result.status ?? result.signal ?? "unknown"}${detail ? `\n${detail}` : ""}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
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
  const includeExisting = process.argv.includes("--include-existing");
  if (git(BACKEND_ROOT, "branch", "--show-current") !== "feat/010p-w3-production-order-read-contract") {
    throw new Error(`Backend worktree is not on the W3 branch: ${BACKEND_ROOT}`);
  }
  const backendHead = git(BACKEND_ROOT, "rev-parse", "HEAD");
  if (backendHead !== EXPECTED_BACKEND_SHA) {
    throw new Error(`Backend must be ${EXPECTED_BACKEND_SHA}; found ${backendHead}`);
  }
  if (git(FRONTEND_ROOT, "branch", "--show-current") !== "feat/010p-w3-frontend") {
    throw new Error(`Frontend worktree is not on feat/010p-w3-frontend: ${FRONTEND_ROOT}`);
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
      E2E_OPERATOR_EMAIL: `solo-quema-operator-${loginSuffix}@example.com`,
      E2E_OPERATOR_PASSWORD: randomBytes(32).toString("base64url"),
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

    const testFiles = includeExisting
      ? [
          "e2e/revision/produccion-010i.spec.ts",
          "e2e/revision/production-w3-explicit-lot.spec.ts",
          "e2e/revision/production-w3-labor-parallel.spec.ts",
          "e2e/revision/production-w3-prototype-results.spec.ts",
          "e2e/revision/solo-quema-real-e2e.spec.ts",
        ]
      : ["e2e/revision/solo-quema-real-e2e.spec.ts"];
    console.log(
      `[solo-quema-runner] Running ${includeExisting ? "the existing W3/010I regression set plus " : ""}the real Solo Quema browser E2E`,
    );
    runSync(process.execPath, [playwrightCli, "test", "--config=playwright.revision.config.ts", "--project=chromium", ...testFiles], {
      cwd: FRONTEND_ROOT,
      env,
      maxBuffer: 8 * 1024 * 1024,
    });

    await stopProcess(frontendServer);
    frontendServer = undefined;
    await stopProcess(backendServer);
    backendServer = undefined;
    await waitForPortClosed(frontendPort);
    await waitForPortClosed(backendPort);

    console.log("[solo-quema-runner] Running the focused PostgreSQL contract test");
    runSync(
      python,
      [
        "-m",
        "pytest",
        "tests/db/test_firing_quotation_v2_api.py::test_solo_quema_get_result_lines_roundtrip_does_not_add_stock",
        "-q",
      ],
      { cwd: BACKEND_ROOT, env },
    );
    console.log("[solo-quema-runner] E2E, backend contract test, server shutdown, and disposable DB cleanup complete");
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
  console.error(`[solo-quema-runner] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
