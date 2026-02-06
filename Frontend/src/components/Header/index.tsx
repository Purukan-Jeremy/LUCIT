import { Link } from "react-router-dom";

function Header() {
  return (
    <header className="site-header">
      <div className="logo">
        <span className="logo-lu">LU</span>
        <span className="logo-cit">CIT</span>
      </div>

      <nav className="nav-links">
        <Link to="/">Home</Link>
        <a href="#about">About</a>
        <a href="#contact">Contact Us</a>
        <a href="#history">History</a>
      </nav>

      <button className="user-icon" aria-label="User profile">
        <span className="icon">👤</span>
        <span className="login-text">Login</span>
      </button>
    </header>
  );
}

export default Header;
