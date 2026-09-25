import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PASOS } from "@/features/cotizadorV2/pasos";
import type { EstadoVisualDePaso } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { V2StepNav } from "@/features/cotizadorV2Next/shell/V2StepNav";

/**
 * La barra de pasos (010O.3): navegable con teclado y lector de pantalla, y con
 * el estado dicho en palabras y símbolos, nunca solo en color.
 */

function pasos(
  cambios: Partial<Record<string, Partial<EstadoVisualDePaso>>> = {},
): EstadoVisualDePaso[] {
  return PASOS.map((paso) => ({
    id: paso.id,
    situacion: "listo",
    faltas: 0,
    avisos: 0,
    ...cambios[paso.id],
  }));
}

describe("barra de pasos", () => {
  it("es un <nav> «Pasos» con una lista ordenada de siete", () => {
    render(<V2StepNav pasos={pasos()} actual="cliente" onIr={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Pasos" });
    const lista = within(nav).getByRole("list");
    expect(lista.tagName).toBe("OL");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(7);
  });

  it("usa las etiquetas del rediseño, en orden", () => {
    render(<V2StepNav pasos={pasos()} actual="cliente" onIr={() => {}} />);
    const botones = screen.getAllByRole("button");
    expect(botones.map((boton) => boton.textContent)).toEqual([
      expect.stringContaining("Cliente"),
      expect.stringContaining("Piezas"),
      expect.stringContaining("Arcilla y esmalte"),
      expect.stringContaining("Trabajo"),
      expect.stringContaining("Horno"),
      expect.stringContaining("Precio"),
      expect.stringContaining("Revisar y emitir"),
    ]);
  });

  it("marca el paso actual con aria-current=step, y solo ese", () => {
    render(<V2StepNav pasos={pasos()} actual="quema" onIr={() => {}} />);
    const actual = screen.getByRole("button", { current: "step" });
    expect(actual).toHaveAccessibleName(/Paso 5: Horno/);
    expect(screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("dice el estado con símbolo y con palabras, también en el paso actual", () => {
    render(
      <V2StepNav
        pasos={pasos({
          cliente: { situacion: "falta", faltas: 1 },
          productos: { situacion: "falta", faltas: 3 },
          quema: { situacion: "aviso", avisos: 1 },
        })}
        actual="cliente"
        onIr={() => {}}
      />,
    );
    const cliente = screen.getByRole("button", { name: /Cliente/ });
    expect(cliente).toHaveTextContent("!");
    expect(cliente).toHaveAccessibleName(/Falta 1 dato/);
    expect(screen.getByRole("button", { name: /Piezas/ })).toHaveAccessibleName(/Faltan 3 datos/);
    const horno = screen.getByRole("button", { name: /Horno/ });
    expect(horno).toHaveTextContent("▲");
    expect(horno).toHaveAccessibleName(/1 aviso/);
    expect(screen.getByRole("button", { name: /Precio/ })).toHaveTextContent("✓");
  });

  it("mientras carga enseña el número y no una falta", () => {
    render(
      <V2StepNav
        pasos={pasos({ cliente: { situacion: "cargando" } })}
        actual="productos"
        onIr={() => {}}
      />,
    );
    const cliente = screen.getByRole("button", { name: /Cliente/ });
    expect(cliente).toHaveTextContent("1");
    expect(cliente).not.toHaveTextContent("!");
  });

  it("todo paso es un botón, incluso los incompletos", async () => {
    const user = userEvent.setup();
    const onIr = vi.fn();
    render(
      <V2StepNav
        pasos={pasos({ precio: { situacion: "falta", faltas: 1 } })}
        actual="cliente"
        onIr={onIr}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Precio/ }));
    expect(onIr).toHaveBeenCalledWith("precio");
  });

  it("es horizontal por defecto y vertical cuando el contenedor tiene sitio", () => {
    render(<V2StepNav pasos={pasos()} actual="cliente" onIr={() => {}} />);
    const lista = screen.getByRole("list");
    expect(lista).toHaveClass("overflow-x-auto", "@min-[760px]:flex-col");
    // Sin bloque contenedor propio, los prefijos `sr-only` (absolutos) escapan
    // del carril y desbordan la página: lo cazó el smoke de Chromium a 375 px.
    expect(lista).toHaveClass("relative");
  });
});
