import "../../assets/style.css";

function Footer() {
  return (
    <footer className="footer-section">
      <div className="footer-content">
        <div className="column">
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Careers</a>
          <a href="#">Brand</a>
        </div>

        <div className="column">
          <h4>Resources</h4>
          <a href="#">Help Center</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>

        <div className="column">
          <h4>Social</h4>
          <a href="#">Instagram</a>
          <a href="#">Twitter</a>
          <a href="#">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
