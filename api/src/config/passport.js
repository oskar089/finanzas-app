import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import AppleStrategy from "passport-apple";

/**
 * Passport configuration for OAuth strategies.
 * Stateless mode (no express-session) — Passport handles the OAuth handshake only.
 * User creation/linking and JWT generation happen in the route callback handlers.
 */

// ============================================================
// Google OAuth 2.0 Strategy
// ============================================================

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ["profile", "email"],
      session: false,
    },
    (accessToken, refreshToken, profile, done) => {
      // Extract profile data from Google's response
      const email =
        profile.emails && profile.emails.length > 0
          ? profile.emails[0].value
          : null;

      const userProfile = {
        provider: "google",
        providerId: profile.id,
        email,
        name: profile.displayName || profile.name?.givenName || email,
      };

      return done(null, userProfile);
    }
  )
);

// ============================================================
// Apple Sign In Strategy
// ============================================================

passport.use(
  "apple",
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      keyID: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      callbackURL: process.env.APPLE_CALLBACK_URL,
      session: false,
    },
    (accessToken, refreshToken, idToken, profile, done) => {
      // Apple sends name and email ONLY on the first login.
      // On subsequent logins, only the idToken is provided.
      // profile is typically null on subsequent logins.
      let email = null;
      let name = null;

      // idToken from passport-apple is the decoded JWT payload (object)
      // Contains claims: sub, email, email_verified, etc.
      if (idToken) {
        email = idToken.email || null;
      }

      // Apple may send user info in the profile parameter on first login
      // profile contains: { id, email, name: { firstName, lastName } }
      if (profile) {
        email = profile.email || email;
        if (profile.name) {
          name = profile.name.firstName
            ? `${profile.name.firstName} ${profile.name.lastName || ""}`.trim()
            : name;
        }
      }

      const userProfile = {
        provider: "apple",
        providerId: profile?.id || idToken?.sub,
        email,
        name: name || email || "User",
      };

      return done(null, userProfile);
    }
  )
);

export default passport;
