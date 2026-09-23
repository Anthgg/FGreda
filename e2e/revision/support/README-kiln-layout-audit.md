# Harness de Auditoría Reproducible — Mapa Interactivo del Horno (Fase 010M)

Este soporte permite ejecutar y reproducir las auditorías de accesibilidad y rendimiento (**Lighthouse** y **React Doctor**) sobre la vista operacional real del mapa interactivo (`/produccion/hornadas/1/mapa`) desde cualquier checkout limpio de `FGreda`, sin requerir una instancia en vivo de `BGreda` ni bases de datos activas.

---

## 1. Componentes del Harness

1. **Servidor Mock de Auditoría (`kiln-layout-audit-server.cjs`)**:
   - Implementado exclusivamente con módulos estándar de Node.js (`http`), sin dependencias externas.
   - Escucha en `http://127.0.0.1:8000` (configurable con `AUDIT_MOCK_PORT`).
   - Sirve endpoints mínimos autenticados:
     - `GET /health` / `GET /api/v1/health`
     - `GET /api/v1/auth/csrf`
     - `GET /api/v1/auth/me` (Rol `ADMIN`)
     - `GET /api/v1/settings/company`
     - `GET /api/v1/kiln-batches/1` (Hornada `KB-2026-000001` en estado `PLANNED`, dimensiones físicas 60×50×80 cm)
     - `GET /api/v1/kiln-batches/1/layout` (2 niveles físicos y 1 pieza colocada `OP #5`)
     - `PUT /api/v1/kiln-batches/1/layout` y `POST /api/v1/kiln-batches/1/layout/suggest`
   - Soporta CORS para `http://localhost:4173` y `http://127.0.0.1:4173`.
   - Emite logs estructurados: `AUDIT_MOCK_REQUEST <METHOD> <PATH>` y `AUDIT_MOCK_UNHANDLED <METHOD> <PATH>`.

2. **Verificador Automatizado de Mapa (`verify-kiln-layout-audit-page.mjs`)**:
   - Script de comprobación rápida basado en Playwright (`@playwright/test`).
   - Verifica que la página cargue en `/produccion/hornadas/1/mapa` sin pantallas de error ni redirecciones a `/login`.
   - Confirma la presencia del SVG interactivo, pestañas de niveles, botones operativos y piezas colocadas.

---

## 2. Instrucciones de Ejecución Paso a Paso

### Paso 1: Levantar el Servidor Mock de Auditoría
En una terminal:
```bash
node e2e/revision/support/kiln-layout-audit-server.cjs
```
*Salida esperada:*
```text
KILN_LAYOUT_AUDIT_MOCK_READY http://127.0.0.1:8000
```

Para verificar su estado de salud en otra consola:
```bash
curl http://127.0.0.1:8000/health
# o en PowerShell:
Invoke-RestMethod http://127.0.0.1:8000/health
```

---

### Paso 2: Compilar el Frontend
```bash
npm run build
```

---

### Paso 3: Configurar el Endpoint de API para Previsualización Local
El build de producción incluye `/dist/runtime-config.js` (en Cloud Run se genera dinámicamente desde variables de entorno). Para el preview local de auditoría, se configura para apuntar al mock:
```bash
node -e "fs.writeFileSync('dist/runtime-config.js', 'window.__GREDA_CONFIG__ = { API_BASE_URL: \"http://127.0.0.1:8000\" };\n');"
```

---

### Paso 4: Levantar el Servidor de Preview
En una terminal:
```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

---

### Paso 5: Comprobar el Renderizado del Mapa
Ejecutar el script de precheck automatizado:
```bash
node e2e/revision/support/verify-kiln-layout-audit-page.mjs
```
*Salida esperada:*
```text
[AUDIT PRECHECK PASS] Mapa interactivo real verificado con éxito.
```
(Termina con código de salida `0`).

---

### Paso 6: Ejecutar la Auditoría de Lighthouse
```bash
npx --yes lighthouse http://localhost:4173/produccion/hornadas/1/mapa --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=lighthouse-report.json
```

---

### Paso 7: Ejecutar la Auditoría de React Doctor
```bash
npx --yes react-doctor src/features/kilnBatches/layout
```
