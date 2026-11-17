"use client";

import { Check, Download, FileSearch, ShieldCheck, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import type { FlowStep } from "@/lib/types";

/* ───────────── Geometria da órbita ─────────────
   Uma elipse inclinada. Toda a matemática fica em JS para que a linha, o preenchimento
   e os tiles usem exatamente os mesmos pontos. Há duas versões: deitada (telas largas)
   e em pé (telas estreitas/altas), para a órbita sempre caber inteira no espaço disponível. */

const SAMPLES = 360;
const SEGMENTS = 120;
const START = 0.72 * Math.PI; // Perfil embaixo, à esquerda; o fluxo segue no sentido horário

interface Shape {
  W: number;
  H: number;
  rx: number;
  ry: number;
  tilt: number;
}

function makeGeometry({ W, H, rx, ry, tilt }: Shape) {
  const cx = W / 2;
  const cy = H / 2;
  const t = (tilt * Math.PI) / 180;
  const point = (theta: number) => {
    const x0 = rx * Math.cos(theta);
    const y0 = ry * Math.sin(theta);
    return { x: cx + x0 * Math.cos(t) - y0 * Math.sin(t), y: cy + x0 * Math.sin(t) + y0 * Math.cos(t) };
  };
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => point(START + (i / SAMPLES) * 2 * Math.PI));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1];
  /** Ponto a uma fração do comprimento do arco (não do ângulo): espaçamento visual uniforme. */
  const at = (f: number) => {
    const target = f * total;
    const i = cum.findIndex((c) => c >= target);
    if (i <= 0) return pts[0];
    const k = (target - cum[i - 1]) / (cum[i] - cum[i - 1]);
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
  };
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  // Segmentos coloridos ao longo do caminho: o arco-íris segue a curva.
  const segments = Array.from({ length: SEGMENTS }, (_, s) => {
    const a = at(s / SEGMENTS);
    const b = at((s + 1.15) / SEGMENTS); // leve sobreposição evita frestas
    return { d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`, color: spectrum(s / SEGMENTS) };
  });
  return { W, H, d, total, at, segments };
}
type Geometry = ReturnType<typeof makeGeometry>;

const LANDSCAPE = makeGeometry({ W: 1000, H: 470, rx: 430, ry: 150, tilt: -9 });
const PORTRAIT = makeGeometry({ W: 520, H: 1000, rx: 175, ry: 410, tilt: -7 });

/** Proporção do palco de cada versão (largura / altura). */
export const ORBIT_RATIO = { landscape: LANDSCAPE.W / LANDSCAPE.H, portrait: PORTRAIT.W / PORTRAIT.H };

/** Espectro: vermelho → laranja → amarelo → verde → ciano → azul → violeta. */
export function spectrum(f: number) {
  return `hsl(${Math.round(355 + f * 285) % 360} 100% ${f > 0.45 && f < 0.75 ? 62 : 64}%)`;
}

/* ───────────── Etapas ───────────── */

const STEPS: { key: FlowStep; label: string; icon: LucideIcon }[] = [
  { key: "perfil", label: "Perfil", icon: UserRound },
  { key: "vaga", label: "Vaga", icon: FileSearch },
  { key: "gerar", label: "Gerar", icon: Sparkles },
  { key: "verificar", label: "Verificar", icon: ShieldCheck },
  { key: "baixar", label: "Baixar", icon: Download },
];

export interface FlowState {
  done: Record<FlowStep, boolean>;
  counts?: Partial<Record<FlowStep, number>>;
}

/** Índice da etapa atual: a primeira ainda não concluída (5 = ciclo completo). */
export const currentStep = (state: FlowState) => {
  const i = STEPS.findIndex((s) => !state.done[s.key]);
  return i === -1 ? STEPS.length : i;
};

function Tile({
  step,
  index,
  state,
  current,
  geo,
  selected,
  onSelect,
}: {
  step: (typeof STEPS)[number];
  index: number;
  state: FlowState;
  current: number;
  geo: Geometry;
  selected: boolean;
  onSelect: (step: FlowStep) => void;
}) {
  const f = index / STEPS.length;
  const pos = geo.at(f);
  const color = spectrum(f);
  const done = state.done[step.key];
  const isCurrent = index === current;
  const featured = step.key === "vaga";
  // Tamanho relativo à largura do palco (unidade cqw): tudo escala junto com a órbita.
  const scale = geo === PORTRAIT ? 1.9 : 1;
  const rel = (featured ? 9.6 : isCurrent ? 8 : 7) * scale;
  const size = `clamp(42px, ${rel}cqw, ${featured ? 128 : 108}px)`;
  const Icon = step.icon;
  const count = state.counts?.[step.key];

  const tile: ReactNode = (
    <span className={`group flex flex-col items-center gap-[clamp(4px,1cqw,10px)] ${!done && !isCurrent && !featured ? "opacity-55 hover:opacity-100" : ""} transition-opacity duration-300`}>
      <span className="relative">
        {/* etapa aberta no painel: anel tracejado girando na cor da etapa */}
        {selected && (
          <span
            className="absolute -inset-[16%] animate-spin-slow rounded-full border-2 border-dashed opacity-90"
            style={{ borderColor: color, animationDuration: "14s", filter: `drop-shadow(0 0 6px ${color})` }}
          />
        )}
        {isCurrent && !selected && (
          <>
            <span className="absolute -inset-[12%] animate-ping rounded-[30%] border" style={{ borderColor: color, animationDuration: "2.4s" }} />
            <span className="absolute -inset-[25%] rounded-[36%] opacity-40 blur-2xl" style={{ background: color }} />
          </>
        )}
        <span
          className={`relative grid place-items-center rounded-[26%] transition duration-500 ${featured || isCurrent ? "rainbow-border rainbow-halo isolate" : "tile tile-hover"}`}
          style={{ width: size, height: size, boxShadow: done && !featured ? `0 0 34px -10px ${color}, inset 0 0 22px -8px ${color}` : undefined }}
        >
          <Icon
            strokeWidth={1.4}
            style={{ width: "38%", height: "38%", color: done || isCurrent || featured ? color : "#cfeaff", filter: `drop-shadow(0 0 8px ${color})` }}
            className="transition duration-300 group-hover:scale-110"
          />
        </span>
        {/* Selos ficam FORA do tile: o tile recorta o conteúdo (reflexo do hover) e cortaria o selo pela metade. */}
        {done && (
          <span
            className="absolute -right-1.5 -top-1.5 z-10 grid h-[22px] w-[22px] place-items-center rounded-full ring-[3px] ring-ink"
            style={{ background: color, boxShadow: `0 0 14px 2px ${color}` }}
          >
            <Check className="h-3 w-3 text-ink" strokeWidth={3.4} />
          </span>
        )}
        {!done && count !== undefined && count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 z-10 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-ink px-1 font-mono text-[0.62rem] ring-1 ring-white/15" style={{ color }}>
            {count}
          </span>
        )}
      </span>
      <span
        className={`label-mono rounded-md px-1.5 py-0.5 backdrop-blur-sm transition ${selected ? "text-ink" : isCurrent || featured ? "bg-ink/70 text-fg" : "bg-ink/70 text-subtle group-hover:text-fg"}`}
        style={{ fontSize: "clamp(8.5px, 1.05cqw, 11px)", background: selected ? color : undefined, boxShadow: selected ? `0 0 14px ${color}` : undefined }}
      >
        {step.label}
      </span>
    </span>
  );

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(pos.x / geo.W) * 100}%`, top: `${(pos.y / geo.H) * 100}%` }}>
      <div className="animate-float" style={{ animationDelay: `${index * 0.7}s` }}>
        <button
          type="button"
          onClick={() => onSelect(step.key)}
          aria-label={`Etapa ${index + 1}: ${step.label}`}
          aria-pressed={selected}
          aria-current={isCurrent ? "step" : undefined}
          className="block rounded-3xl"
        >
          {tile}
        </button>
      </div>
    </div>
  );
}

/**
 * Órbita do fluxo. O palco tem proporção fixa; quem a usa define a largura (style),
 * normalmente para caber no espaço disponível. Dentro dele, tudo usa cqw.
 */
export function FlowOrbit({
  state,
  portrait = false,
  style,
  children,
  selected = null,
  onSelect,
}: {
  state: FlowState;
  portrait?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
  /** Etapa aberta no painel (destacada na órbita). */
  selected?: FlowStep | null;
  onSelect: (step: FlowStep) => void;
}) {
  const geo = portrait ? PORTRAIT : LANDSCAPE;
  const current = currentStep(state);
  const target = current / STEPS.length; // o preenchimento chega até o tile da etapa atual
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProgress(target), 350);
    return () => clearTimeout(t);
  }, [target]);

  const len = geo.total;
  const filled = progress * len;
  const ids = `o${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const dur = `${2 + target * 4}s`;

  return (
    <div className="@container relative" style={{ aspectRatio: `${geo.W} / ${geo.H}`, ...style }}>
      <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <mask id={`${ids}-m`} maskUnits="userSpaceOnUse">
            <path
              d={geo.d}
              fill="none"
              stroke="#fff"
              strokeWidth="40"
              strokeDasharray={`${filled} ${len}`}
              style={{ transition: "stroke-dasharray 2.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
          </mask>
          <filter id={`${ids}-g`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <radialGradient id={`${ids}-c`}>
            <stop offset="0%" stopColor="#fff" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3de1ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* trilho: a órbita inteira, apagada */}
        <path d={geo.d} fill="none" stroke="rgb(190 225 255 / 0.10)" strokeWidth="1.5" />
        <path d={geo.d} fill="none" stroke="rgb(190 225 255 / 0.22)" strokeWidth="1.5" strokeDasharray="2 14" style={{ animation: "orbit-dash 30s linear infinite" }} />

        {/* preenchimento arco-íris até a etapa atual: brilho + traço + fio de luz */}
        <g mask={`url(#${ids}-m)`}>
          <g filter={`url(#${ids}-g)`} opacity="0.85">
            {geo.segments.map((s, i) => (
              <path key={`g${i}`} d={s.d} stroke={s.color} strokeWidth="14" strokeLinecap="round" />
            ))}
          </g>
          {geo.segments.map((s, i) => (
            <path key={i} d={s.d} stroke={s.color} strokeWidth="3.2" strokeLinecap="round" />
          ))}
          <path d={geo.d} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="1" />
        </g>

        {/* cometa percorrendo o trecho concluído */}
        {target > 0 && (
          <g key={geo.d.length}>
            <circle r="16" fill={`url(#${ids}-c)`} opacity="0.55">
              <animateMotion dur={dur} repeatCount="indefinite" path={geo.d} keyPoints={`0;${target}`} keyTimes="0;1" calcMode="linear" />
            </circle>
            <circle r="3.4" fill="#fff">
              <animateMotion dur={dur} repeatCount="indefinite" path={geo.d} keyPoints={`0;${target}`} keyTimes="0;1" calcMode="linear" />
            </circle>
          </g>
        )}
      </svg>

      {/* conteúdo no centro da órbita */}
      <div className="absolute inset-0 grid place-items-center">{children}</div>

      {STEPS.map((s, i) => (
        <Tile key={s.key} step={s} index={i} state={state} current={current} geo={geo} selected={selected === s.key} onSelect={onSelect} />
      ))}
    </div>
  );
}

export { STEPS as FLOW };
