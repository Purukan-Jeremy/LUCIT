import { useNavigate } from "react-router-dom";
import "../../assets/style.css";
import { hasActiveSession } from "../../utils/session";
// Pastikan CSS Hero sudah terhubung (biasanya via global style.css)

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
};

function Hero() {
  const navigate = useNavigate();

  const handleStartDetection = () => {
    if (!hasActiveSession()) {
      window.dispatchEvent(new Event("lucit:open-login"));
      return;
    }

    const docWithTransition = document as DocumentWithViewTransition;

    if (docWithTransition.startViewTransition) {
      docWithTransition.startViewTransition(() => {
        navigate("/analysis");
      });
      return;
    }

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
