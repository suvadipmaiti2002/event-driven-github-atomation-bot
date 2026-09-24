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
        events: ["issues", "pull_request"],
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

  /**
   * Posts an automated comment on an issue or pull request
   */
  async createComment(params: {
    accessToken: string;
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<{ success: boolean; commentId?: number; htmlUrl?: string; error?: string }> {
    const octokit = new Octokit({ auth: params.accessToken });

    try {
      const response = await octokit.rest.issues.createComment({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issueNumber,
        body: params.body,
      });

      return {
        success: true,
        commentId: response.data.id,
        htmlUrl: response.data.html_url,
      };
    } catch (error: any) {
      console.error(
        `[GitHubClient] Failed to post comment on ${params.owner}/${params.repo}#${params.issueNumber}:`,
        error?.message || error
      );
      return {
        success: false,
        error: error?.message || "Failed to post comment on GitHub",
      };
    }
  }

  /**
   * Adds one or more labels to an issue or pull request
   */
  async addLabels(params: {
    accessToken: string;
    owner: string;
    repo: string;
    issueNumber: number;
    labels: string[];
  }): Promise<{ success: boolean; labelsAdded?: string[]; error?: string }> {
    const octokit = new Octokit({ auth: params.accessToken });

    try {
      const response = await octokit.rest.issues.addLabels({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issueNumber,
        labels: params.labels,
      });

      return {
        success: true,
        labelsAdded: response.data.map((l: any) => l.name),
      };
    } catch (error: any) {
      console.error(
        `[GitHubClient] Failed to add labels to ${params.owner}/${params.repo}#${params.issueNumber}:`,
        error?.message || error
      );
      return {
        success: false,
        error: error?.message || "Failed to add labels on GitHub",
      };
    }
  }

  /**
   * Removes a specific label from an issue or pull request (gracefully ignores 404 if label not present)
   */
  async removeLabel(params: {
    accessToken: string;
    owner: string;
    repo: string;
    issueNumber: number;
    name: string;
  }): Promise<void> {
    const octokit = new Octokit({ auth: params.accessToken });

    try {
      await octokit.rest.issues.removeLabel({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issueNumber,
        name: params.name,
      });
    } catch (err: any) {
      // If label does not exist on the issue, 404 is normal and expected
      if (err?.status !== 404) {
        console.warn(`[GitHubClient] Could not remove label '${params.name}':`, err?.message || err);
      }
    }
  }
}

export const githubClient = new GitHubClient();
