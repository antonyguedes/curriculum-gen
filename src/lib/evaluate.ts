import { checkGrounding, checkLetter } from "./grounding";
import { renderDocx } from "./render/docx";
import { buildResumeDoc, STYLES } from "./render/model";
import { renderPdf } from "./render/pdf";
import { computeScore } from "./scoring";
import type { Adjacency, CoverLetter, Evaluation, JobAnalysis, Profile, TailoredResume, Template } from "./types";
import { validateParse } from "./validate";

/** Avaliação completa de uma versão: grounding + parse-back dos arquivos reais + score. */
export async function evaluate(
  profile: Profile,
  analysis: JobAnalysis,
  resume: TailoredResume,
  template: Template,
  adjacency: Adjacency = [],
  letter: CoverLetter | null = null,
): Promise<Evaluation> {
  const doc = buildResumeDoc(resume, profile.contact, analysis.job_title);
  const style = STYLES[template];
  const [pdf, docx] = await Promise.all([renderPdf(doc, style), renderDocx(doc, style)]);
  const parse = await validateParse(doc, pdf, docx);
  const grounding = checkGrounding(profile, analysis, resume, adjacency);
  const score = computeScore(profile, analysis, resume, parse, grounding);
  return { score, grounding, parse, letter: letter ? checkLetter(profile, analysis, letter, adjacency) : [] };
}
