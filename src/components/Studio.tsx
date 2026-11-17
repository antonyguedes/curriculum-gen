"use client";

import { ArrowLeft, ArrowRight, Cpu, Sparkles, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FLOW, FlowOrbit, ORBIT_RATIO, currentStep, spectrum, type FlowState } from "@/components/FlowOrbit";
import { AiSettings } from "@/components/AiSettings";
import { GeneratePanel } from "@/components/job/GeneratePanel";
import { ManualBridge } from "@/components/ManualBridge";
import { ResumeEditor } from "@/components/job/ResumeEditor";
import type { JobPayload } from "@/components/job/types";
import { DownloadStep } from "@/components/steps/DownloadStep";
import { ProfileEditor } from "@/components/steps/ProfileEditor";
import type { JobRow } from "@/components/steps/types";
import { VagaStep } from "@/components/steps/VagaStep";
import { Button, ErrorBox, Modal, Select, cx } from "@/components/ui";
import { PROVIDERS, type PublicAiSettings } from "@/lib/ai/catalog";
import { api } from "@/lib/api";
import { FLOW_STEPS, type FlowStep, type Profile } from "@/lib/types";

interface Nav {
  step?: FlowStep | null;
  job?: string | null;
  v?: string | null;
  novo?: boolean;
  /** Painel "Motor de IA" aberto por cima da etapa atual. */
  ia?: boolean;
}

const isStep = (s: string | null): s is FlowStep => !!s && (FLOW_STEPS as readonly string[]).includes(s);

/** Estado vazio de uma etapa que depende de outra. */
function NeedsStep({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="tile grid place-items-center rounded-3xl px-6 py-14 text-center">
      <Sparkles className="h-7 w-7 text-neon" strokeWidth={1.4} />
      <p className="mt-3 text-sm text-muted">{text}</p>
      <Button variant="primary" className="mt-5" onClick={onAction}>
        {action} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Tela única do app: a órbita do fluxo é sempre o destaque, e cada etapa abre num painel
 * ao lado (desktop) ou abaixo (celular). O estado fica na URL: ?step=…&job=…&v=…
 */
export function Studio() {
  const router = useRouter();
  const params = useSearchParams();
  const stepParam = params.get("step");
  const step: FlowStep | null = isStep(stepParam) ? stepParam : null;
  const jobParam = params.get("job");
  const vParam = params.get("v");
  const creating = params.get("novo") === "1";
  const iaOpen = params.get("ia") === "1";

  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payload, setPayload] = useState<JobPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sem vaga escolhida, o fluxo é o de uma vaga nova.
  const selectedJobId = jobParam;

  /* ── dados ── */
  const loadOverview = useCallback(
    () =>
      Promise.all([api<JobRow[]>("/api/jobs"), api<Profile>("/api/profile")])
        .then(([j, p]) => {
          setJobs(j);
          setProfile(p);
        })
        .catch((e) => setError(e.message)),
    [],
  );
  const loadPayload = useCallback(() => {
    if (!selectedJobId) {
      setPayload(null);
      return Promise.resolve();
    }
    return api<JobPayload>(`/api/jobs/${selectedJobId}`)
      .then(setPayload)
      .catch((e) => setError(e.message));
  }, [selectedJobId]);
  /** Atualiza tudo o que a órbita usa para mostrar o progresso. */
  const refresh = useCallback(() => Promise.all([loadOverview(), loadPayload()]), [loadOverview, loadPayload]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    loadPayload();
  }, [loadPayload]);

  /* ── navegação (URL) + proteção de alterações não salvas no perfil ── */
  const profileDirty = useRef(false);
  const [pendingNav, setPendingNav] = useState<Nav | null>(null);

  const navigate = useCallback(
    (next: Nav) => {
      const q = new URLSearchParams();
      const s = next.step === undefined ? step : next.step;
      const job = next.job === undefined ? jobParam : next.job;
      const v = next.v === undefined ? vParam : next.v;
      if (s) q.set("step", s);
      if (job) q.set("job", job);
      if (v) q.set("v", v);
      if (next.novo) q.set("novo", "1");
      if (next.ia) q.set("ia", "1");
      router.push(q.size ? `/?${q}` : "/", { scroll: false });
    },
    [router, step, jobParam, vParam],
  );

  const go = useCallback(
    (target: Nav) => {
      // Voltar à tela principal reinicia o fluxo: a vaga deixa de estar selecionada.
      const next: Nav = target.step === null ? { step: null, job: null, v: null } : target;
      const leavingProfile = step === "perfil" && next.step !== "perfil";
      if (leavingProfile && profileDirty.current) return setPendingNav(next);
      if (leavingProfile) refresh();
      navigate(next);
    },
    [step, navigate, refresh],
  );

  // Esc fecha o painel (a menos que um modal esteja aberto: ele fecha primeiro).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      if (iaOpen) navigate({}); // fecha a configuração e volta à etapa
      else if (step) go({ step: null });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, go, iaOpen, navigate]);

  /* ── motor de IA em uso (chip no canto da órbita) ── */
  const [engine, setEngine] = useState<PublicAiSettings | null>(null);
  const loadEngine = useCallback(() => api<PublicAiSettings>("/api/ai/settings").then(setEngine).catch(() => undefined), []);
  useEffect(() => {
    loadEngine();
  }, [loadEngine]);

  /* ── estado do fluxo (vaga selecionada) ── */
  const job = jobs?.find((j) => j.id === selectedJobId) ?? null;
  const facts = profile
    ? [...profile.experiences, ...profile.projects, ...profile.education].reduce((n, e) => n + e.facts.length, 0) + profile.extraFacts.length
    : 0;
  const flow: FlowState = {
    done: {
      perfil: !!profile?.contact.name.trim() && profile.experiences.length + profile.projects.length > 0,
      vaga: !!job,
      gerar: !!job && job.versions > 0,
      verificar: !!job?.reviewed,
      baixar: !!job?.downloaded,
    },
    counts: { perfil: facts },
  };
  const current = currentStep(flow);
  const version = payload?.job.id === selectedJobId ? (payload.job.versions.find((v) => v.id === vParam) ?? payload.job.versions[0] ?? null) : null;

  /* ── tamanho da órbita: maior que caiba no espaço livre ── */
  const stageRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const portrait = box ? box.h > box.w * 1.05 : false;
  const ratio = portrait ? ORBIT_RATIO.portrait : ORBIT_RATIO.landscape;
  const orbitWidth = box ? Math.max(0, Math.min(box.w, (box.h - 16) * ratio, portrait ? 640 : 1240)) : 0;

  const open = !!step || iaOpen;
  const stepIndex = step ? FLOW.findIndex((f) => f.key === step) : -1;
  const meta = step ? FLOW[stepIndex] : null;
  const color = spectrum(Math.max(0, stepIndex) / FLOW.length);

  const [deleting, setDeleting] = useState<JobRow | null>(null);
  const removeJob = async (id: string) => {
    setDeleting(null);
    await api(`/api/jobs/${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    if (id === jobParam) navigate({ job: null, v: null, novo: true });
    loadOverview();
  };

  /* ── conteúdo de cada etapa ── */
  let body: ReactNode = null;
  if (step === "perfil") {
    body = <ProfileEditor onChange={loadOverview} onDirtyChange={(d) => {
      profileDirty.current = d;
    }} />;
  } else if (step === "vaga") {
    body = jobs ? (
      <VagaStep
        jobs={jobs}
        selectedId={selectedJobId}
        creating={creating}
        payload={payload}
        onSelect={(id) => go({ step: "vaga", job: id, v: null })}
        onNew={() => go({ step: "vaga", job: null, v: null, novo: true })} // nova vaga = fluxo do círculo reiniciado
        onCreated={(id) => {
          go({ step: "vaga", job: id, v: null });
          loadOverview();
        }}
        reload={refresh}
        onDelete={(j) => setDeleting(j)}
      />
    ) : null;
  } else if (step === "gerar") {
    body = !job ? (
      <NeedsStep text="Escolha ou cadastre uma vaga primeiro." action="Ir para Vaga" onAction={() => go({ step: "vaga" })} />
    ) : payload?.job.id === job.id ? (
      <GeneratePanel data={payload} reload={refresh} onOpen={(vid) => go({ step: "verificar", v: vid })} />
    ) : null;
  } else if (step === "verificar" || step === "baixar") {
    body = !job ? (
      <NeedsStep text="Escolha ou cadastre uma vaga primeiro." action="Ir para Vaga" onAction={() => go({ step: "vaga" })} />
    ) : payload?.job.id !== job.id ? null : !version ? (
      <NeedsStep text="Gere um currículo para esta vaga primeiro." action="Ir para Gerar" onAction={() => go({ step: "gerar" })} />
    ) : step === "verificar" ? (
      <ResumeEditor key={version.id} jobId={job.id} version={version} onSaved={loadPayload} onReviewed={refresh} />
    ) : (
      <DownloadStep key={version.id} jobId={job.id} version={version} onDownloaded={refresh} />
    );
  }

  const jobScoped = step && step !== "perfil";
  const next = stepIndex >= 0 && stepIndex < FLOW.length - 1 ? FLOW[stepIndex + 1] : null;
  const prev = stepIndex > 0 ? FLOW[stepIndex - 1] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {error && (
        <div className="fixed left-1/2 top-4 z-[95] w-[min(92vw,520px)] -translate-x-1/2">
          <ErrorBox message={error} />
        </div>
      )}

      {/* ── coluna da órbita: sempre visível ── */}
      <div
        className={cx(
          "flex min-h-0 min-w-0 flex-col gap-4 transition-[flex-basis] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "shrink-0 basis-[30%] lg:basis-[34%]" : "basis-full",
        )}
      >
        <section ref={stageRef} className="relative min-h-[200px] flex-1">
          {/* motor de IA em uso */}
          <button
            type="button"
            onClick={() => (iaOpen ? navigate({}) : navigate({ ia: true }))}
            aria-pressed={iaOpen}
            className={cx(
              "absolute left-0 top-0 z-20 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition",
              iaOpen ? "rainbow-border rainbow-halo text-fg" : "tile tile-hover text-muted hover:text-fg",
            )}
          >
            <Cpu className="h-3.5 w-3.5 text-neon" strokeWidth={1.8} />
            <span className="hidden sm:inline">Motor de IA ·</span>
            <span className="font-medium text-fg">{engine ? PROVIDERS[engine.provider].label : "…"}</span>
          </button>
          {box && (
            <div className="absolute inset-0 grid place-items-center">
              <FlowOrbit state={flow} portrait={portrait} style={{ width: orbitWidth }} selected={step} onSelect={(s) => go({ step: s === step ? null : s })}>
                <div className={`pointer-events-none text-center ${portrait ? "px-[26%]" : "px-[14%]"}`}>
                  {!open && (
                    <h1
                      className="text-balance font-display font-bold leading-[1.05] tracking-tight"
                      style={{ fontSize: portrait ? "clamp(1.25rem, 7.5cqw, 2.6rem)" : "clamp(1.6rem, 6cqw, 4.6rem)" }}
                    >
                      Gerar <span className="text-rainbow">Currículo</span>
                    </h1>
                  )}
                  {!open && jobs && profile && (
                    <p className="label-mono mt-[1.6cqw] text-subtle" style={{ fontSize: "clamp(9px, 1.15cqw, 12px)" }}>
                      <span style={{ color: spectrum(Math.min(current, FLOW.length - 1) / FLOW.length) }}>{String(Math.min(current + 1, FLOW.length)).padStart(2, "0")}</span>
                      <span className="mx-1.5">/</span>0{FLOW.length}
                      <span className="mx-2 text-line-strong">·</span>
                      <span className="text-fg">{current < FLOW.length ? FLOW[current].label : "Ciclo completo"}</span>
                    </p>
                  )}
                  {!open && job && (
                    <p className="mx-auto mt-2 max-w-full truncate text-xs text-muted" style={{ fontSize: "clamp(10px, 1.3cqw, 13px)" }}>
                      {job.title}
                    </p>
                  )}
                </div>
              </FlowOrbit>
            </div>
          )}
        </section>

      </div>

      {/* ── painel do motor de IA (por cima da etapa) ── */}
      {iaOpen && (
        <aside className="tile flex min-h-0 min-w-0 flex-1 animate-[panel-in_0.5s_cubic-bezier(0.16,1,0.3,1)_both] flex-col overflow-hidden rounded-3xl" aria-label="Motor de IA">
          <header className="relative flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon to-transparent" aria-hidden />
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-neon/60 text-neon shadow-[0_0_18px_-4px_rgb(61_225_255/0.9)]">
              <Cpu className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <p className="label-mono text-subtle">Configuração</p>
              <h2 className="font-display text-base font-semibold leading-tight text-fg">Motor de IA</h2>
            </div>
            <Button variant="ghost" small className="ml-auto" aria-label="Fechar configuração" onClick={() => navigate({})}>
              <X className="h-4 w-4" />
            </Button>
          </header>
          <div className="@container min-h-0 flex-1 overflow-y-auto p-5">
            <AiSettings onChanged={loadEngine} />
          </div>
        </aside>
      )}

      {/* ── painel da etapa ── */}
      {!iaOpen && open && meta && (
        <aside key={step} className="tile flex min-h-0 min-w-0 flex-1 animate-[panel-in_0.5s_cubic-bezier(0.16,1,0.3,1)_both] flex-col overflow-hidden rounded-3xl" aria-label={`Etapa ${meta.label}`}>
          <header className="relative flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
            <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} aria-hidden />
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border" style={{ borderColor: color, color, boxShadow: `0 0 18px -4px ${color}` }}>
              <meta.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <p className="label-mono text-subtle">
                Etapa {stepIndex + 1}/{FLOW.length}
              </p>
              <h2 className="truncate font-display text-base font-semibold leading-tight text-fg">
                {meta.label}
                {jobScoped && job && !(step === "vaga" && creating) && <span className="ml-2 font-sans text-sm font-normal text-muted">· {job.title}</span>}
              </h2>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {step === "verificar" && payload && payload.job.versions.length > 1 && version && (
                <Select aria-label="Versão" className="mr-1 w-auto py-1 text-xs" value={version.id} onChange={(e) => go({ v: e.target.value })}>
                  {payload.job.versions.map((v, i) => (
                    <option key={v.id} value={v.id}>
                      v{payload.job.versions.length - i} · {v.evaluation.score.total}
                    </option>
                  ))}
                </Select>
              )}
              {prev && (
                <Button variant="ghost" small aria-label={`Etapa anterior: ${prev.label}`} onClick={() => go({ step: prev.key })}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {next && (
                <Button variant={flow.done[meta.key] ? "primary" : "ghost"} small onClick={() => go({ step: next.key })}>
                  <span className="hidden sm:inline">{next.label}</span> <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" small aria-label="Fechar etapa" onClick={() => go({ step: null })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="@container min-h-0 flex-1 overflow-y-auto p-5">{body ?? <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" />}</div>
        </aside>
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        tone="bad"
        icon={<Trash2 />}
        title="Excluir esta vaga?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button className="border border-bad/50 bg-bad/15 font-semibold text-bad hover:bg-bad/25" onClick={() => deleting && removeJob(deleting.id)}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </>
        }
      >
        <strong className="text-fg">{deleting?.title}</strong>
        {deleting?.company ? ` · ${deleting.company}` : ""} e todos os currículos gerados para ela serão apagados.
      </Modal>

      <Modal
        open={!!pendingNav}
        onClose={() => setPendingNav(null)}
        tone="bad"
        title="Descartar alterações do perfil?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingNav(null)}>
              Continuar editando
            </Button>
            <Button
              className="border border-bad/50 bg-bad/15 font-semibold text-bad hover:bg-bad/25"
              onClick={() => {
                const target = pendingNav!;
                profileDirty.current = false;
                setPendingNav(null);
                navigate(target);
              }}
            >
              Descartar
            </Button>
          </>
        }
      >
        Há alterações no perfil que ainda não foram salvas.
      </Modal>

      <ManualBridge />
    </div>
  );
}
