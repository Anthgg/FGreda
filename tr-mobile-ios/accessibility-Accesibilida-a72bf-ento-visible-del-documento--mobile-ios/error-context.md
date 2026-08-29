# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> Accesibilidad basica >> Inicio: Tab no pierde el foco (permanece en un elemento visible del documento)
- Location: e2e\accessibility.spec.ts:71:3

# Error details

```
Error: foco perdido tras 2 Tab(s)

expect(received).not.toBeNull()

Received: null
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - img "Logo de Greda" [ref=f1e7]
    - button "Abrir menú principal" [ref=f1e8] [cursor=pointer]
  - main [ref=f1e11]:
    - generic [ref=f1e12]:
      - generic [ref=f1e13]:
        - generic [ref=f1e14]:
          - heading "Inicio." [level=1] [ref=f1e15]
          - paragraph [ref=f1e16]: Resumen general del taller.
        - link "Nueva cotización" [ref=f1e17]:
          - /url: /cotizador/nuevo
      - region "Métricas del taller" [ref=f1e21]:
        - generic [ref=f1e22]:
          - generic [ref=f1e27]:
            - paragraph [ref=f1e28]: Cotizaciones este mes
            - paragraph [ref=f1e29]: "100"
          - generic [ref=f1e30]: en el mes actual
        - generic [ref=f1e31]:
          - generic [ref=f1e36]:
            - paragraph [ref=f1e37]: Confirmadas
            - paragraph [ref=f1e38]: "2"
          - generic [ref=f1e39]: aprobadas del mes
        - link "Borradores pendientes 98 requieren atención" [ref=f1e40]:
          - /url: /cotizaciones
          - generic [ref=f1e45]:
            - paragraph [ref=f1e46]: Borradores pendientes
            - paragraph [ref=f1e47]: "98"
          - generic [ref=f1e48]: requieren atención
        - generic [ref=f1e52]:
          - generic [ref=f1e57]:
            - paragraph [ref=f1e58]: Total cotizado (mes)
            - paragraph [ref=f1e59]: S/ 21,322.60
          - generic [ref=f1e60]: total confirmado
      - generic [ref=f1e61]:
        - region "Cotizaciones recientes" [ref=f1e62]:
          - generic [ref=f1e63]:
            - generic [ref=f1e64]:
              - heading "Cotizaciones recientes" [level=2] [ref=f1e65]
              - link "Ver todas" [ref=f1e66]:
                - /url: /cotizaciones
            - table [ref=f1e68]:
              - rowgroup [ref=f1e69]:
                - row [ref=f1e70]:
                  - columnheader "Código" [ref=f1e71]
                  - columnheader "Cliente" [ref=f1e72]
                  - columnheader "Fecha" [ref=f1e73]
                  - columnheader "Total" [ref=f1e74]
                  - columnheader "Estado" [ref=f1e75]
                  - columnheader "Acción" [ref=f1e76]
              - rowgroup [ref=f1e78]:
                - row [ref=f1e79] [cursor=pointer]:
                  - cell "CTZ-2026-000210" [ref=f1e80]
                  - cell "ANA MARIA CISNEROS VELARDE DE BUTRICH" [ref=f1e81]
                  - cell "28/08/2026" [ref=f1e82]
                  - cell "S/ —" [ref=f1e83]
                  - cell "Borrador" [ref=f1e84]
                  - cell [ref=f1e86]:
                    - link "Abrir cotización CTZ-2026-000210" [ref=f1e87]:
                      - /url: /cotizador/212
                - row [ref=f1e90] [cursor=pointer]:
                  - cell "CTZ-2026-000209" [ref=f1e91]
                  - cell "ANA MARIA CISNEROS VELARDE DE BUTRICH" [ref=f1e92]
                  - cell "28/08/2026" [ref=f1e93]
                  - cell "S/ —" [ref=f1e94]
                  - cell "Borrador" [ref=f1e95]
                  - cell [ref=f1e97]:
                    - link "Abrir cotización CTZ-2026-000209" [ref=f1e98]:
                      - /url: /cotizador/211
                - row [ref=f1e101] [cursor=pointer]:
                  - cell "CTZ-2026-000208" [ref=f1e102]
                  - cell "ANA MARIA CISNEROS VELARDE DE BUTRICH" [ref=f1e103]
                  - cell "28/08/2026" [ref=f1e104]
                  - cell "S/ —" [ref=f1e105]
                  - cell "Borrador" [ref=f1e106]
                  - cell [ref=f1e108]:
                    - link "Abrir cotización CTZ-2026-000208" [ref=f1e109]:
                      - /url: /cotizador/210
                - row [ref=f1e112] [cursor=pointer]:
                  - cell "CTZ-2026-000207" [ref=f1e113]
                  - cell "ANA MARIA CISNEROS VELARDE DE BUTRICH" [ref=f1e114]
                  - cell "28/08/2026" [ref=f1e115]
                  - cell "S/ —" [ref=f1e116]
                  - cell "Borrador" [ref=f1e117]
                  - cell [ref=f1e119]:
                    - link "Abrir cotización CTZ-2026-000207" [ref=f1e120]:
                      - /url: /cotizador/209
                - row [ref=f1e123] [cursor=pointer]:
                  - cell "CTZ-2026-000206" [ref=f1e124]
                  - cell "ANA MARIA CISNEROS VELARDE DE BUTRICH" [ref=f1e125]
                  - cell "28/08/2026" [ref=f1e126]
                  - cell "S/ —" [ref=f1e127]
                  - cell "Borrador" [ref=f1e128]
                  - cell [ref=f1e130]:
                    - link "Abrir cotización CTZ-2026-000206" [ref=f1e131]:
                      - /url: /cotizador/208
        - region "Pendientes y alertas" [ref=f1e134]:
          - generic [ref=f1e135]:
            - heading "Pendientes / Alertas" [level=2] [ref=f1e137]
            - generic [ref=f1e138]:
              - link [ref=f1e139]:
                - /url: /cotizaciones
                - generic [ref=f1e144]:
                  - paragraph [ref=f1e145]: 98 borradores
                  - paragraph [ref=f1e146]: Cotizaciones sin finalizar
              - link [ref=f1e149]:
                - /url: /productos
                - generic [ref=f1e154]:
                  - paragraph [ref=f1e155]: 100 productos sin medida
                  - paragraph [ref=f1e156]: Completar dimensiones
      - generic [ref=f1e159]:
        - region "Actividad reciente" [ref=f1e160]:
          - generic [ref=f1e161]:
            - heading "Actividad reciente" [level=2] [ref=f1e162]
            - link "Ver todas" [ref=f1e163]:
              - /url: /cotizaciones
          - generic [ref=f1e164]:
            - link "Cotización CTZ-2026-000210 registrada (Borrador) Hace 1 min" [ref=f1e165]:
              - /url: /cotizador/212
              - paragraph [ref=f1e170]: Cotización CTZ-2026-000210 registrada (Borrador)
              - generic [ref=f1e171]: Hace 1 min
            - link "Cotización CTZ-2026-000209 registrada (Borrador) Hace 1 min" [ref=f1e172]:
              - /url: /cotizador/211
              - paragraph [ref=f1e177]: Cotización CTZ-2026-000209 registrada (Borrador)
              - generic [ref=f1e178]: Hace 1 min
            - link "Cotización CTZ-2026-000208 registrada (Borrador) Hace 1 min" [ref=f1e179]:
              - /url: /cotizador/210
              - paragraph [ref=f1e184]: Cotización CTZ-2026-000208 registrada (Borrador)
              - generic [ref=f1e185]: Hace 1 min
            - link "Cotización CTZ-2026-000207 registrada (Borrador) Hace 2 min" [ref=f1e186]:
              - /url: /cotizador/209
              - paragraph [ref=f1e191]: Cotización CTZ-2026-000207 registrada (Borrador)
              - generic [ref=f1e192]: Hace 2 min
            - link "Cotización CTZ-2026-000206 registrada (Borrador) Hace 2 min" [ref=f1e193]:
              - /url: /cotizador/208
              - paragraph [ref=f1e198]: Cotización CTZ-2026-000206 registrada (Borrador)
              - generic [ref=f1e199]: Hace 2 min
        - region "Accesos rápidos" [ref=f1e200]:
          - generic [ref=f1e201]:
            - heading "Accesos rápidos" [level=2] [ref=f1e203]
            - generic [ref=f1e204]:
              - link "Cotizador" [ref=f1e205]:
                - /url: /cotizador/nuevo
              - link "Productos" [ref=f1e210]:
                - /url: /productos
              - link "Terceros" [ref=f1e215]:
                - /url: /terceros
              - link "Cotizaciones" [ref=f1e220]:
                - /url: /cotizaciones
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | import { login } from "./helpers/auth";
  4  | import { hasE2ECredentials } from "./helpers/fixtures";
  5  | 
  6  | /**
  7  |  * Fase 009A — accesibilidad basica (no un audit completo axe-core): botones
  8  |  * sin nombre accesible, inputs sin etiqueta, y que Tab no deje el foco
  9  |  * "perdido" (fuera del documento o en un elemento invisible).
  10 |  */
  11 | 
  12 | const PAGES: Array<{ label: string; path: string }> = [
  13 |   { label: "Inicio", path: "/" },
  14 |   { label: "Cotizador", path: "/cotizador/nuevo" },
  15 |   { label: "Cotizaciones", path: "/cotizaciones" },
  16 |   { label: "Productos", path: "/productos" },
  17 |   { label: "Inventario", path: "/inventario" },
  18 |   { label: "Recetas", path: "/recetas" },
  19 | ];
  20 | 
  21 | test.describe("Accesibilidad basica", () => {
  22 |   test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");
  23 | 
  24 |   for (const { label, path } of PAGES) {
  25 |     test(`${label}: botones e inputs tienen nombre accesible`, async ({ page }) => {
  26 |       await login(page);
  27 |       await page.goto(path, { waitUntil: "networkidle" });
  28 | 
  29 |       const unnamedButtons = await page.evaluate(() => {
  30 |         const hasAccessibleName = (el: Element): boolean => {
  31 |           if (el.getAttribute("aria-label")?.trim()) return true;
  32 |           if (el.getAttribute("aria-labelledby")) return true;
  33 |           if (el.getAttribute("title")?.trim()) return true;
  34 |           return (el.textContent ?? "").trim().length > 0;
  35 |         };
  36 |         return Array.from(document.querySelectorAll("button"))
  37 |           .filter((btn) => {
  38 |             const style = window.getComputedStyle(btn);
  39 |             const visible = style.display !== "none" && style.visibility !== "hidden" && btn.offsetParent !== null;
  40 |             return visible && !hasAccessibleName(btn);
  41 |           })
  42 |           .map((btn) => btn.outerHTML.slice(0, 150));
  43 |       });
  44 | 
  45 |       const unlabeledInputs = await page.evaluate(() => {
  46 |         const hasLabel = (el: HTMLElement): boolean => {
  47 |           if (el.getAttribute("aria-label")?.trim()) return true;
  48 |           if (el.getAttribute("aria-labelledby")) return true;
  49 |           const id = el.getAttribute("id");
  50 |           if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return true;
  51 |           if (el.closest("label")) return true;
  52 |           return false;
  53 |         };
  54 |         const controls = Array.from(document.querySelectorAll("input, textarea, select")) as HTMLElement[];
  55 |         return controls
  56 |           .filter((el) => {
  57 |             const type = (el.getAttribute("type") ?? "").toLowerCase();
  58 |             if (["hidden", "submit", "button"].includes(type)) return false;
  59 |             const style = window.getComputedStyle(el);
  60 |             const visible = style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
  61 |             return visible && !hasLabel(el);
  62 |           })
  63 |           .map((el) => el.outerHTML.slice(0, 150));
  64 |       });
  65 | 
  66 |       expect(unnamedButtons, `botones sin nombre accesible en ${label}`).toEqual([]);
  67 |       expect(unlabeledInputs, `inputs sin etiqueta en ${label}`).toEqual([]);
  68 |     });
  69 |   }
  70 | 
  71 |   test("Inicio: Tab no pierde el foco (permanece en un elemento visible del documento)", async ({ page }) => {
  72 |     await login(page);
  73 |     await page.goto("/", { waitUntil: "networkidle" });
  74 | 
  75 |     for (let i = 0; i < 15; i++) {
  76 |       await page.keyboard.press("Tab");
  77 |       const focused = await page.evaluate(() => {
  78 |         const el = document.activeElement;
  79 |         if (!el || el === document.body) return null;
  80 |         const style = window.getComputedStyle(el);
  81 |         return {
  82 |           tag: el.tagName,
  83 |           visible: style.display !== "none" && style.visibility !== "hidden",
  84 |         };
  85 |       });
> 86 |       expect(focused, `foco perdido tras ${i + 1} Tab(s)`).not.toBeNull();
     |                                                                ^ Error: foco perdido tras 2 Tab(s)
  87 |       expect(focused?.visible, `foco en elemento invisible tras ${i + 1} Tab(s)`).toBe(true);
  88 |     }
  89 |   });
  90 | });
  91 | 
```