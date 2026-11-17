import { handle, json } from "@/lib/http";
import { getProfile, saveProfile } from "@/lib/store";
import { ProfileSchema } from "@/lib/types";

export const GET = () => handle(async () => json(await getProfile()));

export const PUT = (req: Request) =>
  handle(async () => {
    const profile = ProfileSchema.parse(await req.json());
    await saveProfile(profile);
    return json(profile);
  });
