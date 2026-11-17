import { handle, json } from "@/lib/http";
import { computeCoverage, yearsOfExperience } from "@/lib/matching";
import { withDocuments } from "@/lib/documents";
import { deleteJob, getJob, getProfile, getProfileDocs } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const job = await getJob((await params).id);
    if (!job) return json({ error: "Vaga não encontrada." }, 404);
    const profile = await getProfile();
    const evidence = withDocuments(profile, await getProfileDocs(profile));
    return json({
      job,
      // A cobertura é sempre recalculada: reflete o perfil atual, inclusive lacunas recém-preenchidas.
      coverage: computeCoverage(evidence, job.analysis, job.adjacency),
      years: yearsOfExperience(profile),
      targets: [
        ...profile.experiences.map((e) => ({ id: e.id, label: `${e.title} — ${e.company}` })),
        ...profile.projects.map((p) => ({ id: p.id, label: `Projeto: ${p.name}` })),
        ...profile.education.map((e) => ({ id: e.id, label: `Formação: ${e.degree}` })),
      ],
      profileReady: !!profile.contact.name.trim() && profile.experiences.length + profile.projects.length > 0,
    });
  });

export const DELETE = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    await deleteJob((await params).id);
    return json({ ok: true });
  });
