import { requestManual } from "./manual-client";

/**
 * fetch tipado para a UI: lança Error com a mensagem da API.
 * No modo copiar e colar, a API responde 409 com um pedido manual: o usuário responde
 * no modal e a mesma requisição é refeita automaticamente, quantas vezes for preciso.
 */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  for (;;) {
    const res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const data = await res.json().catch(() => null);
    if (res.status === 409 && data?.manual) {
      await requestManual(data.manual);
      continue;
    }
    if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
    return data as T;
  }
}
