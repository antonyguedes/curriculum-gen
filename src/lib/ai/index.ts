import type { z } from "zod";
import { PROVIDERS, type ProviderId } from "./catalog";
import { InvalidAnswerError, extractJson, validate } from "./json";
import { askManual } from "./manual";
import { runProvider } from "./providers";
import { getAiSettings, providerConfig } from "./settings";

export { ManualRequired } from "./manual";

interface AskOptions<T extends z.ZodType> {
  /** Nome da etapa, mostrado no modo copiar e colar (ex.: "Análise da vaga"). */
  label: string;
  system: string;
  prompt: string;
  schema: T;
  /** Modelo escolhido na interface (quando o provedor permite escolher). */
  model?: string;
  /** Tarefa pequena: usa o modelo rápido/barato do provedor. */
  fast?: boolean;
}

function pickModel(id: ProviderId, config: { model: string; fastModel: string }, o: { model?: string; fast?: boolean }) {
  const info = PROVIDERS[id];
  if (!info.modelSelectable) return "";
  if (o.fast) return config.fastModel || info.fastModel || config.model || info.defaultModel || "";
  return o.model?.trim() || config.model || info.defaultModel || "";
}

/**
 * Única porta de entrada para a IA no app. Chama o motor configurado e devolve
 * um objeto validado pelo schema; uma resposta fora do formato ganha uma segunda tentativa.
 */
export async function askLLM<T extends z.ZodType>(o: AskOptions<T>): Promise<z.infer<T>> {
  const settings = await getAiSettings();
  const id = settings.provider;
  if (id === "manual") return validate(o.schema, await askManual(o));

  const model = pickModel(id, providerConfig(settings, id), o);
  if (PROVIDERS[id].modelSelectable && !model && id !== "antigravity-cli")
    throw new Error(`Escolha um modelo para ${PROVIDERS[id].label} nas configurações do motor de IA.`);

  const call = (prompt: string) => runProvider(id, settings, { ...o, prompt, model, fast: !!o.fast });
  const parse = (raw: unknown) => validate(o.schema, typeof raw === "string" ? extractJson(raw) : raw);
  try {
    return parse(await call(o.prompt));
  } catch (e) {
    if (!(e instanceof InvalidAnswerError)) throw e;
    const retry = `${o.prompt}\n\n---\nATENÇÃO: uma tentativa anterior não seguiu o formato pedido (${e.problems.join("; ")}). Responda de novo seguindo o schema à risca.`;
    return parse(await call(retry));
  }
}

/** O que o pipeline precisa saber sobre o motor atual. */
export async function aiMode() {
  const { provider } = await getAiSettings();
  return { provider, manual: provider === "manual", docsBudget: PROVIDERS[provider].docsBudget };
}
