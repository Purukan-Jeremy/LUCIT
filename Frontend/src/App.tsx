import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Hero from "./components/Hero";
import AnalysisPage from "./pages/analysis"; // Pastikan path ini sesuai struktur folder Anda

function App() {
  return (
    <Router>
      {/* Header ditaruh di luar Routes agar selalu muncul di semua halaman */}
      <Header />

      <Routes>
        {/* Halaman Utama (Home) */}
        <Route path="/" element={<Hero />} />

        {/* Halaman Analysis (Tujuan saat tombol ditekan) */}
        <Route path="/analysis" element={<AnalysisPage />} />
      </Routes>
    </Router>
  );
}

export default App;
