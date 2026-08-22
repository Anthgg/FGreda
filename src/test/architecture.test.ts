/**
 * Guardas arquitectonicas.
 *
 * Convierten en fallo de compilacion las reglas que de otro modo dependerian de
 * la disciplina de quien escribe el codigo: nada de Supabase en el frontend,
 * ninguna sesion en el almacenamiento del navegador y un unico punto de salida
 * HTTP.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import packageJson from "../../package.json" with { type: "json" };

// Vitest se ejecuta desde la raiz del proyecto. No se usa import.meta.url
// porque bajo el entorno jsdom no es una URL de esquema file:.
const SRC_DIR = join(process.cwd(), "src");

function sourceFiles(directory: string = SRC_DIR): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

function productionFiles(): string[] {
  return sourceFiles().filter(
    (path) => !/\.test\.(ts|tsx)$/.test(path) && !path.includes(`${join("src", "test")}`),
  );
}

/**
 * Devuelve el codigo sin comentarios.
 *
 * Sin esto, un comentario que explica una prohibicion la haria saltar.
 */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("regla arquitectonica: el frontend solo habla con el backend", () => {
  it("no declara ninguna dependencia de Supabase", () => {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const supabase = Object.keys(dependencies).filter((name) => name.includes("supabase"));

    expect(supabase).toEqual([]);
  });

  it("no importa ningun SDK de Supabase en el codigo", () => {
    const offenders = productionFiles().filter((path) =>
      /@supabase\/|from ["']supabase/.test(code(path)),
    );

    expect(offenders).toEqual([]);
  });

  it("no usa localStorage ni sessionStorage", () => {
    const offenders = productionFiles().filter((path) =>
      /localStorage|sessionStorage/.test(code(path)),
    );

    expect(offenders).toEqual([]);
  });

  it("solo el cliente centralizado invoca fetch", () => {
    const offenders = productionFiles().filter(
      (path) => !path.endsWith(join("api", "client.ts")) && /\bfetch\(/.test(code(path)),
    );

    expect(offenders).toEqual([]);
  });

  it("no expone ninguna variable de entorno mas que la URL del backend", () => {
    const usadas = new Set<string>();
    for (const path of productionFiles()) {
      for (const match of code(path).matchAll(/import\.meta\.env\.(\w+)/g)) {
        usadas.add(match[1]!);
      }
    }

    expect([...usadas]).toEqual(["VITE_API_BASE_URL"]);
  });
});
