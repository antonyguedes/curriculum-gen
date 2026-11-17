import { z } from "zod";
import { askLLM } from "@/lib/ai";
import { PROVIDERS } from "@/lib/ai/catalog";
import { getAiSettings } from "@/lib/ai/settings";
import { handle, json } from "@/lib/http";

const Ping = z.object({ ok: z.boolean(), mensagem: z.string() });

/** Faz uma chamada mínima com o motor salvo e mede o tempo. */
export const POST = () =>
  handle(async () => {
    const { provider } = await getAiSettings();
    if (provider === "manual") return json({ ok: true, ms: 0, message: "No modo copiar e colar não há conexão para testar." });
    const t = Date.now();
    const r = await askLLM({
      label: "Teste de conexão",
      fast: true,
      system: "Você responde apenas com o JSON pedido.",
      prompt: 'Responda com ok = true e mensagem = "conectado".',
      schema: Ping,
    });
    return json({ ok: r.ok, ms: Date.now() - t, message: `${PROVIDERS[provider].label} respondeu em ${((Date.now() - t) / 1000).toFixed(1)} s.` });
  });
