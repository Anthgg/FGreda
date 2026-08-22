import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AUDIT_PAGE,
  COMMERCIAL_FILLED,
  COMPANY_EMPTY,
  COMPANY_FILLED,
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

const OPERATOR: SessionUser = { ...TEST_USER, display_name: "Operario", role: "OPERATOR" };

interface Overrides {
  user?: SessionUser;
  company?: unknown;
  commercial?: unknown;
  sequences?: unknown;
  onRequest?: (url: string, init: RequestInit) => Response | undefined;
}

/** Instala respuestas para toda la pantalla de configuracion. */
function mockSettings(overrides: Overrides = {}) {
  return mockFetch((url, init) => {
    const custom = overrides.onRequest?.(url, init);
    if (custom) return custom;

    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse(overrides.user ?? TEST_USER);
    if (url.includes("/settings/company/logo")) return new Response(null, { status: 404 });
    if (url.includes("/settings/company")) return jsonResponse(200, overrides.company ?? COMPANY_FILLED);
    if (url.includes("/settings/commercial"))
      return jsonResponse(200, overrides.commercial ?? COMMERCIAL_FILLED);
    if (url.includes("/settings/sequences"))
      return jsonResponse(200, { sequences: overrides.sequences ?? SEQUENCES });
    if (url.includes("/settings/audit")) return jsonResponse(200, AUDIT_PAGE);
    return jsonResponse(200, {});
  });
}

async function abrirPestana(nombre: RegExp) {
  await userEvent.setup().click(screen.getByRole("tab", { name: nombre }));
}

describe("pantalla de configuracion", () => {
  it("se alcanza desde el menu principal", async () => {
    mockSettings();
    renderApp(["/"]);

    await userEvent.setup().click(await screen.findByRole("link", { name: /configuracion/i }));

    expect(await screen.findByRole("heading", { name: /^configuracion$/i })).toBeInTheDocument();
  });

  it("muestra un estado de carga mientras consulta", async () => {
    // La respuesta se retiene y se libera al final: dejar una promesa sin
    // resolver mantendria viva la peticion y colgaria la suite.
    let liberar: (() => void) | undefined;
    const retenida = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    mockFetch(async (url) => {
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/auth/csrf")) return csrfResponse();
      await retenida;
      return jsonResponse(200, COMPANY_FILLED);
    });
    renderApp(["/configuracion"]);

    expect(await screen.findByText(/cargando configuracion/i)).toBeInTheDocument();
    liberar?.();
  });

  it("muestra los datos de empresa que devuelve el backend", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    expect(await screen.findByDisplayValue("Taller Greda SAC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20123456789")).toBeInTheDocument();
    expect(screen.getByDisplayValue("contacto@greda.pe")).toBeInTheDocument();
  });

  it("no inventa datos cuando la configuracion esta vacia", async () => {
    mockSettings({ company: COMPANY_EMPTY });
    renderApp(["/configuracion"]);

    const razonSocial = await screen.findByLabelText(/razon social/i);
    expect(razonSocial).toHaveValue("");
  });

  it("informa cuando el backend no responde", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/auth/csrf")) return csrfResponse();
      throw new TypeError("Failed to fetch");
    });
    renderApp(["/configuracion"]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo conectar/i);
  });
});

describe("edicion como ADMIN", () => {
  it("el boton de guardar arranca deshabilitado", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    expect(await screen.findByRole("button", { name: /guardar cambios/i })).toBeDisabled();
  });

  it("al editar aparece el aviso de cambios sin guardar", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    const campo = await screen.findByLabelText(/nombre comercial/i);
    await userEvent.setup().type(campo, " Editado");

    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeEnabled();
  });

  it("cancelar descarta los cambios", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    const user = userEvent.setup();
    const campo = await screen.findByLabelText(/nombre comercial/i);
    await user.type(campo, " Editado");
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(campo).toHaveValue("Greda");
    expect(screen.queryByText(/cambios sin guardar/i)).not.toBeInTheDocument();
  });

  it("guardar envia la configuracion al backend", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/nombre comercial/i), " Editado");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      const put = fetchSpy.mock.calls.find(
        ([url, init]) => String(url).includes("/settings/company") && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cuerpo = JSON.parse(String(put![1]?.body));
      expect(cuerpo.trade_name).toBe("Greda Editado");
      // La version viaja siempre: es el control de concurrencia.
      expect(cuerpo.version).toBe(COMPANY_FILLED.version);
    });
  });

  it("un RUC invalido bloquea el guardado sin llamar al backend", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);

    const user = userEvent.setup();
    const ruc = await screen.findByLabelText(/ruc/i);
    await user.clear(ruc);
    await user.type(ruc, "123");

    expect(screen.getByText(/11 digitos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeDisabled();
    expect(
      fetchSpy.mock.calls.some(([, init]) => init?.method === "PUT"),
    ).toBe(false);
  });

  it("informa cuando otra persona modifico la configuracion", async () => {
    mockSettings({
      onRequest: (url, init) =>
        url.includes("/settings/company") && init.method === "PUT"
          ? errorResponse(409, "SETTINGS_VERSION_CONFLICT")
          : undefined,
    });
    renderApp(["/configuracion"]);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/nombre comercial/i), " X");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/otra persona modifico/i);
    expect(screen.getByRole("button", { name: /recargar configuracion/i })).toBeInTheDocument();
  });

  it("maneja un 403 del backend al guardar", async () => {
    mockSettings({
      onRequest: (url, init) =>
        url.includes("/settings/company") && init.method === "PUT"
          ? errorResponse(403, "AUTH_INSUFFICIENT_ROLE")
          : undefined,
    });
    renderApp(["/configuracion"]);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/nombre comercial/i), " X");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/rol no permite/i);
  });
});

describe("permisos de OPERATOR", () => {
  it("no ofrece acciones de edicion", async () => {
    mockSettings({ user: OPERATOR });
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);

    expect(screen.queryByRole("button", { name: /guardar cambios/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo un administrador puede modificar/i)).toBeInTheDocument();
  });

  it("los campos se muestran deshabilitados", async () => {
    mockSettings({ user: OPERATOR });
    renderApp(["/configuracion"]);

    expect(await screen.findByLabelText(/razon social/i)).toBeDisabled();
  });

  it("no ve la pestana de historial", async () => {
    mockSettings({ user: OPERATOR });
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);

    expect(screen.queryByRole("tab", { name: /historial/i })).not.toBeInTheDocument();
  });

  it("puede consultar la configuracion comercial", async () => {
    mockSettings({ user: OPERATOR });
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/comercial/i);

    expect(await screen.findByDisplayValue("PEN")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
  });
});

describe("seccion comercial", () => {
  it("muestra moneda, IGV, vigencia y banco", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/comercial/i);

    expect(await screen.findByDisplayValue("PEN")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("00219300123456789015")).toBeInTheDocument();
  });

  it("rechaza un IGV fuera de rango sin llamar al backend", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/comercial/i);

    const user = userEvent.setup();
    const igv = await screen.findByLabelText(/igv/i);
    await user.clear(igv);
    await user.type(igv, "150");

    expect(screen.getByText(/entre 0 y 100/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeDisabled();
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("rechaza un CCI que no tenga veinte digitos", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/comercial/i);

    const user = userEvent.setup();
    const cci = await screen.findByLabelText(/^cci$/i);
    await user.clear(cci);
    await user.type(cci, "123");

    expect(screen.getByText(/20 digitos/i)).toBeInTheDocument();
  });
});

describe("seccion de numeracion", () => {
  it("muestra la configuracion de cotizaciones y quemas", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/numeracion/i);

    // Se acota a los titulos: "Cotizaciones" y "Quemas" tambien aparecen en el
    // menu lateral como modulos aun deshabilitados.
    expect(await screen.findByRole("heading", { name: "Cotizaciones" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quemas" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("CTZ")).toBeInTheDocument();
    expect(screen.getByDisplayValue("HR")).toBeInTheDocument();
  });

  it("la vista previa esta identificada como tal", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/numeracion/i);

    expect(await screen.findAllByText(/vista previa/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/no reserva ni consume/i).length).toBeGreaterThan(0);
  });

  it("la vista previa se recalcula en el navegador y no llama al backend", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/numeracion/i);

    const prefijo = await screen.findByDisplayValue("CTZ");
    const llamadasAntes = fetchSpy.mock.calls.length;

    const user = userEvent.setup();
    await user.clear(prefijo);
    await user.type(prefijo, "GRE");

    expect(await screen.findByText(/^GRE-\d{4}-000001$/)).toBeInTheDocument();
    // Ni una sola peticion: cambiar el formato no consume correlativos.
    expect(fetchSpy.mock.calls.length).toBe(llamadasAntes);
  });

  it("no existe ninguna accion para generar el siguiente numero", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/numeracion/i);

    await screen.findByRole("heading", { name: "Cotizaciones" });
    expect(
      screen.queryByRole("button", { name: /generar|siguiente numero|reservar/i }),
    ).not.toBeInTheDocument();
  });

  it("guardar el formato envia la version y el patron", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/numeracion/i);

    const user = userEvent.setup();
    const prefijo = await screen.findByDisplayValue("CTZ");
    await user.clear(prefijo);
    await user.type(prefijo, "GRE");

    const tarjeta = prefijo.closest("form")!;
    await user.click(within(tarjeta).getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      const put = fetchSpy.mock.calls.find(
        ([url, init]) => String(url).includes("/settings/sequences/QUOTE") && init?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cuerpo = JSON.parse(String(put![1]?.body));
      expect(cuerpo.prefix).toBe("GRE");
      expect(cuerpo.version).toBe(1);
    });
  });
});

describe("historial", () => {
  it("ADMIN ve los cambios registrados", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);
    await abrirPestana(/historial/i);

    expect(await screen.findByText("tax_percent")).toBeInTheDocument();
    expect(screen.getByText("legal_name")).toBeInTheDocument();
    expect(screen.getAllByText("Administrador").length).toBeGreaterThan(0);
  });
});

describe("logo", () => {
  it("muestra que no hay logo cargado", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    expect(await screen.findByText(/sin logo/i)).toBeInTheDocument();
  });

  it("subir un archivo lo envia al backend, nunca a Supabase", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);

    const entrada = await screen.findByLabelText(/seleccionar archivo de logo/i);
    const archivo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", {
      type: "image/png",
    });
    await userEvent.setup().upload(entrada, archivo);

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([url, init]) => String(url).includes("/settings/company/logo") && init?.method === "POST",
      );
      expect(post).toBeDefined();
      expect(post![1]?.body).toBeInstanceOf(FormData);
      expect(post![1]?.credentials).toBe("include");
    });

    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("supabase"))).toBe(false);
  });

  it("el atributo accept ya descarta los formatos no admitidos", async () => {
    mockSettings();
    renderApp(["/configuracion"]);

    const entrada = await screen.findByLabelText(/seleccionar archivo de logo/i);
    expect(entrada).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
  });

  it("informa cuando el servidor rechaza el archivo", async () => {
    // Un archivo con extension permitida cuyo contenido no lo es: el filtro del
    // navegador lo deja pasar y quien lo rechaza es el backend, que es el unico
    // que inspecciona los bytes reales.
    mockSettings({
      onRequest: (url, init) =>
        url.includes("/settings/company/logo") && init.method === "POST"
          ? errorResponse(422, "LOGO_TYPE_NOT_ALLOWED")
          : undefined,
    });
    renderApp(["/configuracion"]);

    const entrada = await screen.findByLabelText(/seleccionar archivo de logo/i);
    await userEvent
      .setup()
      .upload(entrada, new File(["<svg/>"], "disfrazado.png", { type: "image/png" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/png, jpg o webp/i);
  });

  it("descarga la vista previa por el backend con las cookies incluidas", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchSpy = mockSettings({
      company: { ...COMPANY_FILLED, logo: { content_type: "image/png", size_bytes: 4, url: "/api/v1/settings/company/logo" } },
      onRequest: (url, init) =>
        url.includes("/settings/company/logo") && (init.method ?? "GET") === "GET"
          ? new Response(png, { status: 200, headers: { "Content-Type": "image/png" } })
          : undefined,
    });
    // Se parchean solo los metodos: reemplazar el objeto URL entero romperia
    // cualquier uso interno de "new URL(...)".
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    renderApp(["/configuracion"]);

    expect(await screen.findByAltText(/logo de la empresa/i)).toHaveAttribute("src", "blob:preview");

    const get = fetchSpy.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/settings/company/logo") && (init?.method ?? "GET") === "GET",
    );
    expect(get![1]?.credentials).toBe("include");
  });

  it("OPERATOR no puede subir ni eliminar el logo", async () => {
    mockSettings({ user: OPERATOR });
    renderApp(["/configuracion"]);

    await screen.findByLabelText(/razon social/i);

    expect(screen.queryByLabelText(/seleccionar archivo de logo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
  });
});
