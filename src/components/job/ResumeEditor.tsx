"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CsvInput, ErrorBox, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { Bullet, CoverLetter, Evaluation, ResumeVersion, TailoredResume, Template } from "@/lib/types";
import { ScorePanel } from "./ScorePanel";

type SaveState = "salvo" | "salvando" | "pendente" | "erro";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function BulletsEditor({ bullets, onChange }: { bullets: Bullet[]; onChange: (b: Bullet[]) => void }) {
  return (
    <div className="space-y-2">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex-1">
            <Textarea rows={2} value={b.text} onChange={(e) => onChange(bullets.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <div className="mt-0.5 flex gap-1.5">
              {b.inferred && <Badge tone="amber" title="Inferência do modo ousado: confirme">inferência — revise</Badge>}
              {b.manual && <Badge tone="blue">escrito por você</Badge>}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <Button small variant="ghost" disabled={i === 0} onClick={() => onChange(move(bullets, i, i - 1))} aria-label="Mover para cima">
              ↑
            </Button>
            <Button small variant="ghost" disabled={i === bullets.length - 1} onClick={() => onChange(move(bullets, i, i + 1))} aria-label="Mover para baixo">
              ↓
            </Button>
            <Button small variant="danger" onClick={() => onChange(bullets.filter((_, j) => j !== i))} aria-label="Remover bullet">
              ✕
            </Button>
          </div>
        </div>
      ))}
      <Button small onClick={() => onChange([...bullets, { text: "", source_ids: [], inferred: false, manual: true }])}>
        + Bullet
      </Button>
    </div>
  );
}

export function ResumeEditor({ jobId, version, onSaved, onReviewed }: { jobId: string; version: ResumeVersion; onSaved: () => void; onReviewed?: () => void }) {
  const [resume, setResume] = useState<TailoredResume>(version.resume);
  const [letter, setLetter] = useState<CoverLetter | null>(version.coverLetter);
  const [template, setTemplate] = useState<Template>(version.template);
  const [evaluation, setEvaluation] = useState<Evaluation>(version.evaluation);
  const [saveState, setSaveState] = useState<SaveState>("salvo");
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<"resume" | "cover">("resume");
  const [letterBusy, setLetterBusy] = useState(false);
  const [letterNotes, setLetterNotes] = useState("");
  const firstRender = useRef(true);
  const seq = useRef(0);

  const base = `/api/jobs/${jobId}/versions/${version.id}`;

  // Abrir a versão no editor conta como a etapa "Verificar" do fluxo.
  useEffect(() => {
    if (!version.reviewedAt)
      fetch(`${base}/reviewed`, { method: "POST" })
        .then(() => onReviewed?.())
        .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvamento automático: cada edição é gravada e reavaliada (score, grounding, parse).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("pendente");
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setSaveState("salvando");
      try {
        const saved = await api<ResumeVersion>(base, { method: "PUT", json: { resume, coverLetter: letter, template } });
        if (mine !== seq.current) return; // chegou uma edição mais nova
        setEvaluation(saved.evaluation);
        setPreviewKey((k) => k + 1);
        setSaveState("salvo");
        setError(null);
        onSaved();
      } catch (e) {
        if (mine !== seq.current) return;
        setSaveState("erro");
        setError((e as Error).message);
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, letter, template]);

  const edit = (fn: (draft: TailoredResume) => void) => {
    const draft = structuredClone(resume);
    fn(draft);
    setResume(draft);
  };

  const generateLetter = async () => {
    if (letter && !confirm("Gerar uma nova carta substitui o texto atual. Continuar?")) return;
    setLetterBusy(true);
    setError(null);
    try {
      // Garante que a carta use o currículo já salvo com as últimas edições.
      await api<ResumeVersion>(base, { method: "PUT", json: { resume, template } });
      setLetter(await api<CoverLetter>(`${base}/cover`, { method: "POST", json: { notes: letterNotes } }));
      setPreviewDoc("cover");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLetterBusy(false);
    }
  };

  const download = (doc: "resume" | "cover", format: string) => `${base}/file?doc=${doc}&format=${format}`;
  const downloads = (doc: "resume" | "cover") => (
    <div className="flex gap-1.5">
      {["pdf", "docx", "txt"].map((f) => (
        <a key={f} href={download(doc, f)} className="rounded-lg border border-line-strong bg-panel-2/60 px-2 py-1 text-xs font-medium uppercase text-fg hover:bg-panel-3">
          {f}
        </a>
      ))}
    </div>
  );

  const saveLabel: Record<SaveState, string> = { salvo: "Alterações salvas", salvando: "Salvando…", pendente: "Editando…", erro: "Erro ao salvar" };

  return (
    <div className="grid gap-4 @5xl:grid-cols-2 [&>*]:min-w-0">
      {/* ── Coluna de edição ── */}
      <div className="space-y-4">
        <Card
          title="Editar currículo"
          actions={
            <span className={`flex items-center gap-1.5 text-xs ${saveState === "erro" ? "text-bad" : "text-subtle"}`}>
              {saveState === "salvando" && <Spinner />} {saveLabel[saveState]}
            </span>
          }
        >
          <div className="space-y-3">
            <ErrorBox message={error} />
            <Field label="Headline (use o título exato da vaga)">
              <Input value={resume.headline} onChange={(e) => edit((d) => void (d.headline = e.target.value))} />
            </Field>
            <Field label="Resumo profissional" hint={`${resume.summary.split(/\s+/).filter(Boolean).length} palavras (ideal: 50 a 90)`}>
              <Textarea rows={3} value={resume.summary} onChange={(e) => edit((d) => void (d.summary = e.target.value))} />
            </Field>
            <Field label="Modelo visual">
              <Select value={template} onChange={(e) => setTemplate(e.target.value as Template)}>
                <option value="classico">Clássico</option>
                <option value="moderno">Moderno discreto</option>
                <option value="compacto">Compacto</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Habilidades" actions={<Button small onClick={() => edit((d) => void d.skill_groups.push({ label: "", items: [] }))}>+ Grupo</Button>}>
          <div className="space-y-2">
            {resume.skill_groups.map((g, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <Input className="col-span-3" value={g.label} placeholder="Grupo" onChange={(e) => edit((d) => void (d.skill_groups[i].label = e.target.value))} />
                <div className="col-span-8">
                  <CsvInput value={g.items} placeholder="Itens separados por vírgula" onChange={(items) => edit((d) => void (d.skill_groups[i].items = items))} />
                </div>
                <Button small variant="danger" onClick={() => edit((d) => void d.skill_groups.splice(i, 1))}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Experiência profissional">
          <div className="space-y-4">
            {resume.experiences.map((e, i) => (
              <div key={e.source_id || i} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-start gap-2">
                  <div className="flex-1">
                    <Input value={e.title} onChange={(ev) => edit((d) => void (d.experiences[i].title = ev.target.value))} />
                    <p className="mt-1 text-xs text-subtle">
                      {[e.company, e.location, `${e.start || "?"} – ${e.end || "atual"}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button small variant="ghost" disabled={i === 0} onClick={() => edit((d) => void (d.experiences = move(d.experiences, i, i - 1)))}>
                    ↑
                  </Button>
                  <Button small variant="ghost" disabled={i === resume.experiences.length - 1} onClick={() => edit((d) => void (d.experiences = move(d.experiences, i, i + 1)))}>
                    ↓
                  </Button>
                  <Button small variant="danger" onClick={() => confirm("Remover esta experiência do currículo?") && edit((d) => void d.experiences.splice(i, 1))}>
                    Remover
                  </Button>
                </div>
                <BulletsEditor bullets={e.bullets} onChange={(b) => edit((d) => void (d.experiences[i].bullets = b))} />
              </div>
            ))}
          </div>
        </Card>

        {resume.projects.length > 0 && (
          <Card title="Projetos">
            <div className="space-y-4">
              {resume.projects.map((p, i) => (
                <div key={p.source_id || i} className="rounded-lg border border-line p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Input className="flex-1" value={p.name} onChange={(ev) => edit((d) => void (d.projects[i].name = ev.target.value))} />
                    <Button small variant="danger" onClick={() => confirm("Remover este projeto do currículo?") && edit((d) => void d.projects.splice(i, 1))}>
                      Remover
                    </Button>
                  </div>
                  <BulletsEditor bullets={p.bullets} onChange={(b) => edit((d) => void (d.projects[i].bullets = b))} />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title="Formação, certificações e idiomas">
          <div className="space-y-3">
            {resume.education.map((ed, i) => (
              <div key={ed.source_id || i} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-start gap-2">
                  <div className="flex-1">
                    <Input value={ed.degree} onChange={(e) => edit((d) => void (d.education[i].degree = e.target.value))} />
                    <p className="mt-1 text-xs text-subtle">{[ed.institution, ed.period].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Button small variant="danger" onClick={() => edit((d) => void d.education.splice(i, 1))}>
                    Remover
                  </Button>
                </div>
                <BulletsEditor bullets={ed.bullets ?? []} onChange={(b) => edit((d) => void (d.education[i].bullets = b))} />
              </div>
            ))}
            <Field label="Certificações (uma por linha)">
              <Textarea rows={2} value={resume.certifications.join("\n")} onChange={(e) => edit((d) => void (d.certifications = e.target.value.split("\n")))} />
            </Field>
            <Field label="Idiomas (um por linha)">
              <Textarea rows={2} value={resume.languages.join("\n")} onChange={(e) => edit((d) => void (d.languages = e.target.value.split("\n")))} />
            </Field>
          </div>
        </Card>

        <Card title="Carta de apresentação (cover letter)" actions={letter ? downloads("cover") : undefined}>
          <div className="space-y-3">
            {letter ? (
              <>
                <Field label="Saudação">
                  <Input value={letter.greeting} onChange={(e) => setLetter({ ...letter, greeting: e.target.value })} />
                </Field>
                <Field label="Texto (separe os parágrafos com uma linha em branco)" hint={`${letter.body.split(/\s+/).filter(Boolean).length} palavras`}>
                  <Textarea rows={4} value={letter.body} onChange={(e) => setLetter({ ...letter, body: e.target.value })} />
                </Field>
                <Field label="Despedida">
                  <Input value={letter.closing} onChange={(e) => setLetter({ ...letter, closing: e.target.value })} />
                </Field>
              </>
            ) : (
              <p className="text-sm text-muted">Sem carta nesta versão.</p>
            )}
            {letter && (evaluation.letter ?? []).length > 0 && (
              <ul className="space-y-1 rounded-lg border border-warn/35 bg-warn/10 px-3 py-2 text-sm">
                {(evaluation.letter ?? []).map((g, i) => (
                  <li key={i} className={g.severity === "erro" ? "text-bad" : "text-warn"}>
                    {g.message}
                  </li>
                ))}
              </ul>
            )}
            <Field label="Orientações para a carta (opcional)">
              <Input value={letterNotes} onChange={(e) => setLetterNotes(e.target.value)} placeholder="Ex.: mencionar interesse no setor de educação." />
            </Field>
            <div className="flex gap-2">
              <Button variant={letter ? "secondary" : "primary"} disabled={letterBusy} onClick={generateLetter}>
                {letterBusy && <Spinner />} {letterBusy ? "Escrevendo…" : letter ? "Gerar novamente" : "Gerar carta de apresentação"}
              </Button>
              {letter && (
                <Button variant="danger" onClick={() => confirm("Remover a carta desta versão?") && (setLetter(null), setPreviewDoc("resume"))}>
                  Remover carta
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Coluna de resultado ── */}
      <div className="space-y-4">
        <Card
          title={
            <span className="flex items-center gap-2">
              Prévia
              {letter && (
                <span className="flex overflow-hidden rounded-lg border border-line-strong text-xs font-normal">
                  {(["resume", "cover"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setPreviewDoc(d)} className={`px-2 py-0.5 ${previewDoc === d ? "bg-gradient-to-r from-neon to-plasma text-ink font-semibold" : "bg-panel-2/60 text-fg/85"}`}>
                      {d === "resume" ? "Currículo" : "Carta"}
                    </button>
                  ))}
                </span>
              )}
            </span>
          }
          actions={downloads(previewDoc)}
        >
          <iframe key={`${previewDoc}-${previewKey}`} title="Prévia do PDF" src={`${download(previewDoc, "pdf")}&inline=1#toolbar=0&view=FitH`} className="h-[640px] w-full rounded border border-line bg-panel-2/60" />
        </Card>
        <ScorePanel evaluation={evaluation} screener={version.screener} />
      </div>
    </div>
  );
}
