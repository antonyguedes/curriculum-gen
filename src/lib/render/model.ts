import type { Contact, CoverLetter, Lang, TailoredResume, Template } from "../types";

/**
 * Modelo de documento neutro: uma lista linear de blocos, coluna única.
 * PDF, DOCX e TXT são gerados a partir dele, então os três sempre têm o mesmo conteúdo
 * e a mesma ordem de leitura.
 */
export type Block =
  | { t: "heading"; text: string }
  | { t: "para"; text: string }
  | { t: "entry"; bold: string; rest: string }
  | { t: "bullet"; text: string };

export interface DocModel {
  name: string;
  contact: string;
  headline: string;
  blocks: Block[];
  meta: { title: string; author: string; subject: string };
}

/** Títulos de seção canônicos — os ATS descartam blocos com títulos fora do padrão. */
export const SECTION_TITLES: Record<Lang, Record<string, string>> = {
  pt: {
    summary: "Resumo Profissional",
    skills: "Habilidades Técnicas",
    experience: "Experiência Profissional",
    projects: "Projetos",
    education: "Formação Acadêmica",
    certifications: "Certificações",
    languages: "Idiomas",
  },
  en: {
    summary: "Professional Summary",
    skills: "Skills",
    experience: "Professional Experience",
    projects: "Projects",
    education: "Education",
    certifications: "Certifications",
    languages: "Languages",
  },
};

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(ym: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{1,2})$/.exec(ym.trim());
  if (!m) return ym.trim() ? ym.trim() : lang === "pt" ? "Atual" : "Present";
  const month = Number(m[2]);
  return lang === "pt" ? `${String(month).padStart(2, "0")}/${m[1]}` : `${EN_MONTHS[month - 1] ?? ""} ${m[1]}`.trim();
}

export const formatRange = (start: string, end: string, lang: Lang) =>
  start.trim() ? `${formatDate(start, lang)} – ${formatDate(end, lang)}` : "";

/** Telefone no padrão internacional: parsers como o do Lever anulam o campo sem DDI. */
export function formatPhone(phone: string): string {
  const raw = phone.trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw.replace(/\s+/g, " ");
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `+55 ${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `+55 ${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 13 && d.startsWith("55")) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  return raw;
}

export function fullUrl(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`;
}

/** Só caracteres que as fontes padrão do PDF representam: evita glifos perdidos na extração. */
export function sanitize(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[→⇒➜➔]/g, "->")
    .replace(/[•●▪◦‣]/g, "-")
    .replace(/…/g, "...")
    .replace(/[  -​ ]/g, " ")
    .replace(/[^ -~¡-ÿ–—\n]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function contactLine(c: Contact): string {
  const place = [c.city, c.state].map((s) => s.trim()).filter(Boolean).join(", ");
  return [place, formatPhone(c.phone), c.email.trim(), fullUrl(c.linkedin), fullUrl(c.github), fullUrl(c.website)]
    .filter(Boolean)
    .map(sanitize)
    .join(" | ");
}

const joinParts = (parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(" | ");

/** Modalidade de trabalho no idioma do currículo (o perfil costuma estar em português). */
const WORK_MODE_EN: [RegExp, string][] = [
  [/\bremoto\b/gi, "Remote"],
  [/\bh[ií]brido\b/gi, "Hybrid"],
  [/\bpresencial\b/gi, "On-site"],
];
export const localizeLocation = (location: string, lang: Lang) =>
  lang === "en" ? WORK_MODE_EN.reduce((s, [re, en]) => s.replace(re, en), location) : location;

export function buildResumeDoc(resume: TailoredResume, contact: Contact, jobTitle: string): DocModel {
  const L = SECTION_TITLES[resume.language];
  const blocks: Block[] = [];
  const push = (b: Block) => {
    const clean = { ...b } as Block;
    if (clean.t === "entry") {
      clean.bold = sanitize(clean.bold);
      clean.rest = sanitize(clean.rest);
      if (!clean.bold && !clean.rest) return;
    } else {
      clean.text = sanitize(clean.text);
      if (!clean.text) return;
    }
    blocks.push(clean);
  };

  if (resume.summary.trim()) {
    push({ t: "heading", text: L.summary });
    push({ t: "para", text: resume.summary });
  }

  const groups = resume.skill_groups.filter((g) => g.items.some((i) => i.trim()));
  if (groups.length) {
    push({ t: "heading", text: L.skills });
    for (const g of groups) {
      const items = g.items.map((i) => i.trim()).filter(Boolean).join(", ");
      push({ t: "para", text: g.label.trim() ? `${g.label.trim()}: ${items}` : items });
    }
  }

  if (resume.experiences.length) {
    push({ t: "heading", text: L.experience });
    for (const e of resume.experiences) {
      const rest = joinParts([localizeLocation(e.location, resume.language), formatRange(e.start, e.end, resume.language)]);
      push({ t: "entry", bold: e.title, rest: [e.company.trim() && `— ${e.company.trim()}`, rest].filter(Boolean).join(" | ") });
      for (const b of e.bullets) push({ t: "bullet", text: b.text });
    }
  }

  if (resume.projects.length) {
    push({ t: "heading", text: L.projects });
    for (const p of resume.projects) {
      push({ t: "entry", bold: p.name, rest: p.url.trim() ? `| ${fullUrl(p.url)}` : "" });
      for (const b of p.bullets) push({ t: "bullet", text: b.text });
    }
  }

  if (resume.education.length) {
    push({ t: "heading", text: L.education });
    for (const ed of resume.education) {
      push({ t: "entry", bold: ed.degree, rest: [ed.institution.trim() && `— ${ed.institution.trim()}`, ed.period.trim()].filter(Boolean).join(" | ") });
      for (const b of ed.bullets ?? []) push({ t: "bullet", text: b.text });
    }
  }

  const certs = resume.certifications.filter((c) => c.trim());
  if (certs.length) {
    push({ t: "heading", text: L.certifications });
    for (const c of certs) push({ t: "bullet", text: c });
  }

  const langs = resume.languages.filter((l) => l.trim());
  if (langs.length) {
    push({ t: "heading", text: L.languages });
    push({ t: "para", text: langs.join(" | ") });
  }

  const name = sanitize(contact.name);
  return {
    name,
    contact: contactLine(contact),
    headline: sanitize(resume.headline),
    blocks,
    meta: { title: `${name} — ${sanitize(resume.headline || jobTitle)}`, author: name, subject: sanitize(jobTitle) },
  };
}

export function buildCoverLetterDoc(letter: CoverLetter, contact: Contact, jobTitle: string, lang: Lang): DocModel {
  const name = sanitize(contact.name);
  const blocks: Block[] = [];
  const para = (text: string) => {
    const t = sanitize(text.replace(/\n+/g, " "));
    if (t) blocks.push({ t: "para", text: t });
  };
  para(letter.greeting);
  for (const p of letter.body.split(/\n\s*\n/)) para(p);
  para(letter.closing);
  para(name);
  return {
    name,
    contact: contactLine(contact),
    headline: "",
    blocks,
    meta: {
      title: `${name} — ${lang === "pt" ? "Carta de Apresentação" : "Cover Letter"}`,
      author: name,
      subject: sanitize(jobTitle),
    },
  };
}

export interface Style {
  marginCm: number;
  body: number;
  name: number;
  heading: number;
  accent: string; // hex sem '#'
  centerHeader: boolean;
  gap: number;
}

/** Variações só de tipografia/espaçamento; a estrutura ATS é idêntica nas três. */
export const STYLES: Record<Template, Style> = {
  classico: { marginCm: 2, body: 10.5, name: 18, heading: 12, accent: "000000", centerHeader: true, gap: 1 },
  moderno: { marginCm: 2, body: 10.5, name: 20, heading: 12, accent: "1F3A5F", centerHeader: false, gap: 1.1 },
  compacto: { marginCm: 1.8, body: 10, name: 16, heading: 11, accent: "000000", centerHeader: true, gap: 0.7 },
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function fileBaseName(name: string, jobTitle: string, company: string, cover = false, lang: Lang = "pt") {
  const parts = [slug(name), slug(jobTitle), slug(company)].filter(Boolean);
  if (cover) parts.push(lang === "pt" ? "Carta" : "Cover_Letter");
  return parts.join("_").slice(0, 120) || "curriculo";
}
