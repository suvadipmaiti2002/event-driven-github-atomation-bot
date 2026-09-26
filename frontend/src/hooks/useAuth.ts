import { useState, useEffect, useCallback } from "react";
import { UserProfile, fetchCurrentUser, logoutUser, GITHUB_LOGIN_URL } from "../api/auth";

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((profile) => setUser(profile))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(() => {
    window.location.href = GITHUB_LOGIN_URL;
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setIsLoading(false);
      window.location.href = "/login";
    }
  }, []);

  return {
    user,
    isLoading,
    login,
    logout,
  };
}
