import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import SignIn from "@/pages/SignIn";
import SignedOut from "@/pages/SignedOut";
import AuthCallback from "@/pages/AuthCallback";
import ComingSoon from "@/pages/ComingSoon";
import Dashboard from "@/pages/Dashboard";
import Discover from "@/pages/Discover";
import Settings from "@/pages/Settings";
import { Toaster } from "@/components/ui/sonner";

function Router() {
  const location = useLocation();
  // CRITICAL: handle OAuth callback synchronously (before other routes)
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/signed-out" element={<SignedOut />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/discover"
          element={<Discover />}
        />
        <Route
          path="/outreach"
          element={
            <ComingSoon
              kicker="Engagement"
              title="Outreach"
              description="Draft, review and send AI-personalised buyer emails and moodboards from one place."
            />
          }
        />
        <Route
          path="/impact"
          element={
            <ComingSoon
              kicker="Measurement"
              title="Impact"
              description="Track quotes, replies and artisan-level impact created by your buyer outreach."
            />
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Router />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
