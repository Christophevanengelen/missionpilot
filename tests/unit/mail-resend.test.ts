import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const env = {
  LOG_LEVEL: "error",
  APP_ENV: "local",
  DIGEST_ENABLED: false as boolean,
  RESEND_API_KEY: undefined as string | undefined,
  DIGEST_FROM: undefined as string | undefined,
};
vi.mock("@/lib/env", () => ({ env }));

const { mailConfigure, envoyerCourriel, MailError } =
  await import("@/lib/mail/resend");

/**
 * L'envoyeur — le seul module du produit qui parle au monde extérieur en NOTRE
 * nom, sous notre domaine.
 *
 * Une page fautive se redéploie ; un e-mail parti est parti. Ce module n'avait
 * aucun test unitaire : l'audit du 2026-07-30 l'a relevé, et c'est la seule
 * surface où ce trou coûtait vraiment.
 */

const courriel = {
  a: "alice@exemple.test",
  objet: "3 offres pour vous",
  html: "<p>bonjour</p>",
  texte: "bonjour",
  desabonnementUrl: "https://missionpilot.net/api/desabonnement?jeton=abc",
};

beforeEach(() => {
  env.DIGEST_ENABLED = false;
  env.RESEND_API_KEY = undefined;
  env.DIGEST_FROM = undefined;
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("l'interrupteur compte autant que la clé", () => {
  it("reste éteint tant que les TROIS conditions ne sont pas réunies", () => {
    // Poser une clé prépare le terrain ; allumer l'envoi automatique vers de
    // vraies boîtes aux lettres est une décision distincte. Les confondre,
    // c'est risquer un premier envoi le jour où l'on voulait seulement
    // configurer.
    expect(mailConfigure()).toBe(false);

    env.RESEND_API_KEY = "re_test";
    expect(mailConfigure()).toBe(false);

    env.DIGEST_FROM = "bonjour@send.hi-def.be";
    expect(mailConfigure()).toBe(false);

    env.DIGEST_ENABLED = true;
    expect(mailConfigure()).toBe(true);
  });
});

describe("l'envoi porte la sortie EN EN-TÊTE, pas seulement en pied de page", () => {
  it("déclare List-Unsubscribe et le un-clic (RFC 8058)", async () => {
    // C'est ce qui fait apparaître le bouton « se désabonner » natif de Gmail,
    // juste à côté de « Signaler comme spam ». Sans lui, la seule sortie
    // visible d'un destinataire agacé est celle qui abîme la réputation du
    // domaine — donc, à terme, la délivrabilité des liens de connexion.
    env.RESEND_API_KEY = "re_test";
    env.DIGEST_FROM = "bonjour@send.hi-def.be";

    const fetchMock: ReturnType<typeof vi.fn<typeof fetch>> = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const id = await envoyerCourriel(courriel);
    expect(id).toBe("msg_1");

    const corps = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(corps.headers["List-Unsubscribe"]).toBe(
      `<${courriel.desabonnementUrl}>`,
    );
    expect(corps.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("envoie TOUJOURS une version texte à côté du HTML", async () => {
    // Un e-mail sans version texte part avec un score de spam plus élevé, et
    // il est illisible pour qui lit son courrier en texte brut — ce qui reste
    // le cas de gens qui cherchent un emploi depuis un terminal.
    env.RESEND_API_KEY = "re_test";
    env.DIGEST_FROM = "bonjour@send.hi-def.be";
    const fetchMock: ReturnType<typeof vi.fn<typeof fetch>> = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "msg_2" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await envoyerCourriel(courriel);
    const corps = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(corps.text).toBe("bonjour");
    expect(corps.html).toBe("<p>bonjour</p>");
    expect(corps.from).toBe("bonjour@send.hi-def.be");
  });
});

describe("un échec lève, il ne ment jamais sur un succès", () => {
  it("refuse de partir sans clé ni expéditeur", async () => {
    await expect(envoyerCourriel(courriel)).rejects.toBeInstanceOf(MailError);
  });

  it("lève sur un refus HTTP — l'appelant décidera de réessayer", async () => {
    // Pour la tâche planifiée, un échec est un destinataire à revoir la
    // semaine suivante — et SURTOUT pas une date de dernier envoi à écrire.
    env.RESEND_API_KEY = "re_test";
    env.DIGEST_FROM = "bonjour@send.hi-def.be";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 422 })),
    );
    await expect(envoyerCourriel(courriel)).rejects.toBeInstanceOf(MailError);
  });

  it("lève sur une réponse inattendue plutôt que d'inventer un identifiant", async () => {
    env.RESEND_API_KEY = "re_test";
    env.DIGEST_FROM = "bonjour@send.hi-def.be";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      ),
    );
    await expect(envoyerCourriel(courriel)).rejects.toBeInstanceOf(MailError);
  });

  it("ne journalise JAMAIS l'adresse du destinataire", async () => {
    // Ce journal sert à repérer un envoyeur muet, pas à tracer qui reçoit quoi.
    env.RESEND_API_KEY = "re_test";
    env.DIGEST_FROM = "bonjour@send.hi-def.be";
    const lignes: string[] = [];
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation((...a) => lignes.push(a.join(" ")));
    vi.spyOn(console, "warn").mockImplementation((...a) =>
      lignes.push(a.join(" ")),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("réseau");
      }),
    );
    await expect(envoyerCourriel(courriel)).rejects.toBeInstanceOf(MailError);
    expect(lignes.join("\n")).not.toContain("alice@exemple.test");
    spy.mockRestore();
  });
});
