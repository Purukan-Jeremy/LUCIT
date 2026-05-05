import "../../assets/style.css";
import { hasActiveSession } from "../../utils/session";
import React from "react";

function Hero() {
  const handleStartDetection = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasActiveSession()) {
      window.dispatchEvent(new Event("lucit:open-login"));
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    window.dispatchEvent(
      new CustomEvent("lucit:start-transition", {
        detail: { x, y, target: "/analysis" },
      }),
    );
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

        <button className="primary-btn" onClick={handleStartDetection}>
          Start Detection
        </button>
      </div>
    </main>
  );
}

export default Hero;
