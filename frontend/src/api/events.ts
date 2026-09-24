const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
