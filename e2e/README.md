# E2E (Playwright) — Cotizador Greda

> **Dos suites, dos preguntas distintas (desde la Fase 010G).**
>
> | | Smoke de produccion | E2E de la revision |
> |---|---|---|
> | Pregunta | ¿Sigue en pie lo desplegado? | ¿Funciona lo que trae esta rama? |
> | Specs | `e2e/*.spec.ts` | `e2e/revision/*.spec.ts` |
> | Config | `playwright.config.ts` | `playwright.revision.config.ts` |
> | Target | produccion (`E2E_BASE_URL` o la URL real) | la app construida de la rama, en `localhost` |
> | Backend | el desplegado | `Anthgg/BGreda` en `BACKEND_REF`, levantado en el job |
> | Job de CI | «Smoke de produccion (Chromium)» | «E2E de la revision (Chromium)» |
> | Sin credenciales | se omite (aviso visible) | nunca se omite: las genera el job |
>
> Una prueba FUNCIONAL de algo nuevo va en `e2e/revision/`. Ponerla junto al
> smoke la mandaria contra produccion, que todavia no tiene ese cambio: fallaria
> por la razon equivocada o, sin credenciales, se saltaria dejando un verde vacio.
>
> Correrla en local:
>
> Son tres procesos que se quedan corriendo, asi que van en **tres
> terminales**, y las tres tienen que ver las MISMAS credenciales: el backend
> de la revision registra dos cuentas en su autenticacion simulada (una ADMIN
> y una OPERATOR) y Playwright entra con ellas. Como `openssl rand` da un valor
> distinto cada vez, se generan **una sola vez** en un fichero fuera del repo y
> cada terminal lo carga. Son aleatorias, igual que en CI: no hay ninguna
> credencial real que poner aqui.
>
> ```bash
> # UNA sola vez. Ajusta BGREDA_DIR si tu clon del backend esta en otro sitio;
> # la URL de la base es la misma que usa CI (usuario y clave `greda`).
> cat > "$HOME/.greda-e2e-revision.env" <<EOF
> export BGREDA_DIR="$HOME/BGreda"
> export DATABASE_URL=postgresql://greda:greda@localhost:5432/greda_e2e
> export E2E_EMAIL=e2e@example.com
> export E2E_PASSWORD=$(openssl rand -hex 24)
> export E2E_OPERATOR_EMAIL=e2e-operator@example.com
> export E2E_OPERATOR_PASSWORD=$(openssl rand -hex 24)
> EOF
> ```
>
> ```bash
> # terminal 1 — backend de la revision (queda sirviendo en :8000)
> source "$HOME/.greda-e2e-revision.env"
> cd "$BGREDA_DIR"
> uv sync
> uv run alembic upgrade head
> GREDA_E2E_REVISION=1 \
>   FRONTEND_ORIGINS=http://localhost:4173 \
>   COOKIE_SECURE=false \
>   uv run python -m tests.e2e.servidor_revision --port 8000
> ```
>
> ```bash
> # terminal 2 — la app construida desde esta rama (queda sirviendo en :4173)
> source "$HOME/.greda-e2e-revision.env"
> VITE_API_BASE_URL=http://localhost:4173 npm run build
> npx vite preview --port 4173 --strictPort
> ```
>
> ```bash
> # terminal 3 — las pruebas
> source "$HOME/.greda-e2e-revision.env"
> E2E_BASE_URL=http://localhost:4173 \
>   E2E_PDF_PYTHON="$BGREDA_DIR/.venv/bin/python" \
>   npx playwright test -c playwright.revision.config.ts
> ```
>
> `playwright.revision.config.ts` se niega a arrancar si falta cualquiera de
> `E2E_BASE_URL` (que ademas tiene que ser `localhost` o `127.0.0.1`),
> `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_OPERATOR_EMAIL` o `E2E_OPERATOR_PASSWORD`:
> sin valores por defecto, para que no pueda caer contra un sitio real.
> `E2E_PDF_PYTHON` lo exige `cotizador-v2-ciclo-de-vida.spec.ts` para extraer
> el texto del PDF con el `pypdf` del backend; en Windows (Git Bash) es
> `"$BGREDA_DIR/.venv/Scripts/python.exe"`. `VITE_API_BASE_URL` apunta al
> propio `vite preview`, que reenvia `/api` al backend.
>
> Lo que sigue describe el **smoke de produccion**.

Suite Playwright que corre **contra un ambiente real** (por defecto, producción:
`https://fgreda-web-303244958634.southamerica-west1.run.app`). No usa mocks ni
un backend de prueba: todo lo que hace la suite hace requests reales a BGreda.

## Cómo correrla

```bash
npm run e2e                # todos los proyectos (chromium/firefox/webkit/mobile-ios/mobile-android)
npm run e2e:chromium        # solo chromium (el que corre en CI por PR)
npx playwright test --project=firefox
npx playwright test -g "CASO B"
```

Variables de entorno:

| Variable | Requerida para | Efecto si falta |
|---|---|---|
| `E2E_BASE_URL` | apuntar a un ambiente distinto de producción | usa la URL de producción por defecto |
| `E2E_EMAIL` / `E2E_PASSWORD` | todo lo que necesita sesión (casi toda la suite) | los tests que dependen de login se **saltan** (`test.skip`), nunca fallan en falso |
| `BACKEND_BASE_URL` | `e2e/helpers/api.ts` (conteos de Quemas/Inventario antes/después) | los specs que lo usan documentan su propio fallback |

**Nunca** se hardcodean credenciales ni se versiona un `storageState` con cookies
reales (ver `.gitignore`: `**/.auth/`). Las credenciales de prueba usadas en
esta fase son una cuenta real ya existente (rol Administrador) — la política
del proyecto prohíbe inventar usuarios o contraseñas, así que si no hay
`E2E_EMAIL`/`E2E_PASSWORD` configuradas, la suite completa se salta en vez de
fallar.

## Política de no-mutación

Toda cotización/tercero que un test crea usa el prefijo `E2E-` (`testName()` en
`e2e/helpers/fixtures.ts`) para quedar identificable y no colisionar entre
corridas. La suite:

- No borra registros reales (no hay ningún `DELETE` ni "vaciar" nada).
- No confirma cotizaciones de prueba salvo en el flujo explícito de
  `cotizador.spec.ts` ("flujo completo"), que además verifica —vía
  `e2e/helpers/api.ts`— que el conteo de Quemas e Inventario no cambia antes/
  después (una cotización confirmada no debe disparar producción real).
- Deja borradores `E2E-*` sin anular cuando el propósito del test es solo
  verificar UI (anular también es una mutación, y no es el objetivo del test).

## Cobertura por módulo

| Módulo | Spec | Cubre |
|---|---|---|
| Auth | `auth.spec.ts` | login válido/inválido, persistencia de sesión, nueva pestaña, redirect sin sesión, logout |
| Cotizador | `cotizador.spec.ts` | D2 (bloqueo de Siguiente sin cliente), flujo multiproducto completo, costeo/markup/IGV, PDF, confirmación, no-mutación de Quemas/Inventario |
| Concurrencia | `concurrency.spec.ts` | doble-clic en Confirmar (CASO B), doble-clic en Guardar (CASO D); CASO A y CASO C documentados abajo |
| Terceros | `terceros.spec.ts` | lookup DNI/RUC, autocompletado y persistencia de ubigeo |
| Recetas | `recipes.spec.ts` | listado, detalle, rendimiento, búsqueda, historial de versiones, no-persistencia del simulador |
| Inventario | `inventory.spec.ts` | listado real, saldo no editable inline; permisos por rol: skip en el smoke, verificado en el gate de revisión (ver abajo) |
| Importaciones | `imports.spec.ts` | archivo corrupto → error controlado, nunca 500, nunca llega a confirmar |
| Permisos | `permissions.spec.ts` | skip en el smoke; verificado en el gate de revisión (ver abajo) |

## Permisos por rol: verificados en el gate de revisión, no en el smoke

`permissions.spec.ts` y la sección "Inventario: permisos" de
`inventory.spec.ts` siguen en `test.skip`, pero **ya no son NOT_VERIFIED**.
El skip es porque el smoke corre contra producción con la única cuenta real
(ADMIN), y aprovisionar ahí una cuenta no-admin sería crear un usuario en
producción para pasar una prueba. Contra producción no se duplica.

Los casos se ejercitan en el gate de revisión, que levanta backend y frontend
de la rama con un operador sembrado en local (en CI, credenciales aleatorias
por corrida en `E2E_OPERATOR_EMAIL` / `E2E_OPERATOR_PASSWORD`):

- **UI_PERMISSION_BYPASS** y **BACKEND_PERMISSION_BYPASS** —
  `e2e/revision/cotizador-v2-pre010i.spec.ts`, test «A2H-002: operador local
  ve UI restringida y la API responde 403». El operador ve la configuración
  del Cotizador V2 en solo lectura (sin Guardar/Editar/Configurar) y la misma
  mutación por API directa (`PUT /settings/commercial`) responde 403: el
  backend es la autoridad final.
- **INVENTORY_PERMISSION_BYPASS** — `e2e/revision/inventario-operador.spec.ts`.
  Documenta la política real, no una inventada:
  - **ajustar existencia es del taller** (`ajustarInventario: esTaller` en
    `src/features/auth/capabilities.ts`; `POST /inventory/adjustments` con
    `WorkshopUserDep` = ADMIN u OPERATOR). El test lo **hace de verdad** por la
    pantalla: el ADMIN monta un almacén propio de la corrida con saldo
    conocido, el operador pulsa «Ajustar», registra un delta, y se comprueba
    que el saldo se mueve exactamente eso y que queda **un** movimiento
    `ADJUSTMENT` con el delta, el saldo resultante, el motivo y el nombre de
    quien lo hizo;
  - **abrir un almacén es administrativo** (`crearAlmacen: esAdmin`;
    `POST /inventory/locations` con `AdminUserDep`). El test manda un payload
    **válido** —el mismo que como ADMIN sí crea el almacén, que es el
    control— y comprueba que al operador le responde 403 y que el almacén no
    queda creado. Sin ese control, un 403 podría venir de un cuerpo mal
    formado (el esquema rechaza campos de más) y no del rol.

  Esto es el ajuste manual que ya existe, no el consumo de una orden de
  producción: que un operador pueda ajustar a mano no significa que una
  cotización consuma inventario.

## Casos documentados como NOT_VERIFIED / skip permanente

### CASO A: edición concurrente del mismo borrador (`concurrency.spec.ts`)

Necesita dos contextos de navegador editando **el mismo** `DRAFT` ya
persistido al mismo tiempo, para observar cómo resuelve el backend un
conflicto de versión (last-write-wins vs. conflicto explícito). Automatizarlo
de punta a punta requeriría crear el borrador, capturar su id, y solo
entonces abrir el segundo contexto — lo cual es viable, pero se dejó como
procedimiento manual en esta fase para no introducir otro punto de
flakiness (el id depende de un create previo) sin antes tener el resto de la
suite estable. Procedimiento manual:

1. Loguearse en dos pestañas/perfiles distintos con la misma cuenta.
2. En la pestaña A, crear un borrador `E2E-Concurrencia-CasoA-...` y anotar su
   `CTZ-...`.
3. En la pestaña B, navegar al mismo borrador (`/cotizador/<id>`).
4. En A, cambiar el nombre y "Guardar borrador". En B, sin recargar, cambiar
   un campo distinto y "Guardar borrador" también.
5. Verificar en el backend (o recargando ambas pestañas) qué versión quedó:
   si el segundo guardado sobrescribe silenciosamente el primero sin aviso,
   es un defecto a reportar; si el backend devuelve 409 o similar, es el
   comportamiento esperado.

### CASO C: dos requests completando dimensiones NULL simultáneamente

Necesita un producto real del catálogo con dimensiones `NULL` en el momento
exacto de la corrida. No se puede garantizar sin mutar deliberadamente el
catálogo de producción (crear o alterar un producto para dejarlo sin
dimensiones), lo cual está fuera del alcance no-destructivo de esta fase.
Queda documentado y saltado hasta que exista un producto así de forma
natural, o se autorice explícitamente crear uno de prueba.

## Físico vs. emulado

Los proyectos `webkit` y `mobile-ios`/`mobile-android` de `playwright.config.ts`
corren sobre los motores que Playwright empaqueta (WebKit headless, emulación
de viewport/UA), **no** sobre Safari real ni un dispositivo físico. Cualquier
reporte de esta suite que diga "Safari" o "iOS/Android" se refiere siempre a
esa emulación — `SAFARI_PHYSICAL` y `MOBILE_PHYSICAL` quedan `NOT_VERIFIED`
hasta que alguien los pruebe en hardware real.
