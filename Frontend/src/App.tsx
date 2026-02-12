import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Footer from "./components/Footer";
import AnalysisPage from "./pages/analysis";
import SplashScreen from "./components/SplashScreen";
import ContactUs from "./components/ContactUs";
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location]);

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
                <ContactUs />
              </>
            }
          />

          {/* Halaman Analysis (Tujuan saat tombol ditekan) */}
          <Route path="/analysis" element={<AnalysisPage />} />
        </Routes>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
