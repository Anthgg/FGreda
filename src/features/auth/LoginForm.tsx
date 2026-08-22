import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError, ErrorCode } from "@/api/client";
import { Spinner } from "@/components/Spinner";
import { useLogin } from "@/features/auth/useSession";

const inputClassName =
  "mt-2 block min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[16px] text-zinc-950 shadow-sm shadow-zinc-950/[0.025] transition-[border-color,box-shadow,background-color] placeholder:text-zinc-400 hover:border-zinc-400 focus:border-clay-600 focus:outline-none focus:ring-4 focus:ring-clay-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 sm:text-base";

/** Traduce errores de autenticación a mensajes seguros y accionables. */
function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Ocurrió un error inesperado. Intenta nuevamente.";
  }
  if (error.isUnreachable) {
    return "No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.";
  }
  switch (error.code) {
    case ErrorCode.INVALID_CREDENTIALS:
      return "Correo o contraseña incorrectos.";
    case ErrorCode.PROFILE_NOT_PROVISIONED:
      return "Tu usuario no está habilitado en la aplicación. Contacta al administrador.";
    case ErrorCode.ACCOUNT_INACTIVE:
      return "Tu cuenta está desactivada. Contacta al administrador.";
    default:
      return "No fue posible iniciar sesión. Intenta nuevamente.";
  }
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
        <path
          d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.6 10.6 0 0 1 12 4c5.2 0 8.6 4.7 9 6.7.1.4.1.6 0 1a10.5 10.5 0 0 1-2.2 3.8M6.2 6.2A11.8 11.8 0 0 0 3 10.7c-.1.4-.1.6 0 1C3.4 13.7 6.8 18 12 18c1 0 2-.2 2.8-.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
      <path
        d="M3 10.7C3.5 8.6 6.9 4 12 4s8.5 4.6 9 6.7c.1.4.1.6 0 1-.5 2.1-3.9 6.3-9 6.3s-8.5-4.2-9-6.3c-.1-.4-.1-.6 0-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  // La validación aquí solo mejora la experiencia. El backend vuelve a
  // validar todo: nada de lo que ocurre en esta pantalla es autoritativo.
  const canSubmit = email.trim().length > 0 && password.length > 0 && !login.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

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
    <form onSubmit={handleSubmit} noValidate className="mt-7" aria-describedby="login-help">
      <p id="login-help" className="sr-only">
        Ingresa el correo y la contraseña asociados a tu cuenta de Greda.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor={emailId} className="block text-base font-medium text-zinc-700">
            Correo electrónico
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={login.isPending}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="block text-base font-medium text-zinc-700">
            Contraseña
          </label>
          <div className="relative">
            <input
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={login.isPending}
              className={`${inputClassName} pr-12`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              disabled={login.isPending}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 mt-2 grid min-h-[44px] min-w-[44px] place-items-center rounded-xl text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-offset-[-3px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PasswordVisibilityIcon visible={showPassword} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-[4.5rem] items-end py-3">
        {login.isError ? (
          <p
            role="alert"
            className="w-full rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-base leading-5 text-red-800"
          >
            {messageFor(login.error)}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-base font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] hover:bg-zinc-800 active:translate-y-px disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600 disabled:shadow-none"
      >
        {login.isPending ? (
          <Spinner className="size-4" label="Iniciando sesión..." />
        ) : (
          "Iniciar sesión"
        )}
      </button>
    </form>
  );
}
