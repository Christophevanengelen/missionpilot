import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { PERSONAL_TABLES, type PersonalTable } from "@/domain/account";
import type { Empreinte, SectionsLues } from "@/lib/account/export";

/**
 * Lecture du compte — empreinte et export.
 *
 * TOUT passe par le client de SESSION, jamais par le client de service. La RLS
 * est ici la garantie qu'on ne rend à personne les lignes d'un autre : le code
 * ne filtre pas par `user_id`, il n'en a pas besoin, et c'est précisément ce
 * qui le rend sûr. Un client à clé secrète dans un chemin de lecture
 * utilisateur transformerait une erreur de filtre en fuite de données.
 */
type Client = SupabaseClient<Database>;

/**
 * Combien de lignes, table par table.
 *
 * `head: true` avec `count: "exact"` : on demande le compte sans rapatrier une
 * seule ligne. L'écran a besoin d'un nombre, pas du contenu — et le contenu
 * d'un compte entier n'a rien à faire dans la mémoire d'une page qui ne fait
 * que l'annoncer.
 *
 * Une table qui échoue rend `undefined` plutôt que zéro. Zéro se lirait comme
 * « vous n'avez rien ici », ce qui est faux et rassurant au mauvais moment.
 */
export async function loadAccountFootprint(client: Client): Promise<Empreinte> {
  const empreinte: Empreinte = {};

  await Promise.all(
    PERSONAL_TABLES.map(async (table) => {
      const { count, error } = await client
        .from(table)
        .select("*", { count: "exact", head: true });
      if (!error && typeof count === "number") {
        empreinte[table] = count;
      }
    }),
  );

  return empreinte;
}

/**
 * Le contenu, pour l'export.
 *
 * Une table qui échoue reste ABSENTE du résultat — elle n'est pas mise à `[]`.
 * `buildAccountExport` s'en sert pour la signaler dans `sectionsNonLues` : sans
 * cette distinction, un export partiel se présenterait comme complet, et
 * l'absence se lirait comme un zéro.
 */
export async function readAccountData(client: Client): Promise<SectionsLues> {
  const sections: SectionsLues = {};

  await Promise.all(
    PERSONAL_TABLES.map(async (table) => {
      const { data, error } = await client.from(table).select("*");
      if (!error && Array.isArray(data)) {
        sections[table as PersonalTable] = data;
      }
    }),
  );

  return sections;
}
