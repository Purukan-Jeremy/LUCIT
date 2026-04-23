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
            Lung and Colon Cancer Detection Using Interpretable Transfer
            Learning
          </p>
          <div className="disclaimer-mini">
            <span>Research-only version. Not for clinical diagnosis.</span>
          </div>
        </div>

        <div className="footer-nav">
          <div className="footer-column">
            <h4>Methodology</h4>
            <a href="about">LC25000 Dataset</a>
            <a href="about">Explainable AI</a>
            <a href="features">Grad-CAM Visualization</a>
            <a href="features">CNN Architecture</a>
          </div>

          <div className="footer-column">
            <h4>Contributor</h4>
            <a href="">University of Klabat</a>
            <a href="">Jeremy Purukan</a>
            <a href="">Steve Umbas</a>
            <a href="">Jonathan Taufik</a>
          </div>

          <div className="footer-column">
            <h4>Clinical Connect</h4>
            <a href="">Pathology Resources</a>
            <a href="">Research Publications</a>
            <a href="">Collaborate</a>
            <a href="">Contact Support</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom-cozy">
        <div className="footer-legal">
          <span>&copy; {currentYear} LUCIT Team. All rights reserved.</span>
          <span className="dot-divider"></span>
          <span>Open-Source for Research</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
