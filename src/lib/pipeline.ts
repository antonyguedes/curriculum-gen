import { z } from "zod";
import { aiMode, askLLM } from "./ai";
import { evaluate } from "./evaluate";
import { checkLetter, hasErrors } from "./grounding";
import { docsForPrompt, withDocuments, type DocText } from "./documents";
import { computeCoverage, flattenFacts } from "./matching";
import { norm } from "./taxonomy";
import {
  ADJACENCY_SYSTEM,
  adjacencyPrompt,
  coverLetterPrompt,
  coverLetterSystem,
  fixPrompt,
  generationPrompt,
  generationSystem,
  IMPORT_SYSTEM,
  importPrompt,
  JOB_ANALYSIS_SYSTEM,
  jobAnalysisPrompt,
  revisePrompt,
  type RevisionTargets,
  SCREENER_SYSTEM,
  screenerPrompt,
  SUGGEST_FACTS_SYSTEM,
  suggestFactsPrompt,
} from "./prompts";
import { buildResumeDoc } from "./render/model";
import { renderTxt } from "./render/txt";
import {
  AdjacencySchema,
  CoverLetterLLMSchema,
  JobAnalysisSchema,
  ProfileSchema,
  ResumeLLMSchema,
  ScreenerSchema,
  uid,
  type Adjacency,
  type CoverLetter,
  type Evaluation,
  type JobAnalysis,
  type JobPosting,
  type Profile,
  type ResumeLLM,
  type ResumeVersion,
  type Screener,
  type TailoredResume,
  type Temperature,
  type Template,
} from "./types";

const MAX_FIX_ROUNDS = 2;
/** No modo copiar e colar cada rodada é uma colagem a mais: uma correção basta. */
const MANUAL_FIX_ROUNDS = 1;
const STUFFING_TARGET = 6;

/* ───────────── Vaga ───────────── */

export async function analyzeJob(rawText: string, model?: string): Promise<JobAnalysis> {
  const analysis = await askLLM({
    label: "Análise da vaga",
    system: JOB_ANALYSIS_SYSTEM,
    prompt: jobAnalysisPrompt(rawText),
    schema: JobAnalysisSchema,
    model,
  });
  analysis.hard_skills = analysis.hard_skills
    .filter((s) => s.name.trim())
    .map((s) => ({ ...s, weight: Math.min(5, Math.max(1, Math.round(s.weight) || 1)) }));
  return analysis;
}

/** Habilidades adjacentes para os requisitos sem evidência direta (sinal semântico). */
export async function findAdjacency(profile: Profile, analysis: JobAnalysis, docs: DocText[] = []): Promise<Adjacency> {
  const mode = await aiMode();
  if (mode.manual) return []; // sinal opcional: no modo copiar e colar, economiza uma colagem
  const evidence = withDocuments(profile, docs);
  const missing = computeCoverage(evidence, analysis, [])
    .filter((c) => c.status === "nenhuma")
    .map((c) => c.name);
  // Documentos entram recortados: aqui só importa saber se comprovam algum requisito.
  const docText = new Map(docsForPrompt(docs, Math.min(60_000, mode.docsBudget)).docs.map((d) => [d.id, d.text]));
  const facts = flattenFacts(evidence)
    .filter((f) => f.text.trim())
    .map((f) => (docText.has(f.id) ? { ...f, text: `[documento ${f.docName}] ${docText.get(f.id)}` } : f));
  const skills = [...new Set([...profile.skills.map((s) => s.name), ...facts.flatMap((f) => f.skills)])].filter(Boolean);
  if (!missing.length || (!skills.length && !facts.length)) return [];
  try {
    const { items } = await askLLM({
      label: "Habilidades relacionadas",
      fast: true,
      system: ADJACENCY_SYSTEM,
      prompt: adjacencyPrompt(missing, skills, facts),
      schema: AdjacencySchema,
    });
    // O modelo só pode apontar para habilidades e fatos que existem de verdade.
    const skillSet = new Set(skills.map(norm));
    const factIds = new Set(facts.map((f) => f.id));
    return items
      .map((i) => ({
        ...i,
        related_skills: i.related_skills.filter((s) => skillSet.has(norm(s))),
        evidence_fact_ids: i.covers ? i.evidence_fact_ids.filter((id) => factIds.has(id)) : [],
      }))
      .filter((i) => i.related_skills.length || i.evidence_fact_ids.length);
  } catch {
    return []; // sinal opcional: a análise continua válida sem ele
  }
}

/* ───────────── Importação de currículo ───────────── */

const ImportSchema = z.object({
  contact: z.object({
    name: z.string(), email: z.string(), phone: z.string(), city: z.string(),
    state: z.string(), linkedin: z.string(), github: z.string(), website: z.string(),
  }),
  summary: z.string(),
  experiences: z.array(
    z.object({
      title: z.string(), company: z.string(), location: z.string(), start: z.string(), end: z.string(),
      facts: z.array(z.object({ text: z.string(), skills: z.array(z.string()) })),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(), url: z.string(), description: z.string(),
      facts: z.array(z.object({ text: z.string(), skills: z.array(z.string()) })),
    }),
  ),
  education: z.array(
    z.object({
      degree: z.string(), institution: z.string(), period: z.string(),
      facts: z.array(z.object({ text: z.string(), skills: z.array(z.string()) })),
    }),
  ),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string(), date: z.string() })),
  skills: z.array(z.object({ name: z.string(), aliases: z.array(z.string()), level: z.string() })),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
});

export async function importProfile(text: string, model?: string): Promise<Profile> {
  const raw = await askLLM({ label: "Importação do currículo", system: IMPORT_SYSTEM, prompt: importPrompt(text), schema: ImportSchema, model });
  const facts = (list: { text: string; skills: string[] }[]) => list.map((f) => ({ id: uid("f"), ...f }));
  return ProfileSchema.parse({
    contact: raw.contact,
    summary: raw.summary,
    experiences: raw.experiences.map((e) => ({ ...e, id: uid("exp"), facts: facts(e.facts) })),
    projects: raw.projects.map((p) => ({ ...p, id: uid("proj"), facts: facts(p.facts) })),
    education: raw.education.map((e) => ({ ...e, id: uid("edu"), facts: facts(e.facts) })),
    certifications: raw.certifications.map((c) => ({ ...c, id: uid("cert") })),
    skills: raw.skills.map((s) => ({ ...s, id: uid("sk") })),
    languages: raw.languages.map((l) => ({ ...l, id: uid("lang") })),
    extraFacts: [],
  });
}

/* ───────────── Fatos a partir de documentos ───────────── */

const SuggestedFactsSchema = z.object({
  facts: z.array(z.object({ text: z.string(), skills: z.array(z.string()), source_doc: z.string() })),
});

export async function suggestProjectFacts(project: { name: string; description: string; facts: string[] }, docs: DocText[]) {
  const prompted = docsForPrompt(docs, Math.min(120_000, (await aiMode()).docsBudget));
  const { facts } = await askLLM({
    label: "Fatos dos documentos do projeto",
    system: SUGGEST_FACTS_SYSTEM,
    prompt: suggestFactsPrompt(project, prompted.docs),
    schema: SuggestedFactsSchema,
  });
  return {
    facts: facts.filter((f) => f.text.trim()).map((f) => ({ text: f.text.trim(), skills: f.skills.filter(Boolean), sourceDoc: f.source_doc })),
    truncated: prompted.truncated,
  };
}

/* ───────────── Geração ───────────── */

/** Junta o texto do LLM com os dados factuais do perfil (empresa, datas, local, formação). */
export function hydrate(llm: ResumeLLM, profile: Profile, analysis: JobAnalysis): TailoredResume {
  const exp = new Map(profile.experiences.map((e) => [e.id, e]));
  const proj = new Map(profile.projects.map((p) => [p.id, p]));
  const edu = new Map(profile.education.map((e) => [e.id, e]));
  const cert = new Map(profile.certifications.map((c) => [c.id, c]));
  const clean = (bullets: ResumeLLM["experiences"][number]["bullets"]) =>
    bullets.filter((b) => b.text.trim()).map((b) => ({ ...b, text: b.text.trim(), manual: false }));

  return {
    language: analysis.language,
    headline: llm.headline.trim(),
    summary: llm.summary.trim(),
    skill_groups: llm.skill_groups.filter((g) => g.items.length),
    experiences: llm.experiences
      .filter((e) => exp.has(e.source_id))
      .map((e) => {
        const src = exp.get(e.source_id)!;
        return {
          source_id: src.id,
          title: e.title.trim() || src.title,
          company: src.company,
          location: src.location,
          start: src.start,
          end: src.end,
          bullets: clean(e.bullets),
        };
      })
      .sort((a, b) => (b.end || "9999-99").localeCompare(a.end || "9999-99") || b.start.localeCompare(a.start)),
    projects: llm.projects
      .filter((p) => proj.has(p.source_id))
      .map((p) => {
        const src = proj.get(p.source_id)!;
        return { source_id: src.id, name: src.name, url: src.url, bullets: clean(p.bullets) };
      }),
    education: llm.education
      .filter((e) => edu.has(e.source_id))
      .map((e) => {
        const src = edu.get(e.source_id)!;
        return { source_id: src.id, degree: e.degree.trim() || src.degree, institution: src.institution, period: src.period, bullets: clean(e.bullets) };
      }),
    certifications: llm.certification_ids
      .map((id) => cert.get(id))
      .filter((c) => !!c)
      .map((c) => [c.name, c.issuer, c.date].map((s) => s.trim()).filter(Boolean).join(" — ")),
    languages: llm.languages,
  };
}

export async function generateCoverLetter(
  analysis: JobAnalysis,
  resume: TailoredResume,
  temperature: Temperature,
  notes: string,
  model?: string,
): Promise<CoverLetter> {
  const raw = await askLLM({
    label: "Carta de apresentação",
    system: coverLetterSystem(resume.language),
    prompt: coverLetterPrompt(analysis, resume, temperature, notes),
    schema: CoverLetterLLMSchema,
    model,
  });
  return { greeting: raw.greeting.trim(), body: raw.paragraphs.map((p) => p.trim()).filter(Boolean).join("\n\n"), closing: raw.closing.trim() };
}

async function screen(profile: Profile, analysis: JobAnalysis, resume: TailoredResume, model?: string): Promise<Screener | null> {
  if ((await aiMode()).manual) return null; // segundo sinal opcional: pulado no modo copiar e colar
  try {
    // O screener lê o currículo sem dados de contato, como um ATS anonimizado.
    const doc = buildResumeDoc(resume, { ...profile.contact, email: "", phone: "", linkedin: "", github: "", website: "" }, analysis.job_title);
    return await askLLM({ label: "Triagem simulada", system: SCREENER_SYSTEM, prompt: screenerPrompt(analysis, renderTxt(doc)), schema: ScreenerSchema, model });
  } catch {
    return null; // segundo sinal é opcional
  }
}

/** O que dá para melhorar sem inventar: termos comprovados que faltam e termos repetidos demais. */
export function revisionTargets(evaluation: Evaluation, coverage: ReturnType<typeof computeCoverage>, evidence: Profile): RevisionTargets {
  const facts = new Map(flattenFacts(evidence).map((f) => [f.id, f]));
  const byName = new Map(coverage.map((c) => [c.name, c]));
  const missing = evaluation.score.keywords
    .filter((k) => k.required && k.status === "ausente")
    .map((k) => byName.get(k.name))
    .filter((c) => !!c && c.evidence.length > 0)
    .map((c) => ({
      name: c!.name,
      facts: c!.evidence.slice(0, 3).map((e) => {
        const f = facts.get(e.factId)!;
        return { id: f.id, text: f.text.length > 1500 ? `${f.text.slice(0, 1500)}…` : f.text };
      }),
    }));
  const stuffed = evaluation.score.keywords.filter((k) => k.count > STUFFING_TARGET).map((k) => ({ name: k.name, count: k.count }));
  return { missing, stuffed };
}

export interface GenerateOptions {
  temperature: Temperature;
  template: Template;
  /** Modelo escolhido na interface; vazio = padrão do motor configurado. */
  model?: string;
  coverLetter: boolean;
  notes: string;
}

export type Progress = (step: string, detail?: string) => void;

export async function generateVersion(
  profile: Profile,
  job: JobPosting,
  opts: GenerateOptions,
  progress: Progress,
  docs: DocText[] = [],
): Promise<ResumeVersion> {
  const { analysis } = job;
  // Perfil de evidências: fatos + documentos dos projetos (só em memória).
  const evidence = withDocuments(profile, docs);
  const coverage = computeCoverage(evidence, analysis, job.adjacency);
  const system = generationSystem(analysis.language);
  const mode = await aiMode();
  const prompted = docsForPrompt(docs, mode.docsBudget);
  const fixRounds = mode.manual ? MANUAL_FIX_ROUNDS : MAX_FIX_ROUNDS;

  progress(
    "Escrevendo o currículo",
    [`nível ${opts.temperature}${opts.model ? `, modelo ${opts.model}` : ""}`, docs.length ? `${docs.length} documento(s) de projeto` : "", prompted.truncated.length ? `lidos em parte: ${prompted.truncated.join(", ")}` : ""]
      .filter(Boolean)
      .join("; "),
  );
  let llm = await askLLM({
    label: "Geração do currículo",
    system,
    prompt: generationPrompt({ profile, analysis, coverage, temperature: opts.temperature, notes: opts.notes, docs: prompted.docs }),
    schema: ResumeLLMSchema,
    model: opts.model,
  });
  let resume = hydrate(llm, profile, analysis);

  progress("Verificando grounding e score");
  let evaluation: Evaluation = await evaluate(evidence, analysis, resume, opts.template, job.adjacency);

  for (let round = 1; round <= fixRounds && hasErrors(evaluation.grounding); round++) {
    const errors = evaluation.grounding.filter((g) => g.severity === "erro");
    progress(`Corrigindo ${errors.length} trecho(s) sem evidência`, `rodada ${round} de ${fixRounds}`);
    llm = await askLLM({ label: `Correção de trechos sem evidência (rodada ${round})`, system, prompt: fixPrompt(llm, errors), schema: ResumeLLMSchema, model: opts.model });
    resume = hydrate(llm, profile, analysis);
    evaluation = await evaluate(evidence, analysis, resume, opts.template, job.adjacency);
  }

  // Loop de otimização: uma revisão dirigida, aceita só se melhorar o score sem quebrar o grounding.
  const targets = revisionTargets(evaluation, coverage, evidence);
  if (!mode.manual && !hasErrors(evaluation.grounding) && (targets.missing.length || targets.stuffed.length)) {
    progress(
      "Otimizando para o ATS",
      [targets.missing.length ? `incluir ${targets.missing.map((m) => m.name).join(", ")}` : "", targets.stuffed.length ? `reduzir repetições de ${targets.stuffed.map((s) => s.name).join(", ")}` : ""]
        .filter(Boolean)
        .join("; "),
    );
    try {
      const revisedLlm = await askLLM({ label: "Otimização para o ATS", system, prompt: revisePrompt(llm, targets), schema: ResumeLLMSchema, model: opts.model });
      const revised = hydrate(revisedLlm, profile, analysis);
      const revisedEval = await evaluate(evidence, analysis, revised, opts.template, job.adjacency);
      if (!hasErrors(revisedEval.grounding) && revisedEval.score.total > evaluation.score.total) {
        llm = revisedLlm;
        resume = revised;
        evaluation = revisedEval;
      }
    } catch {
      // a revisão é opcional: mantém a versão já verificada
    }
  }

  progress(opts.coverLetter ? "Triagem simulada e carta de apresentação" : "Triagem simulada por IA");
  const [screener, coverLetter] = await Promise.all([
    screen(profile, analysis, resume, opts.model),
    opts.coverLetter ? generateCoverLetter(analysis, resume, opts.temperature, opts.notes, opts.model) : Promise.resolve(null),
  ]);

  if (coverLetter) evaluation.letter = checkLetter(evidence, analysis, coverLetter, job.adjacency);

  return {
    id: uid("v"),
    createdAt: new Date().toISOString(),
    temperature: opts.temperature,
    template: opts.template,
    model: opts.model || mode.provider,
    resume,
    coverLetter,
    screener,
    evaluation,
  };
}
