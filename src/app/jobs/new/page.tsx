import { redirect } from "next/navigation";

/** A nova vaga agora abre como etapa da órbita. */
export default function NewJobRedirect() {
  redirect("/?step=vaga&novo=1");
}
