const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface AutomationRule {
  id: string;
  repositoryId: string;
  name: string;
  eventType: "issues" | "pull_request" | "all";
  matchField: "always" | "title_contains" | "body_contains" | "author_is";
  matchValue: string | null;
  actionLabel: string | null;
  actionSlack: boolean;
  actionComment: string | null;
  actionAiTriage: boolean;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleDTO {
  name: string;
  eventType: "issues" | "pull_request" | "all";
  matchField: "always" | "title_contains" | "body_contains" | "author_is";
  matchValue?: string | null;
  actionLabel?: string | null;
  actionSlack?: boolean;
  actionComment?: string | null;
  actionAiTriage?: boolean;
}

/**
 * Fetch all configured automation rules for a connected repository
 */
export async function fetchRepositoryRules(repoId: string): Promise<AutomationRule[]> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/repositories/${repoId}/rules`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch automation rules.");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Toggle a rule active/inactive
 */
export async function toggleRule(ruleId: string, isActive: boolean): Promise<AutomationRule> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/rules/${ruleId}/toggle`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ isActive }),
  });

  if (!response.ok) {
    throw new Error("Failed to update rule status.");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create a new custom rule
 */
export async function createRule(
  repoId: string,
  ruleData: CreateRuleDTO
): Promise<AutomationRule> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/repositories/${repoId}/rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(ruleData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || "Failed to create custom rule.");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Delete a custom rule
 */
export async function deleteRule(ruleId: string): Promise<void> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/rules/${ruleId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to delete rule.");
  }
}
