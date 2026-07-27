# Ce qu'il reste à faire à la main

Tout ce qui suit demande **un compte, une signature ou une carte** — c'est-à-dire
des choses qu'un agent ne fait pas à votre place. Le code correspondant est
déjà écrit et testé : chaque étape ci-dessous **allume** une fonctionnalité qui
attend déjà.

Ordre volontaire : chaque étape débloque la suivante.

---

## 1. Service d'envoi d'e-mails — débloque DEUX fonctionnalités

**Pourquoi maintenant :** sans lui, le service intégré de Supabase plafonne à
**deux e-mails par heure**. Avec la connexion par lien magique, cela veut dire
deux personnes par heure, et un échec **silencieux** pour toutes les autres —
elles attendent un e-mail qui ne partira jamais et concluent que le produit est
cassé.

Il débloque à la fois **la connexion par lien magique** et **le digest
hebdomadaire**.

1. Créer un compte sur **Resend** (`resend.com`) — l'offre gratuite suffit pour
   commencer. Postmark ou SendGrid conviennent aussi.
2. Y ajouter le domaine **`hi-def.be`**, puis poser chez votre registrar les
   enregistrements DNS fournis (**SPF** et **DKIM**). Sans eux, les e-mails
   partent en indésirables — ce qui, pour un lien de connexion, équivaut à ne
   pas les envoyer.
3. Récupérer les identifiants SMTP.
4. Dans le tableau de bord Supabase → **Project Settings → Authentication →
   SMTP Settings** : activer le SMTP personnalisé et coller ces identifiants.

> Ne me collez jamais ces identifiants dans une conversation. Ils se saisissent
> directement dans les deux interfaces concernées.

---

## 2. Ouvrir les inscriptions — deux réglages, deux minutes

**À savoir, parce que c'est contre-intuitif :** `supabase/config.toml` dans le
dépôt ne pilote **que la pile locale**. La CI ne fait que `supabase db push`,
jamais `supabase config push`. Les réglages d'authentification du projet en
ligne vivent **uniquement** dans le tableau de bord.

Dans le tableau de bord Supabase du projet `etnshuiduinewpcrrskb` :

1. **Authentication → Sign In / Providers** → activer _« Allow new users to
   sign up »_.
2. **Authentication → URL Configuration → Redirect URLs** → ajouter
   `https://missionpilot.vercel.app/auth/confirm`.

Le second point n'est pas optionnel : sans lui, Supabase **ignore
silencieusement** l'adresse de retour demandée par le code et renvoie les gens
à l'accueil sans jamais créer de session. C'est le piège qui a été diagnostiqué
en local en suivant un vrai lien.

Une fois ces deux réglages faits, prévenez-moi : la page d'accueil annonce
encore « bêta privée, inscriptions fermées », et cette phrase doit sauter le
même jour.

---

## 3. LinkedIn — allumer « Remplir avec LinkedIn »

La page entreprise **Hi-DEF** est revendiquée, ce qui débloque la voie.

1. Sur `linkedin.com/developers/apps`, créer une **seconde application**, liée
   cette fois à la page **Hi-DEF**.
   _L'application existante ne peut pas servir : elle est liée de façon
   irréversible à la page par défaut de LinkedIn._
2. Onglet **Products** → demander **Member Data Portability API (3rd Party)**.
3. Remplir le formulaire de vérification d'entreprise :

   | Champ                | Valeur                             |
   | -------------------- | ---------------------------------- |
   | Nom légal            | Hi-DEF                             |
   | Adresse              | Ixelles, Bruxelles                 |
   | Site web             | `https://christophevanengelen.com` |
   | E-mail professionnel | `cve@hi-def.be`                    |

   L'e-mail doit être sur un domaine professionnel — la documentation exclut
   explicitement les adresses personnelles type gmail. `hi-def.be` convient.

4. Attendre la revue de LinkedIn.
5. Une fois approuvé, poser dans Vercel : `LINKEDIN_CLIENT_ID`,
   `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ENABLED=true`.

Tant que ces trois variables sont absentes, le bouton **n'apparaît pas** et
l'onboarding ne propose que le dépôt d'archive — c'est voulu : un bouton
visible menant à une erreur de configuration se paierait sur le premier écran.

---

## 4. Vercel — une variable oubliée

`REMOTEOK_ENABLED=true`

Le connecteur est écrit, testé et fusionné depuis plusieurs jours, mais reste
éteint. Il apporte une centaine d'offres à jour par appel, très denses aux
États-Unis — exactement ce qui était demandé.

---

## Ce que ça donne une fois tout allumé

| Étape du parcours            | Dépend de             |
| ---------------------------- | --------------------- |
| Page d'accueil qui explique  | rien — en ligne       |
| Entrer par lien magique      | **1** puis **2**      |
| Déposer son CV               | rien — en ligne       |
| Remplir avec LinkedIn        | **3**                 |
| Questions conversationnelles | rien — en ligne       |
| Liste des opportunités       | **4** pour la largeur |
| Digest hebdomadaire          | **1**                 |
