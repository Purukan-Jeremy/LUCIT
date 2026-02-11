import { useNavigate } from "react-router-dom";
// Pastikan CSS Hero sudah terhubung (biasanya via global style.css)

function Hero() {
  const navigate = useNavigate();

  const handleStartDetection = () => {
    // Ini memerintahkan website pindah ke url /analysis
    navigate("/analysis");
  };

  return (
    <main className="hero" id="home">
      <div className="hero-content">
        <h1 className="hero-title">
          <span className="hero-lung">Lung</span>
          <span className="hero-and">&amp;</span>
          <span className="hero-colon">Colon</span>
        </h1>

        <p className="hero-subtitle">
          Histopathology Classification and Segmentation
        </p>

        {/* Tambahkan event onClick di sini */}
        <button className="primary-btn" onClick={handleStartDetection}>
          Start Detection
        </button>
      </div>
    </main>
  );
}

export default Hero;
