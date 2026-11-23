import { OAuth2Client } from 'google-auth-library';
import type { OidcVerifier } from './verify.js';

/** Factor 1 in production: Google-signed ID token, issuer accounts.google.com. */
export function googleOidcVerifier(): OidcVerifier {
  const client = new OAuth2Client();
  return {
    async verify(idToken: string, audience: string) {
      const ticket = await client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      const email = payload?.email;
      const aud = payload?.aud;
      const audienceOk = aud === audience || (Array.isArray(aud) && aud.includes(audience));
      if (!email || !audienceOk) {
        throw new Error('oidc');
      }
      return { email, audience };
    },
  };
}
