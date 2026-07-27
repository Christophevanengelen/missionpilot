import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

/**
 * Rend un document juridique versionné dans `content/legal/`.
 *
 * POURQUOI UNE DÉPENDANCE ICI, DANS UN DÉPÔT QUI LES PROSCRIT. Le contenu est
 * du Markdown avec des tableaux — durées de conservation, destinataires,
 * cookies. Écrire à la main le parseur qui les rend, dans un document où une
 * ligne mal rendue est un problème de conformité, aurait été le mauvais endroit
 * pour économiser une dépendance. `marked` n'en a aucune.
 *
 * Le contenu n'est PAS de la saisie utilisateur : il vient du dépôt, il est
 * relu en revue, et il est versionné. Aucune désinfection n'est donc nécessaire
 * — et si un jour ces documents devenaient éditables ailleurs que dans un
 * commit, cette phrase deviendrait fausse et il faudrait en assainir la sortie.
 *
 * Lecture au BUILD, jamais à l'exécution : les pages qui l'utilisent sont
 * statiques, donc le fichier est lu une fois à la compilation et le HTML est
 * figé. Le serveur n'ouvre aucun fichier pour répondre.
 */
export function LegalDocument({ fichier }: { fichier: string }) {
  const source = readFileSync(
    join(process.cwd(), "content", "legal", fichier),
    "utf8",
  );
  const html = marked.parse(source, { async: false, gfm: true });

  return (
    <main
      id="main"
      tabIndex={-1}
      /* `break-words` est posé ICI, sur l'ancêtre, parce que `overflow-wrap`
         s'hérite : toute la descendance en bénéficie, y compris les mots longs
         du corps de texte que je n'aurais pas pensé à cibler.
         Ce n'est pas une précaution théorique — la version qui ne visait que
         les liens et le code passait sur macOS et échouait sur Linux en CI, à
         320 px, parce que les métriques de police diffèrent. Viser les
         constructions une par une, c'est parier sur la police du relecteur. */
      className="mx-auto w-full max-w-3xl px-6 py-16 break-words"
    >
      {/* La typographie est portée ici plutôt que par des classes dans le
          Markdown : le document doit rester lisible tel quel dans le dépôt,
          en revue et en diff. */}
      <div
        /* `[&_a]:break-words` n'est pas cosmétique : ce document cite des URL
           de dépôt et d'autorité de contrôle qui dépassent la largeur d'un
           téléphone. Sans lui, la page entière défile latéralement — et une
           politique qu'on lit de travers est une politique qu'on ne lit pas.
           Les tableaux, eux, défilent DANS leur propre conteneur. */
        className="[&_a]:underline-offset-4 [&_h2]:border-border flex min-w-0 flex-col gap-4 [&>*]:min-w-0 [&_a]:break-words [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_code]:break-all [&_code]:text-[0.9em] [&_h1]:mt-2 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-10 [&_h2]:border-t [&_h2]:pt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_hr]:hidden [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-pretty [&_strong]:font-semibold [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-sm [&_td]:border-border [&_td]:border-t [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_th]:pr-4 [&_th]:pb-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
