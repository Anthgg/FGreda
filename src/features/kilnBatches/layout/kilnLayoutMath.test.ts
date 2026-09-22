import { describe, expect, it } from "vitest";

import {
  checkCollision,
  checkHeightExceeded,
  checkPlacementBounds,
  cmToSvgY,
  getOrderStyle,
  getReservedFootprint,
  svgToCmY,
  toDecimal6,
} from "./kilnLayoutMath";

describe("kilnLayoutMath", () => {
  describe("getReservedFootprint", () => {
    it("calcula dimensiones reservadas con rotación 0°", () => {
      const fp = getReservedFootprint("10", "8", "12", "1", 0);
      expect(fp.x_size).toBe(11); // 10 + 1
      expect(fp.y_size).toBe(9); // 8 + 1
      expect(fp.z_size).toBe(13); // 12 + 1
      expect(fp.piece_x).toBe(10);
      expect(fp.piece_y).toBe(8);
      expect(fp.piece_z).toBe(12);
      expect(fp.separation).toBe(1);
    });

    it("calcula dimensiones reservadas con rotación 90° (intercambia X e Y)", () => {
      const fp = getReservedFootprint("10", "8", "12", "1", 90);
      expect(fp.x_size).toBe(9); // 8 + 1
      expect(fp.y_size).toBe(11); // 10 + 1
      expect(fp.z_size).toBe(13); // 12 + 1
      expect(fp.piece_x).toBe(8);
      expect(fp.piece_y).toBe(10);
    });

    it("con separación 0, las dimensiones reservadas son idénticas a la pieza", () => {
      const fp = getReservedFootprint(15, 10, 5, 0, 0);
      expect(fp.x_size).toBe(15);
      expect(fp.y_size).toBe(10);
      expect(fp.z_size).toBe(5);
      expect(fp.separation).toBe(0);
    });
  });

  describe("cmToSvgY y svgToCmY", () => {
    const kilnDepth = 60;
    const reservedY = 10;

    it("mapea origen inferior M2 (y=0) a la parte inferior del SVG", () => {
      // y_cm = 0 -> svg_y = 60 - (0 + 10) = 50
      const svgY = cmToSvgY(0, reservedY, kilnDepth);
      expect(svgY).toBe(50);
      // Reversa
      expect(svgToCmY(svgY, reservedY, kilnDepth)).toBe(0);
    });

    it("mapea tope superior (y_cm = 50) a svg_y = 0", () => {
      const svgY = cmToSvgY(50, reservedY, kilnDepth);
      expect(svgY).toBe(0);
      // Reversa
      expect(svgToCmY(svgY, reservedY, kilnDepth)).toBe(50);
    });

    it("es una biyección exacta para cualquier posición intermedia", () => {
      const testCases = [0, 5.5, 12.333333, 25, 49.9];
      for (const y of testCases) {
        const svgY = cmToSvgY(y, reservedY, kilnDepth);
        const back = svgToCmY(svgY, reservedY, kilnDepth);
        expect(back).toBeCloseTo(y, 6);
      }
    });
  });

  describe("toDecimal6", () => {
    it("normaliza enteros sin ceros decimales innecesarios", () => {
      expect(toDecimal6(10)).toBe("10");
      expect(toDecimal6("15.000000")).toBe("15");
    });

    it("trunca/redondea a 6 decimales evitando drift de coma flotante", () => {
      expect(toDecimal6(10.333333333333337)).toBe("10.333333");
      expect(toDecimal6("5.1234567")).toBe("5.123457");
    });

    it("maneja números con decimales cortos sin agregar ceros", () => {
      expect(toDecimal6(12.5)).toBe("12.5");
      expect(toDecimal6("8.25")).toBe("8.25");
    });
  });

  describe("checkPlacementBounds", () => {
    const width = 60;
    const depth = 50;

    it("retorna true para placement completamente dentro del horno", () => {
      expect(checkPlacementBounds(0, 0, 10, 10, width, depth)).toBe(true);
      expect(checkPlacementBounds(50, 40, 10, 10, width, depth)).toBe(true);
    });

    it("retorna false si excede el ancho (X)", () => {
      expect(checkPlacementBounds(51, 0, 10, 10, width, depth)).toBe(false);
    });

    it("retorna false si excede la profundidad (Y)", () => {
      expect(checkPlacementBounds(0, 41, 10, 10, width, depth)).toBe(false);
    });

    it("retorna false para coordenadas negativas", () => {
      expect(checkPlacementBounds(-1, 0, 10, 10, width, depth)).toBe(false);
      expect(checkPlacementBounds(0, -0.5, 10, 10, width, depth)).toBe(false);
    });
  });

  describe("checkCollision", () => {
    it("detecta colisión cuando hay solapamiento interior", () => {
      const boxA = { left: 0, right: 10, bottom: 0, top: 10 };
      const boxB = { left: 5, right: 15, bottom: 5, top: 15 };
      expect(checkCollision(boxA, boxB)).toBe(true);
    });

    it("permite contacto adyacente exacto en bordes (sin solape interior)", () => {
      const boxA = { left: 0, right: 10, bottom: 0, top: 10 };
      const boxB = { left: 10, right: 20, bottom: 0, top: 10 };
      expect(checkCollision(boxA, boxB)).toBe(false);
    });

    it("retorna false para cajas completamente separadas", () => {
      const boxA = { left: 0, right: 10, bottom: 0, top: 10 };
      const boxB = { left: 20, right: 30, bottom: 20, top: 30 };
      expect(checkCollision(boxA, boxB)).toBe(false);
    });
  });

  describe("checkHeightExceeded", () => {
    it("retorna false si cabe en el nivel", () => {
      expect(checkHeightExceeded(15, 1, 20)).toBe(false);
    });

    it("retorna false para ajuste exacto", () => {
      expect(checkHeightExceeded(19, 1, 20)).toBe(false);
    });

    it("retorna true si excede la altura útil", () => {
      expect(checkHeightExceeded(20, 1, 20)).toBe(true);
    });
  });

  describe("getOrderStyle", () => {
    it("es determinista y estable para la misma clave", () => {
      const style1 = getOrderStyle("OP #101");
      const style2 = getOrderStyle("OP #101");
      expect(style1).toEqual(style2);
    });

    it("provee propiedades visuales no dependientes solo de color", () => {
      const style = getOrderStyle(123);
      expect(style.borderStyle).toBeDefined();
      expect(style.hatchPattern).toBeDefined();
      expect(style.fillColor).toBeDefined();
      expect(style.textColor).toBeDefined();
    });
  });
});
