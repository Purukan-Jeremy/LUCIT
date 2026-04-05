import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Footer from "./components/Footer";
import AnalysisPage from "./pages/analysis";
import HistoryPage from "./pages/history";
import SplashScreen from "./components/SplashScreen";
import Features from "./components/Features";
import AboutUs from "./components/AboutUs";

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
  const isLoggedIn = Boolean(localStorage.getItem("lucit_user"));

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
          <Route path="/history" element={<HistoryPage />} />
        </Routes>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
