"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  variant = "primary",
  formAction,
  name,
  value,
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-ink text-cream hover:bg-ink-soft",
    ghost: "border border-ink/20 hover:border-ink",
    danger: "border border-red-300 text-red-700 hover:bg-red-50",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      formAction={formAction}
      name={name}
      value={value}
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function ConfirmButton({
  children,
  message,
  formAction,
  name,
  value,
  variant = "danger",
}: {
  children: React.ReactNode;
  message: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-ink text-cream hover:bg-ink-soft",
    ghost: "border border-ink/20 hover:border-ink",
    danger: "border border-red-300 text-red-700 hover:bg-red-50",
  }[variant];

  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${styles}`}
    >
      {children}
    </button>
  );
}
