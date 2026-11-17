"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const VARIANTS = {
  primary: "rainbow-border rainbow-halo isolate text-fg font-semibold hover:text-white",
  secondary: "tile text-fg hover:shadow-[0_0_28px_-8px_rgb(61_225_255/0.8)]",
  ghost: "text-muted hover:text-fg hover:bg-white/5",
  danger: "text-bad/80 hover:text-bad hover:bg-bad/10",
};

export function Button({
  variant = "secondary",
  small,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS; small?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100",
        small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

const FIELD =
  "w-full rounded-xl border border-line bg-ink/50 px-3 py-2 text-sm text-fg placeholder:text-subtle/80 transition duration-300 focus:border-neon/70 focus:bg-ink/70 focus:outline-none focus:shadow-[0_0_0_3px_rgb(61_225_255/0.12),0_0_24px_-6px_rgb(61_225_255/0.6)]";

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cx(FIELD, className)} />;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Caixa de texto que cresce com o conteúdo: começa com `rows` linhas (padrão 2),
 * acompanha o que é digitado ou colado e, ao chegar em `maxHeight`, passa a rolar por dentro.
 */
export function Textarea({
  className,
  rows = 2,
  maxHeight = "min(60vh, 560px)",
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { maxHeight?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto"; // volta à altura de `rows` para medir o conteúdo real
    const max = parseFloat(getComputedStyle(el).maxHeight) || Infinity;
    const next = Math.min(el.scrollHeight + 2, max); // +2 compensa as bordas
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight + 2 > max ? "auto" : "hidden";
  }, []);

  useIsoLayoutEffect(fit, [props.value, fit]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit()); // a largura mudou → as quebras de linha mudam
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      onInput={(e) => {
        fit();
        props.onInput?.(e);
      }}
      style={{ maxHeight, ...style }}
      className={cx(FIELD, "block resize-none leading-relaxed transition-[height] duration-150", className)}
    />
  );
}

/* ───────────── Tooltip ───────────── */

/** Balão de ajuda no hover e no foco do teclado. O filho recebe aria-describedby. */
export function Tooltip({
  content,
  children,
  align = "right",
  className,
}: {
  content: ReactNode;
  children: ReactElement<{ "aria-describedby"?: string }>;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const id = useId();
  const pos = align === "right" ? "right-0 origin-top-right" : align === "left" ? "left-0 origin-top-left" : "left-1/2 -translate-x-1/2 origin-top";
  return (
    <span className={cx("tt-wrap relative inline-flex", className)}>
      {cloneElement(children, { "aria-describedby": id })}
      <span
        role="tooltip"
        id={id}
        className={cx(
          "tt-bubble pointer-events-none absolute top-full z-50 mt-2.5 w-72 scale-95 rounded-2xl border border-warn/30 bg-[#0b1430]/95 p-3.5 text-left text-xs leading-relaxed text-fg/90 opacity-0 shadow-[0_18px_50px_-18px_rgb(0_0_0/0.9),0_0_30px_-12px_rgb(255_179_64/0.55)] backdrop-blur-xl transition duration-200",
          pos,
        )}
      >
        {content}
      </span>
    </span>
  );
}

/* ───────────── Modal ───────────── */

/** Diálogo modal: renderizado no body (fora de qualquer transform), fecha com Esc ou clicando fora. */
export function Modal({
  open,
  onClose,
  title,
  icon,
  tone = "neon",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  tone?: "neon" | "bad";
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        // Mantém o foco dentro do modal.
        const items = [...panelRef.current.querySelectorAll<HTMLElement>("button, input, a[href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) (last.focus(), e.preventDefault());
        else if (!e.shiftKey && document.activeElement === last) (first.focus(), e.preventDefault());
      }
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("input, button")?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const toneRing = tone === "bad" ? "border-bad/40 bg-bad/10 text-bad shadow-[0_0_30px_-6px_rgb(255_77_109/0.8)]" : "border-neon/40 bg-neon/10 text-neon shadow-[0_0_30px_-6px_rgb(61_225_255/0.8)]";

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 animate-[fade_0.25s_ease_both] bg-ink/70 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("relative w-[min(94vw,480px)] animate-rise rounded-3xl p-6", tone === "bad" ? "tile shadow-[0_0_80px_-30px_rgb(255_77_109/0.9)]" : "rainbow-border rainbow-halo")}
      >
        <div className="flex items-start gap-4">
          {icon && <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl border [&>svg]:h-5 [&>svg]:w-5", toneRing)}>{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight text-fg">
              {title}
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
          </div>
        </div>
        {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────── Toast ───────────── */

/** Aviso flutuante no rodapé, com ação opcional (ex.: Desfazer) e barra de tempo. */
export function Toast({ message, action, onClose, duration = 10000 }: { message: ReactNode; action?: ReactNode; onClose: () => void; duration?: number }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);
  return (
    <div role="status" className="fixed bottom-24 left-1/2 z-[90] w-[min(92vw,420px)] -translate-x-1/2 animate-rise">
      <div className="tile relative overflow-hidden rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex-1 text-fg">{message}</span>
          {action}
        </div>
        <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-gradient-to-r from-neon to-plasma" style={{ animation: `shrink ${duration}ms linear forwards` }} />
      </div>
    </div>
  );
}

export const Select = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cx(FIELD, "cursor-pointer", className)} />
);

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label-mono mb-1.5 block text-subtle">{label}</span>
      {children}
      {hint && <span className="mt-1 block font-mono text-[0.68rem] text-subtle">{hint}</span>}
    </label>
  );
}

export function Card({
  title,
  icon,
  actions,
  children,
  className,
  glow,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Borda arco-íris girando, para o cartão em destaque da tela. */
  glow?: boolean;
}) {
  return (
    <section className={cx("animate-rise rounded-3xl p-5", glow ? "rainbow-border rainbow-halo isolate" : "tile", className)}>
      {(title || actions) && (
        <div className={cx("flex flex-wrap items-center justify-between gap-3", children ? "mb-4" : "")}>
          <h2 className="flex items-center gap-2.5 font-display text-[0.95rem] font-semibold tracking-tight text-fg">
            {icon && <span className="grid h-7 w-7 place-items-center rounded-lg border border-neon/30 bg-neon/10 text-neon [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
            {title}
          </h2>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  green: "bg-ok/10 text-ok ring-ok/30",
  amber: "bg-warn/10 text-warn ring-warn/30",
  red: "bg-bad/10 text-bad ring-bad/30",
  blue: "bg-info/10 text-info ring-info/30",
  neon: "bg-neon/10 text-neon ring-neon/35",
  violet: "bg-plasma/12 text-plasma ring-plasma/35",
  slate: "bg-white/5 text-muted ring-white/10",
};
export type Tone = keyof typeof TONES;

export const Badge = ({ tone = "slate", children, title }: { tone?: Tone; children: ReactNode; title?: string }) => (
  <span title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.68rem] font-medium ring-1 ring-inset", TONES[tone])}>
    {children}
  </span>
);

export const ErrorBox = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="animate-rise rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-fg/90 shadow-[0_0_30px_-12px_rgb(255_77_109/0.8)]">
      {message}
    </p>
  ) : null;

export const Notice = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">{children}</p>
);

export const Spinner = () => (
  <span className="relative inline-block h-4 w-4" aria-hidden>
    <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-neon border-r-plasma" />
  </span>
);

/** Esqueleto de carregamento com uma faixa de luz varrendo. */
export const Loading = ({ className }: { className?: string }) => (
  <div className={cx("tile overflow-hidden rounded-3xl", className ?? "h-40")}>
    <div className="h-full w-1/3 animate-scan bg-gradient-to-r from-transparent via-neon/15 to-transparent" />
  </div>
);

/** Campo de lista separada por vírgulas; só converte ao sair do campo, para não atrapalhar a digitação. */
export function CsvInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <Input
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}
