import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ErrorCode } from "@/api/client";
import { LoginPage } from "@/features/auth/LoginPage";
import {
  csrfResponse,
  errorResponse,
  mockFetch,
  renderApp,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";

async function fillAndSubmit(email = "admin@empresa.com", password = "clave-correcta") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/correo/i), email);
  await user.type(screen.getByLabelText(/^contraseña$/i), password);
  await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));
  return user;
}

describe("pantalla de login", () => {
  it("muestra los campos y la accion", () => {
    mockFetch(() => csrfResponse());
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("no ofrece registro ni acceso con redes sociales", () => {
    mockFetch(() => csrfResponse());
    renderWithProviders(<LoginPage />);

    expect(screen.queryByText(/registrarse|crear cuenta|recordarme/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/google|facebook/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/olvide mi contrasena|recuperar/i)).not.toBeInTheDocument();
  });

  it("mantiene deshabilitado el envio mientras faltan datos", () => {
    mockFetch(() => csrfResponse());
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeDisabled();
  });

  it("permite mostrar y ocultar la contraseña con un control accesible", async () => {
    mockFetch(() => csrfResponse());
    renderWithProviders(<LoginPage />);

    const user = userEvent.setup();
    const password = screen.getByLabelText(/^contraseña$/i);
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: /ocultar contraseña/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("envia las credenciales al backend", async () => {
    const fetchSpy = mockFetch((url) =>
      url.includes("/auth/csrf") ? csrfResponse() : sessionResponse(),
    );
    renderWithProviders(<LoginPage />);

    await fillAndSubmit();

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([url]) => String(url).includes("/auth/login"));
      expect(call).toBeDefined();
      expect(JSON.parse(String(call![1]?.body))).toEqual({
        email: "admin@empresa.com",
        password: "clave-correcta",
      });
    });
  });

  it("informa cuando las credenciales son incorrectas", async () => {
    mockFetch((url) =>
      url.includes("/auth/csrf")
        ? csrfResponse()
        : errorResponse(401, ErrorCode.INVALID_CREDENTIALS, "Credenciales invalidas"),
    );
    renderWithProviders(<LoginPage />);

    await fillAndSubmit("admin@empresa.com", "clave-incorrecta");

    expect(await screen.findByRole("alert")).toHaveTextContent(/correo o contraseña incorrectos/i);
  });

  it("informa cuando el usuario no esta habilitado en la aplicacion", async () => {
    mockFetch((url) =>
      url.includes("/auth/csrf")
        ? csrfResponse()
        : errorResponse(403, ErrorCode.PROFILE_NOT_PROVISIONED),
    );
    renderWithProviders(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no está habilitado/i);
  });

  it("informa cuando el backend no esta disponible", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    renderWithProviders(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo conectar/i);
  });

  it("muestra el estado real de carga durante la petición", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      return new Promise<Response>(() => {});
    });
    renderWithProviders(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByRole("button", { name: /iniciando sesión/i })).toBeDisabled();
  });

  it("navega al inicio después de un login correcto", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/me")) {
        return errorResponse(401, ErrorCode.NOT_AUTHENTICATED);
      }
      if (url.includes("/auth/csrf")) return csrfResponse();
      return sessionResponse();
    });
    renderApp(["/login"]);

    await screen.findByRole("button", { name: /iniciar sesión/i });
    await fillAndSubmit();

    expect(await screen.findByRole("heading", { name: /inicio/i })).toBeInTheDocument();
  });

  it("evita envios simultaneos mientras la peticion esta en curso", async () => {
    let resolveLogin: ((value: Response) => void) | undefined;
    const fetchSpy = mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      return new Promise<Response>((resolve) => {
        resolveLogin = resolve;
      });
    });
    renderWithProviders(<LoginPage />);

    const user = await fillAndSubmit();

    const submit = await screen.findByRole("button", { name: /iniciando sesión/i });
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    await user.click(submit);

    const loginCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/auth/login"));
    expect(loginCalls).toHaveLength(1);

    resolveLogin?.(sessionResponse());
  });

  it("muestra el estado visual de éxito tras una autenticación correcta", async () => {
    mockFetch((url) =>
      url.includes("/auth/csrf") ? csrfResponse() : sessionResponse(),
    );
    renderWithProviders(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByText(/¡acceso concedido!/i)).toBeInTheDocument();
    expect(screen.getByText(/iniciando plataforma/i)).toBeInTheDocument();
  });
});
