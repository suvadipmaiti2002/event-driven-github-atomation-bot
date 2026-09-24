import { env } from "../../config/env";

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
}

export class SlackClient {
  /**
   * Dispatches a structured, formal notification to Slack via Incoming Webhook.
   * Format:
   * 📁 Repository: <Repo link>
   * 🔀 Pull Request / 📋 Issue: <Link>
   * 📊 Status: Open / Closed / Merged
   * 👤 Opened by / Closed by: @author
   * 📝 Description: (if provided)
   */
  async sendNotification(payload: SlackNotificationPayload): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = env.SLACK_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes("hooks.slack.com/services/T00000000")) {
      return {
        success: false,
        error: "Slack webhook URL is not configured or using placeholder.",
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
      `👤 *${actionByLabel}:* <https://github.com/${payload.sender}|@${payload.sender}>`,
    ];

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
            text: `🤖 *GitHub Automation Bot* • <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|just now>`,
          },
        ],
      },
    ];

    try {
      const response = await fetch(webhookUrl, {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Slack API error (HTTP ${response.status}): ${errorText}`,
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: `Slack network error: ${err?.message || String(err)}`,
      };
    }
  }
}

export const slackClient = new SlackClient();
