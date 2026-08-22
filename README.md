# FGreda

Frontend del **Cotizador Greda** — SPA construida con React, TypeScript y Vite.

Este repositorio contiene exclusivamente la capa de presentacion. Consume la API
del backend por HTTPS y no posee autoridad sobre ninguna regla de negocio.

- Backend (unica fuente de verdad): <https://github.com/Anthgg/BGreda>

## Regla arquitectonica

```
React (FGreda)
  |  HTTPS
FastAPI (BGreda)
  |
Supabase / PostgreSQL / servicios externos
```

Este frontend **no** instala `@supabase/supabase-js`, **no** consulta Supabase ni
PostgreSQL, **no** maneja Supabase Auth y **no** almacena tokens en el navegador.

## Estado

Commit tecnico de bootstrap. La implementacion de la Fase 1 se desarrolla en la
rama `feat/phase-001-foundation-auth`.
