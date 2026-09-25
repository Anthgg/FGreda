import type { KeyboardEvent, ReactNode } from "react";
import { useId, useRef } from "react";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  testId?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T | null | undefined;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  name?: string;
  label?: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
  optionsClassName?: string;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  "data-testid"?: string;
}

function getNextEnabledIndex<T extends string>(
  options: readonly SegmentedControlOption<T>[],
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
  options: readonly SegmentedControlOption<T>[],
): number {
  return options.findIndex((opt) => !opt.disabled);
}

function getLastEnabledIndex<T extends string>(
  options: readonly SegmentedControlOption<T>[],
): number {
  for (let i = options.length - 1; i >= 0; i--) {
    if (!options[i]?.disabled) return i;
  }
  return -1;
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  name: _name,
  label,
  ariaLabel,
  ariaLabelledBy,
  disabled = false,
  size = "md",
  fullWidth = false,
  orientation = "horizontal",
  className = "",
  optionsClassName = "",
  hint,
  error,
  id: externalId,
  "data-testid": testId,
}: SegmentedControlProps<T>) {
  const generatedId = useId();
  const rootId = externalId ?? generatedId;
  const labelId = `${rootId}-label`;
  const hintId = `${rootId}-hint`;
  const errorId = `${rootId}-error`;

  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
        optionRefs.current[targetIndex]?.focus();
        if (targetOption.value !== value) {
          onChange(targetOption.value);
        }
      }
    }
  };

  const handleClick = (option: SegmentedControlOption<T>) => {
    if (disabled || option.disabled) return;
    onChange(option.value);
  };

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-1.5 text-xs sm:text-sm gap-2",
    lg: "px-4.5 py-2 text-sm gap-2.5",
  }[size];

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
      aria-orientation={orientation}
      aria-disabled={disabled ? true : undefined}
      data-testid={testId}
      className={[
        "inline-flex items-center p-1 rounded-xl border border-black/[0.08] bg-white/55 backdrop-blur-xs shadow-2xs gap-1",
        orientation === "vertical" ? "flex-col items-stretch" : "",
        fullWidth ? "flex w-full" : "",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        optionsClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isOptionDisabled = disabled || Boolean(option.disabled);
        const isNavigable = !disabled && index === navigableIndex;
        const optionId = option.id ?? `${rootId}-opt-${index}`;

        return (
          <button
            key={option.value}
            id={optionId}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isOptionDisabled ? true : undefined}
            aria-label={option.ariaLabel}
            tabIndex={isNavigable ? 0 : -1}
            disabled={isOptionDisabled}
            data-testid={option.testId}
            onClick={() => handleClick(option)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              "relative inline-flex items-center justify-center font-medium transition-all duration-150 select-none rounded-lg text-center",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950",
              sizeClasses,
              fullWidth ? "flex-1 w-full" : "",
              isSelected
                ? "bg-zinc-950 text-white shadow-xs font-semibold cursor-default"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-black/[0.04] cursor-pointer",
              isOptionDisabled
                ? "opacity-40 cursor-not-allowed pointer-events-none hover:bg-transparent"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>{option.label}</span>
            {option.description && (
              <span
                className={[
                  "text-[11px] transition-colors",
                  isSelected ? "text-zinc-300" : "text-zinc-400",
                ].join(" ")}
              >
                {option.description}
              </span>
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
          className="flex items-baseline justify-between gap-2 text-xs font-semibold text-zinc-800 mb-1.5"
        >
          <span>{label}</span>
        </label>
      )}
      {groupMarkup}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-red-600 font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-[11px] text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
