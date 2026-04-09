import "../../assets/style.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-section-cozy">
      <div className="footer-grid-cozy">
        <div className="footer-branding">
          <div className="logo-footer">
            <span className="logo-lu">LU</span>
            <span className="logo-cit">CIT</span>
          </div>
          <p className="footer-tagline">
            Intelligent Histopathology Decision Support. 
            Empowering pathologists with AI-driven insights for 
            lung and colon cancer detection.
          </p>
          <div className="disclaimer-mini">
            <span>Research-only version. Not for clinical diagnosis.</span>
          </div>
        </div>

        <div className="footer-nav">
          <div className="footer-column">
            <h4>Methodology</h4>
            <a href="#about">LC25000 Dataset</a>
            <a href="#about">Explainable AI</a>
            <a href="#features">Grad-CAM Visualization</a>
            <a href="#features">MobileNetV2 Architecture</a>
          </div>

          <div className="footer-column">
            <h4>Support</h4>
            <a href="#">User Documentation</a>
            <a href="#">Security Overview</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Use</a>
          </div>

          <div className="footer-column">
            <h4>Clinical Connect</h4>
            <a href="#">Pathology Resources</a>
            <a href="#">Research Publications</a>
            <a href="#">Collaborate</a>
            <a href="#">Contact Support</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom-cozy">
        <div className="footer-legal">
          <span>&copy; {currentYear} LUCIT AI Team. All rights reserved.</span>
          <span className="dot-divider"></span>
          <span>Open-Source for Research</span>
        </div>
        <div className="footer-socials">
          <a href="#" aria-label="LinkedIn">LN</a>
          <a href="#" aria-label="Twitter">TW</a>
          <a href="#" aria-label="GitHub">GH</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
