const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface UserProfile {
  id: string;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * Fetch currently authenticated user profile
 * Uses cookie or localStorage token, and refreshes the stored token
 */
export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const storedToken = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    },
    credentials: "include", // Transmits cookie
  });

  if (!response.ok) {
    localStorage.removeItem("token");
    return null;
  }

  const result = await response.json();

  // Save token delivered safely via the JSON body
  if (result.data?.token) {
    localStorage.setItem("token", result.data.token);
  }

  return result.data.user;
}

/**
 * Logout current user
 */
export async function logoutUser(): Promise<void> {
  const storedToken = localStorage.getItem("token");

  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    },
    credentials: "include",
  });

  localStorage.removeItem("token");
}

export const GITHUB_LOGIN_URL = `${API_URL}/api/auth/github`;
