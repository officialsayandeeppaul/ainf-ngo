"use client";

import { useId, useState } from "react";

/**
 * The ten local digits from whatever was typed, pasted, autofilled or stored
 * ("+91 98765 43210", "09876543210", "+919876543210"). India only, so the
 * country code is fixed and never typed.
 */
export function mobileDigits(raw: string | null | undefined): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function isMobileDigits(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * +91 shown as a fixed prefix; the box takes exactly ten digits. Controlled
 * (value/onChange get the ten digits) or uncontrolled with name/defaultValue
 * for plain form posts. No maxLength attribute: the browser would cut a pasted
 * "+91 98765 43210" before the prefix could be stripped.
 */
export function PhoneField({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  placeholder = "10-digit mobile",
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string | null;
  onChange?: (digits: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [own, setOwn] = useState(() => mobileDigits(defaultValue));
  const [left, setLeft] = useState(false);
  const hintId = useId();
  const digits = value !== undefined ? mobileDigits(value) : own;
  const showError = left && digits.length > 0 && !isMobileDigits(digits);

  return (
    <>
      <span className="pt-phone">
        <span className="pt-phone__cc" aria-hidden="true">
          +91
        </span>
        <input
          id={id}
          name={name}
          className="pt-input"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={placeholder}
          pattern="[6-9][0-9]{9}"
          title="10-digit mobile number starting with 6, 7, 8 or 9"
          required={required}
          disabled={disabled}
          value={digits}
          onChange={(event) => {
            const next = mobileDigits(event.target.value);
            if (value === undefined) setOwn(next);
            onChange?.(next);
          }}
          onBlur={() => setLeft(true)}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? hintId : undefined}
        />
      </span>
      {showError ? (
        <span id={hintId} className="pt-field-error">
          Enter the 10-digit mobile number, starting with 6, 7, 8 or 9.
        </span>
      ) : null}
    </>
  );
}
