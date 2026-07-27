import Link from "next/link";

/**
 * The public page — the only thing someone sees before they have an account.
 *
 * It replaces a redirect to the sign-in box. A product whose entire public
 * surface is a password field asks for trust before offering any reason to
 * give it, and this one is asking for something unusually personal: a whole
 * career, read as a curve.
 *
 * Three decisions hold the page together:
 *
 * **It leads with the refusal, not the feature.** "We never apply on your
 * behalf" and "we store no offer" are the promises that make the rest
 * credible, and everyone arriving here has been burned by a product that did
 * both. Stating them late reads as small print; stating them first reads as
 * the deal.
 *
 * **It does not pretend you can sign up.** This is a private beta with
 * sign-ups closed. A landing page with a hopeful button that leads to a wall
 * is worse than one that says plainly who it is for today — and the honest
 * alternative is real: the code is open, you can run it yourself.
 *
 * **It shows the staircase, because that is the whole idea.** People apply for
 * the job they already had, and no screenshot of a job list conveys why this
 * one is different.
 */
export function Landing() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-16 px-6 py-16 sm:py-24"
    >
      <section className="flex flex-col gap-6">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
          MissionPilot
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          On ne cherche pas un emploi à votre place.
          <br />
          On vous fait monter d&apos;une marche.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          Déposez votre CV. L&apos;IA lit votre parcours comme une{" "}
          <strong className="text-foreground font-medium">trajectoire</strong> —
          comment ont évolué votre périmètre, vos équipes, votre autonomie — et
          vous pose une question quand elle ne peut pas trancher.
        </p>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          Puis, à chaque connexion, elle vous montre ce que le marché a pour
          vous{" "}
          <strong className="text-foreground font-medium">maintenant</strong> :
          y compris le poste que vous n&apos;auriez pas osé demander, avec les
          preuves de votre propre parcours qui disent pourquoi vous êtes prêt.
        </p>
      </section>

      {/* The two refusals, first and in full size. They are the reason to trust
          everything below, so they are not a footnote. */}
      <section aria-labelledby="refus" className="flex flex-col gap-4">
        <h2 id="refus" className="sr-only">
          Ce que nous ne faisons pas
        </h2>
        <ul className="border-border flex flex-col gap-4 border-l-2 pl-5">
          <li>
            <p className="font-medium">Aucune offre n&apos;est stockée.</p>
            <p className="text-muted-foreground text-sm text-pretty">
              Chaque recherche interroge les plateformes en direct. Votre profil
              est la seule chose que nous gardons.
            </p>
          </li>
          <li>
            <p className="font-medium">
              Nous ne postulons jamais à votre place.
            </p>
            <p className="text-muted-foreground text-sm text-pretty">
              Vous cliquez, vous partez sur l&apos;annonce d&apos;origine, chez
              l&apos;employeur. Rien n&apos;est envoyé en votre nom.
            </p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="escalier" className="flex flex-col gap-6">
        <h2 id="escalier" className="text-2xl font-semibold tracking-tight">
          Pourquoi « une marche »
        </h2>
        <p className="text-muted-foreground text-pretty">
          Beaucoup de gens postulent au poste qu&apos;ils avaient déjà, parce
          que personne ne leur a jamais dit qu&apos;ils étaient prêts pour le
          suivant. C&apos;est ce plafond invisible que ce produit existe pour
          lever.
        </p>
        <div className="border-border flex flex-col gap-3 rounded-lg border p-5">
          <p className="text-sm font-semibold">
            La marche d&apos;après — Directeur de l&apos;expérience client
          </p>
          <p className="text-muted-foreground text-sm">
            Ces postes sont un cran au-dessus de votre niveau actuel. Votre
            parcours montre que vous pouvez les défendre.
          </p>
          <p className="text-muted-foreground border-border border-t pt-3 text-xs">
            Et quand le dossier ne dit pas assez pour trancher, l&apos;IA ne
            devine pas : elle pose la question. Deviner vers le haut coûte des
            mois de refus ; deviner vers le bas, c&apos;est le plafond lui-même.
          </p>
        </div>
      </section>

      <section aria-labelledby="honnete" className="flex flex-col gap-4">
        <h2 id="honnete" className="text-2xl font-semibold tracking-tight">
          Ce que vous verrez, et ce que vous ne verrez pas
        </h2>
        <p className="text-muted-foreground text-pretty">
          Quand une source ne dit pas le salaire, le contrat ou le télétravail,
          l&apos;offre l&apos;affiche comme{" "}
          <em className="text-foreground not-italic">non précisé</em> — et elle
          reste dans la liste. L&apos;écarter reviendrait à vous cacher une
          bonne offre parce que son annonceur est avare en détails.
        </p>
        <p className="text-muted-foreground text-pretty">
          Et quand une plateforme ne répond pas, le produit vous le dit au lieu
          de faire comme s&apos;il avait tout couvert.
        </p>
      </section>

      <section
        aria-labelledby="acces"
        className="border-border flex flex-col gap-4 border-t pt-10"
      >
        <h2 id="acces" className="text-2xl font-semibold tracking-tight">
          Y accéder
        </h2>
        <p className="text-muted-foreground text-pretty">
          MissionPilot est en <strong>bêta privée</strong> : les comptes sont
          créés par l&apos;administrateur et les inscriptions sont fermées. Il
          n&apos;y a donc rien à remplir ici, et ce serait vous faire perdre
          votre temps que de le prétendre.
        </p>
        <p className="text-muted-foreground text-pretty">
          En revanche le projet est <strong>open source</strong> : vous pouvez
          lire le code, et l&apos;héberger vous-même.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/login"
            className="border-border rounded-md border px-4 py-2 text-sm font-medium underline-offset-2 hover:underline"
          >
            J&apos;ai un compte — se connecter
          </Link>
          <a
            href="https://github.com/Christophevanengelen/missionpilot"
            target="_blank"
            rel="noopener"
            className="border-border rounded-md border px-4 py-2 text-sm font-medium underline-offset-2 hover:underline"
          >
            Voir le code
          </a>
        </div>
      </section>
    </main>
  );
}
