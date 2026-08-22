import { BrandMark } from "@/features/auth/BrandMark";
import { LoginForm } from "@/features/auth/LoginForm";
import { LoginParticleBackground } from "@/features/auth/LoginParticleBackground";
import { useTypewriter } from "@/features/auth/useTypewriter";

const GREDA_MESSAGES = [
  "Bienvenido a Greda.",
  "Gestiona tu taller.",
  "Cotiza con precisión.",
] as const;

export function LoginPage() {
  const message = useTypewriter(GREDA_MESSAGES);

  return (
    <main
      className="login-experience relative isolate flex min-h-dvh w-full items-center justify-center overflow-x-hidden px-4 py-6 text-zinc-900 sm:px-6 sm:py-10"
      style={{ colorScheme: "light" }}
    >
      <LoginParticleBackground />

      <section
        aria-labelledby="login-title"
        className="login-card-enter relative z-10 w-full max-w-[420px] rounded-[1.75rem] border border-white/80 bg-white/88 px-6 py-7 shadow-[0_24px_70px_-32px_rgba(64,39,29,0.38)] backdrop-blur-md sm:px-9 sm:py-9"
      >
        <header className="text-center">
          <BrandMark />

          <div className="mt-7">
            <h1 id="login-title" className="text-3xl font-semibold tracking-[-0.035em] text-zinc-950">
              Bienvenido
            </h1>
            <p className="mt-2 text-base leading-6 text-zinc-600">
              Accede a tu espacio de trabajo.
            </p>
          </div>

          <p aria-hidden="true" className="mt-3 min-h-6 text-base font-medium text-clay-700">
            {message}
            <span className="login-typewriter-caret ml-0.5" aria-hidden="true">
              |
            </span>
          </p>
          <p className="sr-only">
            Bienvenido a Greda. Gestiona tu taller y cotiza con precisión.
          </p>
        </header>

        <LoginForm />

        <p className="mt-5 text-center text-sm leading-5 text-zinc-500">
          Gestión de cotizaciones y producción cerámica.
        </p>
      </section>
    </main>
  );
}
