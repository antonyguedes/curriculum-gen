import { Suspense } from "react";
import { Studio } from "@/components/Studio";

/** Tela única: a órbita do fluxo com o painel da etapa aberta (estado na URL). */
export default function Home() {
  return (
    <Suspense fallback={null}>
      <Studio />
    </Suspense>
  );
}
