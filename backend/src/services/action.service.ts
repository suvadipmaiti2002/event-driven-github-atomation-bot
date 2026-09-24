import { EventLog } from "../db/schema";
import { actionLogRepository } from "../repositories/action-log.repository";
import { repositoryRepository } from "../repositories/repository.repository";
import { userRepository } from "../repositories/user.repository";
import { githubClient } from "../integrations/github/github.client";
import { slackClient } from "../integrations/slack/slack.client";

export class ActionService {
  /**
   * Evaluates an incoming event and dispatches automated outbound actions:
   * 1. GitHub Comment (Welcome acknowledgment)
   * 2. GitHub Label (Auto-triage)
   * 3. Slack Notification (Team alert)
   * 
   * Strict Rule: Only executes on 'opened' issues and pull requests.
   * Push events and other actions are ignored to avoid spam.
   */
  async handleEvent(eventLog: EventLog): Promise<void> {
    const { eventType, action, repoFullName, payload } = eventLog;

    // Rule: Process 'opened', 'closed', and 'reopened' for issues and pull_requests
    const isOpened = action === "opened";
    const isClosed = action === "closed";
    const isReopened = action === "reopened";
    const isPR = eventType === "pull_request";
    const isMerged = isPR && Boolean((payload as any)?.pull_request?.merged);

    const isSupportedEvent =
      (eventType === "issues" && (isOpened || isClosed || isReopened)) ||
      (isPR && (isOpened || isClosed || isReopened));

    if (!isSupportedEvent) {
      console.log(
        `[ActionService] ⏭️ Skipping automated actions for event [${eventType}] action [${action || "none"}] (Only 'opened', 'closed', & 'reopened' issues/PRs are automated).`
      );
      return;
    }

    if (!repoFullName) {
      console.warn(`[ActionService] Event ${eventLog.id} has no repoFullName. Skipping actions.`);
      return;
    }

    const [owner, repo] = repoFullName.split("/");
    const issueOrPr = (payload as any)?.issue || (payload as any)?.pull_request;
    const issueNumber: number | undefined = issueOrPr?.number;
    const title: string = issueOrPr?.title || "Untitled";
    const htmlUrl: string = issueOrPr?.html_url || `https://github.com/${repoFullName}`;
    const bodySnippet: string = issueOrPr?.body || "";
    const sender = eventLog.sender || "collaborator";

    // 1. Resolve repository & owner access token for GitHub operations
    let accessToken: string | null = null;
    if (eventLog.repositoryId) {
      const dbRepo = await repositoryRepository.findById(eventLog.repositoryId);
      if (dbRepo?.userId) {
        const user = await userRepository.findById(dbRepo.userId);
        if (user?.accessToken) {
          accessToken = user.accessToken;
        }
      }
    }

    // --- Action 1: GitHub Comment ---
    if (issueNumber && accessToken) {
      let commentBody = "";

      if (isOpened) {
        commentBody = isPR
          ? `👋 Hi @${sender}!\n\nThank you for opening this pull request. Our automated bot has received it and alerted the team on Slack. A maintainer will review your changes shortly.`
          : `👋 Hi @${sender}!\n\nThank you for reporting this issue. Our automated bot has logged this report and notified the team on Slack for triage.`;
      } else if (isClosed) {
        if (isPR) {
          commentBody = isMerged
            ? `🎉 Congratulations @${sender}! This pull request has been merged. Thank you for your contribution!`
            : `This pull request has been closed without merging. Thank you @${sender} for contributing!`;
        } else {
          commentBody = `✅ This issue has been closed. Thank you @${sender} for your feedback and contributions!`;
        }
      } else if (isReopened) {
        commentBody = isPR
          ? `🔄 This pull request has been reopened by @${sender}. Back in review!`
          : `🔄 This issue has been reopened by @${sender}. Back in triage!`;
      }

      try {
        const commentResult = await githubClient.createComment({
          accessToken,
          owner,
          repo,
          issueNumber,
          body: commentBody,
        });

        await actionLogRepository.createActionLog({
          eventLogId: eventLog.id,
          actionType: "github_comment",
          status: commentResult.success ? "SUCCESS" : "FAILED",
          details: {
            issueNumber,
            commentId: commentResult.commentId,
            htmlUrl: commentResult.htmlUrl,
          },
          errorMessage: commentResult.error || null,
        });
      } catch (err: any) {
        await actionLogRepository.createActionLog({
          eventLogId: eventLog.id,
          actionType: "github_comment",
          status: "FAILED",
          details: { issueNumber },
          errorMessage: err?.message || String(err),
        });
      }
    } else {
      await actionLogRepository.createActionLog({
        eventLogId: eventLog.id,
        actionType: "github_comment",
        status: "FAILED",
        details: { issueNumber },
        errorMessage: !accessToken
          ? "No active GitHub access token available to comment."
          : "Issue/PR number missing from payload.",
      });
    }

    // --- Action 2: GitHub Label Management (Clean Swap) ---
    if (issueNumber && accessToken) {
      let labelsToAdd: string[] = [];
      let labelsToRemove: string[] = [];

      if (isOpened) {
        labelsToAdd = isPR ? ["automated-pr", "needs-review"] : ["triage"];
      } else if (isClosed) {
        if (isPR) {
          labelsToRemove = ["needs-review"];
          labelsToAdd = isMerged ? ["merged"] : ["closed"];
        } else {
          labelsToRemove = ["triage"];
          labelsToAdd = ["resolved"];
        }
      } else if (isReopened) {
        if (isPR) {
          labelsToRemove = ["merged", "closed"];
          labelsToAdd = ["needs-review"];
        } else {
          labelsToRemove = ["resolved"];
          labelsToAdd = ["triage"];
        }
      }

      try {
        // 1. Remove outdated lifecycle labels
        for (const labelName of labelsToRemove) {
          await githubClient.removeLabel({
            accessToken,
            owner,
            repo,
            issueNumber,
            name: labelName,
          });
        }

        // 2. Add current state labels
        const labelResult = await githubClient.addLabels({
          accessToken,
          owner,
          repo,
          issueNumber,
          labels: labelsToAdd,
        });

        await actionLogRepository.createActionLog({
          eventLogId: eventLog.id,
          actionType: "github_label",
          status: labelResult.success ? "SUCCESS" : "FAILED",
          details: {
            issueNumber,
            labelsRemoved: labelsToRemove,
            labelsAdded: labelResult.labelsAdded,
          },
          errorMessage: labelResult.error || null,
        });
      } catch (err: any) {
        await actionLogRepository.createActionLog({
          eventLogId: eventLog.id,
          actionType: "github_label",
          status: "FAILED",
          details: { issueNumber },
          errorMessage: err?.message || String(err),
        });
      }
    } else {
      await actionLogRepository.createActionLog({
        eventLogId: eventLog.id,
        actionType: "github_label",
        status: "FAILED",
        details: { issueNumber },
        errorMessage: !accessToken
          ? "No active GitHub access token available to add labels."
          : "Issue/PR number missing from payload.",
      });
    }

    // --- Action 3: Slack Alert ---
    try {
      const slackResult = await slackClient.sendNotification({
        title,
        repoFullName,
        eventType: eventType as "issues" | "pull_request",
        action: action || "opened",
        sender,
        htmlUrl,
        bodySnippet,
        isMerged,
        issueNumber,
      });

      await actionLogRepository.createActionLog({
        eventLogId: eventLog.id,
        actionType: "slack_alert",
        status: slackResult.success ? "SUCCESS" : "FAILED",
        details: {
          title,
          repoFullName,
          htmlUrl,
        },
        errorMessage: slackResult.error || null,
      });
    } catch (err: any) {
      await actionLogRepository.createActionLog({
        eventLogId: eventLog.id,
        actionType: "slack_alert",
        status: "FAILED",
        details: { title, repoFullName },
        errorMessage: err?.message || String(err),
      });
    }
  }
}

export const actionService = new ActionService();
