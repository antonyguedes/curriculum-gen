import { z } from "zod";
import { ProviderIdSchema } from "@/lib/ai/catalog";
import { listModels } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { handle, json } from "@/lib/http";

const Body = z.object({ provider: ProviderIdSchema, apiKey: z.string().optional(), baseUrl: z.string().optional() });

/** Lista os modelos da conta/servidor. Aceita chave e URL ainda não salvas (para testar antes). */
export const POST = (req: Request) =>
  handle(async () => {
    const body = Body.parse(await req.json());
    const settings = await getAiSettings();
    const current = settings.configs[body.provider] ?? { apiKey: "", model: "", fastModel: "", baseUrl: "" };
    settings.configs[body.provider] = {
      ...current,
      apiKey: body.apiKey?.trim() || current.apiKey,
      baseUrl: body.baseUrl?.trim() || current.baseUrl,
    };
    return json({ models: await listModels(body.provider, settings) });
  });
