import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import AppleStrategy from "passport-apple";

/**
 * Passport configuration for OAuth strategies.
 * Stateless mode (no express-session) — Passport handles the OAuth handshake only.
 * User creation/linking and JWT generation happen in the route callback handlers.
 */

// ============================================================
// Google OAuth 2.0 Strategy (optional)
// ============================================================

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
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
} else {
  console.log("ℹ️  Google OAuth not configured — skipping");
}

// ============================================================
// Apple Sign In Strategy (optional)
// ============================================================

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
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
        let email = null;
        let name = null;

        if (idToken) {
          email = idToken.email || null;
        }

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
} else {
  console.log("ℹ️  Apple Sign In not configured — skipping");
}

export default passport;
