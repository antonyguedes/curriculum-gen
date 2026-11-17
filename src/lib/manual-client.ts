import type { ManualRequest } from "./ai/catalog";

/**
 * Ponte do modo copiar e colar no navegador. O modal (ManualBridge) registra o handler;
 * quem recebe um pedido manual chama requestManual e espera o usuário responder.
 */
type Handler = (req: ManualRequest) => Promise<void>;
let handler: Handler | null = null;

export function setManualHandler(h: Handler | null) {
  handler = h;
}

export class ManualCancelled extends Error {
  constructor() {
    super("Etapa manual cancelada.");
  }
}

export function requestManual(req: ManualRequest): Promise<void> {
  if (!handler) return Promise.reject(new Error("O modo copiar e colar não está disponível nesta tela."));
  return handler(req);
}
