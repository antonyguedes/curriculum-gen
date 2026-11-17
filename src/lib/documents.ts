import type { Profile } from "./types";

/**
 * Documentos de apoio anexados a projetos (README, especificação, relatório…).
 * O texto extraído fica em disco; o perfil guarda só a referência.
 * Este módulo é puro (sem Node), para ser usado também na interface.
 */

export const DOC_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown"] as const;
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOCS_PER_PROJECT = 5;
/** Quanto de cada documento a IA lê por chamada. */
export const DOC_PROMPT_CHARS = 30_000;
/** Teto somado de todos os documentos enviados em uma geração. */
export const DOCS_TOTAL_PROMPT_CHARS = 150_000;

export interface DocText {
  id: string;
  projectId: string;
  name: string;
  text: string;
}

/**
 * Perfil de evidências: cada documento vira um "fato" do seu projeto, só em memória.
 * Assim a cobertura, o grounding e os source_ids aceitam o documento como fonte,
 * sem que ele seja salvo ou exibido como fato no perfil.
 */
export function withDocuments(profile: Profile, docs: DocText[]): Profile {
  if (!docs.length) return profile;
  const byProject = new Map<string, DocText[]>();
  for (const d of docs) byProject.set(d.projectId, [...(byProject.get(d.projectId) ?? []), d]);
  return {
    ...profile,
    projects: profile.projects.map((p) => ({
      ...p,
      facts: [...p.facts, ...(byProject.get(p.id) ?? []).map((d) => ({ id: d.id, text: d.text, skills: [], docName: d.name }))],
    })),
  };
}

/** Recorta os documentos para caber no prompt e informa o que foi cortado. */
export function docsForPrompt(docs: DocText[], totalBudget = DOCS_TOTAL_PROMPT_CHARS) {
  const perDoc = Math.min(DOC_PROMPT_CHARS, docs.length ? Math.floor(totalBudget / docs.length) : DOC_PROMPT_CHARS);
  const truncated: string[] = [];
  const out = docs.map((d) => {
    if (d.text.length <= perDoc) return d;
    truncated.push(d.name);
    return { ...d, text: `${d.text.slice(0, perDoc)}\n[… documento cortado: a IA leu os primeiros ${perDoc.toLocaleString("pt-BR")} caracteres]` };
  });
  return { docs: out, truncated };
}
