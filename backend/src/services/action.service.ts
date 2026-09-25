import { EventLog, Rule } from "../db/schema";
import { actionLogRepository } from "../repositories/action-log.repository";
import { repositoryRepository } from "../repositories/repository.repository";
import { userRepository } from "../repositories/user.repository";
import { ruleService } from "./rule.service";
import { githubClient } from "../integrations/github/github.client";
import { slackClient } from "../integrations/slack/slack.client";
import { geminiClient, AITriageResult } from "../integrations/ai/gemini.client";

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

          const matchVal = (r.matchValue || "").toLowerCase();
          if (r.matchField === "always") return true;
          if (!matchVal) return false;

          if (r.matchField === "title_contains") {
            return title.toLowerCase().includes(matchVal);
          }
          if (r.matchField === "body_contains") {
            return bodySnippet.toLowerCase().includes(matchVal);
          }
          if (r.matchField === "author_is") {
            return sender.toLowerCase() === matchVal;
          }
          return false;
        });

        if (matchedCustomRules.length > 0) {
          console.log(
            `[ActionService] 🎯 Matched ${matchedCustomRules.length} custom rule(s): ${matchedCustomRules
              .map((r) => r.name)
              .join(", ")}`
          );
        }
      } catch (err) {
        console.warn("[ActionService] Error loading rules, proceeding with standard defaults:", err);
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
}

export const actionService = new ActionService();
