import { useState } from "react";
import { Link } from "react-router-dom";

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="logo">
        <span className="logo-lu">LU</span>
        <span className="logo-cit">CIT</span>
      </div>

      <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
        <Link to="/#home" onClick={() => setMenuOpen(false)}>
          Home
        </Link>
        <Link to="/#about" onClick={() => setMenuOpen(false)}>
          About
        </Link>
        <Link to="/#contact" onClick={() => setMenuOpen(false)}>
          Contact Us
        </Link>
        <Link to="/#history" onClick={() => setMenuOpen(false)}>
          History
        </Link>
      </nav>

      <button
        className="burger"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <button className="user-icon" aria-label="User profile">
        <span className="icon">👤</span>
        <span className="login-text">Login</span>
      </button>
    </header>
  );
}

export default Header;
