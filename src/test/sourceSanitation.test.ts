/**
 * Ningún archivo fuente lleva bytes de control accidentales.
 *
 * Existe por un caso real: una expresión regular acabó conteniendo un byte
 * `0x08` en lugar de `\b`, porque la herramienta que escribió el archivo
 * interpretó el escape en vez de dejarlo literal. El resultado no fue un error
 * de compilación ni de lint —el archivo era TypeScript válido— sino una regex
 * que buscaba un carácter de retroceso y por tanto no coincidía nunca.
 *
 * Costó cuatro intentos de diagnóstico porque cada pieza funcionaba por
 * separado: el patrón coincidía en un intérprete, el catálogo devolvía el
 * mensaje, y sólo dentro del módulo salía `undefined`. `cat -A` lo delató.
 *
 * Un byte invisible que rompe la lógica sin romper la sintaxis merece una
 * prueba, no una anécdota.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

/** Tabulador, salto de línea y retorno de carro son legítimos. */
const PERMITIDOS = new Set([0x09, 0x0a, 0x0d]);

function archivosFuente(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta);
    return /\.(ts|tsx|css)$/.test(entrada) ? [ruta] : [];
  });
}

describe("CONTROL_BYTES_IN_SRC", () => {
  it("ningún archivo fuente contiene bytes de control", () => {
    const sospechosos: string[] = [];
    for (const ruta of archivosFuente(SRC)) {
      const bytes = readFileSync(ruta);
      for (let i = 0; i < bytes.length; i += 1) {
        const byte = bytes[i] as number;
        if (byte < 0x20 && !PERMITIDOS.has(byte)) {
          sospechosos.push(
            `${ruta.replace(process.cwd(), "")}: 0x${byte.toString(16).padStart(2, "0")}`,
          );
          break;
        }
      }
    }
    expect(sospechosos).toEqual([]);
  });

  it("el detector encuentra un byte de control cuando lo hay", () => {
    // Control positivo: sin esto, la prueba anterior pasaría igual de bien si
    // el recorrido de archivos estuviera roto y no leyera nada.
    // El byte se construye por codigo a proposito: escribirlo literal aqui
    // lo convertiria en el mismo problema que esta prueba vigila, y el
    // archivo se delataria a si mismo.
    const retroceso = String.fromCharCode(8);
    const conRetroceso = Buffer.from(`const re = /${retroceso}abc/;`, "utf-8");
    const encontrado = Array.from(conRetroceso).some(
      (byte) => byte < 0x20 && !PERMITIDOS.has(byte),
    );
    expect(encontrado).toBe(true);
  });

  it("recorre archivos de verdad", () => {
    // La otra mitad del control positivo: si el listado devolviera una lista
    // vacia, «no hay bytes de control» seria cierto y no significaria nada.
    expect(archivosFuente(SRC).length).toBeGreaterThan(50);
  });
});
