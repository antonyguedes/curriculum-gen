import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AiSettingsSchema,
  PROVIDER_IDS,
  PROVIDERS,
  ProviderConfigSchema,
  type AiSettings,
  type ProviderConfig,
  type ProviderId,
  type PublicAiSettings,
} from "./catalog";

/** Configurações do motor de IA. Ficam em data/ (fora do git), só nesta máquina. */
const FILE = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "ai-settings.json");

export async function getAiSettings(): Promise<AiSettings> {
  try {
    return AiSettingsSchema.parse(JSON.parse(await fs.readFile(FILE, "utf8")));
  } catch {
    return AiSettingsSchema.parse({});
  }
}

export async function saveAiSettings(settings: AiSettings) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(AiSettingsSchema.parse(settings), null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, FILE);
}

export function providerConfig(settings: AiSettings, id: ProviderId): ProviderConfig {
  return ProviderConfigSchema.parse(settings.configs[id] ?? {});
}

/** Chave efetiva: a salva no app ou, na falta dela, a variável de ambiente do provedor. */
export function resolveKey(settings: AiSettings, id: ProviderId): string {
  const saved = providerConfig(settings, id).apiKey.trim();
  const env = PROVIDERS[id].keyEnv;
  return saved || (env ? (process.env[env] ?? "").trim() : "");
}

export function resolveBaseUrl(settings: AiSettings, id: ProviderId): string {
  return providerConfig(settings, id).baseUrl.trim() || PROVIDERS[id].baseUrl || "";
}

export function toPublic(settings: AiSettings): PublicAiSettings {
  const configs = {} as PublicAiSettings["configs"];
  for (const id of PROVIDER_IDS) {
    const c = providerConfig(settings, id);
    const env = PROVIDERS[id].keyEnv;
    const envKey = env ? (process.env[env] ?? "").trim() : "";
    configs[id] = {
      model: c.model,
      fastModel: c.fastModel,
      baseUrl: c.baseUrl,
      hasKey: !!(c.apiKey.trim() || envKey),
      keyHint: c.apiKey.trim() ? `…${c.apiKey.trim().slice(-4)}` : "",
      keyFromEnv: !c.apiKey.trim() && !!envKey,
    };
  }
  return { provider: settings.provider, configs };
}
