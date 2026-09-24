import { useState, useEffect, useCallback } from "react";
import {
  GitHubRepository,
  ConnectedRepository,
  fetchAvailableRepositories,
  fetchConnectedRepositories,
  connectRepository,
  disconnectRepository,
} from "../api/repositories";

export function useRepositories() {
  const [availableRepos, setAvailableRepos] = useState<GitHubRepository[]>([]);
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepository[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAllRepositories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [available, connected] = await Promise.all([
        fetchAvailableRepositories(),
        fetchConnectedRepositories(),
      ]);
      setAvailableRepos(available);
      setConnectedRepos(connected);
    } catch (err: any) {
      setError(err?.message || "Failed to load repositories.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllRepositories();
  }, [loadAllRepositories]);

  const handleConnect = async (repo: GitHubRepository) => {
    setActionLoadingId(repo.id);
    setError(null);
    try {
      await connectRepository({
        githubRepoId: repo.id,
        repoOwner: repo.owner,
        repoName: repo.name,
        repoFullName: repo.fullName,
      });
      // Refresh repository lists
      await loadAllRepositories();
    } catch (err: any) {
      setError(err?.message || "Failed to connect repository.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDisconnect = async (repoId: string) => {
    setActionLoadingId(repoId);
    setError(null);
    try {
      await disconnectRepository(repoId);
      // Refresh repository lists
      await loadAllRepositories();
    } catch (err: any) {
      setError(err?.message || "Failed to disconnect repository.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return {
    availableRepos,
    connectedRepos,
    isLoading,
    actionLoadingId,
    error,
    handleConnect,
    handleDisconnect,
    refreshRepos: loadAllRepositories,
  };
}
