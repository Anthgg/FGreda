import { test } from "@playwright/test";

/**
 * Roles y permisos.
 *
 * Esta suite es el SMOKE DE PRODUCCION: corre contra la URL desplegada y con
 * la unica cuenta real que este entorno tiene (ADMIN). Aprovisionar ahi un
 * segundo usuario no-admin seria crear una cuenta en produccion, y eso no se
 * hace para pasar una prueba.
 *
 * UI_PERMISSION_BYPASS y BACKEND_PERMISSION_BYPASS ya NO estan sin verificar:
 * se ejercitan en el gate de revision, que levanta backend y frontend de la
 * rama con un operador sembrado en local —
 * `e2e/revision/cotizador-v2-pre010i.spec.ts`, casos «A2H-002» —, donde se
 * comprueban las dos mitades que importan:
 *   - la UI no ofrece a ese rol lo que no puede hacer;
 *   - la MISMA mutacion por API directa responde 403, aunque el boton ya no
 *     este (el backend es la autoridad final).
 *
 * Aqui no se duplica: contra produccion no hay con quien probarlo.
 */
test.describe("Roles y permisos", () => {
  test.skip(
    true,
    "Verificado en el gate de revision (e2e/revision/cotizador-v2-pre010i.spec.ts, A2H-002): " +
      "el smoke de produccion no aprovisiona cuentas no-admin",
  );
});
