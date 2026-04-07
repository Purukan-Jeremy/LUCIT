import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Footer from "./components/Footer";
import AnalysisPage from "./pages/analysis";
import HistoryPage from "./pages/history";
import SplashScreen from "./components/SplashScreen";
import Features from "./components/Features";
import AboutUs from "./components/AboutUs";
import {
  hasActiveSession,
  isSessionExpired,
  logoutUser,
  touchSessionActivity,
} from "./utils/session";

function ScrollHandler() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return null;
}

function AnalysisRouteGuard() {
  const isLoggedIn = hasActiveSession();

  useEffect(() => {
    if (!isLoggedIn) {
      window.dispatchEvent(new Event("lucit:open-login"));
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return <AnalysisPage />;
}

function HistoryRouteGuard() {
  const isLoggedIn = hasActiveSession();

  useEffect(() => {
    if (!isLoggedIn) {
      window.dispatchEvent(new Event("lucit:open-login"));
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return <HistoryPage />;
}

function SessionManager() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isProtectedPath = location.pathname === "/analysis" || location.pathname === "/history";

    const handleActivity = () => {
      touchSessionActivity();
    };

    const handleAuthChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ user: unknown }>;
      if (customEvent.detail?.user) {
        touchSessionActivity(true);
      }
    };

    const handleStorage = () => {
      if (hasActiveSession()) return;
      if (isProtectedPath) {
        navigate("/", { replace: true });
        window.dispatchEvent(new Event("lucit:open-login"));
      }
    };

    const handleSessionExpired = () => {
      if (isProtectedPath) {
        navigate("/", { replace: true });
        window.dispatchEvent(new Event("lucit:open-login"));
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ];

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );

    const intervalId = window.setInterval(() => {
      if (!hasActiveSession() || !isSessionExpired()) {
        return;
      }

      logoutUser("expired");
    }, 60000);

    if (hasActiveSession()) {
      touchSessionActivity(true);
    }

    window.addEventListener("lucit:auth-changed", handleAuthChanged as EventListener);
    window.addEventListener("lucit:session-expired", handleSessionExpired);
    window.addEventListener("storage", handleStorage);

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity),
      );
      window.clearInterval(intervalId);
      window.removeEventListener("lucit:auth-changed", handleAuthChanged as EventListener);
      window.removeEventListener("lucit:session-expired", handleSessionExpired);
      window.removeEventListener("storage", handleStorage);
    };
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    // Reveal app content slightly before splash fully disappears
    const appTimer = setTimeout(() => {
      setShowApp(true);
    }, 4300);

    // Remove splash after fade-out transition completes
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 5600);

    return () => {
      clearTimeout(appTimer);
      clearTimeout(splashTimer);
    };
  }, []);

  return (
    <Router>
      <ScrollHandler />
      <SessionManager />
      {showSplash && <SplashScreen />}
      <div className={`app-shell ${showApp ? "app-shell-visible" : ""}`}>
        {/* Header ditaruh di luar Routes agar selalu muncul di semua halaman */}
        <Header />

        <Routes>
          {/* Halaman Utama (Home) */}
          <Route
            path="/"
            element={
              <>
                <Hero />
                <AboutUs />
                <Features />
              </>
            }
          />

          {/* Halaman Analysis (Tujuan saat tombol ditekan) */}
          <Route path="/analysis" element={<AnalysisRouteGuard />} />
          <Route path="/history" element={<HistoryRouteGuard />} />
        </Routes>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
