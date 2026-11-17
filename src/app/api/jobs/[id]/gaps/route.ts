import { z } from "zod";
import { handle, json } from "@/lib/http";
import { formsFor } from "@/lib/taxonomy";
import { getProfile, saveProfile } from "@/lib/store";
import { uid } from "@/lib/types";

const Body = z.object({
  requirement: z.string().min(1),
  text: z.string().min(10, "Descreva onde e como você usou (ao menos uma frase)."),
  targetId: z.string().default(""),
});

/** Gap filling: a resposta do usuário vira um fato do perfil mestre e passa a valer para todas as vagas. */
export const POST = (req: Request) =>
  handle(async () => {
    const { requirement, text, targetId } = Body.parse(await req.json());
    const profile = await getProfile();
    const fact = { id: uid("f"), text: text.trim(), skills: [requirement] };

    const exp = profile.experiences.find((e) => e.id === targetId);
    const proj = profile.projects.find((p) => p.id === targetId);
    const edu = profile.education.find((e) => e.id === targetId);
    if (exp) exp.facts.push(fact);
    else if (proj) proj.facts.push(fact);
    else if (edu) edu.facts.push(fact);
    else profile.extraFacts.push(fact);

    const forms = formsFor(requirement);
    const known = profile.skills.some((s) => formsFor(s.name, s.aliases).some((f) => forms.includes(f)));
    if (!known) profile.skills.push({ id: uid("sk"), name: requirement, aliases: [], level: "" });

    await saveProfile(profile);
    return json({ ok: true });
  });
