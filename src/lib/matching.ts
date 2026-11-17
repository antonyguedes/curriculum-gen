import { formsFor, hasForms, norm } from "./taxonomy";
import type { Adjacency, CoverageItem, JobAnalysis, Profile } from "./types";

export interface FlatFact {
  id: string;
  text: string;
  skills: string[];
  parentId: string;
  where: string;
  docName?: string;
}

export function flattenFacts(profile: Profile): FlatFact[] {
  const out: FlatFact[] = [];
  for (const e of profile.experiences)
    for (const f of e.facts) out.push({ ...f, parentId: e.id, where: `${e.title} — ${e.company}` });
  for (const p of profile.projects)
    for (const f of p.facts)
      out.push({ ...f, parentId: p.id, where: f.docName ? `Projeto: ${p.name} (documento: ${f.docName})` : `Projeto: ${p.name}` });
  for (const ed of profile.education)
    for (const f of ed.facts) out.push({ ...f, parentId: ed.id, where: `Formação: ${ed.degree} — ${ed.institution}` });
  for (const f of profile.extraFacts) out.push({ ...f, parentId: "", where: "Fato avulso" });
  return out;
}

/** Grafias de um requisito, ampliadas pelos aliases que o próprio usuário cadastrou. */
export function requirementForms(profile: Profile, name: string, aliases: string[] = []): string[] {
  const forms = new Set(formsFor(name, aliases));
  for (const s of profile.skills) {
    const own = formsFor(s.name, s.aliases);
    if (own.some((f) => forms.has(f))) own.forEach((f) => forms.add(f));
  }
  return [...forms];
}

export function profileEvidence(profile: Profile, forms: string[]) {
  const inSkills = profile.skills.some((s) => formsFor(s.name, s.aliases).some((f) => forms.includes(f)));
  const evidence = flattenFacts(profile)
    .filter(
      (f) => hasForms(norm(f.text), forms) || f.skills.some((s) => formsFor(s).some((x) => forms.includes(x))),
    )
    .map((f) => ({ factId: f.id, where: f.where }));
  return { inSkills, evidence };
}

/** Matriz de cobertura: requisito da vaga → evidências reais do perfil. */
export function computeCoverage(profile: Profile, analysis: JobAnalysis, adjacency: Adjacency): CoverageItem[] {
  const factIndex = new Map(flattenFacts(profile).map((f) => [f.id, f]));
  return analysis.hard_skills
    .map((skill) => {
      const forms = requirementForms(profile, skill.name, skill.aliases);
      const { inSkills, evidence } = profileEvidence(profile, forms);
      const adj = adjacency.find((a) => norm(a.requirement) === norm(skill.name));
      const related = !evidence.length && !inSkills && adj ? adj : undefined;
      // Requisito conceitual comprovado por fatos (ex.: "otimização de consultas" por um fato sobre reescrever queries).
      if (related?.covers)
        for (const id of related.evidence_fact_ids ?? []) {
          const fact = factIndex.get(id);
          if (fact) evidence.push({ factId: fact.id, where: fact.where });
        }
      const status: CoverageItem["status"] = evidence.length
        ? "forte"
        : inSkills || (related?.covers && related.related_skills.length)
          ? "parcial"
          : related?.related_skills.length
            ? "adjacente"
            : "nenhuma";
      return {
        name: skill.name,
        required: skill.required,
        weight: skill.weight,
        status,
        inSkills,
        evidence,
        adjacent: related ? { skills: related.related_skills, rationale: related.rationale, covers: !!related.covers } : undefined,
      };
    })
    .sort((a, b) => Number(b.required) - Number(a.required) || b.weight - a.weight);
}

/** Anos de experiência somando os meses distintos trabalhados. */
export function yearsOfExperience(profile: Profile): number {
  const months = new Set<number>();
  const now = new Date();
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  for (const e of profile.experiences) {
    const s = parseYm(e.start);
    if (s === null) continue;
    const end = parseYm(e.end) ?? nowIdx;
    for (let m = s; m <= Math.min(end, nowIdx); m++) months.add(m);
  }
  return months.size / 12;
}

function parseYm(ym: string): number | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(ym.trim());
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}
