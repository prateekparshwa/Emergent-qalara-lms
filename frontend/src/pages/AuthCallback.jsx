import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    (async () => {
      const hash = window.location.hash || "";
      const match = hash.match(/session_id=([^&]+)/);
      const sessionId = match ? decodeURIComponent(match[1]) : null;
      if (!sessionId) {
        navigate("/sign-in", { replace: true });
        return;
      }
      try {
        const { data } = await apiClient.post("/auth/session", { session_id: sessionId });
        setUser(data);
        // clear hash and navigate to dashboard
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: data } });
      } catch {
        navigate("/sign-in", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen grid place-items-center bg-white" data-testid="auth-callback">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-zinc-200 border-t-teal-600 animate-spin" />
        <p className="text-sm text-zinc-500">Finishing sign-in…</p>
      </div>
    </div>
  );
}
