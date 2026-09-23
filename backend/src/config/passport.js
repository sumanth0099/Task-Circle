import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env.js';
import { pool } from '../db/pool.js';

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (error) {
    done(error);
  }
});

// Only register Google OAuth strategy when credentials are configured.
// Without this guard, passport throws at module load if env vars are missing.
if (env.googleClientId && env.googleClientSecret && env.googleCallbackUrl) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || 'TaskCircle User';
          const avatarUrl = profile.photos?.[0]?.value || null;

          if (!email) {
            return done(new Error('Google profile does not include an email'));
          }

          const upsert = await pool.query(
            `INSERT INTO users (google_id, email, name, avatar_url)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email)
             DO UPDATE SET
               google_id = EXCLUDED.google_id,
               name = EXCLUDED.name,
               avatar_url = EXCLUDED.avatar_url,
               updated_at = NOW()
             RETURNING *`,
            [googleId, email, name, avatarUrl]
          );

          await pool.query(
            `INSERT INTO notification_preferences (user_id)
             VALUES ($1)
             ON CONFLICT (user_id) DO NOTHING`,
            [upsert.rows[0].id]
          );

          return done(null, upsert.rows[0]);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
} else {
  console.error('[CONFIG ERROR] Google OAuth credentials missing — /api/auth/google routes will not work.');
}

export default passport;
