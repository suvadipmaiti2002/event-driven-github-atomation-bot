import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useRepositories } from "../hooks/useRepositories";
import {
  LogOut,
  Radio,
  FolderGit2,
  Lock,
  Globe,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Unplug,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const {
    availableRepos,
    connectedRepos,
    isLoading,
    actionLoadingId,
    error,
    handleConnect,
    handleDisconnect,
    refreshRepos,
  } = useRepositories();

  const [selectedRepoId, setSelectedRepoId] = useState<string>("");

  const handleSelectAndConnect = () => {
    const target = availableRepos.find((r) => r.id === selectedRepoId);
    if (target) {
      handleConnect(target);
      setSelectedRepoId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white">GitHub Automation Bot</h1>
              <p className="text-xs text-slate-400">Event-Driven Automation & Slack Alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* User Profile Banner */}
        {user && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-16 h-16 rounded-full border-2 border-indigo-500/40 shadow"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{user.username}</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    GitHub Verified
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-0.5">{user.email || "No public email"}</p>
              </div>
            </div>

            <button
              onClick={refreshRepos}
              disabled={isLoading}
              className="flex items-center gap-2 self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Sync Repos
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Connected Repositories */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Connected Repositories</h2>
              <p className="text-xs text-slate-400">
                Repositories currently monitored by the automation bot
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              {connectedRepos.length} Connected
            </span>
          </div>

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
              <p className="text-xs">Loading repositories...</p>
            </div>
          ) : connectedRepos.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No repositories connected</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Connect a repository below to start listening for webhook events, triaging issues, and dispatching alerts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {repo.repoFullName}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Webhook ID: {repo.webhookId || "Local / Mocked"} • Connected{" "}
                        {new Date(repo.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDisconnect(repo.id)}
                    disabled={actionLoadingId === repo.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition disabled:opacity-50"
                  >
                    {actionLoadingId === repo.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unplug className="w-3.5 h-3.5" />
                    )}
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Connect a New Repository */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Connect a Repository</h2>
          <p className="text-xs text-slate-400 mb-4">
            Select a repository from your GitHub account to connect to the bot
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">-- Choose a repository from your GitHub account --</option>
              {availableRepos
                .filter((r) => !r.isConnected)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName} {r.isPrivate ? "🔒 (Private)" : "🌐 (Public)"}
                  </option>
                ))}
            </select>

            <button
              onClick={handleSelectAndConnect}
              disabled={!selectedRepoId || actionLoadingId === selectedRepoId}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoadingId === selectedRepoId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Connect Repository
            </button>
          </div>

          {/* Quick list of available repos */}
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Available GitHub Repositories ({availableRepos.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
              {availableRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {repo.isPrivate ? (
                      <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="text-slate-300 font-medium truncate" title={repo.fullName}>
                      {repo.name}
                    </span>
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {repo.isConnected ? (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConnect(repo)}
                      disabled={actionLoadingId === repo.id}
                      className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline text-[11px] disabled:opacity-50"
                    >
                      {actionLoadingId === repo.id ? "Connecting..." : "+ Connect"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600">
        Event-Driven GitHub Automation Bot
      </footer>
    </div>
  );
}

export default DashboardPage;
