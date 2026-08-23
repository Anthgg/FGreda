/**
 * Primitivas de formulario y componentes accesibles para GREDA.
 */

import { useId } from "react";
import type { ReactNode } from "react";

export { SelectField } from "@/components/SelectField";
export type { SelectOption } from "@/components/SelectField";
export { ProductSelectField } from "@/components/ProductSelectField";
export type { ProductSelectOption } from "@/components/ProductSelectField";

const CONTROL =
  "w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs " +
  "placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 " +
  "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 disabled:shadow-none disabled:opacity-60";

const TEXTAREA_CONTROL =
  "w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 shadow-xs " +
  "placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 " +
  "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 disabled:shadow-none disabled:opacity-60";

interface FieldProps {
  label: string;
  requirement?: "required" | "optional" | "automatic" | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: (id: string) => ReactNode;
  className?: string | undefined;
}

export function Field({
  label,
  requirement,
  hint,
  error,
  children,
  className = "",
}: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-xs font-medium text-zinc-700 mb-1"
      >
        <span>{label}</span>
        {requirement ? (
          <span
            className={
              requirement === "required"
                ? "text-orange-600 font-semibold"
                : "font-normal text-zinc-400"
            }
          >
            {requirement === "required"
              ? "* Obligatorio"
              : requirement === "optional"
                ? "Opcional"
                : "Automático"}
          </span>
        ) : null}
      </label>
      <div>{children(id)}</div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  requirement?: "required" | "optional" | "automatic" | undefined;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
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
  requirement,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  type = "text",
  placeholder,
  hint,
  error,
  maxLength,
  inputMode,
  className,
}: TextFieldProps) {
  return (
    <Field
      label={label}
      requirement={requirement}
      hint={hint}
      error={error}
      className={className}
    >
      {(id) => (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          readOnly={readOnly}
          required={requirement === "required"}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          className={[
            CONTROL,
            error ? "border-red-400 focus:border-red-500 focus:ring-red-500" : "",
            readOnly ? "bg-zinc-50/80 cursor-default opacity-80" : "",
          ].join(" ")}
        />
      )}
    </Field>
  );
}

interface TextAreaFieldProps {
  label: string;
  requirement?: "required" | "optional" | undefined;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  rows?: number | undefined;
  placeholder?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
}

export function TextAreaField({
  label,
  requirement,
  value,
  onChange,
  disabled = false,
  rows = 3,
  placeholder,
  hint,
  error,
  className,
}: TextAreaFieldProps) {
  return (
    <Field
      label={label}
      requirement={requirement}
      hint={hint}
      error={error}
      className={className}
    >
      {(id) => (
        <textarea
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required={requirement === "required"}
          rows={rows}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={[
            TEXTAREA_CONTROL,
            "resize-y",
            error ? "border-red-400 focus:border-red-500 focus:ring-red-500" : "",
          ].join(" ")}
        />
      )}
    </Field>
  );
}

export function FormSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className="border-t border-zinc-200/80 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        ) : null}
      </div>
      <div className={className || "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>{children}</div>
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
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
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
      className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-xs transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
