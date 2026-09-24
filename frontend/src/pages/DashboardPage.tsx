import React from "react";
import { useAuth } from "../hooks/useAuth";
import { LogOut, Radio } from "lucide-react";

export function DashboardPage() {
  const { user, logout } = useAuth();

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

      {/* Main Dashboard Content */}
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
          </div>
        )}

        {/* Feature 2: Connected Repositories Placeholder */}
        <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-1">
            Connected Repositories
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            In Feature 2, we will fetch your repositories from GitHub and allow you to connect them.
          </p>
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
