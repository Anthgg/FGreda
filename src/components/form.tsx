/**
 * Primitivas de formulario y componentes accesibles para GREDA.
 */

import { useId } from "react";
import type { ReactNode } from "react";

export { SelectField } from "@/components/SelectField";
export type { SelectOption } from "@/components/SelectField";
export { ProductSelectField } from "@/components/ProductSelectField";
export type { ProductSelectOption } from "@/components/ProductSelectField";
export { DatePickerField } from "@/components/DatePickerField";
export type { DatePickerFieldProps } from "@/components/DatePickerField";


const CONTROL =
  "w-full h-10 rounded-xl border border-black/[0.08] bg-white/55 backdrop-blur-xs px-3 py-2 text-xs sm:text-sm text-zinc-900 shadow-2xs " +
  "placeholder:text-zinc-400 transition-all focus:border-black focus:bg-white/80 focus:outline-hidden focus:ring-1 focus:ring-black " +
  "disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-zinc-400 disabled:border-black/[0.04] disabled:shadow-none disabled:opacity-50";

const TEXTAREA_CONTROL =
  "w-full rounded-xl border border-black/[0.08] bg-white/55 backdrop-blur-xs p-3 text-xs sm:text-sm text-zinc-900 shadow-2xs " +
  "placeholder:text-zinc-400 transition-all focus:border-black focus:bg-white/80 focus:outline-hidden focus:ring-1 focus:ring-black " +
  "disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-zinc-400 disabled:border-black/[0.04] disabled:shadow-none disabled:opacity-50";

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
        className="flex items-baseline justify-between gap-2 text-xs font-semibold text-zinc-800 mb-1"
      >
        <span>{label}</span>
        {requirement ? (
          <span
            className={
              requirement === "required"
                ? "text-amber-700 font-semibold"
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
        <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>
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
            readOnly ? "bg-black/[0.02] cursor-default opacity-80" : "",
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
    <section className="border-t border-black/[0.04] pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
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
  className = "",
}: {
  children: ReactNode;
  disabled?: boolean | undefined;
  type?: "submit" | "button" | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:bg-zinc-800 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  type = "button",
  onClick,
  className = "",
}: {
  children: ReactNode;
  disabled?: boolean | undefined;
  type?: "button" | "submit" | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl border border-black/[0.08] bg-white/60 backdrop-blur-xs px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-zinc-800 shadow-2xs transition-all hover:bg-white/90 hover:text-zinc-950 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
