/**
 * Primitivas de formulario.
 *
 * Densidad moderada y controles planos: la configuracion es una pantalla de
 * trabajo, no un escaparate. Cada campo es una etiqueta y un control, sin
 * encerrar cada uno en su propia tarjeta.
 */

import { useId } from "react";
import type { ReactNode } from "react";

const CONTROL =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-clay-500 focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-900/60";

interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: (id: string) => ReactNode;
  className?: string | undefined;
}

export function Field({ label, hint, error, children, className = "" }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div className="mt-1">{children(id)}</div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  type?: "text" | "email" | "url" | "tel" | "number" | undefined;
  placeholder?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  maxLength?: number | undefined;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | undefined;
  className?: string | undefined;
}

export function TextField({
  label,
  value,
  onChange,
  disabled = false,
  type = "text",
  placeholder,
  hint,
  error,
  maxLength,
  inputMode,
  className,
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          className={CONTROL}
        />
      )}
    </Field>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  rows?: number | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
}

export function TextAreaField({
  label,
  value,
  onChange,
  disabled = false,
  rows = 3,
  hint,
  error,
  className,
}: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <textarea
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={`${CONTROL} resize-y`}
        />
      )}
    </Field>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean | undefined;
  hint?: string | undefined;
  className?: string | undefined;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
  className,
}: SelectFieldProps<T>) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          disabled={disabled}
          className={CONTROL}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-zinc-200 pt-4 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{description}</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function PrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean | undefined;
  type?: "submit" | "button" | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-clay-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-clay-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}
