import type { KeyboardEvent, ReactNode } from "react";
import { useId, useRef } from "react";

export interface ChoiceCardOption<T extends string = string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  ariaLabel?: string;
  id?: string;
  testId?: string;
  children?: ReactNode;
}

export interface ChoiceCardGroupProps<T extends string = string> {
  value: T | null | undefined;
  onChange: (value: T) => void;
  options: readonly ChoiceCardOption<T>[];
  name?: string;
  label?: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  disabled?: boolean;
  columns?: 1 | 2 | 3 | 4 | "auto";
  showRadioIndicator?: boolean;
  className?: string;
  cardsClassName?: string;
  cardClassName?: string;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  "data-testid"?: string;
}

function getNextEnabledIndex<T extends string>(
  options: readonly ChoiceCardOption<T>[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  const count = options.length;
  if (count === 0) return -1;
  for (let step = 1; step <= count; step++) {
    const candidate = (currentIndex + direction * step + count) % count;
    if (!options[candidate]?.disabled) {
      return candidate;
    }
  }
  return -1;
}

function getFirstEnabledIndex<T extends string>(
  options: readonly ChoiceCardOption<T>[],
): number {
  return options.findIndex((opt) => !opt.disabled);
}

function getLastEnabledIndex<T extends string>(
  options: readonly ChoiceCardOption<T>[],
): number {
  for (let i = options.length - 1; i >= 0; i--) {
    if (!options[i]?.disabled) return i;
  }
  return -1;
}

export function ChoiceCardGroup<T extends string = string>({
  value,
  onChange,
  options,
  name: _name,
  label,
  ariaLabel,
  ariaLabelledBy,
  disabled = false,
  columns,
  showRadioIndicator = true,
  className = "",
  cardsClassName = "",
  cardClassName = "",
  hint,
  error,
  id: externalId,
  "data-testid": testId,
}: ChoiceCardGroupProps<T>) {
  const generatedId = useId();
  const rootId = externalId ?? generatedId;
  const labelId = `${rootId}-label`;
  const hintId = `${rootId}-hint`;
  const errorId = `${rootId}-error`;

  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const isSelectedEnabled =
    selectedIndex !== -1 && !options[selectedIndex]?.disabled && !disabled;

  const navigableIndex = disabled
    ? -1
    : isSelectedEnabled
      ? selectedIndex
      : getFirstEnabledIndex(options);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;

    let targetIndex = -1;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        targetIndex = getNextEnabledIndex(options, index, 1);
        break;

      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        targetIndex = getNextEnabledIndex(options, index, -1);
        break;

      case "Home":
        event.preventDefault();
        targetIndex = getFirstEnabledIndex(options);
        break;

      case "End":
        event.preventDefault();
        targetIndex = getLastEnabledIndex(options);
        break;

      case " ":
      case "Spacebar":
      case "Enter": {
        event.preventDefault();
        const currentOption = options[index];
        if (currentOption && !currentOption.disabled) {
          onChange(currentOption.value);
        }
        return;
      }

      default:
        return;
    }

    if (targetIndex !== -1) {
      const targetOption = options[targetIndex];
      if (targetOption && !targetOption.disabled) {
        cardRefs.current[targetIndex]?.focus();
        if (targetOption.value !== value) {
          onChange(targetOption.value);
        }
      }
    }
  };

  const handleClick = (option: ChoiceCardOption<T>) => {
    if (disabled || option.disabled) return;
    onChange(option.value);
  };

  const defaultColumnsClass =
    columns === 1
      ? "grid grid-cols-1 gap-3.5"
      : columns === 2
        ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5"
        : columns === 3
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
          : columns === 4
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
            : columns === "auto"
              ? "grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5"
              : options.length === 2
                ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5"
                : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5";

  const describedBy = error
    ? errorId
    : hint
      ? hintId
      : undefined;

  const labelledBy = label ? labelId : ariaLabelledBy;

  const groupMarkup = (
    <div
      role="radiogroup"
      id={rootId}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-disabled={disabled ? true : undefined}
      data-testid={testId}
      className={[
        defaultColumnsClass,
        disabled ? "opacity-50 cursor-not-allowed" : "",
        cardsClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isCardDisabled = disabled || Boolean(option.disabled);
        const isNavigable = !disabled && index === navigableIndex;
        const cardId = option.id ?? `${rootId}-card-${index}`;

        return (
          <button
            key={option.value}
            id={cardId}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isCardDisabled ? true : undefined}
            aria-label={option.ariaLabel}
            tabIndex={isNavigable ? 0 : -1}
            disabled={isCardDisabled}
            data-testid={option.testId}
            onClick={() => handleClick(option)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              "group relative flex flex-col p-4 sm:p-5 rounded-2xl border text-left transition-all duration-150 select-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950",
              isSelected
                ? "border-zinc-950 ring-1 ring-zinc-950 bg-white/95 shadow-xs text-zinc-900 cursor-default"
                : "border-black/[0.08] bg-white/60 backdrop-blur-xs shadow-2xs hover:border-black/20 hover:bg-white/80 hover:shadow-xs text-zinc-900 cursor-pointer",
              isCardDisabled
                ? "opacity-40 cursor-not-allowed bg-zinc-50/50 border-black/[0.04] shadow-none pointer-events-none hover:bg-zinc-50/50"
                : "",
              cardClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {option.badge && (
              <div className="absolute -top-2.5 right-4 z-10 pointer-events-none">
                {typeof option.badge === "string" ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-700 text-white shadow-2xs tracking-wide">
                    {option.badge}
                  </span>
                ) : (
                  option.badge
                )}
              </div>
            )}

            <div className="flex items-start justify-between gap-3 w-full">
              <div className="min-w-0 flex-1">
                <span className="block text-sm sm:text-base font-bold text-zinc-950 tracking-tight leading-snug">
                  {option.title}
                </span>
                {option.description && (
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                    {option.description}
                  </p>
                )}
              </div>

              {showRadioIndicator && (
                <span
                  aria-hidden="true"
                  className={[
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-all",
                    isSelected
                      ? "border-zinc-950 bg-zinc-950"
                      : "border-zinc-300 bg-white group-hover:border-zinc-400",
                    isCardDisabled ? "border-zinc-200 bg-zinc-100" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                </span>
              )}
            </div>

            {option.children && (
              <div className="my-3 w-full">{option.children}</div>
            )}

            {option.meta && (
              <div className="mt-auto pt-3 border-t border-black/[0.04] text-xs font-semibold text-zinc-900 tabular-nums w-full">
                {option.meta}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  if (!label && !hint && !error && !className) {
    return groupMarkup;
  }

  return (
    <div className={className}>
      {label && (
        <label
          id={labelId}
          className="flex items-baseline justify-between gap-2 text-xs font-semibold text-zinc-800 mb-2"
        >
          <span>{label}</span>
        </label>
      )}
      {groupMarkup}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600 font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[11px] text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
