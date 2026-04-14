import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SlideTransitionProps {
  children: React.ReactElement; 
}

const SlideTransition: React.FC<SlideTransitionProps> = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [prevLocation, setPrevLocation] = useState<typeof location | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'to-history' | 'to-analysis'>('to-history');

  useEffect(() => {
    const isToHistory = displayLocation.pathname === '/analysis' && location.pathname === '/history';
    const isToAnalysis = displayLocation.pathname === '/history' && location.pathname === '/analysis';

    if (isToHistory || isToAnalysis) {
      setDirection(isToHistory ? 'to-history' : 'to-analysis');
      setPrevLocation(displayLocation);
      setIsAnimating(true);
      setDisplayLocation(location);

      const timer = setTimeout(() => {
        setIsAnimating(false);
        setPrevLocation(null);
      }, 700);

      return () => clearTimeout(timer);
    } else {
      setDisplayLocation(location);
      setIsAnimating(false);
      setPrevLocation(null);
    }
  }, [location.pathname]);

  const renderRoutes = (loc: typeof location) => {
    return React.cloneElement(children, { location: loc });
  };

  const isParallelRoute = (location.pathname === '/analysis' || location.pathname === '/history') &&
                         (displayLocation.pathname === '/analysis' || displayLocation.pathname === '/history');

  if (!isParallelRoute && !isAnimating) {
    return renderRoutes(location);
  }

  return (
    <div 
      className="slide-transition-container" 
      style={{ 
        position: 'relative', 
        width: '100%', 
        // FIX: Hanya hidden saat animasi agar scroll tetap berfungsi
        overflow: isAnimating ? 'hidden' : 'visible', 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Outgoing Buffer */}
      {isAnimating && prevLocation && (
        <div
          className="slide-outgoing"
          style={{
            position: 'absolute',
            width: '100%',
            top: 0,
            left: 0,
            zIndex: direction === 'to-history' ? 1 : 2,
            animation: direction === 'to-history' 
              ? 'parallaxRecede 0.7s cubic-bezier(0.2, 0, 0.2, 1) forwards' 
              : 'slideOutToRight 0.7s cubic-bezier(0.2, 0, 0.2, 1) forwards',
            willChange: 'transform',
          }}
        >
          {renderRoutes(prevLocation)}
        </div>
      )}

      {/* Incoming Buffer */}
      <div
        className="slide-incoming"
        style={{
          position: isAnimating ? 'absolute' : 'relative',
          width: '100%',
          flex: 1, // Memastikan mengisi ruang yang tersedia
          top: 0,
          left: 0,
          zIndex: direction === 'to-history' ? 2 : 1,
          animation: isAnimating 
            ? `${direction === 'to-history' ? 'slideInFromRight' : 'parallaxEmerge'} 0.7s cubic-bezier(0.2, 0, 0.2, 1) forwards`
            : 'none',
          willChange: 'transform',
        }}
      >
        {renderRoutes(displayLocation)}

        <style>{`
          @keyframes parallaxRecede {
            from { transform: translateX(0) scale(1); }
            to { transform: translateX(-30%) scale(0.98); }
          }
          @keyframes slideInFromRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes slideOutToRight {
            from { transform: translateX(0); }
            to { transform: translateX(100%); }
          }
          @keyframes parallaxEmerge {
            from { transform: translateX(-30%) scale(0.98); }
            to { transform: translateX(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default SlideTransition;
