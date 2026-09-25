import { useState, useEffect, FormEvent } from "react";
import {
  AutomationRule,
  CreateRuleDTO,
  fetchRepositoryRules,
  toggleRule,
  createRule,
  deleteRule,
} from "../api/rules";
import {
  Sliders,
  Sparkles,
  MessageSquare,
  Tag,
  Bell,
  Plus,
  Trash2,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";

interface RulesManagerProps {
  repositoryId: string;
  repoFullName: string;
  connectedRepos?: { id: string; repoFullName: string }[];
  onSelectRepo?: (repoId: string) => void;
}

export function RulesManager({
  repositoryId,
  repoFullName,
  connectedRepos = [],
  onSelectRepo,
}: RulesManagerProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form State for new custom rule
  const [newRuleName, setNewRuleName] = useState<string>("");
  const [newEventType, setNewEventType] = useState<"issues" | "pull_request" | "all">("issues");
  const [newMatchField, setNewMatchField] = useState<"title_contains" | "body_contains" | "author_is">("title_contains");
  const [newMatchValue, setNewMatchValue] = useState<string>("");
  const [newActionLabel, setNewActionLabel] = useState<string>("");

  // Load rules on mount or repository change
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchRepositoryRules(repositoryId);
        if (isMounted) setRules(data);
      } catch (err: any) {
        if (isMounted) setError(err?.message || "Failed to load automation rules.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (repositoryId) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [repositoryId]);

  // Auto-dismiss transient errors after 4 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle instant toggle
  const handleToggle = async (rule: AutomationRule) => {
    setError(null);
    const nextState = !rule.isActive;
    // Optimistic UI update
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, isActive: nextState } : r))
    );
    setTogglingId(rule.id);

    try {
      await toggleRule(rule.id, nextState);
    } catch (err: any) {
      // Rollback on error
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !nextState } : r))
      );
      setError(err?.message || "Failed to update rule status.");
    } finally {
      setTogglingId(null);
    }
  };

  // Handle custom rule deletion
  const handleDelete = async (ruleId: string) => {
    if (!window.confirm("Are you sure you want to delete this custom rule?")) return;
    setError(null);

    try {
      await deleteRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err: any) {
      setError(err?.message || "Failed to delete rule.");
    }
  };

  // Handle form submission
  const handleCreateRule = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newRuleName.trim()) {
      alert("Please provide a name for this rule.");
      return;
    }
    if (!newMatchValue.trim()) {
      alert("Please enter a keyword or author name to match.");
      return;
    }
    if (!newActionLabel.trim()) {
      alert("Please specify a label name to apply (e.g. bug).");
      return;
    }

    setIsCreating(true);
    try {
      const payload: CreateRuleDTO = {
        name: newRuleName.trim(),
        eventType: newEventType,
        matchField: newMatchField,
        matchValue: newMatchValue.trim(),
        actionLabel: newActionLabel.trim(),
      };

      const created = await createRule(repositoryId, payload);
      setRules((prev) => [...prev, created]);
      setIsModalOpen(false);

      // Reset form
      setNewRuleName("");
      setNewMatchValue("");
      setNewActionLabel("");
    } catch (err: any) {
      alert(err?.message || "Failed to create rule.");
    } finally {
      setIsCreating(false);
    }
  };

  const defaultRules = rules.filter((r) => r.isDefault);
  const customRules = rules.filter((r) => !r.isDefault);

  // Helper icons for default rules
  const getRuleIcon = (rule: AutomationRule) => {
    if (rule.actionAiTriage) return <Sparkles className="w-5 h-5 text-purple-400" />;
    if (rule.actionComment) return <MessageSquare className="w-5 h-5 text-blue-400" />;
    if (rule.actionLabel) return <Tag className="w-5 h-5 text-emerald-400" />;
    if (rule.actionSlack) return <Bell className="w-5 h-5 text-amber-400" />;
    return <Sliders className="w-5 h-5 text-indigo-400" />;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Automation Rules</h2>
            {connectedRepos.length > 1 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">for repo:</span>
                <select
                  value={repositoryId}
                  onChange={(e) => onSelectRepo?.(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm hover:border-slate-600 transition"
                >
                  {connectedRepos.map((repo) => (
                    <option key={repo.id} value={repo.id} className="bg-slate-900 text-white">
                      {repo.repoFullName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                {repoFullName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure automated actions, toggle AI triage, or create keyword-matching filters
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Custom Rule
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-7 h-7 text-indigo-400 animate-spin mb-2" />
          <p className="text-xs">Loading automation rules...</p>
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          {/* Section 1: Default Master Controls */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <span>Standard Capabilities (Master Toggles)</span>
              <span className="text-[10px] text-slate-400 font-normal">Active by default</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {defaultRules.map((rule) => {
                const isToggling = togglingId === rule.id;
                return (
                  <div
                    key={rule.id}
                    className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                      rule.isActive
                        ? "bg-slate-800/40 border-slate-700/80 shadow-sm"
                        : "bg-slate-900/40 border-slate-800/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-800 border border-slate-700/80 mt-0.5 flex-shrink-0">
                        {getRuleIcon(rule)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          {rule.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                          {rule.actionAiTriage && "Runs Gemini 2 Flash auto-summary & priority triage"}
                          {rule.actionComment && "Posts polite greeting & AI analysis report on tickets"}
                          {rule.actionLabel && "Manages 'triage' and lifecycle status tags automatically"}
                          {rule.actionSlack && "Delivers formatted Block Kit cards to team Slack channel"}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={isToggling}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.isActive ? "bg-indigo-600" : "bg-slate-700"
                      }`}
                      role="switch"
                      aria-checked={rule.isActive}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rule.isActive ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Custom Keyword Rules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>Custom Keyword & Author Rules</span>
                <span className="text-[10px] text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  {customRules.length} Active
                </span>
              </h3>
            </div>

            {customRules.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center bg-slate-900/30">
                <Sliders className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-slate-300 font-medium">No custom rules configured yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Click <strong>"Add Custom Rule"</strong> above to configure keyword filters (e.g.{" "}
                  <em>"issues whose title contains bug → add the bug label"</em>).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customRules.map((rule) => {
                  const isToggling = togglingId === rule.id;
                  return (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        rule.isActive
                          ? "bg-slate-800/40 border-slate-700/80"
                          : "bg-slate-900/40 border-slate-800/60 opacity-60"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{rule.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 uppercase font-medium">
                            {rule.eventType}
                          </span>
                        </div>

                        {/* Condition & Actions Badges */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            IF {rule.matchField.replace("_", " ")}: <strong>"{rule.matchValue}"</strong>
                          </span>
                          <span className="text-slate-400">➔</span>
                          {rule.actionLabel && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                              <Tag className="w-3 h-3" /> +Label "{rule.actionLabel}"
                            </span>
                          )}
                          {rule.actionSlack && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
                              <Bell className="w-3 h-3" /> Slack Alert
                            </span>
                          )}
                          {rule.actionAiTriage && (
                            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> AI Triage
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls: Toggle + Delete */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <button
                          onClick={() => handleToggle(rule)}
                          disabled={isToggling}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.isActive ? "bg-indigo-600" : "bg-slate-700"
                          }`}
                          role="switch"
                          aria-checked={rule.isActive}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.isActive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Delete rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Custom Rule */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Create Custom Automation Rule</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure keyword or author triggers to execute specific actions
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              {/* Rule Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Rule Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Auto-tag bug issues"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>

              {/* Event & Match Field Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    When this happens
                  </label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="issues">Issue Opened</option>
                    <option value="pull_request">Pull Request Opened</option>
                    <option value="all">Both Issues & PRs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Field
                  </label>
                  <select
                    value={newMatchField}
                    onChange={(e) => setNewMatchField(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="title_contains">Title contains</option>
                    <option value="body_contains">Description / Body contains</option>
                    <option value="author_is">Author username is</option>
                  </select>
                </div>
              </div>

              {/* Keyword / Match Value */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Matching Keyword / Value *
                </label>
                <input
                  type="text"
                  placeholder="e.g. bug, urgent, security, dependabot"
                  value={newMatchValue}
                  onChange={(e) => setNewMatchValue(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>

              {/* Action: Label to apply */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Label to Apply *
                </label>
                <div className="flex items-center gap-3">
                  <Tag className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="e.g. bug, p0-critical, documentation"
                    value={newActionLabel}
                    onChange={(e) => setNewActionLabel(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Master toggles above already handle Slack alerts, comments, and AI triage automatically.
                </p>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Save & Activate Rule"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
