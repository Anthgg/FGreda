/**
 * Fixtures compartidas de la suite E2E.
 *
 * Credenciales SOLO via variables de entorno (E2E_EMAIL / E2E_PASSWORD).
 * Nunca hardcodeadas, nunca impresas, nunca versionadas en un storageState.
 */

/** Prefijo obligatorio para cualquier dato de prueba creado contra produccion. */
export const TEST_DATA_PREFIX = "E2E-";

/** Nombre unico por ejecucion, para no colisionar entre corridas paralelas/repetidas. */
export function testName(label: string): string {
  return `${TEST_DATA_PREFIX}${label}-${Date.now()}`;
}

export const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";

/** true si hay credenciales de prueba configuradas para correr flujos autenticados. */
export const hasE2ECredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);
