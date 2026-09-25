import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { QUOTER_V2_BASE } from "@/api/quoterV2";

const SRC = resolve(__dirname, "..");

function imports(relativePath: string): string[] {
  const contenido = readFileSync(resolve(SRC, relativePath), "utf-8");
  // Comillas simples tambien: si un formateador las cambia, una regex que
  // solo mire las dobles dejaria de ver los imports y la prueba pasaria en
  // verde sin comprobar nada.
  return [...contenido.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1] as string);
}

function modulosDe(carpeta: string): string[] {
  return readdirSync(resolve(SRC, carpeta), { recursive: true, withFileTypes: true })
    .filter((entrada) => entrada.isFile() && /\.tsx?$/.test(entrada.name) && !/\.test\./.test(entrada.name))
    .map((entrada) => relative(SRC, resolve(entrada.parentPath, entrada.name)).replaceAll("\\", "/"));
}

//: Todo el dominio V2 del frontend. La lista crece con cada fase: un modulo
//: nuevo que no este aqui es un modulo que puede importar Legacy sin que nadie
//: se entere, y el docstring que promete aislamiento pasaria a ser falso.
const V2_MODULES = [
  "api/quoterV2.ts",
  "api/quoterV2Settings.ts",
  "api/quoterV2Materials.ts",
  "types/quoterV2.ts",
  "types/quoterV2Settings.ts",
  "types/quoterV2Materials.ts",
  "features/cotizadorV2/useQuoterV2.ts",
  "features/cotizadorV2/useQuoterV2Materials.ts",
  "features/settings/useQuoterV2Settings.ts",
  // Tambien las pantallas: el aislamiento se rompe igual de facil desde un
  // componente que desde un cliente HTTP, y ahi no hay nadie mirando.
  "features/settings/QuoterV2Section.tsx",
  "features/settings/V2MaterialsTable.tsx",
  "api/quoterV2Labor.ts",
  "types/quoterV2Labor.ts",
  "features/cotizadorV2/useQuoterV2Labor.ts",
  "features/settings/V2WorkforceTable.tsx",
  "api/quoterV2Firing.ts",
  "types/quoterV2Firing.ts",
  "features/cotizadorV2/useQuoterV2Firing.ts",
  "api/quoterV2Pricing.ts",
  "types/quoterV2Pricing.ts",
  "features/cotizadorV2/useQuoterV2Pricing.ts",
  // Fase 010H
  "features/cotizadorV2/useQuoterV2Lifecycle.ts",
  "features/cotizadorV2/V2CicloDeVida.tsx",
  "features/cotizadorV2/V2DocumentoEmitido.tsx",
  "features/cotizadorV2/mensajesCicloDeVida.ts",
  "features/cotizadorV2/fechaLima.ts",
  "features/cotizadorV2/useDialogoAccesible.ts",
  // Fase 010O: la interfaz rediseñada entera, archivo por archivo. Se lee del
  // disco para que un paso nuevo no pueda quedarse fuera de la lista.
  ...modulosDe("features/cotizadorV2Next"),
];

describe("cliente del Cotizador V2", () => {
  it("apunta a una ruta que no comparte segmento con el Cotizador Legacy", () => {
    expect(QUOTER_V2_BASE).toBe("/quotations-v2");
    // `/quotations-v2` no es un subrecurso de `/quotations`: son dos raices
    // distintas, asi que ninguna URL de un motor cae en la del otro.
    expect(QUOTER_V2_BASE.startsWith("/quotations/")).toBe(false);
  });

  it("la lista de módulos incluye la interfaz rediseñada leída del disco", () => {
    expect(V2_MODULES).toContain("features/cotizadorV2Next/CotizadorV2NextPage.tsx");
    expect(V2_MODULES).toContain("features/cotizadorV2Next/shell/V2NextWizard.tsx");
    expect(V2_MODULES).toContain("features/cotizadorV2Next/steps/pricing/FactorControl.tsx");
  });

  it("no importa el cliente ni los tipos del Cotizador Legacy", () => {
    const prohibidos = ["@/api/quotations", "@/api/quotationBuilder", "@/types/quotationBuilder"];
    for (const modulo of V2_MODULES) {
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
