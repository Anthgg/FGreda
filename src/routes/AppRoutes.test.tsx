import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ErrorCode } from "@/api/client";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
  TEST_USER,
} from "@/test/utils";

describe("rutas protegidas y Dashboard", () => {
  it("consulta al backend antes de decidir si hay sesion", async () => {
    const fetchSpy = mockFetch(() => sessionResponse());

    renderApp(["/"]);

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/auth/me"))).toBe(true),
    );
  });

  it("muestra un estado de carga mientras verifica la sesion", () => {
    mockFetch(() => new Promise<Response>(() => {}));

    renderApp(["/"]);

    expect(screen.getByText(/verificando sesion/i)).toBeInTheDocument();
  });

  it("muestra la aplicacion cuando existe sesion", async () => {
    mockFetch(() => sessionResponse());

    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: /inicio/i })).toBeInTheDocument();
    // El nombre aparece en la barra lateral y en el detalle de bienvenida.
    expect(screen.getAllByText(new RegExp(TEST_USER.display_name, "i")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(TEST_USER.email).length).toBeGreaterThan(0);
  });

  it("redirige al login cuando no hay sesion", async () => {
    mockFetch((url) =>
      url.includes("/auth/me")
        ? errorResponse(401, ErrorCode.NOT_AUTHENTICATED)
        : errorResponse(401, ErrorCode.SESSION_EXPIRED),
    );

    renderApp(["/"]);

    expect(await screen.findByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("ofrece reintentar cuando el backend no responde", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    renderApp(["/"]);

    expect(await screen.findByText(/no se pudo contactar con el servidor/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("muestra los modulos futuros deshabilitados en el menu y en accesos", async () => {
    mockFetch(() => sessionResponse());

    renderApp(["/"]);

    await screen.findByRole("heading", { name: /inicio/i });
    for (const modulo of ["Productos", "Inventario", "Recetas", "Quemas", "Cotizaciones"]) {
      const entradas = screen.getAllByText(modulo);
      expect(entradas.length).toBeGreaterThan(0);
      const disabledParent = entradas[0]?.closest("[aria-disabled='true']");
      expect(disabledParent).toBeInTheDocument();
    }
  });

  it("permite colapsar y expandir la barra lateral en desktop", async () => {
    const user = userEvent.setup();
    mockFetch(() => sessionResponse());

    renderApp(["/"]);
    await screen.findByRole("heading", { name: /inicio/i });

    const toggleBtn = screen.getByRole("button", { name: /colapsar barra lateral/i });
    expect(toggleBtn).toBeInTheDocument();

    await user.click(toggleBtn);
    expect(screen.getByRole("button", { name: /expandir barra lateral/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expandir barra lateral/i }));
    expect(screen.getByRole("button", { name: /colapsar barra lateral/i })).toBeInTheDocument();
  });

  it("abre y cierra el drawer movil con boton y tecla Escape", async () => {
    const user = userEvent.setup();
    mockFetch(() => sessionResponse());

    renderApp(["/"]);
    await screen.findByRole("heading", { name: /inicio/i });

    const openMenuBtn = screen.getByRole("button", { name: /abrir menú principal/i });
    await user.click(openMenuBtn);

    const dialog = screen.getByRole("dialog", { name: /menú principal/i });
    expect(dialog).toBeInTheDocument();

    // Cerrar con Escape
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /menú principal/i })).not.toBeInTheDocument();
    });
  });

  it("cierra la sesion llamando al backend y vuelve al login", async () => {
    let authenticated = true;
    const fetchSpy = mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/logout")) {
        authenticated = false;
        return jsonResponse(200, { authenticated: false });
      }
      if (url.includes("/auth/refresh")) return errorResponse(401, ErrorCode.SESSION_EXPIRED);
      return authenticated
        ? sessionResponse()
        : errorResponse(401, ErrorCode.NOT_AUTHENTICATED);
    });

    renderApp(["/"]);
    await screen.findByRole("heading", { name: /inicio/i });

    await userEvent.setup().click(screen.getByRole("button", { name: /cerrar sesión/i }));

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/auth/logout"))).toBe(true),
    );
    expect(await screen.findByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("no contiene enlaces invalidos href='#'", async () => {
    mockFetch(() => sessionResponse());

    renderApp(["/"]);
    await screen.findByRole("heading", { name: /inicio/i });

    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.getAttribute("href")).not.toBe("#");
    });
  });

  it("no permite volver al login con una sesion activa", async () => {
    mockFetch(() => sessionResponse());

    renderApp(["/login"]);

    expect(await screen.findByRole("heading", { name: /inicio/i })).toBeInTheDocument();
  });
});
