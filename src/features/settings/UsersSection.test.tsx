import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_FILLED,
  COMPANY_FILLED,
  REFERENCE_DATA,
  SEQUENCES,
} from "@/test/settingsFixtures";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
  TEST_USER,
} from "@/test/utils";
import type { SessionUser } from "@/types/auth";
import type { AppUser } from "@/types/settings";

/**
 * Fase 009K.2 — administración de usuarios.
 *
 * Lo que esta pantalla no puede hacer importa tanto como lo que hace: no borra
 * a nadie, no enseña identificadores internos y no deja escapar una contraseña
 * de vuelta. Un usuario que ya firmó documentos no se quita sin romper el
 * historial, así que la baja es desactivar.
 */

const OPERATOR: SessionUser = { ...TEST_USER, display_name: "Operario", role: "OPERATOR" };

const ANA: AppUser = {
  id: "11111111-1111-1111-1111-111111111111",
  display_name: "Ana Pérez",
  email: "ana@greda-test.com",
  role: "ADMIN",
  active: true,
};

const BETO: AppUser = {
  id: "22222222-2222-2222-2222-222222222222",
  display_name: "Beto Ruiz",
  email: "beto@greda-test.com",
  role: "OPERATOR",
  active: false,
};

interface Overrides {
  user?: SessionUser;
  users?: AppUser[];
  onRequest?: (url: string, init: RequestInit) => Response | undefined;
}

function mockUsuarios(overrides: Overrides = {}) {
  const usuarios = overrides.users ?? [ANA, BETO];
  return mockFetch((url, init) => {
    const custom = overrides.onRequest?.(url, init);
    if (custom) return custom;

    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse(overrides.user ?? TEST_USER);
    if (url.includes("/users")) {
      if (init.method === "POST" || init.method === "PUT") {
        const enviado = init.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse(init.method === "POST" ? 201 : 200, {
          ...ANA,
          ...enviado,
          // El backend NUNCA devuelve la contraseña; el doble tampoco.
          password: undefined,
        });
      }
      return jsonResponse(200, { items: usuarios, total: usuarios.length });
    }
    // Configuracion completa: la pantalla no pinta ninguna pestana hasta que
    // empresa, comercial, correlativos y datos de referencia han cargado.
    if (url.includes("/settings/company/logo")) return new Response(null, { status: 404 });
    if (url.includes("/settings/reference-data")) return jsonResponse(200, REFERENCE_DATA);
    if (url.includes("/settings/company")) return jsonResponse(200, COMPANY_FILLED);
    if (url.includes("/settings/commercial")) return jsonResponse(200, COMMERCIAL_FILLED);
    if (url.includes("/settings/sequences")) return jsonResponse(200, { sequences: SEQUENCES });
    if (url.includes("/settings/audit")) return jsonResponse(200, { items: [], total: 0 });
    return jsonResponse(200, {});
  });
}

async function abrirUsuarios() {
  renderApp(["/configuracion"]);
  await userEvent.setup().click(await screen.findByRole("tab", { name: /^Usuarios$/ }));
}

describe("Configuración · Usuarios", () => {
  it("USER_LIST: enseña nombre, correo, rol y estado", async () => {
    mockUsuarios();
    await abrirUsuarios();

    const ana = (await screen.findByText("Ana Pérez")).closest("tr")!;
    expect(within(ana).getByText("ana@greda-test.com")).toBeInTheDocument();
    expect(within(ana).getByText("Administrador")).toBeInTheDocument();
    expect(within(ana).getByText("Activo")).toBeInTheDocument();

    const beto = screen.getByText("Beto Ruiz").closest("tr")!;
    expect(within(beto).getByText("Operario")).toBeInTheDocument();
    expect(within(beto).getByText("Inactivo")).toBeInTheDocument();
  });

  it("no enseña el identificador interno de nadie", async () => {
    mockUsuarios();
    await abrirUsuarios();
    await screen.findByText("Ana Pérez");

    // FRONTEND_ACTOR_UUID_RESOLUTION: 0 — el id existe para saber a quién se
    // edita, no para leerlo.
    expect(document.body.textContent).not.toContain(ANA.id);
    expect(document.body.textContent).not.toContain(BETO.id);
  });

  it("no ofrece borrar a nadie", async () => {
    mockUsuarios();
    await abrirUsuarios();
    await screen.findByText("Ana Pérez");

    // Quien ya firmó documentos no se puede quitar sin romper el historial.
    expect(screen.queryByRole("button", { name: /eliminar|borrar/i })).not.toBeInTheDocument();
  });

  it("un perfil sin cuenta enseña el hueco, no desaparece", async () => {
    mockUsuarios({
      users: [{ ...ANA, email: null, display_name: "Perfil sin cuenta" }],
    });
    await abrirUsuarios();

    const fila = (await screen.findByText("Perfil sin cuenta")).closest("tr")!;
    expect(within(fila).getByText("—")).toBeInTheDocument();
  });

  it("USER_CREATE: el alta manda nombre, correo, rol y contraseña", async () => {
    const fetchSpy = mockUsuarios();
    await abrirUsuarios();
    await screen.findByText("Ana Pérez");

    await userEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));
    await userEvent.type(screen.getByLabelText(/nombre visible/i), "Carmen Loayza");
    await userEvent.type(screen.getByLabelText(/^correo/i), "carmen@greda-test.com");
    await userEvent.type(screen.getByLabelText(/contraseña inicial/i), "contrasena-larga");
    await userEvent.click(screen.getByRole("button", { name: /^crear usuario$/i }));

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      );
      expect(post).toBeDefined();
      const cuerpo = JSON.parse(String((post![1] as RequestInit).body));
      expect(cuerpo.display_name).toBe("Carmen Loayza");
      expect(cuerpo.email).toBe("carmen@greda-test.com");
      expect(cuerpo.role).toBe("OPERATOR");
      expect(cuerpo.password).toBe("contrasena-larga");
    });
  });

  it("una contraseña corta se avisa y no se manda", async () => {
    const fetchSpy = mockUsuarios();
    await abrirUsuarios();
    await screen.findByText("Ana Pérez");

    await userEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));
    await userEvent.type(screen.getByLabelText(/nombre visible/i), "Carmen");
    await userEvent.type(screen.getByLabelText(/^correo/i), "carmen@greda-test.com");
    await userEvent.type(screen.getByLabelText(/contraseña inicial/i), "corta");

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^crear usuario$/i })).toBeDisabled();
    expect(
      fetchSpy.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method === "POST"),
    ).toHaveLength(0);
  });

  it("la contraseña no se queda escrita en la pantalla", async () => {
    mockUsuarios();
    await abrirUsuarios();
    await screen.findByText("Ana Pérez");

    await userEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));
    const campo = screen.getByLabelText(/contraseña inicial/i);
    await userEvent.type(campo, "secreto-larguisimo");

    // Se teclea oculta, y el texto de la página no la contiene.
    expect(campo).toHaveAttribute("type", "password");
    expect(document.body.textContent).not.toContain("secreto-larguisimo");
  });

  it("USER_UPDATE_DISPLAY_NAME y USER_ROLE_UPDATE: editar manda ambos", async () => {
    const fetchSpy = mockUsuarios();
    await abrirUsuarios();
    const ana = (await screen.findByText("Ana Pérez")).closest("tr")!;

    await userEvent.click(within(ana).getByRole("button", { name: /editar/i }));
    const nombre = await screen.findByLabelText(/nombre visible/i);
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Ana María Pérez");
    await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      const put = fetchSpy.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cuerpo = JSON.parse(String((put![1] as RequestInit).body));
      expect(cuerpo.display_name).toBe("Ana María Pérez");
      expect(cuerpo.role).toBe("ADMIN");
    });
  });

  it("el correo se enseña al editar pero no se puede cambiar", async () => {
    mockUsuarios();
    await abrirUsuarios();
    const ana = (await screen.findByText("Ana Pérez")).closest("tr")!;
    await userEvent.click(within(ana).getByRole("button", { name: /editar/i }));

    // Su autoridad es Supabase Auth: cambiarlo es cambiar la credencial.
    const correo = await screen.findByLabelText(/^correo/i);
    expect(correo).toHaveValue("ana@greda-test.com");
    expect(correo).toHaveAttribute("readonly");
  });

  it("USER_DISABLE: desactivar llama al endpoint de baja", async () => {
    const fetchSpy = mockUsuarios();
    await abrirUsuarios();
    const ana = (await screen.findByText("Ana Pérez")).closest("tr")!;

    await userEvent.click(within(ana).getByRole("button", { name: /desactivar/i }));

    await waitFor(() => {
      const llamada = fetchSpy.mock.calls.find(([url]) => String(url).includes("/disable"));
      expect(llamada).toBeDefined();
    });
  });

  it("USER_REENABLE: un inactivo ofrece reactivar, no desactivar", async () => {
    const fetchSpy = mockUsuarios();
    await abrirUsuarios();
    const beto = (await screen.findByText("Beto Ruiz")).closest("tr")!;

    expect(within(beto).queryByRole("button", { name: /desactivar/i })).not.toBeInTheDocument();
    await userEvent.click(within(beto).getByRole("button", { name: /reactivar/i }));

    await waitFor(() => {
      const llamada = fetchSpy.mock.calls.find(([url]) => String(url).includes("/enable"));
      expect(llamada).toBeDefined();
    });
  });

  it("si el backend rechaza la baja, se dice; no se da por hecha", async () => {
    mockUsuarios({
      onRequest: (url) =>
        url.includes("/disable") ? errorResponse(409, "LAST_ACTIVE_ADMIN") : undefined,
    });
    await abrirUsuarios();
    const ana = (await screen.findByText("Ana Pérez")).closest("tr")!;
    await userEvent.click(within(ana).getByRole("button", { name: /desactivar/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("USER_MANAGEMENT_RBAC: un OPERATOR no ve la pestaña", async () => {
    mockUsuarios({ user: OPERATOR });
    renderApp(["/configuracion"]);
    await screen.findByRole("tab", { name: /^Empresa$/ });

    // Esconder es sólo cortesía: quien autoriza es el backend, que responde
    // 403 aunque la petición llegue igual.
    expect(screen.queryByRole("tab", { name: /^Usuarios$/ })).not.toBeInTheDocument();
  });

  it("si el backend responde 403 se explica en vez de quedarse en blanco", async () => {
    mockUsuarios({
      onRequest: (url, init) =>
        url.includes("/users") && (init.method ?? "GET") === "GET"
          ? errorResponse(403, "FORBIDDEN")
          : undefined,
    });
    await abrirUsuarios();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
