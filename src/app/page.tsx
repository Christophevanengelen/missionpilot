import { redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/auth/dal";

/**
 * The root has no page of its own.
 *
 * It used to hold a SECOND public landing page, in English, describing a
 * product that no longer exists — "opportunity intelligence for senior
 * freelancers: discover, evaluate and prepare". Two public faces saying
 * different things is worse than one saying nothing: whichever a visitor lands
 * on, the other one is lying about the same product.
 *
 * The promise now lives on the sign-in screen, which is where anyone without
 * an account ends up anyway.
 */
export default async function RootPage() {
  const session = await getSessionClaims();
  redirect(session ? "/dashboard" : "/login");
}
