import { env } from "../../config/env";
import { AITriageResult } from "../ai/gemini.client";
import { createChildLogger } from "../../utils/logger";
import { withRetry } from "../../utils/retry";

const log = createChildLogger("SlackClient");

export interface SlackNotificationPayload {
  title: string;
  repoFullName: string;
  eventType: "issues" | "pull_request";
  action: string;
  sender: string;
  htmlUrl: string;
  bodySnippet?: string;
  isMerged?: boolean;
  issueNumber?: number;
  aiTriage?: AITriageResult;
  botOwnerName?: string;
}

export class SlackClient {
  /**
   * Dispatches a structured, formal notification to Slack via Incoming Webhook.
   * Format:
   * 📁 Repository: <Repo link>
   * 🔀 Pull Request / 📋 Issue: <Link>
   * 📊 Status: Open / Closed / Merged
   * 👤 Opened by / Closed by: @author
   * 🤖 AI Summary: (if available)
   * 📝 Description: (if provided)
   */
  async sendNotification(
    payload: SlackNotificationPayload,
    targetWebhookUrl?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = targetWebhookUrl?.trim();

    if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/services/")) {
      return {
        success: false,
        error: "Slack webhook URL is not configured for this repository.",
      };
    }

    const isPR = payload.eventType === "pull_request";
    const isMerged = Boolean(payload.isMerged);
    const isClosed = payload.action === "closed";
    const isReopened = payload.action === "reopened";

    // 1. Determine Status, Actor label, and Accent Color
    let statusText = "Open";
    let actionByLabel = "Opened by";
    let accentColor = "#2da44e"; // GitHub Green (Open)

    if (isPR) {
      if (isMerged) {
        statusText = "Merged";
        actionByLabel = "Merged by";
        accentColor = "#8250df"; // GitHub Purple (Merged)
      } else if (isClosed) {
        statusText = "Closed";
        actionByLabel = "Closed by";
        accentColor = "#cf222e"; // GitHub Red (Closed)
      } else if (isReopened) {
        statusText = "Reopened";
        actionByLabel = "Reopened by";
        accentColor = "#0969da"; // GitHub Blue (Reopened)
      }
    } else {
      if (isClosed) {
        statusText = "Closed";
        actionByLabel = "Closed by";
        accentColor = "#cf222e"; // GitHub Red (Closed)
      } else if (isReopened) {
        statusText = "Reopened";
        actionByLabel = "Reopened by";
        accentColor = "#0969da"; // GitHub Blue (Reopened)
      }
    }

    const itemLabel = isPR ? "🔀 *Pull Request:*" : "📋 *Issue:*";
    const issueRef = payload.issueNumber ? `#${payload.issueNumber} - ` : "";

    // 2. Structured Line-by-Line Content
    const contentLines: string[] = [
      `📁 *Repository:* <https://github.com/${payload.repoFullName}|${payload.repoFullName}>`,
      `${itemLabel} <${payload.htmlUrl}|${issueRef}${payload.title}>`,
      `📊 *Status:* \`${statusText}\``,
      `👤 *${actionByLabel}:* <https://github.com/${payload.sender}|@${payload.sender}> (Bot)`,
    ];

    // Optional AI Triage Section
    if (payload.aiTriage) {
      const p = payload.aiTriage;
      const priorityEmoji =
        p.priority === "CRITICAL"
          ? "🚨"
          : p.priority === "HIGH"
          ? "🔴"
          : p.priority === "MEDIUM"
          ? "🟡"
          : "🟢";

      const labelsFormatted =
        p.suggestedLabels.length > 0
          ? p.suggestedLabels.map((l) => `\`${l}\``).join(" ")
          : "_none_";

      contentLines.push(
        `🤖 *AI Summary:* _${p.summary}_`,
        `⚡ *Priority:* ${priorityEmoji} \`${p.priority}\` • *Suggested Labels:* ${labelsFormatted}`
      );
    }

    // Optional Description Quote
    const cleanSnippet = payload.bodySnippet?.trim();
    if (cleanSnippet) {
      const truncated = cleanSnippet.length > 300 ? cleanSnippet.slice(0, 300) + "..." : cleanSnippet;
      const quoted = truncated
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      contentLines.push(`📝 *Description:*\n${quoted}`);
    }

    // 3. Assemble Block Kit Attachment
    const fallbackText = `[${payload.repoFullName}] ${isPR ? "PR" : "Issue"} ${issueRef}${statusText} by @${payload.sender}`;

    const blocks: any[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: contentLines.join("\n"),
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "View on GitHub ↗",
            emoji: true,
          },
          url: payload.htmlUrl,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🤖 *GitHub Automation Bot*${payload.botOwnerName ? ` (on behalf of @${payload.botOwnerName})` : ""} • <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|just now>`,
          },
        ],
      },
    ];

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attachments: [
                {
                  fallback: fallbackText,
                  color: accentColor,
                  blocks,
                },
              ],
            }),
            signal: AbortSignal.timeout(30000),
          });

          // Transient server errors (500, 502, 503, 504) should trigger a retry
          if (res.status >= 500) {
            throw new Error(`Slack API transient HTTP ${res.status}`);
          }
          return res;
        },
        { maxRetries: 2, delayMs: 800, label: "Slack Webhook" }
      );

      if (!response.ok) {
        const errorText = await response.text();
        log.error(
          { status: response.status, errorText, repo: payload.repoFullName },
          "Slack API returned error status"
        );
        return {
          success: false,
          error: `Slack API error (HTTP ${response.status}): ${errorText}`,
        };
      }

      log.info(
        { repo: payload.repoFullName, action: payload.action, title: payload.title },
        "Slack notification dispatched successfully"
      );
      return { success: true };
    } catch (err: any) {
      log.error({ err, repo: payload.repoFullName }, "Slack network error occurred");
      return {
        success: false,
        error: `Slack network error: ${err?.message || String(err)}`,
      };
    }
  }

  /**
   * Sends a simple verification ping to test a newly entered Slack webhook URL
   */
  async sendTestPing(
    webhookUrl: string,
    repoFullName: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl.startsWith("https://hooks.slack.com/services/")) {
      return {
        success: false,
        error: "Invalid Slack Webhook URL. It must begin with https://hooks.slack.com/services/",
      };
    }

    try {
      const response = await fetch(cleanUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🎉 *GitHub Automation Bot Connection Test*\n\n✅ Slack Incoming Webhook verified successfully for repository: \`${repoFullName}\`!\nYou will now receive real-time automated notifications here when issues, pull requests, or rules trigger.`,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          error: `Slack rejected webhook (${response.status}): ${errText}`,
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: `Slack test connection failed: ${err?.message || String(err)}`,
      };
    }
  }
}

export const slackClient = new SlackClient();
