"use client";

import { ScoreRing } from "@/components/ScoreRing";
import { Badge, Card } from "@/components/ui";
import type { Evaluation, Screener } from "@/lib/types";

const bar = (v: number) =>
  v >= 85 ? "from-neon to-ok shadow-[0_0_10px_rgb(52_245_168/0.6)]" : v >= 70 ? "from-warn to-[#ff9f43] shadow-[0_0_10px_rgb(255_200_87/0.5)]" : "from-bad to-flare shadow-[0_0_10px_rgb(255_92_122/0.5)]";

export function ScorePanel({ evaluation, screener }: { evaluation: Evaluation; screener: Screener | null }) {
  const { score, grounding, parse } = evaluation;
  const errors = grounding.filter((g) => g.severity === "erro");
  const warnings = grounding.filter((g) => g.severity === "aviso");
  const verdict = score.total >= 85 ? "Topo do ranking" : score.total >= 70 ? "Competitivo" : "Abaixo do corte";

  return (
    <div className="space-y-4">
      <Card glow>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="flex flex-col items-center">
            <ScoreRing value={score.total} size={148} stroke={11} label="Score ATS" />
            <span className={`label-mono mt-2 ${score.total >= 85 ? "text-ok" : score.total >= 70 ? "text-warn" : "text-bad"}`}>{verdict}</span>
          </div>
          <div className="w-full flex-1 space-y-2.5">
            {score.components.map((c) => (
              <div key={c.key} className="text-xs">
                <div className="mb-1 flex justify-between">
                  <span className="text-muted">{c.label}</span>
                  <span className="font-mono tabular-nums text-fg/85">
                    {c.value}
                    <span className="text-subtle"> · {Math.round(c.weight * 100)}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-panel-3">
                  <div className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ${bar(c.value)}`} style={{ width: `${c.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {score.penalties.map((p) => (
          <p key={p.label} className="mt-3 font-mono text-xs text-bad">
            −{p.points} · {p.label}
          </p>
        ))}
      </Card>

      <Card title="Keywords da vaga">
        <div className="flex flex-wrap gap-1.5">
          {score.keywords.map((k) => (
            <Badge
              key={k.name}
              tone={k.status === "contexto" ? "green" : k.status === "lista" ? "amber" : "red"}
              title={`${k.required ? "Obrigatória" : "Desejável"} · ${k.status === "contexto" ? "citada em contexto" : k.status === "lista" ? "só na lista de habilidades" : "ausente"} · ${k.count}x`}
            >
              {k.status === "contexto" ? "✓" : k.status === "lista" ? "~" : "✕"} {k.name}
              {k.required ? "" : " (desejável)"}
            </Badge>
          ))}
        </div>
      </Card>

      <Card title={`Grounding — ${errors.length ? `${errors.length} problema(s)` : "tudo sustentado pelo perfil"}`}>
        {errors.length === 0 && warnings.length === 0 && <p className="text-sm text-muted">Cada trecho do currículo aponta para um fato do seu perfil.</p>}
        <ul className="space-y-1.5 text-sm">
          {errors.map((g, i) => (
            <li key={`e${i}`} className="text-bad">
              <span className="font-medium">{g.where}:</span> {g.message}
            </li>
          ))}
          {warnings.map((g, i) => (
            <li key={`w${i}`} className="text-warn">
              <span className="font-medium">{g.where}:</span> {g.message}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Leitura do arquivo (parse-back)">
        <div className="flex gap-2">
          <Badge tone={parse.pdf.fidelity === 100 ? "green" : "red"}>PDF {parse.pdf.fidelity}%</Badge>
          <Badge tone={parse.docx.fidelity === 100 ? "green" : "red"}>DOCX {parse.docx.fidelity}%</Badge>
        </div>
        {[...parse.pdf.missing, ...parse.docx.missing].length > 0 && (
          <ul className="mt-2 list-disc pl-4 text-xs text-bad">
            {[...new Set([...parse.pdf.missing, ...parse.docx.missing])].slice(0, 8).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </Card>

      {score.tips.length > 0 && (
        <Card title="Como melhorar">
          <ul className="list-disc space-y-1 pl-4 text-sm text-fg/85">
            {score.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      )}

      {screener && (
        <Card title={`Triagem simulada por IA — nota ${screener.grade}`}>
          <p className="text-sm text-fg/85">{screener.justification}</p>
          {(
            [
              ["Pontos fortes", screener.strengths],
              ["Riscos", screener.risks],
              ["Sugestões", screener.suggestions],
            ] as const
          )
            .filter(([, items]) => items.length)
            .map(([label, items]) => (
              <div key={label} className="mt-2">
                <p className="text-xs font-medium text-subtle">{label}</p>
                <ul className="list-disc pl-4 text-sm text-fg/85">
                  {items.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          <p className="mt-2 text-xs text-subtle">Parecer da versão original; não é refeito a cada edição.</p>
        </Card>
      )}
    </div>
  );
}
