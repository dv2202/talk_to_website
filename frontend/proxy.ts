import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    // Cheap presence check only; API routes and layouts validate the session against the DB.
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    // Protect dashboard and admin routes
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
        if (!sessionCookie) {
            const loginUrl = new URL("/login", request.url);
            loginUrl.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Redirect logged-in users away from auth pages
    if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") {
        if (sessionCookie) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard",
        "/dashboard/:path*",
        "/admin",
        "/admin/:path*",
        "/login",
        "/signup",
        "/forgot-password",
    ],
};
