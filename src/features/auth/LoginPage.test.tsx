import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ErrorCode } from "@/api/client";
import { LoginPage } from "@/features/auth/LoginPage";
import {
  csrfResponse,
  errorResponse,
  mockFetch,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";

async function fillAndSubmit(email = "admin@empresa.com", password = "clave-correcta") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/correo/i), email);
  await user.type(screen.getByLabelText(/contrasena/i), password);
  await user.click(screen.getByRole("button", { name: /iniciar sesion/i }));
  return user;
}

describe("pantalla de login", () => {
  it("muestra los campos y la accion", () => {
    mockFetch(() => csrfResponse());
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contrasena/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesion/i })).toBeInTheDocument();
  });

  it("no ofrece registro ni acceso con redes sociales", () => {
    mockFetch(() => csrfResponse());
    renderWithProviders(<LoginPage />);

    expect(screen.queryByText(/registrarse|crear cuenta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/google|facebook/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/olvide mi contrasena|recuperar/i)).not.toBeInTheDocument();
  });

  it("mantiene deshabilitado el envio mientras faltan datos", () => {
    mockFetch(() => csrfResponse());
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole("button", { name: /iniciar sesion/i })).toBeDisabled();
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

    expect(await screen.findByRole("alert")).toHaveTextContent(/correo o contrasena incorrectos/i);
  });

  it("informa cuando el usuario no esta habilitado en la aplicacion", async () => {
    mockFetch((url) =>
      url.includes("/auth/csrf")
        ? csrfResponse()
        : errorResponse(403, ErrorCode.PROFILE_NOT_PROVISIONED),
    );
    renderWithProviders(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no esta habilitado/i);
  });

  it("informa cuando el backend no esta disponible", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    renderWithProviders(<LoginPage />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo conectar/i);
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

    const submit = screen.getByRole("button");
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    await user.click(submit);

    const loginCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/auth/login"));
    expect(loginCalls).toHaveLength(1);

    resolveLogin?.(sessionResponse());
  });
});
