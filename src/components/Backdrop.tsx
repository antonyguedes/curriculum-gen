import { RainbowDust } from "./RainbowDust";

/** Fundo fixo: aurora arco-íris em movimento lento, grade fina e estrelas piscando. */

// Posições determinísticas: o mesmo HTML no servidor e no cliente (sem erro de hidratação).
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { left: r(1) * 100, top: r(2) * 100, delay: r(3) * 4, size: r(4) > 0.85 ? 3 : 2 };
});

export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="backdrop-aurora" />
      <div className="backdrop-grid" />
      <RainbowDust />
      {STARS.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s`, width: s.size, height: s.size }}
        />
      ))}
      <div className="backdrop-vignette" />
    </div>
  );
}
