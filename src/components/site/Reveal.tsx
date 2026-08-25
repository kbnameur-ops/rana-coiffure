"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Fait apparaître son contenu quand il entre dans la fenêtre. Une seule fois :
 * un élément qui rejoue son animation à chaque passage fatigue vite.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  variant = "rise",
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
  /** « arch » découvre le contenu par le bas, comme un store qu'on lève. */
  variant?: "rise" | "arch";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // Navigateur sans observateur : on affiche, hors du rendu en cours.
      const timer = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style = { "--reveal-delay": `${delay}ms` } as React.CSSProperties;

  // Le découpage se fait sur un enfant, jamais sur l'élément observé : un
  // `clip-path` qui vide la boîte annule aussi son intersection, et
  // l'observateur ne se déclencherait jamais.
  if (variant === "arch") {
    return (
      <Tag ref={ref} className={className}>
        <span data-shown={shown} style={style} className="reveal-arch block">
          {children}
        </span>
      </Tag>
    );
  }

  return (
    <Tag ref={ref} data-shown={shown} style={style} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
