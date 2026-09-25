const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface ActionExecutionLog {
  id: string;
  eventLogId: string;
  actionType: "github_comment" | "github_label" | "slack_alert" | string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  details: any;
  errorMessage: string | null;
  retryCount?: number;
  createdAt: string;
}

export interface WebhookEventLog {
  id: string;
  deliveryId: string;
  repositoryId: string | null;
  repoFullName: string | null;
  eventType: string;
  action: string | null;
  sender: string | null;
  payload: any;
  createdAt: string;
  actionLogs?: ActionExecutionLog[];
}

/**
 * Fetch recent webhook event logs from backend/Supabase
 */
export async function fetchEventLogs(): Promise<WebhookEventLog[]> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/events`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch event logs.");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Retry a failed action execution (Dead-letter recovery)
 */
export async function retryActionLog(actionLogId: string): Promise<ActionExecutionLog> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/actions/${actionLogId}/retry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    signal: AbortSignal.timeout(30000), // 30 seconds max
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to retry action.");
  }

  return result.data;
}
