import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginModal from "../LoginModal";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
};

function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<{ fullname: string; email: string } | null>(() => {
    const saved = localStorage.getItem("lucit_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const handleLoginSuccess = (userData: { fullname: string; email: string }) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("lucit_user");
    setUser(null);
    setShowProfileDropdown(false);
    navigate("/");
  };

  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      closeMenu();
      return;
    }

    event.preventDefault();
    closeMenu();

    const docWithTransition = document as DocumentWithViewTransition;
    if (docWithTransition.startViewTransition) {
      docWithTransition.startViewTransition(() => {
        navigate("/");
      });
      return;
    }

    navigate("/");
  };

  return (
    <>
      <header className="site-header">
        <div className="logo">
          <span className="logo-lu">LU</span>
          <span className="logo-cit">CIT</span>
        </div>

        <nav className={`nav-links ${isMenuOpen ? "open" : ""}`}>
          <Link to="/" onClick={handleHomeClick}>
            Home
          </Link>
          <Link to="/#about" onClick={closeMenu}>
            About Us
          </Link>
          <Link to="/#contact" onClick={closeMenu}>
            Contact Us
          </Link>
          <a href="#history" onClick={closeMenu}>
            History
          </a>
        </nav>

        <button
          className="burger"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={toggleMenu}
        >
          <span />
          <span />
          <span />
        </button>

        {!user ? (
          <button
            className="user-icon"
            aria-label="User profile"
            onClick={openLoginModal}
          >
            <span className="icon">👤</span>
            <span className="login-text">Login</span>
          </button>
        ) : (
          <div className="user-profile-container">
            <button
              className="user-profile-btn"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            >
              <div className="user-profile-info">
                <span className="user-fullname">{user.fullname}</span>
                <span className="user-email">{user.email}</span>
              </div>
              <span className="icon">👤</span>
            </button>

            {showProfileDropdown && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={closeLoginModal} 
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}

export default Header;
