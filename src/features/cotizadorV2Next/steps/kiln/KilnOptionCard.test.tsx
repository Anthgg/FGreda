import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KilnOptionCard } from "@/features/cotizadorV2Next/steps/kiln/KilnOptionCard";
import { QUEMA_HORNO } from "@/test/v2next/kilnFixtures";

describe("KilnOptionCard", () => {
  it("muestra capacidad comercial en litros y costos con moneda base", () => {
    render(
      <KilnOptionCard
        horno={QUEMA_HORNO.kilns[0]!}
        seleccionado
        batchLoads={QUEMA_HORNO.batch_loads}
        maxCapacityCm3="200000.000000"
      />,
    );

    expect(screen.getByText("17.0 L")).toBeInTheDocument();
    expect(screen.getByText("S/ 1125.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 262.50")).toBeInTheDocument();
  });

  it("dice Sin tarifas cuando el backend marca el horno sin tarifas", () => {
    render(
      <KilnOptionCard
        horno={QUEMA_HORNO.kilns[2]!}
        seleccionado={false}
        batchLoads={[]}
        maxCapacityCm3="200000.000000"
      />,
    );

    expect(screen.getByText("Sin tarifas")).toBeInTheDocument();
  });
});
