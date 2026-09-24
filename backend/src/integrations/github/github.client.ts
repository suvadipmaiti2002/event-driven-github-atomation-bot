import { Octokit } from "@octokit/rest";

export interface GitHubRepositoryDTO {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  htmlUrl: string;
}

export class GitHubClient {
  /**
   * Fetches the repositories that the authenticated user owns or has admin access to
   */
  async getUserRepositories(accessToken: string): Promise<GitHubRepositoryDTO[]> {
    const octokit = new Octokit({ auth: accessToken });

    const response = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      affiliation: "owner,collaborator",
    });

    return response.data.map((repo) => ({
      id: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      isPrivate: repo.private,
      htmlUrl: repo.html_url,
    }));
  }

  /**
   * Automatically creates a webhook on the specified GitHub repository
   */
  async createRepositoryWebhook(params: {
    accessToken: string;
    owner: string;
    repo: string;
    webhookUrl: string;
    secret: string;
  }): Promise<string | null> {
    const octokit = new Octokit({ auth: params.accessToken });

    try {
      // 1. Check if our webhook is already installed on this repository
      const existingHooks = await octokit.rest.repos.listWebhooks({
        owner: params.owner,
        repo: params.repo,
      });

      const matchedHook = existingHooks.data.find(
        (hook) => hook.config.url === params.webhookUrl
      );

      if (matchedHook) {
        return String(matchedHook.id);
      }

      // 2. Create the webhook listening for issues and pull requests
      const hookResponse = await octokit.rest.repos.createWebhook({
        owner: params.owner,
        repo: params.repo,
        config: {
          url: params.webhookUrl,
          content_type: "json",
          secret: params.secret,
        },
        events: ["issues", "pull_request", "push"],
        active: true,
      });

      return String(hookResponse.data.id);
    } catch (error: any) {
      console.warn(
        `[GitHubClient] Could not register webhook for ${params.owner}/${params.repo}:`,
        error?.message || error
      );
      // Return null so connecting the repo in the UI does not fail if on localhost without a public URL
      return null;
    }
  }

  /**
   * Deletes a registered webhook from a GitHub repository
   */
  async deleteRepositoryWebhook(params: {
    accessToken: string;
    owner: string;
    repo: string;
    webhookId: string;
  }): Promise<void> {
    const octokit = new Octokit({ auth: params.accessToken });

    try {
      await octokit.rest.repos.deleteWebhook({
        owner: params.owner,
        repo: params.repo,
        hook_id: Number(params.webhookId),
      });
    } catch (error: any) {
      // If webhook was already removed on GitHub, ignore 404
      if (error?.status !== 404) {
        console.warn(`[GitHubClient] Error deleting webhook ${params.webhookId}:`, error?.message);
      }
    }
  }
}

export const githubClient = new GitHubClient();
