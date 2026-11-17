import { redirect } from "next/navigation";

/** O perfil agora abre como etapa da órbita. */
export default function ProfileRedirect() {
  redirect("/?step=perfil");
}
