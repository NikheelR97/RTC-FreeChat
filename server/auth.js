import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { getUserByUsername, createUser, getUserById, db } from './database.js'; // Need raw db for complex find?
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'your-github-client-id';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export function setupPassport(app) {
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        const user = getUserById(id);
        done(null, user);
    });

    // Google Strategy
    passport.use(new GoogleStrategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/google/callback`
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Find or create user
                // Need a way to find by provider_id
                const stmt = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?');
                let user = stmt.get('google', profile.id);

                if (!user) {
                    // Create new user
                    // Ensure username is unique
                    let username = profile.displayName.replace(/\s+/g, '').toLowerCase();
                    let suffix = 1;
                    while (getUserByUsername(username)) {
                        username = `${profile.displayName.replace(/\s+/g, '').toLowerCase()}${suffix++}`;
                    }

                    const userId = crypto.randomUUID();
                    const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

                    user = {
                        id: userId,
                        username,
                        password: null, // No password for OAuth
                        avatar,
                        provider: 'google',
                        provider_id: profile.id
                    };

                    // We need a modified createUser that handles provider fields
                    const insert = db.prepare('INSERT INTO users (id, username, password, avatar, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?)');
                    insert.run(user.id, user.username, user.password, user.avatar, user.provider, user.provider_id);
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }));

    // GitHub Strategy
    passport.use(new GitHubStrategy({
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/github/callback`
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const stmt = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?');
                let user = stmt.get('github', profile.id);

                if (!user) {
                    let username = profile.username || profile.displayName.replace(/\s+/g, '').toLowerCase();
                    let suffix = 1;
                    while (getUserByUsername(username)) {
                        username = `${profile.username}${suffix++}`;
                    }

                    const userId = crypto.randomUUID();
                    const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

                    user = {
                        id: userId,
                        username,
                        password: null,
                        avatar,
                        provider: 'github',
                        provider_id: profile.id
                    };

                    const insert = db.prepare('INSERT INTO users (id, username, password, avatar, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?)');
                    insert.run(user.id, user.username, user.password, user.avatar, user.provider, user.provider_id);
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }));
}
