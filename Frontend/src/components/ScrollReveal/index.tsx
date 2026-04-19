import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
}

const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
        });
      },
      {
        threshold: 0.1, 
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const { current } = domRef;
    if (current) {
      observer.observe(current);
    }

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, []);

  return (
    <div
      ref={domRef}
      style={{
        perspective: '1200px', // Creates 3D space for the children
        width: '100%',
        willChange: 'opacity, transform, filter',
      }}
    >
      <div
        style={{
          opacity: isVisible ? 1 : 0,
          filter: isVisible ? 'blur(0px)' : 'blur(8px)',
          transform: isVisible 
            ? 'translateY(0) scale(1) rotateX(0deg)' 
            : 'translateY(100px) scale(0.94) rotateX(-12deg)',
          transition: `opacity 1.4s cubic-bezier(0.23, 1, 0.32, 1) ${delay}s, 
                       transform 1.4s cubic-bezier(0.23, 1, 0.32, 1) ${delay}s, 
                       filter 1.4s cubic-bezier(0.23, 1, 0.32, 1) ${delay}s`,
          transformOrigin: 'top center',
          width: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScrollReveal;
