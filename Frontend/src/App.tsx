import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Footer from "./components/Footer";
import AnalysisPage from "./pages/analysis";
import SplashScreen from "./components/SplashScreen";

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
      {showSplash && <SplashScreen />}
      {!showSplash && (
        <>
          {/* Header ditaruh di luar Routes agar selalu muncul di semua halaman */}
          <Header />

          <Routes>
            {/* Halaman Utama (Home) */}
            <Route path="/" element={<Hero />} />

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
