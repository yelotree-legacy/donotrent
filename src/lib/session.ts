import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  companyId?: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
};

// Hard fail in production if SESSION_PASSWORD isn't configured. Otherwise
// session cookies would be signed with a public string and an attacker who
// reads the source could forge any operator's session.
const sessionPassword = (() => {
  const env = process.env.SESSION_PASSWORD;
  if (!env || env.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_PASSWORD must be set to a string ≥32 chars in production. " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
      );
    }
    return "dev-only-fallback-secret-please-set-in-prod-env-var";
  }
  return env;
})();

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: "dnr_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}
