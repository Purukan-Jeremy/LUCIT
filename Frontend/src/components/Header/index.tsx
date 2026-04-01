import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginModal from "../LoginModal";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
};

function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const navigateWithTransition = (to: string) => {
    const docWithTransition = document as DocumentWithViewTransition;

    if (docWithTransition.startViewTransition) {
      docWithTransition.startViewTransition(() => {
        navigate(to);
      });
      return;
    }

    navigate(to);
  };

  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      closeMenu();
      return;
    }

    event.preventDefault();
    closeMenu();
    navigateWithTransition("/");
  };

  const handleHistoryClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/history") {
      closeMenu();
      return;
    }

    event.preventDefault();
    closeMenu();
    navigateWithTransition("/history");
  };

  return (
    <>
      <header className="site-header">
        <div className="logo" aria-label="LUCIT">
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
          <Link to="/history" onClick={handleHistoryClick}>
            History
          </Link>
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

        <button
          className="user-icon"
          aria-label="User profile"
          onClick={openLoginModal}
        >
          <span className="icon">👤</span>
          <span className="login-text">Login</span>
        </button>
      </header>

      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
    </>
  );
}

export default Header;
