import { flattenFacts, profileEvidence, requirementForms, yearsOfExperience } from "./matching";
import { hasForms, norm } from "./taxonomy";
import type { Adjacency, Bullet, CoverLetter, GroundingIssue, JobAnalysis, Profile, TailoredResume } from "./types";

/** Números "soltos" (métricas). Dígitos colados em nomes (S3, EC2, HTML5, K8s) não contam. */
const numbersIn = (s: string) => (s.match(/(?<![A-Za-z0-9.,])\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));

/**
 * Checagem determinística de grounding: nada no currículo pode existir sem lastro no perfil.
 * - todo bullet aponta para fatos reais (source_ids);
 * - todo número de um bullet existe nos fatos de origem;
 * - toda tecnologia pedida pela vaga que aparece no currículo tem evidência no perfil.
 */
export function checkGrounding(
  profile: Profile,
  analysis: JobAnalysis,
  resume: TailoredResume,
  adjacency: Adjacency = [],
): GroundingIssue[] {
  const issues: GroundingIssue[] = [];
  const facts = flattenFacts(profile);
  const factById = new Map(facts.map((f) => [f.id, f]));
  const profileText = norm(
    [profile.summary, ...facts.map((f) => `${f.text} ${f.skills.join(" ")}`), ...profile.projects.map((p) => p.description)].join("\n"),
  );
  const profileNumbers = allowedNumbers(profile, profileText);
  const years = yearsOfExperience(profile);

  // Requisitos da vaga sem nenhuma evidência no perfil: não podem aparecer no currículo.
  // Exceção: conceitos satisfeitos por uma habilidade do perfil (ex.: "mensageria" por RabbitMQ).
  const coveredByConcept = new Set(adjacency.filter((a) => a.covers && (a.related_skills.length || (a.evidence_fact_ids ?? []).length)).map((a) => norm(a.requirement)));
  const unsupported = analysis.hard_skills
    .filter((s) => !coveredByConcept.has(norm(s.name)))
    .map((s) => ({ name: s.name, forms: requirementForms(profile, s.name, s.aliases) }))
    .filter(({ forms }) => {
      const ev = profileEvidence(profile, forms);
      return !ev.inSkills && !ev.evidence.length && !hasForms(profileText, forms);
    });

  const flagUnsupported = (text: string, where: string) => {
    const n = norm(text);
    for (const u of unsupported)
      if (hasForms(n, u.forms))
        issues.push({ severity: "erro", where, message: `"${u.name}" aparece no texto, mas não há evidência disso no perfil.` });
  };

  const checkBullet = (b: Bullet, where: string, parentId: string) => {
    if (b.manual) return;
    const sources = b.source_ids.map((id) => factById.get(id)).filter((f) => !!f);
    if (!b.source_ids.length || sources.length !== b.source_ids.length) {
      issues.push({ severity: "erro", where, message: "Bullet sem fato de origem válido no perfil." });
    } else if (sources.some((f) => f.parentId && f.parentId !== parentId)) {
      issues.push({ severity: "aviso", where, message: "Bullet usa um fato que pertence a outra experiência/projeto." });
    }
    const sourceNumbers = new Set(sources.flatMap((f) => numbersIn(f.text)));
    for (const n of numbersIn(b.text))
      if (!sourceNumbers.has(n))
        issues.push({ severity: "erro", where, message: `O número "${n}" não está nos fatos de origem deste bullet.` });
    flagUnsupported(b.text, where);
    if (b.inferred) issues.push({ severity: "aviso", where, message: "Bullet com inferência (modo ousado): confirme se está correto." });
  };

  const expIds = new Set(profile.experiences.map((e) => e.id));
  resume.experiences.forEach((e, i) => {
    const where = `Experiência ${i + 1} (${e.company || e.title})`;
    if (!expIds.has(e.source_id)) issues.push({ severity: "erro", where, message: "Experiência não existe no perfil." });
    e.bullets.forEach((b, j) => checkBullet(b, `${where}, bullet ${j + 1}`, e.source_id));
  });

  const projIds = new Set(profile.projects.map((p) => p.id));
  resume.projects.forEach((p, i) => {
    const where = `Projeto ${i + 1} (${p.name})`;
    if (!projIds.has(p.source_id)) issues.push({ severity: "erro", where, message: "Projeto não existe no perfil." });
    p.bullets.forEach((b, j) => checkBullet(b, `${where}, bullet ${j + 1}`, p.source_id));
  });

  const eduIds = new Set(profile.education.map((e) => e.id));
  resume.education.forEach((ed, i) => {
    const where = `Formação ${i + 1} (${ed.degree})`;
    if (!eduIds.has(ed.source_id)) issues.push({ severity: "erro", where, message: "Formação não existe no perfil." });
    (ed.bullets ?? []).forEach((b, j) => checkBullet(b, `${where}, bullet ${j + 1}`, ed.source_id));
  });

  // Habilidades listadas precisam existir no perfil (skill cadastrada ou citada em algum fato).
  for (const g of resume.skill_groups)
    for (const item of g.items) {
      // "Amazon Web Services (AWS)" → testa o nome completo, a parte externa e a sigla.
      const variants = [item, item.replace(/\s*\(.*?\)\s*/g, " "), ...[...item.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])]
        .map((v) => v.trim())
        .filter(Boolean);
      const forms = [...new Set(variants.flatMap((v) => requirementForms(profile, v)))];
      const ev = profileEvidence(profile, forms);
      if (!ev.inSkills && !ev.evidence.length && !hasForms(profileText, forms))
        issues.push({ severity: "erro", where: `Habilidades (${g.label})`, message: `"${item}" não consta no perfil.` });
    }

  // Headline e resumo: tecnologias sem lastro e números inventados.
  flagUnsupported(resume.headline, "Headline");
  flagUnsupported(resume.summary, "Resumo");
  for (const n of numbersIn(resume.summary)) {
    const asYears = Number(n);
    const plausibleYears = asYears > 0 && asYears <= Math.ceil(years);
    if (!plausibleYears && !profileNumbers.has(n))
      issues.push({ severity: "erro", where: "Resumo", message: `O número "${n}" não aparece no perfil.` });
  }

  // Certificações precisam ser as do perfil.
  const certNames = profile.certifications.map((c) => norm(c.name));
  resume.certifications.forEach((c) => {
    if (!certNames.some((n) => n && norm(c).includes(n)))
      issues.push({ severity: "erro", where: "Certificações", message: `"${c}" não consta no perfil.` });
  });

  return dedupe(issues);
}

/** Números que podem aparecer em texto livre: os dos fatos e os anos das datas do perfil. */
function allowedNumbers(profile: Profile, profileText: string) {
  const dates = [
    ...profile.experiences.flatMap((e) => [e.start, e.end]),
    ...profile.education.map((e) => e.period),
    ...profile.certifications.map((c) => c.date),
  ].join(" ");
  return new Set([...numbersIn(profileText), ...(dates.match(/\d{4}/g) ?? [])]);
}

/**
 * Carta de apresentação: texto corrido, sem source_ids. Verifica o que dá para verificar
 * de forma determinística: números e tecnologias da vaga sem lastro no perfil.
 */
export function checkLetter(profile: Profile, analysis: JobAnalysis, letter: CoverLetter, adjacency: Adjacency = []): GroundingIssue[] {
  const facts = flattenFacts(profile);
  const profileText = norm(
    [profile.summary, ...facts.map((f) => `${f.text} ${f.skills.join(" ")}`), ...profile.projects.map((p) => p.description)].join("\n"),
  );
  const allowed = allowedNumbers(profile, profileText);
  const years = Math.ceil(yearsOfExperience(profile));
  const text = [letter.greeting, letter.body, letter.closing].join("\n");
  const issues: GroundingIssue[] = [];

  for (const n of new Set(numbersIn(text))) {
    const v = Number(n);
    if (!allowed.has(n) && !(v > 0 && v <= years))
      issues.push({ severity: "erro", where: "Carta", message: `O número "${n}" não aparece no perfil.` });
  }
  // A carta pode citar um requisito apenas como interesse; por isso aqui é aviso, não erro.
  const covered = new Set(adjacency.filter((a) => a.covers).map((a) => norm(a.requirement)));
  const n = norm(text);
  for (const s of analysis.hard_skills) {
    if (covered.has(norm(s.name))) continue;
    const forms = requirementForms(profile, s.name, s.aliases);
    const ev = profileEvidence(profile, forms);
    if (!ev.inSkills && !ev.evidence.length && !hasForms(profileText, forms) && hasForms(n, forms))
      issues.push({ severity: "aviso", where: "Carta", message: `Cita "${s.name}", que não consta no perfil. Confira se não soa como experiência que você não tem.` });
  }
  return issues;
}

function dedupe(issues: GroundingIssue[]) {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.where}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const hasErrors = (issues: GroundingIssue[]) => issues.some((i) => i.severity === "erro");
