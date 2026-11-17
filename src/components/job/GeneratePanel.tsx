"use client";

import { History, Sparkles } from "lucide-react";
import { useState } from "react";
import { ScoreRing } from "@/components/ScoreRing";
import { Badge, Button, Card, ErrorBox, Field, Select, Spinner, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { requestManual } from "@/lib/manual-client";
import { TEMPERATURE_INFO } from "@/lib/prompts";
import type { Temperature, Template } from "@/lib/types";
import type { JobPayload } from "./types";

const LEVELS: Temperature[] = ["conservador", "equilibrado", "ousado"];
/** Cada nível tem sua cor: gelo (fiel ao texto), neon (recomendado) e calor (mais agressivo). */
const LEVEL_LOOK: Record<Temperature, { active: string; bar: string; tag: string }> = {
  conservador: { active: "border-info/70 bg-info/10 shadow-[0_0_24px_-10px_rgb(92_184_255/0.9)]", bar: "bg-info", tag: "fiel ao texto" },
  equilibrado: { active: "border-neon/70 bg-neon/10 shadow-[0_0_24px_-10px_rgb(34_228_255/0.9)]", bar: "bg-neon", tag: "recomendado" },
  ousado: { active: "border-flare/70 bg-flare/10 shadow-[0_0_24px_-10px_rgb(255_92_207/0.9)]", bar: "bg-flare", tag: "revise o texto" },
};
const TEMPLATES: Record<Template, string> = { classico: "Clássico", moderno: "Moderno", compacto: "Compacto" };

export function GeneratePanel({ data, reload, onOpen }: { data: JobPayload; reload: () => void; onOpen: (versionId: string) => void }) {
  const { job } = data;
  const [level, setLevel] = useState(1);
  const [template, setTemplate] = useState<Template>("classico");
  const [coverLetter, setCoverLetter] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const temperature = LEVELS[level];
  const gaps = data.coverage.filter((c) => c.required && c.status === "nenhuma").length;

  const generate = async () => {
    setBusy(true);
    setError(null);
    setSteps([]);
    try {
      // Modo copiar e colar: a geração pausa a cada pedido manual e recomeça com a resposta.
      for (;;) {
      const res = await fetch(`/api/jobs/${job.id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ temperature, template, coverLetter, notes }), // motor e modelo: os do "Motor de IA"
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Erro ${res.status}`);
      let manual = null;

      // Lê o progresso em NDJSON: uma linha JSON por evento.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "progress") setSteps((s) => [...s, event.detail ? `${event.step} (${event.detail})` : event.step]);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "manual") manual = event.request;
          if (event.type === "done") {
            finished = true;
            reload();
            onOpen(event.versionId);
          }
        }
      }
      if (manual) {
        setSteps((s) => [...s, `Aguardando sua resposta: ${manual.label}`]);
        await requestManual(manual);
        setSteps([]);
        continue;
      }
      if (!finished) throw new Error("A geração foi interrompida antes de terminar.");
      break;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeVersion = async (vid: string) => {
    if (!confirm("Excluir esta versão do currículo?")) return;
    await api(`/api/jobs/${job.id}/versions/${vid}`, { method: "DELETE" }).catch((e) => setError(e.message));
    reload();
  };

  return (
    <div className="grid gap-4 @3xl:grid-cols-2 [&>*]:min-w-0">
      <Card title="Gerar" icon={<Sparkles />}>
        <div className="space-y-4">
          {!data.profileReady && (
            <p className="rounded-lg border border-warn/35 bg-warn/10 px-3 py-2 text-sm text-warn">Complete o perfil primeiro.</p>
          )}
          {gaps > 0 && (
            <p className="rounded-lg border border-warn/35 bg-warn/10 px-3 py-2 text-sm text-warn">
              {gaps} requisito(s) obrigatório(s) sem evidência no perfil. Eles ficarão fora do currículo. Se você tem essa experiência, registre-a na etapa Vaga antes de gerar.
            </p>
          )}

          <fieldset>
            <legend className="label-mono mb-2 text-subtle">Temperatura</legend>
            <div className="grid grid-cols-1 gap-2 @md:grid-cols-3" role="radiogroup">
              {LEVELS.map((l, i) => {
                const active = level === i;
                const look = LEVEL_LOOK[l];
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={TEMPERATURE_INFO[l].short}
                    onClick={() => setLevel(i)}
                    className={`relative min-w-0 overflow-hidden rounded-xl border px-3 py-3 text-left transition ${active ? look.active : "border-line bg-ink/40 hover:border-line-strong"}`}
                  >
                    <span className="flex items-center gap-1" aria-hidden>
                      {[0, 1, 2].map((b) => (
                        <span key={b} className={`h-1.5 w-4 rounded-full ${b <= i ? (active ? look.bar : "bg-line-strong") : "bg-line"}`} />
                      ))}
                    </span>
                    <span className={`mt-2 block font-display text-sm font-semibold ${active ? "text-fg" : "text-muted"}`}>{TEMPERATURE_INFO[l].label}</span>
                    <span className="label-mono block text-[0.6rem] text-subtle">{look.tag}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field label="Modelo visual">
              <Select value={template} onChange={(e) => setTemplate(e.target.value as Template)}>
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>

          <label className="flex items-start gap-2 text-sm text-fg">
            <input type="checkbox" className="mt-0.5 accent-neon" checked={coverLetter} onChange={(e) => setCoverLetter(e.target.checked)} />
            <span>
              Carta de apresentação
            </span>
          </label>

          <Field label="Orientações">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: destaque pagamentos" />
          </Field>

          <ErrorBox message={error} />
          <Button variant="primary" className="w-full py-3 text-base" disabled={busy || !data.profileReady} onClick={generate}>
            {busy && <Spinner />} {busy ? "Gerando…" : "Gerar currículo"}
          </Button>

          {steps.length > 0 && (
            <ol className="relative space-y-3 pl-6">
              <span className="absolute bottom-1 left-[7px] top-1 w-px bg-gradient-to-b from-neon/60 via-plasma/40 to-transparent" aria-hidden />
              {steps.map((s, i) => {
                const current = i === steps.length - 1 && busy;
                return (
                  <li key={i} className="relative animate-rise text-sm">
                    <span
                      className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 ${
                        current ? "animate-pulse-glow border-neon bg-neon/40 shadow-[0_0_12px_rgb(34_228_255)]" : "border-ok bg-ok/30"
                      }`}
                      aria-hidden
                    />
                    <span className={current ? "font-medium text-neon" : "text-muted"}>{s}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </Card>

      <Card title="Versões" icon={<History />}>
        {job.versions.length === 0 ? (
          <p className="text-sm text-subtle">Nenhuma versão ainda.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {job.versions.map((v) => {
              const s = v.evaluation.score.total;
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{new Date(v.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    <span className="block text-xs text-subtle">
                      {TEMPERATURE_INFO[v.temperature].label} · {v.template} · {v.model}
                      {v.coverLetter ? " · com carta" : ""}
                    </span>
                  </div>
                  <ScoreRing value={s} size={44} stroke={4} />
                  {v.screener && <Badge tone="blue">Triagem {v.screener.grade}</Badge>}
                  <Button small variant="primary" onClick={() => onOpen(v.id)}>
                    Abrir
                  </Button>
                  <Button small variant="danger" onClick={() => removeVersion(v.id)}>
                    Excluir
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
