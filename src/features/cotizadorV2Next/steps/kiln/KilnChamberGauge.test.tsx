import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KilnChamberGauge } from "@/features/cotizadorV2Next/steps/kiln/KilnChamberGauge";

describe("KilnChamberGauge", () => {
  it("deriva 250 % en tres cámaras visuales: 100, 100 y 50", () => {
    render(
      <KilnChamberGauge
        seleccionado={false}
        batchLoads={[]}
        occupancyPercent="250.000000"
        firingCount={3}
        capacityCm3="17000.000000"
        maxCapacityCm3="200000.000000"
      />,
    );

    expect(screen.getAllByTestId("kiln-chamber").map((camara) => camara.dataset.fill)).toEqual([
      "100",
      "100",
      "50",
    ]);
  });

  it("para el horno elegido usa las cargas reales del backend", () => {
    render(
      <KilnChamberGauge
        seleccionado
        batchLoads={["80.000000", "35.500000"]}
        occupancyPercent="250.000000"
        firingCount={3}
        capacityCm3="17000.000000"
        maxCapacityCm3="200000.000000"
      />,
    );

    expect(screen.getAllByTestId("kiln-chamber").map((camara) => camara.dataset.fill)).toEqual([
      "80",
      "35.5",
    ]);
  });
});
