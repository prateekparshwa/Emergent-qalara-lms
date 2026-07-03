import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import SignIn from "@/pages/SignIn";
import SignedOut from "@/pages/SignedOut";
import AuthCallback from "@/pages/AuthCallback";
import ComingSoon from "@/pages/ComingSoon";
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
        <Route
          path="/"
          element={
            <ComingSoon
              kicker="Overview"
              title="Dashboard"
              description="Your daily pulse on the pipeline — active leads, outreach velocity, and impact on artisan producers."
            />
          }
        />
        <Route
          path="/dashboard"
          element={
            <ComingSoon
              kicker="Overview"
              title="Dashboard"
              description="Your daily pulse on the pipeline — active leads, outreach velocity, and impact on artisan producers."
            />
          }
        />
        <Route
          path="/discover"
          element={
            <ComingSoon
              kicker="Buyer Intelligence"
              title="Discover"
              description="Surface, enrich and score global wholesale buyers that fit Qalara's artisan supply."
            />
          }
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
        <Route
          path="/settings"
          element={
            <ComingSoon
              kicker="Configuration"
              title="Settings"
              description="Manage the Qalara profile, categories, MOQs and value props used across the platform."
            />
          }
        />
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
