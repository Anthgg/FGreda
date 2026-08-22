# FGreda — Frontend del Cotizador Greda

SPA construida con React, TypeScript y Vite. Contiene exclusivamente la capa de
presentación: consume la API de BGreda por HTTPS y **no posee autoridad sobre
ninguna regla de negocio**.

- Backend (única fuente de verdad): <https://github.com/Anthgg/BGreda>

---

## Regla arquitectónica: solo backend

```
React (FGreda)
   │  HTTPS  (cookies HttpOnly + X-CSRF-Token)
FastAPI (BGreda)
   │
Supabase Auth · PostgreSQL · servicios externos
```

Este frontend **no**:

- instala `@supabase/supabase-js` ni ningún SDK de Supabase;
- consulta Supabase, PostgreSQL ni ejecuta SQL;
- maneja Supabase Auth ni interpreta JWT;
- recibe service role keys ni publishable keys;
- guarda tokens en `localStorage` o `sessionStorage`;
- calcula costos, aplica reglas de inventario ni genera correlativos;
- decide permisos por su cuenta.

Lo único que hace: capturar datos, llamar al backend, mostrar la respuesta y
manejar estado visual. **Toda validación se repite en el backend.**

Estas reglas no dependen de la disciplina de quien escribe el código: se hacen
cumplir automáticamente.

| Mecanismo | Qué impide |
|---|---|
| ESLint `no-restricted-imports` | Importar cualquier paquete de Supabase |
| ESLint `no-restricted-globals` | Usar `localStorage`, `sessionStorage` o `fetch` fuera del cliente central |
| `src/test/architecture.test.ts` | Dependencias de Supabase, almacenamiento de sesión, `fetch` disperso y variables de entorno no autorizadas |
| Paso de CI sobre `dist/` | Que el bundle publicado contenga cualquiera de lo anterior |

---

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:5173
```

## Variables de entorno

Este proyecto declara **una sola variable**, a propósito:

| Variable | Descripción |
|---|---|
| `VITE_API_BASE_URL` | URL base del backend BGreda, sin barra final. |

```
# desarrollo
VITE_API_BASE_URL=http://localhost:8000
```

> ⚠️ En Vite, toda variable con prefijo `VITE_` queda **incrustada en el bundle
> público**. Por eso aquí no existe ninguna URL ni clave de Supabase: no hay
> secretos que colocar en el frontend.

El cliente HTTP construye las rutas como `${VITE_API_BASE_URL}/api/v1/...`.

---

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm run lint        # ESLint (falla con cualquier advertencia)
npm run typecheck   # TypeScript en modo estricto
npm test            # Vitest
npm run build       # typecheck + build de producción
npm run preview     # sirve el build local
```

---

## Arquitectura

```
src/
├── api/
│   ├── client.ts        # cliente HTTP único (CSRF, refresh, timeout, errores)
│   └── auth.ts          # operaciones de autenticación
├── components/          # piezas de interfaz reutilizables
├── features/
│   └── auth/
│       ├── LoginPage.tsx
│       ├── ProtectedRoute.tsx
│       └── useSession.ts
├── layouts/
│   ├── AppShell.tsx     # estructura visual de la app autenticada
│   └── navigation.ts    # menú principal
├── routes/              # mapa de rutas y páginas
├── test/                # utilidades y guardas arquitectónicas
├── types/               # contratos compartidos con el backend
├── App.tsx
└── main.tsx
```

### Cliente HTTP

`src/api/client.ts` es el **único** módulo autorizado a usar `fetch`. Centraliza:

- `credentials: "include"` en todas las peticiones — sin esto el navegador no
  enviaría las cookies de sesión;
- el token CSRF, guardado **solo en memoria** y enviado en `X-CSRF-Token` en
  `POST`, `PUT`, `PATCH` y `DELETE`;
- **un** reintento tras renovar la sesión ante un 401, con las peticiones
  concurrentes compartiendo un único refresh (nunca hay bucles);
- **un** reintento con token nuevo ante un 403 de CSRF;
- timeout de 15 s y traducción de todo fallo a un `ApiError` uniforme.

`/auth/refresh`, `/auth/login`, `/auth/logout` y `/auth/csrf` están excluidas del
refresh automático: sin esa exclusión, un 401 de la propia renovación
desencadenaría un bucle infinito.

Los componentes nunca llaman a `fetch` directamente.

### Sesión

`/api/v1/auth/me` es la **única fuente de verdad**. Al arrancar, la aplicación
pregunta al backend:

- mientras responde → pantalla de carga (nunca el login);
- si hay sesión → se renderiza la aplicación;
- si no → redirección a `/login`.

La existencia de cookies **no** se usa como evidencia de autenticación: son
`HttpOnly` y JavaScript no puede leerlas. Al cerrar sesión se llama a
`POST /auth/logout` y luego se limpia el estado en memoria — no hay ningún token
local que borrar.

### Interfaz

Diseño compacto y profesional pensado para uso prolongado al 100 % de zoom: base
tipográfica de 14 px, superficies planas, bordes finos y un acento terracota
apagado. Barra lateral en escritorio, menú plegable en móvil.

El menú declara toda la navegación prevista del producto —Inicio, Productos,
Inventario, Recetas, Quemas, Cotizaciones y Configuración— pero **en la Fase 1
solo `Inicio` tiene contenido funcional**. El resto aparece deshabilitado y
marcado como próximo módulo; su lógica corresponde a fases posteriores.

---

## Pruebas

`npm test` ejecuta Vitest con Testing Library sobre jsdom. `fetch` se sustituye
por un doble, de modo que la suite no necesita backend ni red. Cubre el cliente
HTTP (cookies, CSRF, refresh sin bucles, errores de red), la pantalla de login
(envío, credenciales inválidas, backend caído, doble envío), las rutas protegidas
(carga, sesión existente, redirección, logout) y las guardas arquitectónicas.

---

## Docker

```bash
docker build -t fgreda --build-arg VITE_API_BASE_URL=https://api.example.com .
docker run --rm -p 8080:8080 fgreda
```

Build con Node y servido por nginx sin privilegios (UID 101). Escucha `PORT`
—inyectado por Cloud Run—, resuelve el fallback de React Router y no contiene
ningún secreto.

`VITE_API_BASE_URL` debe pasarse como **build arg**: Vite incrusta las variables
en tiempo de compilación, así que cambiar de backend requiere reconstruir la
imagen.

---

## CI

`.github/workflows/ci.yml` se ejecuta en cada PR y en `main`:

1. `npm ci` — falla si el lockfile no coincide con `package.json`
2. `npm run lint` — ESLint sin admitir advertencias
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
6. Auditoría del bundle generado
7. Construcción de la imagen, arranque del contenedor, verificación del fallback
   de React Router y comprobación de que el proceso no corre como root

Ningún paso usa `continue-on-error`.
