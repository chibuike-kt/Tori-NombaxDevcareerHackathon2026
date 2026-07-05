"use client";
import type { ReactNode } from "react";
import { useInView } from "@/lib/use-in-view";

/** Fades and lifts children up once they scroll into view. Plain CSS transition, no JS animation loop. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
