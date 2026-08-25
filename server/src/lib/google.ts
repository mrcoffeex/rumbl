import { env } from "./env";
import { HttpError } from "../middleware/errors";

type GoogleIdentity = {
  googleId: string;
  email: string;
  name: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new HttpError(501, "Google sign-in is not configured");
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  const payload = (await response.json()) as {
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    error?: string;
  };

  if (!response.ok || payload.error) {
    throw new HttpError(401, "Google could not verify this account");
  }
  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new HttpError(401, "Google could not verify this account");
  }

  const verified = payload.email_verified === true || payload.email_verified === "true";
  const email = payload.email?.toLocaleLowerCase();
  if (!payload.sub || !email || !verified) {
    throw new HttpError(401, "Google could not verify this account");
  }

  return {
    googleId: payload.sub,
    email,
    name: payload.name || email.split("@")[0] || "Google user",
  };
}
