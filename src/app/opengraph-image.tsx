import { ImageResponse } from "next/og";

/**
 * La carte que voient LinkedIn, Slack et WhatsApp quand quelqu'un colle le
 * lien — et, pour un produit qu'on partage par lien, c'est la seule surface
 * virale qui existe.
 *
 * Elle reprend la signature de la landing : l'encre, l'or, et l'escalier en
 * dessin technique — « vous êtes ici », puis la marche du dessus. Pas un logo
 * sur fond plat : la promesse elle-même, lisible en une seconde dans un fil
 * d'actualité.
 *
 * AUCUNE POLICE TÉLÉCHARGÉE. `ImageResponse` accepte des fichiers de police,
 * mais le dépôt s'interdit toute récupération réseau au build (même règle que
 * `globals.css`, revue Codex J6). On s'en tient donc aux polices intégrées :
 * moins de caractère typographique, zéro dépendance et zéro échec silencieux
 * le jour où un CDN tombe.
 *
 * Les couleurs sont écrites en hexadécimal et non en `oklch` : le moteur de
 * rendu de Satori ne connaît pas cet espace. Ce sont les valeurs exactes de
 * `landing.tsx`, converties une fois.
 */

export const alt =
  "MissionPilot — on ne cherche pas un emploi à votre place, on vous fait monter d'une marche";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ENCRE = "#14161d";
const OR = "#f5c25f";
const CLAIR = "#f7f6f3";
const ESTOMPE = "#8b93a5";
const TRAIT = "rgba(247,246,243,0.14)";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: ENCRE,
        padding: "64px 72px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: 6,
            color: ESTOMPE,
            marginBottom: 34,
          }}
        >
          MISSIONPILOT — MOTEUR DE RECHERCHE D&apos;EMPLOI, OPEN SOURCE
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.12,
            color: CLAIR,
          }}
        >
          <div>On ne cherche pas un emploi</div>
          <div>à votre place.</div>
          <div style={{ color: OR }}>
            On vous fait monter d&apos;une marche.
          </div>
        </div>
      </div>

      {/* L'escalier, en dessin technique — la même figure que la landing.
            Deux paliers, une marche, et le « +1 » qui dit tout le produit. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 0,
          height: 132,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: 470,
            height: 52,
            borderTop: `2px solid ${CLAIR}`,
            borderRight: `1px dashed ${TRAIT}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 19,
              color: ESTOMPE,
              padding: "10px 0 0 4px",
            }}
          >
            VOUS ÊTES ICI
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: 470,
            height: 118,
            borderTop: `2px solid ${OR}`,
            borderLeft: `2px dashed ${OR}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 19,
              color: OR,
              padding: "10px 0 0 14px",
            }}
          >
            LA MARCHE D&apos;APRÈS
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 700,
            color: OR,
            paddingLeft: 24,
            paddingBottom: 4,
          }}
        >
          +1
        </div>
      </div>
    </div>,
    size,
  );
}
