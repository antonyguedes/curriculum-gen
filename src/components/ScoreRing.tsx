"use client";

import { useEffect, useState } from "react";

export const scoreTone = (v: number) => (v >= 85 ? "ok" : v >= 70 ? "warn" : "bad");

/**
 * Medidor circular: o traço é o espectro arco-íris girando devagar, com brilho por baixo.
 * O progresso é animado via a propriedade CSS registrada --p.
 */
export function ScoreRing({ value, size = 120, stroke = 9, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(v));
    return () => cancelAnimationFrame(t);
  }, [v]);

  const ring = `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px + 0.5px))`;
  const arc: React.CSSProperties = {
    background: "conic-gradient(from var(--angle), var(--rainbow))",
    WebkitMask: `${ring}, conic-gradient(#000 var(--p), transparent 0)`,
    WebkitMaskComposite: "source-in",
    mask: `${ring} intersect, conic-gradient(#000 var(--p), transparent 0)`,
    animation: "angle 8s linear infinite",
    transition: "--p 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
    ["--p" as string]: `${shown}%`,
  };

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"}: ${v} de 100`}>
      <div className="absolute inset-0 rounded-full" style={{ WebkitMask: ring, mask: ring, background: "rgb(255 255 255 / 0.07)" }} />
      <div className="absolute inset-0 -rotate-0 rounded-full opacity-80 blur-[7px]" style={arc} />
      <div className="absolute inset-0 rounded-full" style={arc} />
      <div className="relative text-center">
        <div className="font-display font-bold tabular-nums leading-none text-fg" style={{ fontSize: size * 0.3 }}>
          {v}
        </div>
        {label && size >= 90 && <div className="label-mono mt-1.5 text-subtle">{label}</div>}
      </div>
    </div>
  );
}
