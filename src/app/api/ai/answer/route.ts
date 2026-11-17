import { z } from "zod";
import { InvalidAnswerError } from "@/lib/ai/json";
import { submitManualAnswer } from "@/lib/ai/manual";
import { handle, json } from "@/lib/http";

const Body = z.object({ id: z.string(), answer: z.string().min(2, "Cole a resposta da IA.") });

/** Recebe a resposta colada no modo copiar e colar e a valida contra o formato esperado. */
export const POST = (req: Request) =>
  handle(async () => {
    const { id, answer } = Body.parse(await req.json());
    try {
      await submitManualAnswer(id, answer);
      return json({ ok: true });
    } catch (e) {
      if (e instanceof InvalidAnswerError) return json({ error: e.message, problems: e.problems }, 422);
      throw e;
    }
  });
