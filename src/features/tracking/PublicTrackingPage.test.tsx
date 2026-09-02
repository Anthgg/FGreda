import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { errorResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";
import type { PublicTracking } from "@/types/tracking";

const SEGUIMIENTO: PublicTracking = {
  company_name: "LABERINTO S.A.C.",
  order_code: "OP-2026-000002",
  status: "COMPLETED",
  created_at: "2026-09-02T11:06:00Z",
  started_at: "2026-09-02T11:07:00Z",
  completed_at: "2026-09-02T11:11:00Z",
  cancelled_at: null,
  items: [
    { product_name: "Jarras", quantity: 12 },
    { product_name: "Shot pisquero", quantity: 8 },
  ],
};

/** Un navegador sin sesión: el puente hacia la vista interna responde 401. */
function backendPublico(conSesion = false) {
  return mockFetch((url) => {
    if (url.includes("/tracking/production-orders/current/internal-link")) {
      return conSesion
        ? jsonResponse(200, { production_order_id: 2 })
        : errorResponse(401, "AUTH_NOT_AUTHENTICATED");
    }
    if (url.includes("/tracking/production-orders/scan/")) return jsonResponse(200, SEGUIMIENTO);
    if (url.includes("/tracking/production-orders/current")) return jsonResponse(200, SEGUIMIENTO);
    throw new Error(`llamada inesperada: ${url}`);
  });
}

describe("seguimiento público", () => {
  it("se abre sin sesión y sin pasar por el login", async () => {
    // Es la razón entera de la subfase: hasta 009J el QR llevaba a una ruta
    // protegida y quien escaneaba sin cuenta acababa pidiendo credenciales.
    const fetchSpy = backendPublico();

    renderApp(["/seguimiento"]);

    expect(await screen.findByText("OP-2026-000002")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /iniciar sesión/i })).not.toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/auth/me"))).toBe(false);
  });

  it("enseña el estado y la línea de tiempo", async () => {
    backendPublico();

    renderApp(["/seguimiento"]);

    // Aparece dos veces a propósito: como estado actual en la cabecera y como
    // último hito de la línea de tiempo.
    expect((await screen.findAllByText("Producción completada")).length).toBe(2);
    expect(screen.getByText("Orden creada")).toBeInTheDocument();
    expect(screen.getByText("Producción iniciada")).toBeInTheDocument();
  });

  it("enseña las piezas y sus cantidades", async () => {
    backendPublico();

    renderApp(["/seguimiento"]);

    expect(await screen.findByText("Jarras")).toBeInTheDocument();
    expect(screen.getByText("12 unidades")).toBeInTheDocument();
    expect(screen.getByText("Shot pisquero")).toBeInTheDocument();
    expect(screen.getByText("8 unidades")).toBeInTheDocument();
  });

  it("no ofrece ni una acción sobre la orden", async () => {
    // QR_PUBLIC_READ_ONLY. No es que estén ocultos: no existen en este árbol,
    // y el backend tampoco expone ninguna escritura bajo /tracking.
    backendPublico();

    renderApp(["/seguimiento"]);
    await screen.findByText("OP-2026-000002");

    for (const prohibido of [
      /arrancar/i,
      /completar/i,
      /anular/i,
      /editar/i,
      /ajustar/i,
      /preparar/i,
      /crear orden/i,
    ]) {
      expect(screen.queryByRole("button", { name: prohibido })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: prohibido })).not.toBeInTheDocument();
    }
  });

  it("no enseña nada interno", async () => {
    // La garantía real la da el backend, que no manda estos campos. Esto fija
    // que la pantalla tampoco los invente a partir de lo que sí recibe.
    backendPublico();

    const { container } = renderApp(["/seguimiento"]);
    await screen.findByText("OP-2026-000002");

    const texto = container.textContent ?? "";
    // «LAB50021» es el código interno de una pieza; «LABERINTO S.A.C.» es la
    // razón social, que sí es pública. Por eso se buscan los códigos enteros.
    for (const prohibido of [
      "CTZ-",
      "Almacén",
      "BARNIZ",
      "LAB50021",
      "LAB70005",
      "receta",
      "gramos",
    ]) {
      expect(texto).not.toContain(prohibido);
    }
  });

  it("sin sesión no ofrece el salto a la vista interna", async () => {
    backendPublico(false);

    renderApp(["/seguimiento"]);
    await screen.findByText("OP-2026-000002");

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /en la aplicación/i })).not.toBeInTheDocument(),
    );
  });

  it("con sesión sí lo ofrece", async () => {
    // QR_AUTHENTICATED_INTERNAL_FLOW. Quien trabaja aquí escanea el mismo papel
    // y llega a la vista interna sin teclear un código.
    backendPublico(true);

    renderApp(["/seguimiento"]);

    const enlace = await screen.findByRole("link", { name: /en la aplicación/i });
    expect(enlace).toHaveAttribute("href", "/produccion/2");
  });

  it("entrar a la dirección sin escanear no enseña la orden de nadie", async () => {
    mockFetch((url) => {
      if (url.includes("/tracking/")) return errorResponse(404, "TRACKING_NOT_FOUND");
      throw new Error(`llamada inesperada: ${url}`);
    });

    renderApp(["/seguimiento"]);

    expect(await screen.findByText(/no hay ningún seguimiento abierto/i)).toBeInTheDocument();
  });
});

describe("el token del QR", () => {
  it("se cambia por el seguimiento y desaparece de la dirección", async () => {
    // QR_TOKEN_VISIBLE_AFTER_REDIRECT: NO. El token viaja UNA sola vez; a
    // partir de ahí el contexto es una cookie HttpOnly que esta capa no puede
    // leer, así que ninguna petición posterior puede llevarlo aunque quisiera.
    const fetchSpy = backendPublico();
    const TOKEN = "un-token-opaco-de-cuarenta-y-tres-caracteres";

    renderApp([`/seguimiento/${TOKEN}`]);

    expect(await screen.findByText("OP-2026-000002")).toBeInTheDocument();

    const conToken = fetchSpy.mock.calls.filter(([url]) => String(url).includes(TOKEN));
    expect(conToken).toHaveLength(1);
    expect(String(conToken[0]?.[0])).toContain("/tracking/production-orders/scan/");
  });

  it("un código que no corresponde a nada lo dice sin tecnicismos", async () => {
    mockFetch((url) => {
      if (url.includes("/tracking/production-orders/scan/")) {
        return errorResponse(404, "TRACKING_NOT_FOUND");
      }
      throw new Error(`llamada inesperada: ${url}`);
    });

    renderApp(["/seguimiento/token-inventado"]);

    expect(
      await screen.findByText(/no corresponde a ninguna orden/i),
    ).toBeInTheDocument();
    // Ni el código del backend ni el número de estado en pantalla.
    expect(screen.queryByText(/TRACKING_NOT_FOUND/)).not.toBeInTheDocument();
    expect(screen.queryByText(/404/)).not.toBeInTheDocument();
  });

  it("distingue un fallo temporal de un código inválido y permite reintentar", async () => {
    let intentos = 0;
    mockFetch((url) => {
      if (url.includes("/tracking/production-orders/scan/")) {
        intentos += 1;
        return intentos === 1
          ? errorResponse(503, "SERVICE_UNAVAILABLE")
          : jsonResponse(200, SEGUIMIENTO);
      }
      if (url.includes("/tracking/production-orders/current/internal-link")) {
        return errorResponse(401, "AUTH_NOT_AUTHENTICATED");
      }
      if (url.includes("/tracking/production-orders/current")) {
        return jsonResponse(200, SEGUIMIENTO);
      }
      throw new Error(`llamada inesperada: ${url}`);
    });

    renderApp(["/seguimiento/token-valido"]);

    expect(await screen.findByText(/no pudimos abrir el seguimiento/i)).toBeInTheDocument();
    expect(screen.queryByText(/no corresponde a ninguna orden/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(await screen.findByText("OP-2026-000002")).toBeInTheDocument();
    expect(intentos).toBe(2);
  });
});
