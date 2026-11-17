import { z } from "zod";

/**
 * Catálogo dos motores de IA suportados. Módulo puro (sem Node): usado pelo servidor
 * e pela tela de configurações.
 */

export const PROVIDER_IDS = [
  "claude-code",
  "codex-cli",
  "antigravity-cli",
  "gemini-cli",
  "anthropic",
  "openai",
  "gemini-api",
  "openrouter",
  "openai-compatible",
  "ollama",
  "manual",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
export const ProviderIdSchema = z.enum(PROVIDER_IDS);

export type ProviderGroup = "agent" | "api" | "local" | "manual";

export interface ProviderInfo {
  label: string;
  group: ProviderGroup;
  description: string;
  /** Binário de CLI (agentes locais). */
  bin?: string;
  /** Como instalar quando o binário não existe. */
  install?: string;
  docsUrl?: string;
  /** API: precisa de chave? (`optional` = só alguns servidores pedem) */
  key?: "required" | "optional";
  keyEnv?: string;
  keyUrl?: string;
  /** Endpoint compatível com a API da OpenAI. */
  baseUrl?: string;
  baseUrlEditable?: boolean;
  /** Modelos sugeridos (a lista real pode ser carregada da API). */
  models?: string[];
  defaultModel?: string;
  /** Modelo mais barato para tarefas pequenas (classificação). */
  fastModel?: string;
  /** Dá para escolher o modelo? */
  modelSelectable: boolean;
  /** Dá para listar os modelos disponíveis pela API? */
  listModels?: boolean;
  /** Quanto texto de documentos de projeto cabe em uma chamada. */
  docsBudget: number;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  "claude-code": {
    label: "Claude Code",
    group: "agent",
    description: "Usa o login do Claude Code instalado (assinatura Claude Pro/Max ou chave).",
    bin: "claude",
    install: "npm install -g @anthropic-ai/claude-code",
    docsUrl: "https://code.claude.com/docs",
    models: ["opus", "sonnet", "haiku", "fable"],
    defaultModel: "opus",
    fastModel: "haiku",
    modelSelectable: true,
    docsBudget: 150_000,
  },
  "codex-cli": {
    label: "Codex CLI",
    group: "agent",
    description: "Agente da OpenAI. Usa o login do Codex (conta ChatGPT ou chave OpenAI).",
    bin: "codex",
    install: "npm install -g @openai/codex",
    docsUrl: "https://developers.openai.com/codex",
    modelSelectable: false,
    docsBudget: 150_000,
  },
  "antigravity-cli": {
    label: "Antigravity CLI",
    group: "agent",
    description: "Agente do Google (sucessor do Gemini CLI). Usa o login Google do agy.",
    bin: "agy",
    docsUrl: "https://antigravity.google/docs/cli",
    modelSelectable: true,
    docsBudget: 50_000, // prompt vai como argumento: o Linux limita cada argumento a 128 KB
  },
  "gemini-cli": {
    label: "Gemini CLI (legado)",
    group: "agent",
    description: "Para quem ainda usa o Gemini CLI. O Google o substituiu pelo Antigravity CLI.",
    bin: "gemini",
    install: "npm install -g @google/gemini-cli",
    docsUrl: "https://geminicli.com/docs/cli/headless/",
    modelSelectable: false,
    docsBudget: 50_000,
  },
  anthropic: {
    label: "Anthropic API",
    group: "api",
    description: "Modelos Claude pela API oficial, cobrados por uso.",
    key: "required",
    keyEnv: "ANTHROPIC_API_KEY",
    keyUrl: "https://platform.claude.com/",
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"],
    defaultModel: "claude-opus-5-5",
    fastModel: "claude-haiku-5-5",
    modelSelectable: true,
    listModels: true,
    docsBudget: 150_000,
  },
  openai: {
    label: "OpenAI API",
    group: "api",
    description: "Modelos GPT pela API oficial, cobrados por uso.",
    key: "required",
    keyEnv: "OPENAI_API_KEY",
    keyUrl: "https://platform.openai.com/api-keys",
    modelSelectable: true,
    listModels: true,
    docsBudget: 150_000,
  },
  "gemini-api": {
    label: "Google Gemini API",
    group: "api",
    description: "Modelos Gemini com chave do Google AI Studio (há cota gratuita).",
    key: "required",
    keyEnv: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    modelSelectable: true,
    listModels: true,
    docsBudget: 150_000,
  },
  openrouter: {
    label: "OpenRouter",
    group: "api",
    description: "Uma chave para centenas de modelos: Claude, GPT, Gemini, Llama, DeepSeek, Qwen e outros (inclusive gratuitos).",
    key: "required",
    keyEnv: "OPENROUTER_API_KEY",
    keyUrl: "https://openrouter.ai/keys",
    baseUrl: "https://openrouter.ai/api/v1",
    modelSelectable: true,
    listModels: true,
    docsBudget: 150_000,
  },
  "openai-compatible": {
    label: "Outra API compatível",
    group: "api",
    description: "Qualquer serviço com API no padrão OpenAI: Groq, DeepSeek, Mistral, Together, LM Studio, vLLM…",
    key: "optional",
    baseUrlEditable: true,
    modelSelectable: true,
    listModels: true,
    docsBudget: 100_000,
  },
  ollama: {
    label: "Ollama",
    group: "local",
    description: "Modelos abertos rodando no seu computador: grátis, offline e privado.",
    docsUrl: "https://ollama.com/download",
    baseUrl: "http://localhost:11434/v1",
    baseUrlEditable: true,
    modelSelectable: true,
    listModels: true,
    docsBudget: 40_000, // modelos locais costumam ter contexto menor
  },
  manual: {
    label: "Copiar e colar",
    group: "manual",
    description: "Sem integração: o app gera o prompt, você cola no site da IA que preferir e traz a resposta de volta.",
    modelSelectable: false,
    docsBudget: 30_000, // chats na web têm limite de mensagem
  },
};

export const GROUP_LABELS: Record<ProviderGroup, string> = {
  agent: "Agentes locais · usam o seu login",
  api: "APIs · com chave",
  local: "No seu computador",
  manual: "Qualquer chat de IA na web",
};

/** Sites onde o modo copiar e colar funciona. */
export const CHAT_SITES = [
  { name: "ChatGPT", url: "https://chatgpt.com/" },
  { name: "Claude", url: "https://claude.ai/new" },
  { name: "Gemini", url: "https://gemini.google.com/app" },
  { name: "Copilot", url: "https://copilot.microsoft.com/" },
  { name: "DeepSeek", url: "https://chat.deepseek.com/" },
  { name: "Grok", url: "https://grok.com/" },
  { name: "Mistral", url: "https://chat.mistral.ai/" },
  { name: "Perplexity", url: "https://www.perplexity.ai/" },
];

/* ───────────── Configurações ───────────── */

export const ProviderConfigSchema = z.object({
  apiKey: z.string().default(""),
  model: z.string().default(""),
  fastModel: z.string().default(""),
  baseUrl: z.string().default(""),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const AiSettingsSchema = z.object({
  provider: ProviderIdSchema.default("claude-code"),
  configs: z.record(z.string(), ProviderConfigSchema).default({}),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

/** Versão das configurações que vai para a interface: chaves nunca saem do servidor. */
export interface PublicProviderConfig {
  model: string;
  fastModel: string;
  baseUrl: string;
  hasKey: boolean;
  keyHint: string;
  keyFromEnv: boolean;
}
export interface PublicAiSettings {
  provider: ProviderId;
  configs: Record<ProviderId, PublicProviderConfig>;
}

/** Pedido de resposta no modo copiar e colar. */
export interface ManualRequest {
  id: string;
  label: string;
  prompt: string;
  chars: number;
}
