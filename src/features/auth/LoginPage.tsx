import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError, ErrorCode } from "@/api/client";
import { Spinner } from "@/components/Spinner";
import { useLogin } from "@/features/auth/useSession";

/** Traduce un error del backend a un mensaje util para la persona usuaria. */
function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Ocurrio un error inesperado. Intente nuevamente.";
  }
  if (error.isUnreachable) {
    return "No se pudo conectar con el servidor. Verifique su conexion e intente de nuevo.";
  }
  switch (error.code) {
    case ErrorCode.INVALID_CREDENTIALS:
      return "Correo o contrasena incorrectos.";
    case ErrorCode.PROFILE_NOT_PROVISIONED:
      return "Su usuario no esta habilitado en la aplicacion. Contacte al administrador.";
    case ErrorCode.ACCOUNT_INACTIVE:
      return "Su cuenta esta desactivada. Contacte al administrador.";
    default:
      return error.message;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  // La validacion aqui es solo de experiencia de usuario. El backend vuelve a
  // validar todo: nada de lo que ocurra en esta pantalla es autoritativo.
  const canSubmit = email.trim().length > 0 && password.length > 0 && !login.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return; // impide envios simultaneos

    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          const from = (location.state as { from?: string } | null)?.from;
          navigate(from ?? "/", { replace: true });
        },
      },
    );
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-xs">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Cotizador Greda
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Ingrese con sus credenciales para continuar.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor={emailId}
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Correo electronico
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={login.isPending}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-clay-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor={passwordId}
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Contrasena
            </label>
            <input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={login.isPending}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-clay-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {login.isError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {messageFor(login.error)}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-clay-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-clay-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {login.isPending ? <Spinner className="size-4" label="Ingresando..." /> : "Iniciar sesion"}
          </button>
        </form>
      </div>
    </main>
  );
}
