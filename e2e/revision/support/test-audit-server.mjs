import http from "http";
import assert from "assert";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { server, handleRequest, resetLayout } = require("./kiln-layout-audit-server.cjs");

const TEST_PORT = 8099;
const TEST_HOST = "127.0.0.1";
const BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: {
          Origin: "http://localhost:4173",
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      },
    );
    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

console.log("[TEST AUDIT SERVER] Iniciando tests unitarios del mock server...");

const testServer = http.createServer(handleRequest);

testServer.listen(TEST_PORT, TEST_HOST, async () => {
  try {
    resetLayout();

    // 1. Health check
    const health = await makeRequest("/health");
    assert.strictEqual(health.status, 200, "/health debe retornar 200");
    assert.strictEqual(health.body.status, "ok");
    assert.strictEqual(health.body.service, "kiln-layout-audit-mock");
    console.log("  ✓ GET /health");

    // 2. CORS Preflight
    const optionsRes = await makeRequest("/api/v1/auth/me", { method: "OPTIONS" });
    assert.strictEqual(optionsRes.status, 204, "OPTIONS debe responder 204");
    assert.strictEqual(optionsRes.headers["access-control-allow-origin"], "http://localhost:4173");
    assert.strictEqual(optionsRes.headers["access-control-allow-credentials"], "true");
    console.log("  ✓ OPTIONS (CORS preflight)");

    // 3. Auth CSRF
    const csrf = await makeRequest("/api/v1/auth/csrf");
    assert.strictEqual(csrf.status, 200);
    assert.ok(csrf.body.csrf_token, "csrf_token debe existir");
    console.log("  ✓ GET /api/v1/auth/csrf");

    // 4. Auth me
    const me = await makeRequest("/api/v1/auth/me");
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.body.authenticated, true);
    assert.strictEqual(me.body.user.role, "ADMIN");
    console.log("  ✓ GET /api/v1/auth/me");

    // 5. Auth login (valid dummy credentials)
    const loginValid = await makeRequest("/api/v1/auth/login", {
      method: "POST",
      body: { email: "audit-admin@example.invalid", password: "audit-local-only-password" },
    });
    assert.strictEqual(loginValid.status, 200);
    assert.strictEqual(loginValid.body.authenticated, true);
    assert.ok(loginValid.headers["set-cookie"], "Login debe emitir Set-Cookie");
    console.log("  ✓ POST /api/v1/auth/login (válido)");

    // 6. Auth login (invalid credentials)
    const loginInvalid = await makeRequest("/api/v1/auth/login", {
      method: "POST",
      body: { email: "unknown@example.com", password: "wrong" },
    });
    assert.strictEqual(loginInvalid.status, 401);
    console.log("  ✓ POST /api/v1/auth/login (inválido)");

    // 7. Auth logout
    const logout = await makeRequest("/api/v1/auth/logout", { method: "POST" });
    assert.strictEqual(logout.status, 200);
    assert.strictEqual(logout.body.authenticated, false);
    console.log("  ✓ POST /api/v1/auth/logout");

    // 8. Company settings
    const company = await makeRequest("/api/v1/settings/company");
    assert.strictEqual(company.status, 200);
    console.log("  ✓ GET /api/v1/settings/company");

    // 9. Kiln batches list
    const batchList = await makeRequest("/api/v1/kiln-batches");
    assert.strictEqual(batchList.status, 200);
    assert.ok(Array.isArray(batchList.body.items));
    assert.strictEqual(batchList.body.items[0].code, "KB-2026-000001");
    console.log("  ✓ GET /api/v1/kiln-batches");

    // 10. Kiln batch single
    const batchSingle = await makeRequest("/api/v1/kiln-batches/1");
    assert.strictEqual(batchSingle.status, 200);
    assert.strictEqual(batchSingle.body.code, "KB-2026-000001");
    console.log("  ✓ GET /api/v1/kiln-batches/1");

    // 11. Kiln layout GET
    const layoutGet = await makeRequest("/api/v1/kiln-batches/1/layout");
    assert.strictEqual(layoutGet.status, 200);
    assert.strictEqual(layoutGet.body.layout_id, 10);
    assert.strictEqual(layoutGet.body.version, 1);
    assert.strictEqual(layoutGet.body.invalid_quantity, 0);
    assert.ok(layoutGet.body.updated_at);
    assert.ok(layoutGet.body.levels.length >= 1);
    assert.strictEqual(layoutGet.body.levels[0].id, 101);
    console.log("  ✓ GET /api/v1/kiln-batches/1/layout");

    // 12. Kiln layout suggest
    const suggest = await makeRequest("/api/v1/kiln-batches/1/layout/suggest");
    assert.strictEqual(suggest.status, 200);
    assert.ok(Array.isArray(suggest.body.suggested_placements));
    console.log("  ✓ POST /api/v1/kiln-batches/1/layout/suggest");

    // 13. Kiln layout PUT
    const layoutPut = await makeRequest("/api/v1/kiln-batches/1/layout", {
      method: "PUT",
      body: {
        expected_version: 1,
        levels: layoutGet.body.levels,
        placements: layoutGet.body.placements,
      },
    });
    assert.strictEqual(layoutPut.status, 200);
    assert.strictEqual(layoutPut.body.layout_id, 10);
    assert.strictEqual(layoutPut.body.version, 2);
    assert.strictEqual(layoutPut.body.invalid_quantity, 0);
    assert.strictEqual(layoutPut.body.levels[0].id, 101);
    console.log("  ✓ PUT /api/v1/kiln-batches/1/layout");

    console.log("\n[TEST AUDIT SERVER PASS] Todos los 13 endpoints verificados correctamente.");
    testServer.close(() => process.exit(0));
  } catch (err) {
    console.error("\n[TEST AUDIT SERVER FAIL]", err);
    testServer.close(() => process.exit(1));
  }
});
