import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gestion de la session et de l'accès sécurisé.
 *
 * - Toute route fonctionnelle (hors /login) exige le marqueur `sigcc_session`.
 *   Sans marqueur (nouveau lancement, onglet frais, accès direct sans
 *   authentification), redirection systématique vers /login.
 * - /login n'accepte aucun paramètre de retour (`next`, `redirect`, …) :
 *   après authentification, l'utilisateur arrive toujours sur `/`
 *   (aucune restauration automatique du dernier espace consulté).
 * - La déconnexion (côté client) supprime le marqueur → le middleware
 *   refusera à nouveau l'accès aux espaces fonctionnels.
 */
const MARQUEUR = "sigcc_session";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const aMarqueur = request.cookies.get(MARQUEUR)?.value === "1";

  if (pathname === "/login") {
    // Ne jamais restaurer le dernier espace : on nettoie tout retour demandé.
    if (searchParams.has("next") || searchParams.has("redirect") || searchParams.has("returnUrl")) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("next");
      url.searchParams.delete("redirect");
      url.searchParams.delete("returnUrl");
      return NextResponse.redirect(url);
    }
    // Déjà authentifié dans cet onglet : retour au tableau de bord.
    if (aMarqueur) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Espace fonctionnel sans session valide → page de connexion.
  if (!aMarqueur) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Toutes les pages sauf assets Next, favicon et fichiers publics.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
