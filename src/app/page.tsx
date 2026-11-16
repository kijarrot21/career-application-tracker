import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getOptionalUser();
  if (user) {
    redirect("/dashboard");
  }
  redirect("/sign-in");
}
