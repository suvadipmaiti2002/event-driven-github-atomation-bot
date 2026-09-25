import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useRepositories } from "../hooks/useRepositories";
import { useEvents } from "../hooks/useEvents";
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
  Activity,
  GitPullRequest,
  Tag,
  GitCommit,
  MessageSquare,
  Bell,
  Sparkles,
  ChevronDown,
  RotateCw,
  X,
} from "lucide-react";
import { ActionExecutionLog, retryActionLog } from "../api/events";
import { RulesManager } from "../components/RulesManager";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [selectedRulesRepoId, setSelectedRulesRepoId] = useState<string | null>(null);
  const {
    availableRepos,
    connectedRepos,
    isLoading: isReposLoading,
    actionLoadingId,
    error: repoError,
    handleConnect,
    handleDisconnect,
    refreshRepos,
  } = useRepositories();

  const {
    events,
    isLoadingEvents,
    eventsError,
    refreshEvents,
  } = useEvents(); // Automatically polls every 3 seconds

  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [selectedEventsRepo, setSelectedEventsRepo] = useState<string>("all");
  const [retryingActionId, setRetryingActionId] = useState<string | null>(null);
  const [showOnlyFailures, setShowOnlyFailures] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  // Auto-dismiss toast notification after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const activeRulesRepo =
    connectedRepos.find((r) => r.id === selectedRulesRepoId) || connectedRepos[0] || null;

  const eventRepoOptions = connectedRepos.map((r) => r.repoFullName);

  const failedEventsCount = events.filter((evt) =>
    evt.actionLogs?.some((a) => a.status === "FAILED")
  ).length;

  const filteredEvents = events.filter((evt) => {
    if (selectedEventsRepo !== "all") {
      const matchRepo = evt.repositoryId === selectedEventsRepo || evt.repoFullName === selectedEventsRepo;
      if (!matchRepo) return false;
    }
    if (showOnlyFailures) {
      return evt.actionLogs?.some((a) => a.status === "FAILED");
    }
    return true;
  });

  const formatErrorMessage = (raw: string): string => {
    if (!raw) return "An unexpected error occurred.";
    if (raw.includes("503") || raw.includes("high demand") || raw.includes("UNAVAILABLE")) {
      return "Gemini AI is temporarily busy with high demand. Please try again in a few moments.";
    }
    if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
      return "Gemini API rate limit reached. Please wait a moment before retrying.";
    }
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed?.error?.message) return parsed.error.message;
        if (parsed?.message) return parsed.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    return raw.replace(/^Error:\s*/, "");
  };

  const handleRetryAction = async (actionLogId: string) => {
    try {
      setRetryingActionId(actionLogId);
      await retryActionLog(actionLogId);
      await refreshEvents();
      setToast({
        type: "success",
        message: "Action retried successfully!",
      });
    } catch (err: any) {
      await refreshEvents();
      const friendlyMsg = formatErrorMessage(err?.message || "Failed to retry action.");
      setToast({
        type: "error",
        message: friendlyMsg,
      });
    } finally {
      setRetryingActionId(null);
    }
  };

  // If the currently filtered repo was disconnected, revert back to "all"
  useEffect(() => {
    if (selectedEventsRepo !== "all" && !eventRepoOptions.includes(selectedEventsRepo)) {
      setSelectedEventsRepo("all");
    }
  }, [eventRepoOptions, selectedEventsRepo]);

  const handleSelectAndConnect = () => {
    const target = availableRepos.find((r) => r.id === selectedRepoId);
    if (target) {
      handleConnect(target);
      setSelectedRepoId("");
    }
  };

  const handleRefreshAll = () => {
    refreshRepos();
    refreshEvents();
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "issues":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Tag className="w-3.5 h-3.5" />
            Issue
          </span>
        );
      case "pull_request":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <GitPullRequest className="w-3.5 h-3.5" />
            PR
          </span>
        );
      case "push":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <GitCommit className="w-3.5 h-3.5" />
            Push
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {eventType}
          </span>
        );
    }
  };

  const getActionBadge = (action: string | null, payload?: any) => {
    const isMerged = payload?.pull_request?.merged;
    const act = isMerged ? "merged" : (action || "triggered").toLowerCase();

    switch (act) {
      case "opened":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            OPENED
          </span>
        );
      case "merged":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
            MERGED
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
            CLOSED
          </span>
        );
      case "reopened":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
            REOPENED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            {act.toUpperCase()}
          </span>
        );
    }
  };

  // Helper to extract issue/PR title, number, and direct GitHub URL
  const getEventDetails = (evt: any) => {
    const p = evt.payload;
    if (p?.issue) {
      return {
        title: p.issue.title,
        number: `#${p.issue.number}`,
        url: p.issue.html_url,
      };
    }
    if (p?.pull_request) {
      return {
        title: p.pull_request.title,
        number: `#${p.pull_request.number}`,
        url: p.pull_request.html_url,
      };
    }
    if (p?.head_commit) {
      return {
        title: p.head_commit.message?.split("\n")[0] || "Commit pushed",
        number: p.head_commit.id?.slice(0, 7) || "",
        url: p.head_commit.url || p.compare,
      };
    }
    return {
      title: null,
      number: null,
      url: p?.repository?.html_url || null,
    };
  };

  // Helper to render action execution status badges
  const renderActionBadges = (actionLogs?: ActionExecutionLog[]) => {
    if (!actionLogs || actionLogs.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 mr-1">
          Actions:
        </span>
        {actionLogs.map((act) => {
          const isSuccess = act.status === "SUCCESS";
          let label = act.actionType;
          let icon = <Activity className="w-2.5 h-2.5" />;

          if (act.actionType === "ai_triage") {
            label = act.details?.priority ? `AI: ${act.details.priority}` : "AI Triage";
            icon = <Sparkles className="w-2.5 h-2.5 text-indigo-400" />;
          } else if (act.actionType === "github_comment") {
            label = "Comment";
            icon = <MessageSquare className="w-2.5 h-2.5" />;
          } else if (act.actionType === "github_label") {
            label = "Label";
            icon = <Tag className="w-2.5 h-2.5" />;
          } else if (act.actionType === "slack_alert") {
            label = "Slack";
            icon = <Bell className="w-2.5 h-2.5" />;
          }

          const badgeClasses = isSuccess
            ? act.actionType === "ai_triage"
              ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-300 border-rose-500/20";

          const isRetrying = retryingActionId === act.id;
          const retryCount = act.retryCount || 0;

          return (
            <div key={act.id} className="inline-flex items-center gap-1">
              <span
                title={
                  isSuccess
                    ? `${label}: Executed successfully${retryCount > 0 ? ` (after ${retryCount} retry)` : ""}`
                    : `${label}: Failed - ${act.errorMessage || "Unknown error"}`
                }
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition cursor-default ${badgeClasses}`}
              >
                {icon}
                <span>{label}</span>
                <span className="font-semibold text-[9px]">
                  {isSuccess ? "✓" : "✗"}
                </span>
                {retryCount > 0 && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800/80 text-indigo-300 font-mono">
                    {retryCount}r
                  </span>
                )}
              </span>

              {/* Inline Retry Button for Failed Actions */}
              {!isSuccess && (
                <button
                  onClick={() => handleRetryAction(act.id)}
                  disabled={isRetrying}
                  title={`Retry ${label}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition disabled:opacity-50"
                >
                  <RotateCw className={`w-2.5 h-2.5 ${isRetrying ? "animate-spin" : ""}`} />
                  <span>{isRetrying ? "Retrying..." : "Retry"}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
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
              onClick={handleRefreshAll}
              disabled={isReposLoading || isLoadingEvents}
              className="flex items-center gap-2 self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReposLoading || isLoadingEvents ? "animate-spin" : ""}`} />
              Sync All
            </button>
          </div>
        )}

        {/* Errors */}
        {(repoError || eventsError) && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{repoError || eventsError}</span>
          </div>
        )}

        {/* Section 1: Connected Repositories (Scrollable) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Connected Repositories</h2>
              <p className="text-xs text-slate-400">
                Repositories currently sending real-time webhooks to the bot
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              {connectedRepos.length} Connected
            </span>
          </div>

          {isReposLoading ? (
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
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
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
                        {/* Direct Clickable Link to GitHub Repository */}
                        <a
                          href={`https://github.com/${repo.repoFullName}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-white text-sm hover:text-indigo-400 transition inline-flex items-center gap-1.5 group"
                        >
                          <span>{repo.repoFullName}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
                        </a>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Active Webhook
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Connected {new Date(repo.createdAt).toLocaleDateString()}
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

        {/* Section: Automation Rules (Configurable Rules Engine) */}
        {connectedRepos.length > 0 && activeRulesRepo && (
          <RulesManager
            repositoryId={activeRulesRepo.id}
            repoFullName={activeRulesRepo.repoFullName}
            connectedRepos={connectedRepos}
            onSelectRepo={setSelectedRulesRepoId}
          />
        )}

        {/* Section 2: Live Activity Stream (Scrollable Container) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">Live Activity Stream</h2>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time events received from your connected repositories
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Repository Filter Dropdown */}
              <div className="relative">
                <select
                  value={selectedEventsRepo}
                  onChange={(e) => setSelectedEventsRepo(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none"
                >
                  <option value="all">All Repositories ({events.length})</option>
                  {eventRepoOptions.map((repoName) => {
                    const count = events.filter((e) => e.repoFullName === repoName).length;
                    return (
                      <option key={repoName} value={repoName}>
                        {repoName} ({count})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Failures Only Filter Button */}
              <button
                onClick={() => setShowOnlyFailures(!showOnlyFailures)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                  showOnlyFailures
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-700"
                }`}
                title="Filter events that have failed actions needing retry"
              >
                <AlertCircle className={`w-3.5 h-3.5 ${showOnlyFailures ? "text-rose-400" : "text-slate-500"}`} />
                <span>Failures {failedEventsCount > 0 ? `(${failedEventsCount})` : ""}</span>
              </button>

              <button
                onClick={refreshEvents}
                disabled={isLoadingEvents}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition border border-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {isLoadingEvents && events.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
              <p className="text-xs">Loading activity stream...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No activity yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Open a test issue or pull request on your connected repository to see activity appear here in real-time.
              </p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">
                {showOnlyFailures ? "No failed actions found" : "No events for this repository"}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {showOnlyFailures
                  ? "All actions have executed successfully without failures."
                  : `No activity recorded yet for ${selectedEventsRepo}. Try selecting "All Repositories" or trigger an event in that repo.`}
              </p>
            </div>
          ) : (
            /* Fixed-height scrollable container for event logs */
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredEvents.map((evt) => {
                const details = getEventDetails(evt);
                return (
                  <div
                    key={evt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getEventBadge(evt.eventType)}</div>
                      <div>
                        {/* Repository & Action */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {evt.repoFullName && (
                            <a
                              href={`https://github.com/${evt.repoFullName}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-indigo-300 border border-slate-700 hover:text-indigo-200 transition"
                            >
                              <FolderGit2 className="w-3 h-3 text-indigo-400" />
                              {evt.repoFullName}
                            </a>
                          )}
                          {getActionBadge(evt.action, evt.payload)}
                          {evt.sender && (
                            <span className="text-xs text-slate-400">
                              by <span className="text-indigo-400 font-medium">@{evt.sender}</span>
                            </span>
                          )}
                        </div>

                        {/* Clickable Issue/PR Title with Direct Link to GitHub */}
                        {details.title && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {details.number && (
                              <span className="text-xs font-mono text-slate-400 font-semibold">
                                {details.number}
                              </span>
                            )}
                            {details.url ? (
                              <a
                                href={details.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-slate-100 hover:text-indigo-400 transition inline-flex items-center gap-1 group"
                              >
                                <span>{details.title}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 opacity-80" />
                              </a>
                            ) : (
                              <span className="text-sm font-medium text-slate-200">
                                {details.title}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Automated Action Badges (Comment, Label, Slack, AI) */}
                        {renderActionBadges(evt.actionLogs)}

                        {/* AI Triage Executive Summary Banner (if generated) */}
                        {(() => {
                          const aiLog = evt.actionLogs?.find(
                            (a) => a.actionType === "ai_triage" && a.status === "SUCCESS" && a.details?.summary
                          );
                          if (!aiLog?.details?.summary) return null;

                          const p = aiLog.details;
                          const priorityColor =
                            p.priority === "CRITICAL" || p.priority === "HIGH"
                              ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                              : p.priority === "MEDIUM"
                              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                          return (
                            <div className="mt-2.5 text-xs bg-slate-900/90 border border-indigo-500/20 rounded-lg p-2.5 text-slate-300">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <div className="flex items-center gap-1 font-semibold text-indigo-300 text-[11px]">
                                  <Sparkles className="w-3 h-3 text-indigo-400" />
                                  <span>AI Triage</span>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${priorityColor}`}>
                                  Priority: {p.priority}
                                </span>
                                {p.category && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    {p.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-300 text-[11px] leading-relaxed">
                                {p.summary}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <span className="text-xs text-slate-400 self-end sm:self-center font-mono">
                      {new Date(evt.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Connect a New Repository */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Connect a Repository</h2>
          <p className="text-xs text-slate-400 mb-4">
            Select a repository from your GitHub account to connect to the bot
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              disabled={isReposLoading}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
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

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md ${
              toast.type === "success"
                ? "bg-emerald-950/95 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/95 border-rose-500/40 text-rose-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs leading-relaxed">
              <p className="font-semibold mb-0.5">
                {toast.type === "success" ? "Success" : "Retry Status"}
              </p>
              <p className="opacity-90">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white transition p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
