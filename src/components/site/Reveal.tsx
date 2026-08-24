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
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
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

  return (
    <Tag
      ref={ref}
      data-shown={shown}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      className={`reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
