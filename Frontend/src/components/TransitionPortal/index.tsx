import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface TransitionPortalProps {
  onComplete: () => void;
}

const TransitionPortal: React.FC<TransitionPortalProps> = ({ onComplete }) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleTrigger = (event: Event) => {
      const customEvent = event as CustomEvent<{
        x: number;
        y: number;
        target: string;
      }>;
      const { x, y, target } = customEvent.detail;

      setCoords({ x, y });
      setIsVisible(true);
      setIsExpanding(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsExpanding(true);

          navigate(target);

          setTimeout(() => {
            setIsVisible(false);
            setIsExpanding(false);
            setCoords(null);
            onComplete();
          }, 1300);
        });
      });
    };

    window.addEventListener(
      "lucit:start-transition",
      handleTrigger as EventListener,
    );
    return () =>
      window.removeEventListener(
        "lucit:start-transition",
        handleTrigger as EventListener,
      );
  }, [navigate, onComplete]);

  if (!isVisible || !coords) return null;

  const holeSize = isExpanding ? "350vh" : "0px";

  return (
    <div
      className="transition-mask-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999999,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "transparent",
      }}
    >
      <div
        className="transition-mask-hole"
        style={{
          position: "absolute",
          left: coords.x,
          top: coords.y,
          width: holeSize,
          height: holeSize,
          borderRadius: "50%",
          backgroundColor: "transparent",
          boxShadow: "0 0 0 200vw #f06292",
          transform: "translate(-50%, -50%)",
          transition:
            "width 1.2s cubic-bezier(0.7, 0, 0.3, 1), height 1.2s cubic-bezier(0.7, 0, 0.3, 1)",
          willChange: "width, height",
        }}
      />
    </div>
  );
};

export default TransitionPortal;
