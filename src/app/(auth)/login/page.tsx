import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionClaims } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "MissionPilot — on vous fait monter d'une marche",
  description:
    "Déposez votre CV. On lit votre parcours comme une trajectoire et, à chaque connexion, on vous montre ce que le marché a pour vous — y compris le poste d'un cran au-dessus.",
};

/**
 * The only public surface of the product.
 *
 * It used to be a bare sign-in box announcing that sign-ups were disabled —
 * the single screen anyone can reach without an account, and it said nothing
 * about what this is for. A private beta is a reason to explain yourself more
 * carefully, not less: the person in front of it either already believes in
 * the product or is about to decide whether to.
 *
 * So the promise sits beside the form, in the owner's own terms, with the two
 * refusals stated up front rather than buried. What we will NOT do — store
 * offers, apply on someone's behalf — is as much of the pitch as what we will,
 * because everyone arriving here has been burned by a product that did both.
 */
export default async function LoginPage() {
  const session = await getSessionClaims();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center p-6"
    >
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1.1fr_auto]">
        <section className="flex flex-col gap-5">
          <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
            MissionPilot
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            On ne cherche pas un emploi à votre place.
            <br />
            On vous fait monter d&apos;une marche.
          </h1>
          <p className="text-muted-foreground text-base text-pretty">
            Déposez votre CV. L&apos;IA lit votre parcours comme une{" "}
            <strong className="text-foreground font-medium">trajectoire</strong>{" "}
            — comment ont évolué votre périmètre, vos équipes, votre autonomie —
            et vous pose une question quand elle ne peut pas trancher.
          </p>
          <p className="text-muted-foreground text-base text-pretty">
            Puis, à chaque connexion, elle vous montre ce que le marché a pour
            vous{" "}
            <strong className="text-foreground font-medium">maintenant</strong>{" "}
            : y compris le poste que vous n&apos;auriez pas osé demander, avec
            les preuves de votre propre parcours qui disent pourquoi vous êtes
            prêt.
          </p>

          {/* The refusals, stated plainly. They are the reason to trust the
              rest, so they are not a footnote in a legal page. */}
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            <li>
              <span aria-hidden="true" className="mr-2">
                —
              </span>
              Aucune offre n&apos;est stockée. Votre profil est la seule chose
              que nous gardons.
            </li>
            <li>
              <span aria-hidden="true" className="mr-2">
                —
              </span>
              Nous ne postulons jamais à votre place. Vous cliquez, vous partez
              sur l&apos;annonce d&apos;origine.
            </li>
          </ul>
        </section>

        <Card className="border-border/70 shadow-floating w-full md:w-sm">
          <CardHeader>
            <CardTitle>
              <h2 className="text-base leading-none font-semibold">
                Se connecter
              </h2>
            </CardTitle>
            <CardDescription>
              Bêta privée : les comptes sont créés par l&apos;administrateur,
              les inscriptions sont fermées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
