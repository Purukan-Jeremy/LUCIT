import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Footer from "./components/Footer";
import AnalysisPage from "./pages/analysis";
import SplashScreen from "./components/SplashScreen";
import ContactUs from "./components/ContactUs";

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

  useEffect(() => {
    // Splash screen will be handled by its own internal timer for animation
    // But we remove it from DOM after it's done
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 5000); // Slightly longer than the animation duration in CSS

    return () => clearTimeout(timer);
  }, []);

  return (
    <Router>
      <ScrollHandler />
      {showSplash && <SplashScreen />}
      {!showSplash && (
        <>
          {/* Header ditaruh di luar Routes agar selalu muncul di semua halaman */}
          <Header />

          <Routes>
            {/* Halaman Utama (Home) */}
            <Route
              path="/"
              element={
                <>
                  <Hero />
                  <ContactUs />
                </>
              }
            />

            {/* Halaman Analysis (Tujuan saat tombol ditekan) */}
            <Route path="/analysis" element={<AnalysisPage />} />
          </Routes>

          <Footer />
        </>
      )}
    </Router>
  );
}

export default App;
