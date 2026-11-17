import { z } from "zod";
import { handle, json } from "@/lib/http";
import { analyzeJob, findAdjacency } from "@/lib/pipeline";
import { getProfile, getProfileDocs, listJobs, saveJob } from "@/lib/store";
import { uid, type JobPosting } from "@/lib/types";

export const GET = () =>
  handle(async () =>
    json(
      (await listJobs()).map((j) => ({
        id: j.id,
        createdAt: j.createdAt,
        title: j.analysis.job_title,
        company: j.analysis.company,
        language: j.analysis.language,
        versions: j.versions.length,
        bestScore: j.versions.length ? Math.max(...j.versions.map((v) => v.evaluation.score.total)) : null,
        reviewed: j.versions.some((v) => !!v.reviewedAt),
        downloaded: j.versions.some((v) => !!v.downloadedAt),
      })),
    ),
  );

const Body = z.object({ rawText: z.string().min(80, "Cole o texto completo da vaga."), url: z.string().default("") });

export const POST = (req: Request) =>
  handle(async () => {
    const { rawText, url } = Body.parse(await req.json());
    const analysis = await analyzeJob(rawText);
    const profile = await getProfile();
    const adjacency = await findAdjacency(profile, analysis, await getProfileDocs(profile));
    const job: JobPosting = { id: uid("job"), createdAt: new Date().toISOString(), rawText, url, analysis, adjacency, versions: [] };
    await saveJob(job);
    return json({ id: job.id });
  });
