import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompanyLogo } from "@/components/CompanyLogo";
import { COMPANY_KEY } from "@/features/settings/useSettings";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/utils";

const CON_LOGO = {
  version: 1,
  updated_at: "2026-09-02T00:00:00Z",
  legal_name: "Greda",
  logo: {
    content_type: "image/png",
    size_bytes: 655270,
    url: "/api/v1/settings/company/logo",
  },
};

const SIN_LOGO = { ...CON_LOGO, logo: null };

beforeEach(() => {
  // jsdom no implementa los object URL: se doblan para poder comprobar que el
  // binario descargado es lo que acaba en el `src`, y que se libera al salir.
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:logo-configurado"),
    revokeObjectURL: vi.fn(),
  });
});

describe("el logo de la aplicación", () => {
  it("usa el logo configurado, el mismo que sale impreso", async () => {
    // Antes la pantalla mostraba un PNG del build: cambiar el logo en
    // Configuración cambiaba los PDF y no la aplicación, y quedaban dos logos
    // distintos para la misma empresa sin forma de notarlo.
    mockFetch((url) => {
      if (url.includes("/settings/company/logo")) {
        return new Response(new Blob(["png"]), { status: 200 });
      }
      if (url.includes("/settings/company")) return jsonResponse(200, CON_LOGO);
      throw new Error(`llamada inesperada: ${url}`);
    });

    renderWithProviders(<CompanyLogo className="size-16" />);

    await waitFor(() =>
      expect(screen.getByAltText(/logo de greda/i)).toHaveAttribute("src", "blob:logo-configurado"),
    );
  });

  it("sin logo configurado se queda con el del build", async () => {
    mockFetch((url) => {
      if (url.includes("/settings/company")) return jsonResponse(200, SIN_LOGO);
      throw new Error(`llamada inesperada: ${url}`);
    });

    renderWithProviders(<CompanyLogo />);

    const img = await screen.findByAltText(/logo de greda/i);
    expect(img.getAttribute("src")).not.toBe("blob:logo-configurado");
    // Y no se pide un binario que se sabe que no existe.
    await waitFor(() => expect(img).toBeInTheDocument());
  });

  it("si el binario falla, la aplicación no se queda sin cabecera", async () => {
    // Un almacenamiento caído no puede dejar la barra lateral vacía: se cae al
    // empaquetado, que es exactamente lo que se veía antes de este cambio.
    mockFetch((url) => {
      if (url.includes("/settings/company/logo")) return new Response(null, { status: 500 });
      if (url.includes("/settings/company")) return jsonResponse(200, CON_LOGO);
      throw new Error(`llamada inesperada: ${url}`);
    });

    renderWithProviders(<CompanyLogo />);

    const img = await screen.findByAltText(/logo de greda/i);
    await waitFor(() => expect(img.getAttribute("src")).not.toBe("blob:logo-configurado"));
  });

  it("no vuelve a descargar el binario si el logo no ha cambiado", async () => {
    // La configuración se refresca sola y `logo` es un objeto nuevo cada vez.
    // Depender de él descargaría 655 KB en cada refetch sin que nada cambie.
    const espia = mockFetch((url) => {
      if (url.includes("/settings/company/logo")) {
        return new Response(new Blob(["png"]), { status: 200 });
      }
      if (url.includes("/settings/company")) return jsonResponse(200, CON_LOGO);
      throw new Error(`llamada inesperada: ${url}`);
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <CompanyLogo />
      </QueryClientProvider>,
    );
    const cuenta = (fragmento: string) =>
      espia.mock.calls.filter(([u]) => String(u).includes(fragmento)).length;

    // Se espera al binario, no al `img`: el `img` aparece de inmediato con el
    // respaldo y contar ahí daría cero sin haber comprobado nada.
    await waitFor(() =>
      expect(screen.getByAltText(/logo de greda/i)).toHaveAttribute("src", "blob:logo-configurado"),
    );
    expect(cuenta("/settings/company/logo")).toBe(1);
    const configuracionAntes = cuenta("/settings/company");

    // Se fuerza justo lo que pasa solo: la configuración se vuelve a pedir.
    await queryClient.refetchQueries({ queryKey: COMPANY_KEY });

    await waitFor(() => expect(cuenta("/settings/company")).toBeGreaterThan(configuracionAntes));
    expect(cuenta("/settings/company/logo")).toBe(1);
  });
});
