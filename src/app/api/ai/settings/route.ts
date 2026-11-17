import { z } from "zod";
import { PROVIDER_IDS, ProviderIdSchema } from "@/lib/ai/catalog";
import { getAiSettings, providerConfig, saveAiSettings, toPublic } from "@/lib/ai/settings";
import { handle, json } from "@/lib/http";

export const GET = () => handle(async () => json(toPublic(await getAiSettings())));

const Body = z.object({
  provider: ProviderIdSchema,
  configs: z
    .partialRecord(
      z.enum(PROVIDER_IDS),
      z.object({
        /** ausente = mantém a chave salva; "" = apaga; texto = nova chave */
        apiKey: z.string().optional(),
        model: z.string().optional(),
        fastModel: z.string().optional(),
        baseUrl: z.string().optional(),
      }),
    )
    .default({}),
});

export const PUT = (req: Request) =>
  handle(async () => {
    const body = Body.parse(await req.json());
    const settings = await getAiSettings();
    settings.provider = body.provider;
    for (const [id, patch] of Object.entries(body.configs)) {
      const current = providerConfig(settings, id as (typeof PROVIDER_IDS)[number]);
      settings.configs[id] = {
        apiKey: patch.apiKey === undefined ? current.apiKey : patch.apiKey.trim(),
        model: (patch.model ?? current.model).trim(),
        fastModel: (patch.fastModel ?? current.fastModel).trim(),
        baseUrl: (patch.baseUrl ?? current.baseUrl).trim(),
      };
    }
    await saveAiSettings(settings);
    return json(toPublic(settings));
  });
