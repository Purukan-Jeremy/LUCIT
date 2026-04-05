import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginModal from "../LoginModal";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
};

function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [user, setUser] = useState<{ fullname: string; email: string } | null>(() => {
    const saved = localStorage.getItem("lucit_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const navigateWithTransition = (path: string) => {
    const documentWithTransition = document as DocumentWithViewTransition;

    if (documentWithTransition.startViewTransition) {
      documentWithTransition.startViewTransition(() => {
        navigate(path);
      });
      return;
    }

    navigate(path);
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);
  const openLogoutModal = () => setIsLogoutModalOpen(true);
  const closeLogoutModal = () => setIsLogoutModalOpen(false);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const handleLoginSuccess = (userData: { fullname: string; email: string }) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("lucit_user");
    setUser(null);
    setIsLogoutModalOpen(false);
    setShowProfileDropdown(false);
    navigate("/");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleOpenLogin = () => setIsLoginModalOpen(true);
    window.addEventListener("lucit:open-login", handleOpenLogin);
    return () => window.removeEventListener("lucit:open-login", handleOpenLogin);
  }, []);

  useEffect(() => {
    if (!isLogoutModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLogoutModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isLogoutModalOpen]);

  useEffect(() => {
    if (!isLoginModalOpen && !isLogoutModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLoginModalOpen, isLogoutModalOpen]);

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
        <Link
          to="/"
          className="logo"
          aria-label="LUCIT"
          onClick={handleHomeClick}
        >
          <span className="logo-lu">LU</span>
          <span className="logo-cit">CIT</span>
        </Link>

        <nav className={`nav-links ${isMenuOpen ? "open" : ""}`}>
          <Link to="/" onClick={handleHomeClick}>
            Home
          </Link>
          <Link to="/#about" onClick={closeMenu}>
            About Us
          </Link>
          <Link to="/#features" onClick={closeMenu}>
            Features
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
          <div className="user-profile-container" ref={profileRef}>
            <button
              className="profile-menu-button"
              aria-label="Open profile menu"
              aria-expanded={showProfileDropdown}
              onClick={() => setShowProfileDropdown((prev) => !prev)}
            >
              <span className="icon">👤</span>
            </button>

            {showProfileDropdown && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-user">
                  <span className="user-fullname">{user.fullname}</span>
                  <span className="user-email">{user.email}</span>
                </div>
                <button onClick={openLogoutModal} className="logout-btn">
                  Sign Out
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

      {isLogoutModalOpen ? (
        <div className="logout-modal-overlay" onClick={closeLogoutModal}>
          <div
            className="logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            aria-describedby="logout-modal-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="logout-modal-title" className="logout-modal-title">
              Are you sure you want to sign out?
            </h2>
            <p id="logout-modal-description" className="logout-modal-description">
              You will need to sign in again to access your account and analysis history.
            </p>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-modal-button logout-modal-button-secondary"
                onClick={closeLogoutModal}
              >
                No
              </button>
              <button
                type="button"
                className="logout-modal-button logout-modal-button-primary"
                onClick={handleLogout}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default Header;
