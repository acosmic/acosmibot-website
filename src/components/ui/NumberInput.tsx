import React, { forwardRef, useEffect, useRef, useState } from 'react';

type NativeNumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
>;

export interface NumberInputProps extends NativeNumberInputProps {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Called when an empty value is meaningful, such as an optional number. */
  onEmpty?: () => void;
}

const displayValue = (value: NumberInputProps['value']) =>
  value == null ? '' : String(value);

/**
 * A controlled numeric input with a local editing buffer.
 *
 * Numeric form models cannot represent the temporary empty string produced
 * when a user selects a value or backspaces over it. Keeping that string here
 * prevents React from immediately redrawing the old value (commonly `0`) and
 * lets the user type the replacement normally.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, onEmpty, onBlur, ...props }, ref) => {
    const externalValue = displayValue(value);
    const previousExternalValue = useRef(externalValue);
    const [draft, setDraft] = useState(externalValue);

    useEffect(() => {
      if (externalValue !== previousExternalValue.current) {
        previousExternalValue.current = externalValue;
        setDraft(externalValue);
      }
    }, [externalValue]);

    return (
      <input
        {...props}
        ref={ref}
        type="number"
        value={draft}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);

          if (next === '') {
            onEmpty?.();
            return;
          }

          const parsed = event.currentTarget.valueAsNumber;
          if (Number.isFinite(parsed)) onValueChange(parsed);
        }}
        onBlur={(event) => {
          // Required fields revert to their last model value when left empty.
          // This also reflects any clamping/normalization done by the parent.
          setDraft(displayValue(value));
          onBlur?.(event);
        }}
      />
    );
  },
);

NumberInput.displayName = 'NumberInput';
