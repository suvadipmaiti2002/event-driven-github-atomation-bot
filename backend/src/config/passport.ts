import passport from "passport";
import { Strategy as GitHubStrategy, Profile } from "passport-github2";
import { env } from "./env";
import { authService } from "../services/auth.service";

export function configurePassport(): void {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: env.GITHUB_CALLBACK_URL,
      },
      async (
        accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (err: any, user?: any) => void
      ) => {
        try {
          // 1. Try to read public email from profile
          let email =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0].value
              : undefined;

          // 2. If email is private on GitHub, fetch it via GitHub's /user/emails API
          if (!email && accessToken) {
            try {
              const emailsResponse = await fetch("https://api.github.com/user/emails", {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "User-Agent": "Event-Driven-GitHub-Bot",
                },
              });

              if (emailsResponse.ok) {
                const emailsList = (await emailsResponse.json()) as Array<{
                  email: string;
                  primary: boolean;
                  verified: boolean;
                }>;

                // Pick primary and verified email, or first available email
                const primary =
                  emailsList.find((e) => e.primary && e.verified) || emailsList[0];

                if (primary) {
                  email = primary.email;
                }
              }
            } catch (emailErr) {
              console.warn("Could not fetch user emails from GitHub API:", emailErr);
            }
          }

          const user = await authService.handleGithubAuth({
            githubId: profile.id,
            username: profile.username || profile.displayName || `user-${profile.id}`,
            email,
            avatarUrl:
              profile.photos && profile.photos.length > 0
                ? profile.photos[0].value
                : undefined,
            accessToken,
          });

          return done(null, user);
        } catch (error) {
          console.error("Error during GitHub OAuth strategy execution:", error);
          return done(error as Error, undefined);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authService.getUserById(id);
      done(null, user || null);
    } catch (error) {
      done(error, null);
    }
  });
}
