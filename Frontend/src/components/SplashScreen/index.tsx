import React, { useEffect, useState } from "react";
import "../../assets/style.css";

const SplashScreen: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 4500); // Wait for the animation to finish (4s + some buffer)

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`splash-screen ${!isVisible ? "fade-out" : ""}`}>
      <div className="splash-content">
        <h1 className="splash-text">Welcome To LUCIT Your Histopathology AI</h1>
      </div>
    </div>
  );
};

export default SplashScreen;
