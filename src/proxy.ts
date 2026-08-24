import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth";
import { isDatabaseConfigured } from "./lib/config";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Aucune base rattachée : on sert la marche à suivre avant tout rendu,
  // sinon chaque page échouerait en tentant d'ouvrir une connexion.
  if (!isDatabaseConfigured())
    return pathname === "/installation"
      ? NextResponse.next()
      : NextResponse.rewrite(new URL("/installation", request.url));

  // La page d'installation n'a plus lieu d'être une fois la base rattachée.
  if (pathname === "/installation")
    return NextResponse.redirect(new URL("/", request.url));

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Récupérer un accès perdu ne peut pas exiger d'être déjà connecté.
  if (
    pathname === "/admin/mot-de-passe-oublie" ||
    pathname === "/admin/reinitialisation"
  )
    return NextResponse.next();

  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (pathname === "/admin/login") {
    if (session) return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
