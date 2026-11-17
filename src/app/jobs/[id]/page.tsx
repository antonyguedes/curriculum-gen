import { redirect } from "next/navigation";

/** Links antigos de vaga levam à etapa equivalente da órbita. */
export default async function JobRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const step = tab === "gerar" ? "gerar" : tab === "editor" ? "verificar" : "vaga";
  redirect(`/?step=${step}&job=${encodeURIComponent(id)}`);
}
