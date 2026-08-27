import { test } from "@playwright/test";

/**
 * Roles y permisos.
 *
 * Este entorno solo tiene una cuenta de prueba real disponible (ADMIN).
 * La regla del proyecto es explicita: "no inventar credenciales, no crear
 * usuarios". Sin un segundo usuario real con un rol restringido (OPERATOR
 * u otro no-admin), UI_PERMISSION_BYPASS y BACKEND_PERMISSION_BYPASS no se
 * pueden ejercitar de verdad — un test que solo llame a la API como ADMIN
 * no probaria nada sobre restriccion de permisos.
 *
 * Se documenta como NOT_VERIFIED en vez de fabricar un resultado. Si en
 * algun momento se aprovisiona un usuario de prueba no-admin real, este
 * archivo es el lugar para los casos:
 *   - ruta permitida vs prohibida en el sidebar/router;
 *   - botones ocultos en la UI para ese rol;
 *   - la MISMA mutacion intentada por API directa debe devolver 403,
 *     incluso si la UI ya oculta el boton (el backend es la autoridad).
 */
test.describe("Roles y permisos", () => {
  test.skip(true, "UI_PERMISSION_BYPASS / BACKEND_PERMISSION_BYPASS: NOT_VERIFIED — falta un usuario de prueba no-admin real");
});
