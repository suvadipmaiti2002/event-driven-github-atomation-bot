import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Github, ArrowRight, Loader2 } from "lucide-react";

export function LoginPage() {
  const { user, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-400">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  // If already authenticated, redirect to /dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur text-center">
        {/* Project Branding Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Event-Driven GitHub Automation Bot
        </div>

        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-white shadow-inner">
          <Github className="w-7 h-7" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          GitHub Automation Bot
        </h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Automatically triage issues & PRs with Google Gemini AI, apply smart labels, and dispatch private notifications directly to your Slack channels.
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2 mb-6 text-xs text-slate-300">
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 text-center">
            <span className="block text-indigo-400 font-semibold mb-0.5">⚡ Webhooks</span>
            Event-Driven
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 text-center">
            <span className="block text-purple-400 font-semibold mb-0.5">🤖 Gemini AI</span>
            Auto-Triage
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 text-center">
            <span className="block text-emerald-400 font-semibold mb-0.5">🔔 Slack</span>
            Private Alerts
          </div>
        </div>

        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-4 py-3 rounded-xl transition duration-150 shadow-lg shadow-white/5 active:scale-[0.99]"
        >
          <Github className="w-5 h-5" />
          Sign in with GitHub
          <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
