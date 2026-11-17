import { z } from "zod";

export const uid = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

const str = z.string().default("");

/* ───────────── Perfil mestre ───────────── */

/** Unidade atômica de evidência: uma conquista/responsabilidade real do usuário. */
export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  skills: z.array(z.string()).default([]),
  /** Só em memória: marca o "fato" que representa um documento anexado a um projeto. */
  docName: z.string().optional(),
});

/** Referência a um documento de apoio; o texto extraído fica em data/docs/<id>.txt. */
export const DocumentRefSchema = z.object({
  id: z.string().regex(/^doc_[a-z0-9]+$/),
  name: z.string(),
  size: z.number().default(0),
  chars: z.number().default(0),
  addedAt: z.string().default(""),
});
export type DocumentRef = z.infer<typeof DocumentRefSchema>;

export const ExperienceSchema = z.object({
  id: z.string(),
  title: str,
  company: str,
  location: str,
  start: str, // AAAA-MM
  end: str, // AAAA-MM ou "" = atual
  facts: z.array(FactSchema).default([]),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: str,
  url: str,
  description: str,
  facts: z.array(FactSchema).default([]),
  documents: z.array(DocumentRefSchema).default([]),
});

export const EducationSchema = z.object({
  id: z.string(),
  degree: str,
  institution: str,
  period: str,
  /** Conquistas da formação: TCC, iniciação científica, monitoria, prêmios… */
  facts: z.array(FactSchema).default([]),
});

export const CertificationSchema = z.object({
  id: z.string(),
  name: str,
  issuer: str,
  date: str,
});

export const SkillSchema = z.object({
  id: z.string(),
  name: str,
  aliases: z.array(z.string()).default([]),
  level: str,
});

export const LanguageSchema = z.object({
  id: z.string(),
  name: str,
  level: str,
});

export const ContactSchema = z.object({
  name: str,
  email: str,
  phone: str,
  city: str,
  state: str,
  linkedin: str,
  github: str,
  website: str,
});

export const ProfileSchema = z.object({
  contact: ContactSchema.default(ContactSchema.parse({})),
  summary: str,
  experiences: z.array(ExperienceSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  education: z.array(EducationSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  /** Fatos avulsos (ex.: respostas de lacunas sem experiência associada). */
  extraFacts: z.array(FactSchema).default([]),
});

export type Fact = z.infer<typeof FactSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Profile = z.infer<typeof ProfileSchema>;

export const emptyProfile = (): Profile => ProfileSchema.parse({});

/* ───────────── Vaga ───────────── */

export const LangSchema = z.enum(["pt", "en"]);
export type Lang = z.infer<typeof LangSchema>;

/** Saída do LLM na análise da vaga (sem defaults: precisa virar JSON Schema estrito). */
export const JobAnalysisSchema = z.object({
  job_title: z.string(),
  company: z.string(),
  language: LangSchema,
  seniority: z.string(),
  years_required: z.number().nullable(),
  hard_skills: z.array(
    z.object({
      name: z.string(),
      aliases: z.array(z.string()),
      required: z.boolean(),
      weight: z.number(),
    }),
  ),
  soft_skills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  domain_keywords: z.array(z.string()),
  certifications: z.array(z.string()),
  education: z.array(z.string()),
  languages: z.array(z.string()),
  location: z.string(),
});
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export const AdjacencySchema = z.object({
  items: z.array(
    z.object({
      requirement: z.string(),
      related_skills: z.array(z.string()),
      /** true: a habilidade do candidato É um caso do requisito (RabbitMQ é mensageria). */
      covers: z.boolean(),
      /** Fatos do perfil que comprovam o requisito (para requisitos conceituais, ex.: "otimização de consultas"). */
      evidence_fact_ids: z.array(z.string()),
      rationale: z.string(),
    }),
  ),
});
export type Adjacency = z.infer<typeof AdjacencySchema>["items"];

export type CoverageStatus = "forte" | "parcial" | "adjacente" | "nenhuma";

export interface CoverageItem {
  name: string;
  required: boolean;
  weight: number;
  status: CoverageStatus;
  inSkills: boolean;
  evidence: { factId: string; where: string }[];
  /** Habilidades do perfil relacionadas; `covers` indica que elas satisfazem o requisito. */
  adjacent?: { skills: string[]; rationale: string; covers: boolean };
}

/* ───────────── Currículo gerado ───────────── */

export const TemperatureSchema = z.enum(["conservador", "equilibrado", "ousado"]);
export type Temperature = z.infer<typeof TemperatureSchema>;

export const TemplateSchema = z.enum(["classico", "moderno", "compacto"]);
export type Template = z.infer<typeof TemplateSchema>;

const BulletLLM = z.object({
  text: z.string(),
  source_ids: z.array(z.string()),
  inferred: z.boolean(),
});

/** O LLM só escreve texto; empresa, datas e contato vêm sempre do perfil. */
export const ResumeLLMSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  skill_groups: z.array(z.object({ label: z.string(), items: z.array(z.string()) })),
  experiences: z.array(
    z.object({ source_id: z.string(), title: z.string(), bullets: z.array(BulletLLM) }),
  ),
  projects: z.array(
    z.object({ source_id: z.string(), name: z.string(), bullets: z.array(BulletLLM) }),
  ),
  education: z.array(z.object({ source_id: z.string(), degree: z.string(), bullets: z.array(BulletLLM) })),
  certification_ids: z.array(z.string()),
  languages: z.array(z.string()),
});
export type ResumeLLM = z.infer<typeof ResumeLLMSchema>;

const BulletSchema = z.object({
  text: z.string(),
  source_ids: z.array(z.string()).default([]),
  inferred: z.boolean().default(false),
  /** Bullet escrito à mão pelo usuário no editor: é declaração dele, não passa pelo grounding. */
  manual: z.boolean().default(false),
});

export const TailoredResumeSchema = z.object({
  language: LangSchema,
  headline: str,
  summary: str,
  skill_groups: z.array(z.object({ label: str, items: z.array(z.string()) })).default([]),
  experiences: z
    .array(
      z.object({
        source_id: str,
        title: str,
        company: str,
        location: str,
        start: str,
        end: str,
        bullets: z.array(BulletSchema).default([]),
      }),
    )
    .default([]),
  projects: z
    .array(
      z.object({ source_id: str, name: str, url: str, bullets: z.array(BulletSchema).default([]) }),
    )
    .default([]),
  education: z
    .array(z.object({ source_id: str, degree: str, institution: str, period: str, bullets: z.array(BulletSchema).default([]) }))
    .default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;
export type Bullet = z.infer<typeof BulletSchema>;

export const CoverLetterLLMSchema = z.object({
  greeting: z.string(),
  paragraphs: z.array(z.string()),
  closing: z.string(),
});

export const CoverLetterSchema = z.object({ greeting: str, body: str, closing: str });
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export const ScreenerSchema = z.object({
  grade: z.enum(["A", "B", "C", "D"]),
  justification: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export type Screener = z.infer<typeof ScreenerSchema>;

export interface GroundingIssue {
  severity: "erro" | "aviso";
  where: string;
  message: string;
}

export interface KeywordResult {
  name: string;
  required: boolean;
  status: "contexto" | "lista" | "ausente";
  count: number;
}

export interface ParseReport {
  pdf: { fidelity: number; missing: string[] };
  docx: { fidelity: number; missing: string[] };
}

export interface ScoreReport {
  total: number;
  components: { key: string; label: string; weight: number; value: number }[];
  keywords: KeywordResult[];
  penalties: { label: string; points: number }[];
  tips: string[];
}

export interface Evaluation {
  score: ScoreReport;
  grounding: GroundingIssue[];
  parse: ParseReport;
  /** Problemas de grounding da carta de apresentação (não entram no score do currículo). */
  letter?: GroundingIssue[];
}

export interface ResumeVersion {
  id: string;
  createdAt: string;
  temperature: Temperature;
  template: Template;
  model: string;
  resume: TailoredResume;
  coverLetter: CoverLetter | null;
  screener: Screener | null;
  evaluation: Evaluation;
  /** Quando o usuário abriu a versão no editor (etapa "Verificar" do fluxo). */
  reviewedAt?: string;
  /** Quando algum arquivo da versão foi baixado (etapa "Baixar"). */
  downloadedAt?: string;
}

/** Etapas do fluxo da plataforma, na ordem da órbita da tela inicial. */
export const FLOW_STEPS = ["perfil", "vaga", "gerar", "verificar", "baixar"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export interface JobPosting {
  id: string;
  createdAt: string;
  rawText: string;
  url: string;
  analysis: JobAnalysis;
  adjacency: Adjacency;
  versions: ResumeVersion[];
}

/** Quanto conteúdo o perfil tem (para o bloqueio da importação e a confirmação de limpeza). */
export function profileStats(p: Profile) {
  const facts =
    [...p.experiences, ...p.projects, ...p.education].reduce((n, e) => n + e.facts.length, 0) + p.extraFacts.length;
  const stats = {
    experiences: p.experiences.length,
    projects: p.projects.length,
    education: p.education.length,
    skills: p.skills.length,
    facts,
    documents: p.projects.reduce((n, x) => n + x.documents.length, 0),
    certifications: p.certifications.length,
    languages: p.languages.length,
  };
  const hasContact = Object.values(p.contact).some((v) => v.trim());
  const hasData = hasContact || !!p.summary.trim() || Object.values(stats).some((n) => n > 0);
  return { ...stats, hasData };
}
