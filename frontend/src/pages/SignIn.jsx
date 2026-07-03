import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const AUTH_BG = "https://images.unsplash.com/photo-1640292343595-889db1c8262e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwyfHxpbmRpYW4lMjB0ZXh0aWxlcyUyMGNyYWZ0fGVufDB8fHx8MTc4MzEwNTc1NHww&ixlib=rb-4.1.0&q=85";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function startGoogleAuth() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function SignIn() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-white" data-testid="signin-page">
      {/* LEFT: form */}
      <div className="q-grain relative flex flex-col items-center justify-center px-8 py-16 lg:px-16">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-14" data-testid="brand-logo">
            <div className="h-9 w-9 rounded-lg bg-teal-600 grid place-items-center text-white font-display font-bold text-lg">Q</div>
            <div className="font-display text-xl font-bold tracking-tight">Qalara <span className="text-teal-700">LMS</span></div>
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700 mb-4">Buyer Intelligence & Outreach</p>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] text-zinc-900">
            Welcome to<br />Qalara LMS.
          </h1>
          <p className="mt-5 text-zinc-600 text-base leading-relaxed">
            The internal command centre for identifying, enriching and engaging
            global wholesale buyers of Indian artisan home &amp; lifestyle goods.
          </p>

          <button
            data-testid="google-signin-btn"
            onClick={startGoogleAuth}
            className="mt-10 w-full inline-flex items-center justify-center gap-3 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:-translate-y-0.5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-200 px-5 py-3.5 text-zinc-900 font-medium"
          >
            <GoogleG />
            Sign in with Google
          </button>

          <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>@qalara.com accounts get full editor access. Others enter demo mode.</span>
          </div>

          <div className="mt-16 text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-bold">
            v0.1 · Foundation
          </div>
        </div>
      </div>

      {/* RIGHT: image */}
      <div className="hidden lg:block relative overflow-hidden">
        <img src={AUTH_BG} alt="Artisan weaving" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-teal-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-teal-950/60 via-transparent to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300 font-bold mb-3">From the Loom</p>
          <p className="font-display text-2xl leading-tight max-w-md">
            500+ artisan clusters. 6 categories. One curated pipeline to global buyers.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.4-.1-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1C29.2 35.2 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.1C41.9 35 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
