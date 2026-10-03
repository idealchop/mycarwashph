import type { Auth } from "firebase-admin/auth";

/** The signed-in person behind a request (owner or staff). */
export interface AuthUser {
  uid: string;
  phoneNumber?: string;
  email?: string;
  name?: string;
  /** River Apps platform admin (custom claim). Can change a shop's plan. */
  platformAdmin: boolean;
}

export interface TokenVerifier {
  verify(idToken: string): Promise<AuthUser>;
}

/**
 * Verifies Firebase ID tokens. When FIREBASE_AUTH_EMULATOR_HOST is set (the
 * emulator sets it for functions), firebase-admin accepts emulator tokens.
 */
export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly auth: Auth) {}

  async verify(idToken: string): Promise<AuthUser> {
    const decoded = await this.auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      phoneNumber: decoded.phone_number,
      email: decoded.email,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
      platformAdmin: decoded.platformAdmin === true,
    };
  }
}
