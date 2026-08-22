import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError, ErrorCode } from "@/api/client";
import { Spinner } from "@/components/Spinner";
import { useLogin } from "@/features/auth/useSession";

const inputClassName =
  "block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-all focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

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
      <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden="true">
        <path
          d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.6 10.6 0 0 1 12 4c5.2 0 8.6 4.7 9 6.7.1.4.1.6 0 1a10.5 10.5 0 0 1-2.2 3.8M6.2 6.2A11.8 11.8 0 0 0 3 10.7c-.1.4-.1.6 0 1C3.4 13.7 6.8 18 12 18c1 0 2-.2 2.8-.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden="true">
      <path
        d="M3 10.7C3.5 8.6 6.9 4 12 4s8.5 4.6 9 6.7c.1.4.1.6 0 1-.5 2.1-3.9 6.3-9 6.3s-8.5-4.2-9-6.3c-.1-.4-.1-.6 0-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.6" stroke="currentColor" strokeWidth="1.8" />
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
  const [isSuccess, setIsSuccess] = useState(false);
  const login = useLogin();

  // La validación aquí solo mejora la experiencia. El backend vuelve a
  // validar todo: nada de lo que ocurre en esta pantalla es autoritativo.
  const canSubmit = email.trim().length > 0 && password.length > 0 && !login.isPending && !isSuccess;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          setIsSuccess(true);
          const from = (location.state as { from?: string } | null)?.from;
          window.setTimeout(() => {
            navigate(from ?? "/", { replace: true });
          }, 700);
        },
      },
    );
  };

  if (isSuccess) {
    return (
      <div className="py-7 text-center" role="status" aria-live="polite">
        <div className="login-check-pop mx-auto mb-3.5 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900">¡Acceso concedido!</h3>
        <p className="mt-1 text-sm text-gray-500">Iniciando plataforma...</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`space-y-5 ${login.isError ? "login-shake" : ""}`}
      aria-describedby="login-help"
    >
      <p id="login-help" className="sr-only">
        Ingresa el correo y la contraseña asociados a tu cuenta de Greda.
      </p>

      <div>
        <label htmlFor={emailId} className="block text-sm font-medium text-gray-700 mb-1.5">
          Correo Electrónico
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={login.isPending}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium text-gray-700 mb-1.5">
          Contraseña
        </label>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={login.isPending}
            className={`${inputClassName} pr-11`}
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            disabled={login.isPending}
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 transition-colors hover:text-gray-700 focus:outline-none disabled:cursor-not-allowed"
          >
            <PasswordVisibilityIcon visible={showPassword} />
          </button>
        </div>
      </div>

      <div className="min-h-[22px] flex items-center justify-center">
        {login.isError ? (
          <p
            role="alert"
            aria-live="polite"
            className="text-center text-xs sm:text-sm font-medium text-red-500"
          >
            {messageFor(login.error)}
          </p>
        ) : null}
      </div>

      <div className="pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-full shadow-sm text-sm font-semibold text-white bg-[#1a1a1a] hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#1a1a1a] disabled:text-white"
        >
          {login.isPending ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-4 text-white" label="Iniciando sesión..." />
              <span>Autenticando...</span>
            </span>
          ) : (
            "Iniciar sesión"
          )}
        </button>
      </div>
    </form>
  );
}
