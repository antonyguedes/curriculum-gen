import { z } from "zod";
import { evaluate } from "@/lib/evaluate";
import { handle, json } from "@/lib/http";
import { withDocuments } from "@/lib/documents";
import { getJob, getProfile, getProfileDocs, saveJob } from "@/lib/store";
import { CoverLetterSchema, TailoredResumeSchema, TemplateSchema } from "@/lib/types";

type Ctx = { params: Promise<{ id: string; vid: string }> };

const Body = z.object({
  resume: TailoredResumeSchema.optional(),
  coverLetter: CoverLetterSchema.nullable().optional(),
  template: TemplateSchema.optional(),
});

/** Salva as edições do usuário e devolve a versão reavaliada (score, grounding, parse). */
export const PUT = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const { id, vid } = await params;
    const body = Body.parse(await req.json());
    const [job, profile] = await Promise.all([getJob(id), getProfile()]);
    const version = job?.versions.find((v) => v.id === vid);
    if (!job || !version) return json({ error: "Versão não encontrada." }, 404);

    if (body.resume) version.resume = body.resume;
    if (body.template) version.template = body.template;
    if (body.coverLetter !== undefined) version.coverLetter = body.coverLetter;
    const evidence = withDocuments(profile, await getProfileDocs(profile));
    version.evaluation = await evaluate(evidence, job.analysis, version.resume, version.template, job.adjacency, version.coverLetter);
    await saveJob(job);
    return json(version);
  });

export const DELETE = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const { id, vid } = await params;
    const job = await getJob(id);
    if (!job) return json({ error: "Vaga não encontrada." }, 404);
    job.versions = job.versions.filter((v) => v.id !== vid);
    await saveJob(job);
    return json({ ok: true });
  });
