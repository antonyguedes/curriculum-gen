import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ManualRequired } from "./ai";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function fail(e: unknown, status = 500) {
  // Modo copiar e colar: não é erro, é um pedido para o usuário responder com a IA dele.
  if (e instanceof ManualRequired) return json({ manual: e.request }, 409);
  if (e instanceof ZodError) return json({ error: "Dados inválidos.", details: e.issues }, 400);
  const message = e instanceof Error ? e.message : String(e);
  return json({ error: message }, status);
}

/** Envolve um handler devolvendo erros como JSON legível pela UI. */
export const handle = async (fn: () => Promise<Response>) => {
  try {
    return await fn();
  } catch (e) {
    return fail(e);
  }
};
