import { githubClient, GitHubRepositoryDTO } from "../integrations/github/github.client";
import { slackClient } from "../integrations/slack/slack.client";
import { repositoryRepository } from "../repositories/repository.repository";
import { env } from "../config/env";
import { User, Repository } from "../db/schema";

export interface AvailableRepositoryDTO extends GitHubRepositoryDTO {
  isConnected: boolean;
}

export class RepositoryService {
  /**
   * Fetches all repositories from the user's GitHub account,
   * indicating which ones are already connected to our bot
   */
  async getAvailableGithubRepos(user: User): Promise<AvailableRepositoryDTO[]> {
    const githubRepos = await githubClient.getUserRepositories(user.accessToken);
    const connectedRepos = await repositoryRepository.findActiveByUserId(user.id);

    const connectedMap = new Set(connectedRepos.map((r) => r.githubRepoId));

    return githubRepos.map((repo) => ({
      ...repo,
      isConnected: connectedMap.has(repo.id),
    }));
  }

  /**
   * Returns all active repositories connected by the user
   */
  async getConnectedRepositories(userId: string): Promise<Repository[]> {
    return repositoryRepository.findActiveByUserId(userId);
  }

  /**
   * Connects a repository:
   * 1. Attempts to auto-install the webhook on GitHub using env.GITHUB_WEBHOOK_URL
   * 2. Saves/reactivates the repository record in Supabase
   */
  async connectRepository(
    user: User,
    data: {
      githubRepoId: string;
      repoOwner: string;
      repoName: string;
      repoFullName: string;
    }
  ): Promise<Repository> {
    // Single explicit webhook target URL from env
    const webhookUrl = env.GITHUB_WEBHOOK_URL;

    // Register webhook on GitHub
    const webhookId = await githubClient.createRepositoryWebhook({
      accessToken: user.accessToken,
      owner: data.repoOwner,
      repo: data.repoName,
      webhookUrl,
      secret: env.GITHUB_WEBHOOK_SECRET,
    });

    // Save or update repository in Supabase
    return repositoryRepository.upsertRepository({
      githubRepoId: data.githubRepoId,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
      repoFullName: data.repoFullName,
      webhookId,
      userId: user.id,
    });
  }

  /**
   * Disconnects a repository:
   * 1. Deletes the webhook from GitHub (if installed)
   * 2. Passively soft-deletes the repo in Supabase (isActive = false)
   */
  async disconnectRepository(user: User, repoId: string): Promise<Repository> {
    const repo = await repositoryRepository.findById(repoId);

    if (!repo || repo.userId !== user.id) {
      throw new Error("Repository not found or access denied.");
    }

    // If a webhook was created on GitHub, remove it
    if (repo.webhookId) {
      await githubClient.deleteRepositoryWebhook({
        accessToken: user.accessToken,
        owner: repo.repoOwner,
        repo: repo.repoName,
        webhookId: repo.webhookId,
      });
    }

    // Soft-delete in Supabase
    const updated = await repositoryRepository.setInactive(repoId);
    if (!updated) {
      throw new Error("Failed to deactivate repository.");
    }

    return updated;
  }

  /**
   * Updates or removes the Slack webhook URL for a repository
   */
  async updateSlackWebhook(
    user: User,
    repoId: string,
    slackWebhookUrl: string | null
  ): Promise<Repository> {
    const repo = await repositoryRepository.findById(repoId);
    if (!repo || repo.userId !== user.id) {
      throw new Error("Repository not found or access denied.");
    }

    const updated = await repositoryRepository.updateSlackWebhook(repoId, slackWebhookUrl);
    if (!updated) {
      throw new Error("Failed to update Slack webhook.");
    }
    return updated;
  }

  /**
   * Sends a test ping to verify a repository's Slack webhook
   */
  async testSlackWebhook(
    user: User,
    repoId: string,
    webhookUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    const repo = await repositoryRepository.findById(repoId);
    if (!repo || repo.userId !== user.id) {
      throw new Error("Repository not found or access denied.");
    }

    const targetUrl = webhookUrl || repo.slackWebhookUrl;
    if (!targetUrl) {
      return { success: false, error: "No Slack webhook URL provided or configured." };
    }

    return slackClient.sendTestPing(targetUrl, repo.repoFullName);
  }
}

export const repositoryService = new RepositoryService();
