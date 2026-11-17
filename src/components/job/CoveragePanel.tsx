"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorBox, Select, Spinner, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { CoverageItem } from "@/lib/types";
import type { JobPayload } from "./types";

const STATUS: Record<CoverageItem["status"], { tone: "green" | "amber" | "blue" | "red"; label: string; help: string }> = {
  forte: { tone: "green", label: "Forte", help: "Há fatos no perfil que comprovam." },
  parcial: { tone: "amber", label: "Parcial", help: "Está na lista de habilidades, mas nenhum fato cita o termo." },
  adjacente: { tone: "blue", label: "Adjacente", help: "Você tem algo parecido, mas não exatamente isto." },
  nenhuma: { tone: "red", label: "Lacuna", help: "Nada no perfil. Não entra no currículo." },
};

function GapForm({ jobId, item, targets, onDone }: { jobId: string; item: CoverageItem; targets: JobPayload["targets"]; onDone: () => void }) {
  const [text, setText] = useState("");
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jobs/${jobId}/gaps`, { method: "POST", json: { requirement: item.name, text, targetId } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-neon/30 bg-neon/5 p-3">
      <p className="text-xs text-fg/85">
        A vaga pede <strong>{item.name}</strong>. Se você já usou, conte onde e o que fez (com números, se tiver). Isso entra no seu perfil mestre e vale para as próximas vagas. Só responda se for verdade.
      </p>
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ex.: Usei ${item.name} para … na empresa …`} />
      <div className="flex flex-wrap items-center gap-2">
        <Select className="max-w-xs" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          <option value="">Fato avulso (sem experiência associada)</option>
        </Select>
        <Button variant="primary" small disabled={busy || text.trim().length < 10} onClick={submit}>
          {busy && <Spinner />} Adicionar ao perfil
        </Button>
      </div>
      <ErrorBox message={error} />
    </div>
  );
}

export function CoveragePanel({ data, reload }: { data: JobPayload; reload: () => void }) {
  const { job, coverage } = data;
  const a = job.analysis;
  const [open, setOpen] = useState<string | null>(null);
  const required = coverage.filter((c) => c.required);
  const covered = required.filter((c) => c.status === "forte" || c.status === "parcial").length;

  const row = (c: CoverageItem) => (
    <li key={c.name} className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-fg">{c.name}</span>
        <Badge tone={STATUS[c.status].tone} title={STATUS[c.status].help}>
          {STATUS[c.status].label}
        </Badge>
        <span className="text-xs text-subtle">peso {c.weight}</span>
        {c.status !== "forte" && (
          <Button small variant="ghost" className="ml-auto" onClick={() => setOpen(open === c.name ? null : c.name)}>
            {open === c.name ? "Cancelar" : "Tenho essa experiência"}
          </Button>
        )}
      </div>
      {c.status === "forte" && <p className="mt-0.5 text-xs text-subtle">Evidência: {[...new Set(c.evidence.map((e) => e.where))].slice(0, 3).join("; ")}</p>}
      {c.status === "parcial" && !c.adjacent && <p className="mt-0.5 text-xs text-subtle">{STATUS.parcial.help}</p>}
      {c.adjacent && (
        <p className="mt-0.5 text-xs text-subtle">
          {c.adjacent.skills.length > 0 && `${c.adjacent.covers ? "Atendido por" : "Próximo de"}: ${c.adjacent.skills.join(", ")}. `}
          {c.adjacent.rationale}
          {!c.adjacent.covers && " Não entra no currículo com o nome do requisito."}
        </p>
      )}
      {open === c.name && (
        <GapForm
          jobId={job.id}
          item={c}
          targets={data.targets}
          onDone={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </li>
  );

  return (
    <div className="grid gap-4 @4xl:grid-cols-3 [&>*]:min-w-0">
      <div className="space-y-4 @4xl:col-span-2">
        <Card title={`Requisitos obrigatórios — ${covered} de ${required.length} cobertos`}>
          {required.length ? <ul className="divide-y divide-line/70">{required.map(row)}</ul> : <p className="text-sm text-subtle">A vaga não lista requisitos obrigatórios.</p>}
        </Card>
        {coverage.some((c) => !c.required) && (
          <Card title="Diferenciais">
            <ul className="divide-y divide-line/70">{coverage.filter((c) => !c.required).map(row)}</ul>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card title="Resumo da vaga">
          <dl className="space-y-2 text-sm">
            {[
              ["Senioridade", a.seniority],
              ["Experiência pedida", a.years_required ? `${a.years_required} anos (você soma ${data.years.toFixed(1)})` : ""],
              ["Local", a.location],
              ["Idioma do currículo", a.language === "en" ? "Inglês" : "Português (Brasil)"],
              ["Formação", a.education.join("; ")],
              ["Certificações", a.certifications.join("; ")],
              ["Idiomas exigidos", a.languages.join("; ")],
              ["Domínio", a.domain_keywords.join(", ")],
              ["Comportamentais", a.soft_skills.join(", ")],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-subtle">{k}</dt>
                  <dd className="text-fg">{v}</dd>
                </div>
              ))}
          </dl>
        </Card>
        <Card title="Responsabilidades">
          <ul className="list-disc space-y-1 pl-4 text-sm text-fg/85">
            {a.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
