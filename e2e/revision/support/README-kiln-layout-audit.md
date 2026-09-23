# Harness de Auditoría Reproducible — Mapa Interactivo del Horno (Fase 010M)

Este soporte permite ejecutar y reproducir las auditorías de accesibilidad y rendimiento (**Lighthouse** y **React Doctor**), así como las pruebas **E2E de Playwright** sobre la vista operacional real del mapa interactivo (`/produccion/hornadas/1/mapa`) desde cualquier checkout limpio de `FGreda`, sin requerir una instancia en vivo de `BGreda`, bases de datos activas ni credenciales secretas.

---

## 1. Flujo Rápido de Un Solo Comando (Recomendado)

El orquestador automatizado `run-kiln-layout-audit.mjs` gestiona la compilación, configuración de runtime, puertos, servidores y limpieza de procesos automáticamente:

### A. Precheck de Validación Rápida
Arranca el mock server en `:8000`, configura `dist/runtime-config.js`, levanta `vite preview` en `:4173`, valida el mapa interactivo y apaga los servidores:
```bash
node e2e/revision/support/run-kiln-layout-audit.mjs
```
*Salida esperada:*
```text
[AUDIT PRECHECK PASS] Mapa interactivo real verificado con éxito.
KILN_LAYOUT_AUDIT_PASS
```

### B. Ejecutar la Suite E2E de Playwright (`kiln-layout-map.spec.ts`)
Levanta los servidores, ejecuta las 9 pruebas E2E de la revisión con credenciales mock locales y limpia los procesos:
```bash
node e2e/revision/support/run-kiln-layout-audit.mjs --e2e
```
*Salida esperada:*
```text
  9 passed (27s)
KILN_LAYOUT_AUDIT_PASS
```

### C. Ejecutar la Auditoría Completa de Lighthouse
Valida el precheck, ejecuta Lighthouse contra el mapa operacional real, reporta los scores y limpia:
```bash
node e2e/revision/support/run-kiln-layout-audit.mjs --lighthouse
```
*Salida esperada:*
```text
=== RESULTADOS LIGHTHOUSE AUDIT ===
URL: http://127.0.0.1:4173/produccion/hornadas/1/mapa
Accesibilidad: 100 / 100
label-content-name-mismatch: score 1
aria-required-children: score 1
target-size: score 1
button-name: score 1
===================================
KILN_LAYOUT_AUDIT_PASS
```

### D. Modo Servidor Continuo (para inspección interactiva)
Deja activos los servidores mock y preview para pruebas manuales o inspección en navegador:
```bash
node e2e/revision/support/run-kiln-layout-audit.mjs --serve
```
*(Presionar `Ctrl+C` para detener los servidores y restaurar la configuración limpia).*

---

## 2. Componentes del Harness

1. **`run-kiln-layout-audit.mjs`**:
   - Orquestador autónomo basado en APIs estándar de Node.js (`child_process`, `http`, `fs`).
   - Compatible nativamente con Windows (`spawn` directo de binarios node) y Linux/macOS.
   - Detecta colisión de puertos y realiza sondeo activo de salud (`/health`).
   - Restaura automáticamente `dist/runtime-config.js` al finalizar para mantener el árbol de trabajo `git status` limpio.

2. **`kiln-layout-audit-server.cjs`**:
   - Servidor HTTP ligero en Node.js puro (`http`).
   - Escucha en `http://127.0.0.1:8000` (configurable vía `AUDIT_MOCK_PORT`).
   - Implementa endpoints autenticados y operacionales:
     - `GET /health` (`status: ok`)
     - `GET /api/v1/auth/csrf` (Token CSRF mock)
     - `GET /api/v1/auth/me` (Usuario sesión rol `ADMIN`)
     - `POST /api/v1/auth/login` (Acepta credenciales dummy locales `audit-admin@example.invalid` y emite cookie)
     - `POST /api/v1/auth/logout`
     - `GET /api/v1/settings/company`
     - `GET /api/v1/kiln-batches` y `GET /api/v1/kiln-batches/1` (Hornada fixture `KB-2026-000001`)
     - `GET /api/v1/kiln-batches/1/layout` y `PUT /api/v1/kiln-batches/1/layout`
     - `POST /api/v1/kiln-batches/1/layout/suggest`
   - Soporte CORS estricto para `http://localhost:4173` y `http://127.0.0.1:4173` con `Access-Control-Allow-Credentials: true`.

3. **`test-audit-server.mjs`**:
   - Prueba unitaria automatizada para verificar los 13 endpoints del mock server.
   - Ejecución directa: `node e2e/revision/support/test-audit-server.mjs`.

4. **`verify-kiln-layout-audit-page.mjs`**:
   - Script de comprobación automatizado en Playwright.
   - Diagnóstico detallado en consola si ocurre algún fallo de red (4xx/5xx), error de página o excepción no capturada.

---

## 3. Instrucciones Paso a Paso desde un Clean Checkout

Si prefieres ejecutar cada paso manualmente en terminales separadas:

### Paso 1: Levantar el Mock Server
En la terminal 1:
```bash
node e2e/revision/support/kiln-layout-audit-server.cjs
```
*Salida:* `KILN_LAYOUT_AUDIT_MOCK_READY http://127.0.0.1:8000`

### Paso 2: Compilar el Frontend
En la terminal 2:
```bash
npm run build
```

### Paso 3: Configurar el Runtime Config para Preview Local
Ejecutar el siguiente comando multiplataforma en Node.js:
```bash
node -e "const fs=require('fs'); fs.writeFileSync('dist/runtime-config.js', 'window.__GREDA_CONFIG__ = { API_BASE_URL: \'http://127.0.0.1:8000\' };\n');"
```

### Paso 4: Levantar Vite Preview
En la terminal 2:
```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

### Paso 5: Comprobar el Renderizado
En la terminal 3:
```bash
node e2e/revision/support/verify-kiln-layout-audit-page.mjs
```
*Salida:* `[AUDIT PRECHECK PASS] Mapa interactivo real verificado con éxito.`

### Paso 6: Ejecutar las Pruebas E2E de Playwright
En la terminal 3:
```bash
npm run e2e -- --config=playwright.revision.config.ts e2e/revision/kiln-layout-map.spec.ts --reporter=list
```
*(Nota: `playwright.revision.config.ts` inyecta automáticamente valores dummy mock para este spec si no se definen variables en el entorno).*

### Paso 7: Ejecutar Lighthouse
En la terminal 3:
```bash
npx --yes lighthouse http://localhost:4173/produccion/hornadas/1/mapa --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=lighthouse-report.json
```

### Paso 8: Ejecutar React Doctor
En la terminal 3:
```bash
npx --yes react-doctor src/features/kilnBatches/layout
```
