"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: number;
  phase: number;
  speed: number;
  bokeh: boolean;
}

/**
 * Poeira arco-íris: partículas que assumem a cor da região onde estão
 * (vermelho/laranja no alto à direita → verde no centro → azul embaixo à esquerda),
 * derivam devagar e cintilam. Algumas maiores e desfocadas fazem o bokeh.
 */
export function RainbowDust() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let raf = 0;

    const hueAt = (x: number, y: number) => {
      const f = Math.min(1, Math.max(0, (1 - x / w) * 0.55 + (y / h) * 0.45)); // 0 = alto/direita, 1 = baixo/esquerda
      return f * 245 + (Math.random() - 0.5) * 40; // 0 vermelho … 245 azul
    };

    const spawn = (): Particle => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const bokeh = Math.random() < 0.07;
      return {
        x,
        y,
        r: bokeh ? 2.5 + Math.random() * 4 : 0.5 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.03 - Math.random() * 0.12,
        hue: hueAt(x, y),
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.6,
        bokeh,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(260, (w * h) / 7000));
      particles = Array.from({ length: count }, spawn);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -10 || p.x < -10 || p.x > w + 10) {
            Object.assign(p, spawn(), { y: h + 5 });
            p.hue = hueAt(p.x, p.y);
          }
        }
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * p.speed + p.phase));
        const alpha = (p.bokeh ? 0.22 : 0.85) * twinkle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue} 100% ${p.bokeh ? 62 : 72}% / ${alpha})`;
        ctx.shadowColor = `hsl(${p.hue} 100% 60% / ${alpha})`;
        ctx.shadowBlur = p.bokeh ? 18 : 6;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0" aria-hidden />;
}
