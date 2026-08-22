import { BrandMark } from "@/features/auth/BrandMark";
import { LoginForm } from "@/features/auth/LoginForm";
import { LoginParticleBackground } from "@/features/auth/LoginParticleBackground";
import { useTypewriter } from "@/features/auth/useTypewriter";

const ROTATING_PHRASES = [
  "Inicia sesión.",
  "Bienvenido a Greda.",
  "Gestiona tu taller.",
] as const;

export function LoginPage() {
  const message = useTypewriter(ROTATING_PHRASES);

  return (
    <main
      className="login-experience relative isolate flex min-h-dvh w-full items-center justify-center overflow-x-hidden p-4 text-gray-900 sm:p-6"
      style={{ colorScheme: "light" }}
    >
      <LoginParticleBackground />

      <section
        aria-labelledby="login-title"
        className="login-card-enter relative z-10 w-full max-w-[380px] rounded-[32px] border border-white/60 bg-white/95 p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] backdrop-blur-md sm:p-10"
      >
        <header className="mb-6 text-center">
          <BrandMark />

          <div className="flex h-10 items-center justify-center">
            <h1
              id="login-title"
              className="inline-flex items-center text-2xl font-bold tracking-tight text-gray-900"
            >
              <span>{message}</span>
              <span
                className="login-caret-blink ml-1 inline-block h-[1.15em] w-[2px] rounded-sm bg-black"
                aria-hidden="true"
              />
            </h1>
          </div>

          <p className="sr-only">
            Inicia sesión en Greda. Gestiona tu taller y cotiza con precisión.
          </p>
        </header>

        <LoginForm />
      </section>
    </main>
  );
}
