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
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Github className="w-7 h-7" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Connect GitHub Account</h2>
        <p className="text-slate-400 text-sm mb-6">
          Sign in with your GitHub account to connect repositories, receive notifications for repository events.
        </p>

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
