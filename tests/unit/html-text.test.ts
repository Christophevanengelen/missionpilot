import { describe, expect, it } from "vitest";
import { firstPlainText, toPlainText } from "@/lib/discovery/html-text";

/**
 * Ce module n'avait AUCUN test, et il en portait pourtant deux
 * responsabilités : rendre les annonces lisibles, et empêcher qu'une source
 * distante plante un « fait » que personne n'a jamais vu à l'écran.
 *
 * Le premier cas ci-dessous vient d'une capture d'écran de vraies offres. Les
 * cartes affichaient des pavés de CSS à la place des descriptions, parce que le
 * dépouillement de balises ne fonctionnait que sur les balises à UN seul
 * attribut. Aucune vérification statique ne pouvait l'attraper — il fallait
 * regarder.
 */

describe("toPlainText", () => {
  it("dépouille une balise à PLUSIEURS attributs entre guillemets", () => {
    // Le défaut exact observé en production : le `[^>"']*` ne fermait que la
    // branche apostrophe simple, donc rien ne pouvait consommer le ` style=`
    // qui suit un premier attribut entre guillemets doubles.
    expect(toPlainText('<p class="a" style="color: red">Bonjour</p>')).toBe(
      "Bonjour",
    );
  });

  it("survit au HTML réel d’une annonce, attributs à rallonge compris", () => {
    const reel =
      '<p class="_descriptionText_5yu8i_201" style="box-sizing: border-box; ' +
      'line-height: 0; margin-bottom: 32px; color: #373e4d; font-style: normal;">' +
      "Nous cherchons un designer." +
      "</p>";
    const texte = toPlainText(reel);
    expect(texte).toBe("Nous cherchons un designer.");
    expect(texte).not.toContain("box-sizing");
    expect(texte).not.toContain("class=");
  });

  it("garde le texte qui suit un « > » à l’intérieur d’un attribut", () => {
    // Sans la gestion des guillemets, l'attribut avalerait la phrase suivante.
    expect(toPlainText('<img alt="a > b">Texte visible')).toBe("Texte visible");
  });

  it("supprime le CORPS des éléments jamais rendus, pas seulement leurs balises", () => {
    // C'est la règle qui empêche une source de nous faire enregistrer un TJM
    // que personne n'a jamais vu affiché.
    expect(toPlainText("<style>.x{color:red}</style>Visible")).toBe("Visible");
    expect(toPlainText("<script>var a = 1;</script>Visible")).toBe("Visible");
    expect(
      toPlainText('<div style="display:none">TJM 2000 EUR</div>Visible'),
    ).toBe("Visible");
    expect(toPlainText("<div hidden>TJM 2000 EUR</div>Visible")).toBe(
      "Visible",
    );
  });

  it("rend les entités et n’écrase pas les sauts de paragraphe", () => {
    expect(toPlainText("Paris&nbsp;&amp;&nbsp;Lyon")).toBe("Paris & Lyon");
    expect(toPlainText("<p>Un</p><p>Deux</p>")).toBe("Un\nDeux");
  });
});

describe("firstPlainText", () => {
  it("ignore un candidat qui se nettoie en vide plutôt que de le laisser masquer le suivant", () => {
    // « <p></p> » est vrai au sens JavaScript : sans ce soin, il éclipserait un
    // extrait parfaitement valable et voyagerait comme chaîne vide, ce que la
    // suite lirait comme « annoncé, et vide » au lieu de « la source n'a rien dit ».
    expect(firstPlainText("<p></p>", "Un extrait utile")).toBe(
      "Un extrait utile",
    );
  });

  it("nettoie AUSSI le candidat de repli", () => {
    expect(firstPlainText(null, '<p class="a" style="b">Replié</p>')).toBe(
      "Replié",
    );
  });

  it("rend null quand rien n’est exploitable", () => {
    expect(firstPlainText(null, undefined, "  ", "<p></p>")).toBeNull();
  });
});
