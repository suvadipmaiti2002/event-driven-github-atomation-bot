import { EventLog, ActionLog, Rule } from "../db/schema";
import { actionLogRepository } from "../repositories/action-log.repository";
import { eventLogRepository } from "../repositories/event-log.repository";
import { repositoryRepository } from "../repositories/repository.repository";
import { userRepository } from "../repositories/user.repository";
import { ruleService } from "./rule.service";
import { githubClient } from "../integrations/github/github.client";
import { slackClient } from "../integrations/slack/slack.client";
import { geminiClient, AITriageResult } from "../integrations/ai/gemini.client";
import { createChildLogger } from "../utils/logger";

const log = createChildLogger("ActionService");

export class ActionService {
  /**
   * Evaluates an incoming event and dispatches automated outbound actions:
   * 0. AI Triage (Google Gemini auto-summary, priority & label suggestions)
   * 1. GitHub Comment (Welcome acknowledgment + AI analysis)
   * 2. GitHub Label (Auto-triage & AI suggested tags)
   * 3. Slack Notification (Team alert with AI summary block)
   * 
   * Strict Rule: Only executes on 'opened', 'closed', and 'reopened' issues/PRs.
   * Push events and secondary micro-events are ignored to avoid spam.
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
      log.debug(
        { eventType, action, eventLogId: eventLog.id },
        `Skipping automated actions for event [${eventType}] action [${action || "none"}]`
      );
      return;
    }

    if (!repoFullName) {
      log.warn({ eventLogId: eventLog.id }, "Event has no repoFullName. Skipping actions.");
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

    // --- Step 0: Resolve Configurable Automation Rules ---
    let isAiEnabled = true;
    let isCommentEnabled = true;
    let isLifecycleLabelEnabled = true;
    let isSlackEnabled = true;
    let matchedCustomRules: Rule[] = [];

    if (eventLog.repositoryId) {
      try {
        const repoRules = await ruleService.getRulesForRepository(eventLog.repositoryId);
        const activeRules = repoRules.filter((r) => r.isActive);

        // Feature toggles derived from active system rules
        isAiEnabled = activeRules.some((r) => r.actionAiTriage);
        isCommentEnabled = activeRules.some(
          (r) =>
            (r.isDefault && (r.actionComment === "welcome" || r.name.toLowerCase().includes("comment"))) ||
            Boolean(r.actionComment)
        );
        isLifecycleLabelEnabled = activeRules.some(
          (r) =>
            r.isDefault && (r.actionLabel === "lifecycle" || r.name.toLowerCase().includes("label"))
        );
        isSlackEnabled = activeRules.some((r) => (r.isDefault && r.actionSlack) || r.actionSlack);

        // Evaluate custom keyword / author rules
        matchedCustomRules = activeRules.filter((r) => {
          if (r.isDefault) return false;
          if (r.eventType !== "all" && r.eventType !== eventType) return false;

          const matchVal = (r.matchValue || "").trim();
          if (r.matchField === "always") return true;
          if (!matchVal) return false;

          if (r.matchField === "title_contains" || r.matchField === "body_contains") {
            const targetText = r.matchField === "title_contains" ? title : bodySnippet;
            // Escape regex special characters in the user's keyword
            const escapedKeyword = matchVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Word boundary regex ensures whole-word matching (e.g. "auth" matches "auth" or "[auth]", but NOT "author")
            const wordBoundaryRegex = new RegExp(`\\b${escapedKeyword}\\b`, "i");
            return wordBoundaryRegex.test(targetText);
          }
          if (r.matchField === "author_is") {
            return sender.toLowerCase() === matchVal.toLowerCase();
          }
          return false;
        });

        if (matchedCustomRules.length > 0) {
          log.info(
            {
              count: matchedCustomRules.length,
              rules: matchedCustomRules.map((r) => r.name),
              repo: repoFullName,
            },
            `Matched ${matchedCustomRules.length} custom rule(s)`
          );
        }
      } catch (err) {
        log.warn({ err, repo: repoFullName }, "Error loading rules, proceeding with standard defaults");
      }
    }

    // --- Step 1: Automated AI Triage (Google Gemini) ---
    let aiTriage: AITriageResult | undefined = undefined;

    if (isOpened && isAiEnabled) {
      try {
        const aiResult = await geminiClient.triageContent({
          title,
          bodySnippet,
          eventType: eventType as "issues" | "pull_request",
          repoFullName,
        });

        if (aiResult.success && aiResult.data) {
          aiTriage = aiResult.data;
        }

        await actionLogRepository.createActionLog({
          eventLogId: eventLog.id,
          actionType: "ai_triage",
          status: aiResult.success ? "SUCCESS" : "FAILED",
          details: (aiResult.data as any) || null,
          errorMessage: aiResult.error || null,
        });
      } catch (err: any) {
        await actionLogRepository.createActionLog({
          eventLogId: eventLog.id,
          actionType: "ai_triage",
          status: "FAILED",
          details: null,
          errorMessage: err?.message || String(err),
        });
      }
    }

    // --- Action 1: GitHub Comment ---
    if (issueNumber && accessToken && isCommentEnabled) {
      let commentBody = "";

      if (isOpened) {
        commentBody = isPR
          ? `👋 Hi @${sender}!\n\nThank you for opening this pull request. Our automated bot has received it and alerted the team on Slack. A maintainer will review your changes shortly.`
          : `👋 Hi @${sender}!\n\nThank you for reporting this issue. Our automated bot has logged this report and notified the team on Slack for triage.`;

        if (aiTriage) {
          const priorityIcon =
            aiTriage.priority === "CRITICAL"
              ? "🚨"
              : aiTriage.priority === "HIGH"
              ? "🔴"
              : aiTriage.priority === "MEDIUM"
              ? "🟡"
              : "🟢";

          commentBody += `\n\n---\n### 🤖 Automated AI Triage\n- **Summary:** _${aiTriage.summary}_\n- **Assessed Priority:** ${priorityIcon} \`${aiTriage.priority}\`\n- **Suggested Category:** \`${aiTriage.category}\``;
        }

        // Append custom rule comments if configured
        for (const rule of matchedCustomRules) {
          if (rule.actionComment && rule.actionComment !== "welcome") {
            commentBody += `\n\n---\n**Rule [${rule.name}]:** ${rule.actionComment}`;
          }
        }
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
        if (isLifecycleLabelEnabled) {
          labelsToAdd.push(isPR ? "needs-review" : "triage");
        }
        if (aiTriage && aiTriage.suggestedLabels.length > 0) {
          for (const suggested of aiTriage.suggestedLabels) {
            labelsToAdd.push(suggested);
          }
        }
        // Custom Rule Labels (Dynamic matching)
        for (const rule of matchedCustomRules) {
          if (rule.actionLabel && rule.actionLabel !== "lifecycle") {
            labelsToAdd.push(rule.actionLabel);
          }
        }
      } else if (isClosed) {
        if (isLifecycleLabelEnabled) {
          if (isPR) {
            labelsToRemove = ["needs-review"];
            labelsToAdd = isMerged ? ["merged"] : ["closed"];
          } else {
            labelsToRemove = ["triage"];
            labelsToAdd = ["resolved"];
          }
        }
      } else if (isReopened) {
        if (isLifecycleLabelEnabled) {
          if (isPR) {
            labelsToRemove = ["merged", "closed"];
            labelsToAdd = ["needs-review"];
          } else {
            labelsToRemove = ["resolved"];
            labelsToAdd = ["triage"];
          }
        }
      }

      // Deduplicate labels
      labelsToAdd = Array.from(new Set(labelsToAdd));
      labelsToRemove = Array.from(new Set(labelsToRemove));

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

        // 2. Add current state labels (only if any exist)
        let labelsAddedResult: string[] = [];
        if (labelsToAdd.length > 0) {
          const labelResult = await githubClient.addLabels({
            accessToken,
            owner,
            repo,
            issueNumber,
            labels: labelsToAdd,
          });
          labelsAddedResult = labelResult.labelsAdded || [];
        }

        await actionLogRepository.createActionLog({
          eventLogId: eventLog.id,
          actionType: "github_label",
          status: "SUCCESS",
          details: {
            issueNumber,
            labelsRemoved: labelsToRemove,
            labelsAdded: labelsAddedResult,
          },
          errorMessage: null,
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
    const shouldSendSlack = isSlackEnabled || matchedCustomRules.some((r) => r.actionSlack);

    if (shouldSendSlack) {
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
          aiTriage,
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

  /**
   * Re-executes a failed action for observability dead-letter recovery.
   * Re-constructs original webhook context from PostgreSQL and updates the action audit log.
   */
  async retryAction(actionLogId: string): Promise<{
    success: boolean;
    actionLog: ActionLog;
    error?: string;
  }> {
    const action = await actionLogRepository.findById(actionLogId);
    if (!action) {
      throw new Error(`Action log ${actionLogId} not found.`);
    }

    const eventLog = await eventLogRepository.findById(action.eventLogId);
    if (!eventLog) {
      throw new Error(`Parent event log ${action.eventLogId} not found.`);
    }

    const { eventType, action: evtAction, repoFullName, payload } = eventLog;
    const issueOrPr = (payload as any)?.issue || (payload as any)?.pull_request;
    const issueNumber: number | undefined = issueOrPr?.number;
    const title: string = issueOrPr?.title || "Untitled";
    const htmlUrl: string = issueOrPr?.html_url || `https://github.com/${repoFullName}`;
    const bodySnippet: string = issueOrPr?.body || "";
    const sender = eventLog.sender || "collaborator";
    const isPR = eventType === "pull_request";
    const isMerged = isPR && Boolean((payload as any)?.pull_request?.merged);
    const [owner, repo] = (repoFullName || "").split("/");

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

    let retrySuccess = false;
    let retryDetails: any = action.details;
    let retryError: string | null = null;

    log.info({ actionLogId, actionType: action.actionType, repo: repoFullName }, "Executing manual action retry");

    try {
      if (action.actionType === "slack_alert") {
        // Fetch AI triage details if previously generated
        const siblingActions = await actionLogRepository.findByEventLogId(eventLog.id);
        const aiAction = siblingActions.find((a) => a.actionType === "ai_triage" && a.status === "SUCCESS");
        const aiTriage = aiAction?.details as AITriageResult | undefined;

        const slackResult = await slackClient.sendNotification({
          title,
          repoFullName: repoFullName || "unknown",
          eventType: eventType as "issues" | "pull_request",
          action: evtAction || "opened",
          sender,
          htmlUrl,
          bodySnippet,
          isMerged,
          issueNumber,
          aiTriage,
        });

        retrySuccess = slackResult.success;
        retryError = slackResult.error || null;
      } else if (action.actionType === "ai_triage") {
        const aiResult = await geminiClient.triageContent({
          title,
          bodySnippet,
          eventType: eventType as "issues" | "pull_request",
          repoFullName: repoFullName || "unknown",
        });

        retrySuccess = aiResult.success;
        if (aiResult.success && aiResult.data) {
          retryDetails = aiResult.data;
        } else {
          retryError = aiResult.error || "AI triage retry failed";
        }
      } else if (action.actionType === "github_comment") {
        if (!accessToken || !issueNumber || !owner || !repo) {
          throw new Error("Missing GitHub credentials or issue metadata for comment retry");
        }

        const commentBody = isPR
          ? `👋 Hi @${sender}!\n\nThank you for opening this pull request. (Retried notification)`
          : `👋 Hi @${sender}!\n\nThank you for reporting this issue. (Retried notification)`;

        const commentResult = await githubClient.createComment({
          accessToken,
          owner,
          repo,
          issueNumber,
          body: commentBody,
        });

        retrySuccess = commentResult.success;
        retryError = commentResult.error || null;
        if (commentResult.success) {
          retryDetails = { issueNumber, commentId: commentResult.commentId, htmlUrl: commentResult.htmlUrl };
        }
      } else if (action.actionType === "github_label") {
        if (!accessToken || !issueNumber || !owner || !repo) {
          throw new Error("Missing GitHub credentials or issue metadata for label retry");
        }

        const labelResult = await githubClient.addLabels({
          accessToken,
          owner,
          repo,
          issueNumber,
          labels: ["triage"],
        });

        retrySuccess = labelResult.success;
        retryError = labelResult.error || null;
        if (labelResult.success) {
          retryDetails = { labels: labelResult.labelsAdded };
        }
      } else {
        throw new Error(`Unsupported action type for retry: ${action.actionType}`);
      }
    } catch (err: any) {
      retrySuccess = false;
      retryError = err?.message || String(err);
    }

    const updated = await actionLogRepository.updateActionLog(action.id, {
      status: retrySuccess ? "SUCCESS" : "FAILED",
      details: retryDetails,
      errorMessage: retryError,
      retryCount: action.retryCount + 1,
    });

    log.info(
      {
        actionLogId: action.id,
        actionType: action.actionType,
        status: updated?.status,
        retryCount: updated?.retryCount,
      },
      `Completed retry for action ${action.actionType}`
    );

    return {
      success: retrySuccess,
      actionLog: updated!,
      error: retryError || undefined,
    };
  }
}

export const actionService = new ActionService();
