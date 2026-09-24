const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  htmlUrl: string;
  isConnected: boolean;
}

export interface ConnectedRepository {
  id: string;
  githubRepoId: string;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  webhookId: string | null;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch list of user's GitHub repositories
 */
export async function fetchAvailableRepositories(): Promise<GitHubRepository[]> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/github/available-repositories`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load GitHub repositories.");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetch list of connected repositories from Supabase
 */
export async function fetchConnectedRepositories(): Promise<ConnectedRepository[]> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/repositories/connected`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load connected repositories.");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Connect a repository and install webhook
 */
export async function connectRepository(repo: {
  githubRepoId: string;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
}): Promise<ConnectedRepository> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/repositories/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(repo),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.message || "Failed to connect repository.");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Soft-disconnect a repository and remove webhook
 */
export async function disconnectRepository(repoId: string): Promise<void> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/repositories/${repoId}/disconnect`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to disconnect repository.");
  }
}
