function Header() {
  return (
    <header className="site-header">
      <div className="logo">
        <span className="logo-lu">LU</span>
        <span className="logo-cit">CIT</span>
      </div>

      <nav className="nav-links">
        <a href="#home">Home</a>
        <a href="#about">About</a>
        <a href="#contact">Contact Us</a>
        <a href="#history">History</a>
      </nav>

      <button className="user-icon" aria-label="User profile">
        <span>👤</span>
      </button>
    </header>
  );
}

export default Header;
