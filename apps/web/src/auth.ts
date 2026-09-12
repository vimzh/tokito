import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  providers: [
    Google,
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize(credentials) {
        // ponytail: public shared demo account; use stored password hashes for private accounts.
        if (
          typeof credentials.email !== "string" ||
          credentials.email.trim().toLowerCase() !== "demo@theategmail.com" ||
          credentials.password !== "demo1234"
        ) return null;

        return { id: "demo", name: "Demo", email: "demo@theategmail.com" };
      },
    }),
  ],
});
