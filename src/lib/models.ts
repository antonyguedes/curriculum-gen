/** Aliases de modelo aceitos pelo Claude Code (`claude --model <alias>`). */
export const MODELS = ["opus", "sonnet", "haiku", "fable"] as const;
export type ModelAlias = (typeof MODELS)[number];

export const MODEL_LABELS: Record<ModelAlias, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
  fable: "Fable",
};
