import type { ReactNode } from "react";

/**
 * L'entrée porte l'encre de la landing, quel que soit le thème du système.
 *
 * LA COUTURE QUE ÇA REFERME. La landing est délibérément sombre — c'est un
 * parti pris, `landing.tsx` code son fond en dur. L'application, elle, suit le
 * thème du système. Quelqu'un sous macOS en clair vivait donc, en un clic
 * depuis « Démarrer », le passage d'une page d'encre à une page blanche qui
 * répète le même titre. Ce n'est pas un défaut de goût : c'est le moment où un
 * visiteur se demande s'il est toujours sur le même site.
 *
 * L'écran d'entrée est la CONTINUATION de la landing, pas le début de
 * l'application : il en reprend le titre, la promesse et les deux refus. Il
 * doit donc en reprendre le fond. Le basculement clair/sombre garde tout son
 * sens là où il sert — dans le produit, une fois entré, où l'on passe du temps.
 *
 * La classe `dark` et non un attribut : `globals.css` déclare
 * `@custom-variant dark (&:is(.dark *))` et redéfinit ses jetons sous `.dark`.
 * C'est donc elle que la carte, ses champs et son bouton écoutent — ils
 * héritent du thème sombre complet, contrastes et anneau de focus compris, au
 * lieu d'être repeints à la main, ce qui aurait dérivé au premier changement
 * de palette.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark bg-background text-foreground flex min-h-svh flex-col">
      {children}
    </div>
  );
}
