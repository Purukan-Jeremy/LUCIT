import React, { useEffect, useState } from "react";
import "../../assets/style.css";

const SplashScreen: React.FC = () => {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const animationTimer = setTimeout(() => {
      setIsAnimating(false);
    }, 4300);

    return () => {
      clearTimeout(animationTimer);
    };
  }, []);

  return (
    <div className={`splash-screen ${!isAnimating ? "fade-out" : ""}`}>
      <div className="splash-content">
        <div className="svg-container">
          <svg
            viewBox="0 0 1000 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="motion-line"
            preserveAspectRatio="none"
          >
            <path
              d="M-50 120 Q 250 20, 500 120 T 1050 120"
              stroke="url(#gradient1)"
              strokeWidth="6"
              strokeLinecap="round"
              className="flowing-path path-1"
            />
            <path
              d="M-50 80 Q 250 180, 500 80 T 1050 80"
              stroke="url(#gradient2)"
              strokeWidth="4"
              strokeLinecap="round"
              className="flowing-path path-2"
            />
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e91e63" />
                <stop offset="100%" stopColor="#6a1b9a" />
              </linearGradient>
              <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6a1b9a" />
                <stop offset="100%" stopColor="#e91e63" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="splash-text">Welcome To LUCIT Your Histopathology AI</h1>
      </div>
    </div>
  );
};

export default SplashScreen;
