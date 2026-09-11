import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { QUOTER_V2_BASE } from "@/api/quoterV2";

const SRC = resolve(__dirname, "..");

function imports(relativePath: string): string[] {
  const contenido = readFileSync(resolve(SRC, relativePath), "utf-8");
  return [...contenido.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] as string);
}

describe("cliente del Cotizador V2", () => {
  it("apunta a una ruta que no comparte segmento con el Cotizador Legacy", () => {
    expect(QUOTER_V2_BASE).toBe("/quotations-v2");
    // `/quotations-v2` no es un subrecurso de `/quotations`: son dos raices
    // distintas, asi que ninguna URL de un motor cae en la del otro.
    expect(QUOTER_V2_BASE.startsWith("/quotations/")).toBe(false);
  });

  it("no importa el cliente ni los tipos del Cotizador Legacy", () => {
    const prohibidos = ["@/api/quotations", "@/api/quotationBuilder", "@/types/quotationBuilder"];
    for (const modulo of ["api/quoterV2.ts", "types/quoterV2.ts", "features/cotizadorV2/useQuoterV2.ts"]) {
      const encontrados = imports(modulo).filter((ruta) => prohibidos.includes(ruta));
      expect(encontrados, `${modulo} importa Legacy: ${encontrados.join(", ")}`).toHaveLength(0);
    }
  });

  it("el Cotizador Legacy tampoco importa el dominio V2", () => {
    // La dependencia no puede existir en ninguna direccion: si Legacy llamara
    // a V2, retirar Legacy dejaria de ser una operacion local.
    for (const modulo of ["api/quotations.ts", "api/quotationBuilder.ts"]) {
      const encontrados = imports(modulo).filter((ruta) => ruta.includes("quoterV2"));
      expect(encontrados, `${modulo} importa V2: ${encontrados.join(", ")}`).toHaveLength(0);
    }
  });
});
