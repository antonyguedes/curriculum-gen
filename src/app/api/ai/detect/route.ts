import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/lib/ai/catalog";
import { cliVersion } from "@/lib/ai/cli";
import { getAiSettings, resolveBaseUrl } from "@/lib/ai/settings";
import { handle, json } from "@/lib/http";

/** O que está disponível nesta máquina: agentes instalados e Ollama rodando. */
export const GET = () =>
  handle(async () => {
    const agents = PROVIDER_IDS.filter((id) => PROVIDERS[id].bin);
    const versions = await Promise.all(agents.map((id) => cliVersion(id)));
    const installed = Object.fromEntries(agents.map((id, i) => [id, versions[i]])) as Partial<Record<ProviderId, string | null>>;

    const settings = await getAiSettings();
    const base = resolveBaseUrl(settings, "ollama").replace(/\/+$/, "");
    let ollama: { running: boolean; models: string[] } = { running: false, models: [] };
    try {
      const res = await fetch(`${base}/models`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = (await res.json()) as { data?: { id: string }[] };
        ollama = { running: true, models: (data.data ?? []).map((m) => m.id) };
      }
    } catch {
      /* não está rodando */
    }
    return json({ installed, ollama });
  });
