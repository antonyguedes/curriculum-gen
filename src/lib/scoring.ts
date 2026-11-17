import { requirementForms, yearsOfExperience } from "./matching";
import { countForms, hasForms, norm, tokens } from "./taxonomy";
import type { GroundingIssue, JobAnalysis, KeywordResult, ParseReport, Profile, ScoreReport, TailoredResume } from "./types";

/** Ignora flexão de gênero em cargos: "Desenvolvedora", "Desenvolvedor(a)" e "Desenvolvedor" contam igual. */
export const foldTitle = (s: string) =>
  norm(s)
    .replace(/\((?:a|o|as|os)\)|\/(?:a|o)\b/g, "")
    .replace(/([a-z])(?:ora|oras|ores)\b/g, "$1or")
    .replace(/([a-z])(?:eira|eiras|eiros)\b/g, "$1eiro")
    .replace(/\s+/g, " ")
    .trim();

const WEIGHTS = { kreq: 0.35, knice: 0.1, title: 0.15, resp: 0.1, exp: 0.1, format: 0.1, parse: 0.1 };
const STUFFING_LIMIT = 6;

export const allBullets = (r: TailoredResume) => [
  ...r.experiences.flatMap((e) => e.bullets),
  ...r.projects.flatMap((p) => p.bullets),
  ...r.education.flatMap((e) => e.bullets ?? []),
];

export function resumeTexts(r: TailoredResume) {
  const context = norm([r.summary, ...allBullets(r).map((b) => b.text)].join("\n"));
  const list = norm(r.skill_groups.flatMap((g) => g.items).join("\n"));
  const full = norm(
    [
      r.headline,
      r.summary,
      list,
      context,
      ...r.experiences.map((e) => e.title),
      ...r.certifications,
      ...r.education.map((e) => e.degree),
      ...r.languages,
    ].join("\n"),
  );
  return { context, list, full };
}

/**
 * Score proxy de ATS, 100% determinístico (recalcula a cada edição, sem chamar IA).
 * Imita as duas camadas reais: cobertura de keywords e legibilidade do arquivo.
 */
export function computeScore(
  profile: Profile,
  analysis: JobAnalysis,
  resume: TailoredResume,
  parse: ParseReport,
  grounding: GroundingIssue[],
): ScoreReport {
  const { context, list, full } = resumeTexts(resume);
  const tips: string[] = [];
  const penalties: ScoreReport["penalties"] = [];

  // ── Keywords: valem mais quando aparecem em contexto do que só na lista de skills.
  const keywords: KeywordResult[] = [];
  const kw = { req: { got: 0, total: 0 }, nice: { got: 0, total: 0 } };
  let stuffed = 0;
  for (const skill of analysis.hard_skills) {
    const forms = requirementForms(profile, skill.name, skill.aliases);
    const inContext = hasForms(context, forms);
    const inList = hasForms(list, forms);
    const count = countForms(full, forms);
    const status: KeywordResult["status"] = inContext ? "contexto" : inList ? "lista" : "ausente";
    const w = Math.max(1, skill.weight);
    const bucket = skill.required ? kw.req : kw.nice;
    bucket.total += w;
    bucket.got += w * (status === "contexto" ? 1 : status === "lista" ? 0.7 : 0);
    if (count > STUFFING_LIMIT) stuffed++;
    keywords.push({ name: skill.name, required: skill.required, status, count });
  }
  const kreq = kw.req.total ? (kw.req.got / kw.req.total) * 100 : 100;
  const knice = kw.nice.total ? (kw.nice.got / kw.nice.total) * 100 : 100;

  const missingReq = keywords.filter((k) => k.required && k.status === "ausente").map((k) => k.name);
  if (missingReq.length)
    tips.push(`Requisitos obrigatórios ausentes: ${missingReq.join(", ")}. Se você tem essa experiência, adicione-a ao perfil na etapa Vaga.`);
  const listOnly = keywords.filter((k) => k.required && k.status === "lista").map((k) => k.name);
  if (listOnly.length) tips.push(`Só na lista de habilidades (melhor citar em uma experiência): ${listOnly.join(", ")}.`);

  // ── Título da vaga no headline/resumo.
  const title = foldTitle(analysis.job_title);
  const headline = foldTitle(resume.headline);
  let titleScore = 0;
  if (title && headline.includes(title)) titleScore = 100;
  else if (title && foldTitle(resume.summary).includes(title)) titleScore = 85;
  else {
    const tt = tokens(title);
    const ht = new Set(tokens(headline));
    titleScore = tt.length ? (tt.filter((t) => ht.has(t)).length / tt.length) * 70 : 100;
  }
  if (titleScore < 100) tips.push(`Use o título exato da vaga ("${analysis.job_title}") no headline.`);

  // ── Responsabilidades da vaga refletidas nos bullets (sobreposição lexical).
  const bulletTokens = allBullets(resume).map((b) => new Set(tokens(b.text)));
  const summaryTokens = new Set(tokens(resume.summary));
  let respSum = 0;
  for (const r of analysis.responsibilities) {
    const rt = [...new Set(tokens(r))];
    if (!rt.length) {
      respSum += 1;
      continue;
    }
    let best = rt.filter((t) => summaryTokens.has(t)).length / rt.length;
    for (const bt of bulletTokens) best = Math.max(best, rt.filter((t) => bt.has(t)).length / rt.length);
    respSum += Math.min(1, best / 0.5);
  }
  const resp = analysis.responsibilities.length ? (respSum / analysis.responsibilities.length) * 100 : 100;

  // ── Requisitos de experiência e certificações.
  const years = yearsOfExperience(profile);
  const yearsScore = analysis.years_required ? Math.min(1, years / analysis.years_required) * 100 : 100;
  const certs = analysis.certifications.filter((c) => c.trim());
  const certScore = certs.length ? (certs.filter((c) => full.includes(norm(c))).length / certs.length) * 100 : 100;
  const exp = certs.length ? yearsScore * 0.7 + certScore * 0.3 : yearsScore;
  if (analysis.years_required && years < analysis.years_required)
    tips.push(`A vaga pede ${analysis.years_required} anos; o perfil soma ${years.toFixed(1)}.`);

  // ── Higiene de formato.
  const words = full.split(/\s+/).filter(Boolean).length;
  const summaryWords = resume.summary.split(/\s+/).filter(Boolean).length;
  const bullets = allBullets(resume);
  const checks: [boolean, string][] = [
    [!!profile.contact.name.trim(), "Preencha o nome no perfil."],
    [/^\S+@\S+\.\S+$/.test(profile.contact.email.trim()), "Preencha um e-mail válido no perfil."],
    [profile.contact.phone.replace(/\D/g, "").length >= 10, "Preencha o telefone com DDD no perfil."],
    [!!profile.contact.city.trim(), "Preencha a cidade no perfil."],
    [!!profile.contact.linkedin.trim(), "Adicione a URL do LinkedIn no perfil."],
    [summaryWords >= 30 && summaryWords <= 110, "O resumo deve ter de 3 a 4 linhas (30–110 palavras)."],
    [resume.experiences.length > 0, "Inclua ao menos uma experiência."],
    [resume.experiences.every((e) => /^\d{4}-\d{1,2}$/.test(e.start.trim())), "Há experiências sem data de início válida (AAAA-MM)."],
    [resume.experiences.every((e) => e.bullets.length >= 2 && e.bullets.length <= 7), "Cada experiência deve ter entre 2 e 7 bullets."],
    [bullets.every((b) => b.text.length <= 320), "Há bullets longos demais (mais de ~2 linhas)."],
    [words >= 200 && words <= 950, "O tamanho ideal é de 1 a 2 páginas (200–950 palavras)."],
    [resume.skill_groups.some((g) => g.items.length > 0), "Inclua a seção de habilidades."],
  ];
  const format = (checks.filter(([ok]) => ok).length / checks.length) * 100;
  for (const [ok, tip] of checks) if (!ok) tips.push(tip);

  const parseScore = Math.min(parse.pdf.fidelity, parse.docx.fidelity);
  if (parseScore < 100) tips.push("A re-extração do arquivo perdeu conteúdo; veja o relatório de parse.");

  // ── Penalidades.
  if (stuffed) {
    penalties.push({ label: `Keyword stuffing (${stuffed} termo(s) repetidos mais de ${STUFFING_LIMIT}x)`, points: Math.min(10, stuffed * 3) });
  }
  const errors = grounding.filter((g) => g.severity === "erro").length;
  if (errors) penalties.push({ label: `Conteúdo sem evidência no perfil (${errors})`, points: Math.min(20, errors * 4) });
  const noMetric = bullets.length ? bullets.filter((b) => !/\d/.test(b.text)).length / bullets.length : 0;
  if (noMetric > 0.7) tips.push("Poucos bullets têm números. Adicione métricas reais aos fatos do perfil para fortalecer o currículo.");

  const components = [
    { key: "kreq", label: "Keywords obrigatórias", weight: WEIGHTS.kreq, value: kreq },
    { key: "knice", label: "Keywords desejáveis", weight: WEIGHTS.knice, value: knice },
    { key: "title", label: "Título da vaga", weight: WEIGHTS.title, value: titleScore },
    { key: "resp", label: "Responsabilidades", weight: WEIGHTS.resp, value: resp },
    { key: "exp", label: "Experiência exigida", weight: WEIGHTS.exp, value: exp },
    { key: "format", label: "Formato", weight: WEIGHTS.format, value: format },
    { key: "parse", label: "Fidelidade de parse", weight: WEIGHTS.parse, value: parseScore },
  ].map((c) => ({ ...c, value: Math.round(c.value) }));

  const raw = components.reduce((sum, c) => sum + c.value * c.weight, 0);
  const total = Math.max(0, Math.round(raw - penalties.reduce((s, p) => s + p.points, 0)));
  return { total, components, keywords, penalties, tips };
}
