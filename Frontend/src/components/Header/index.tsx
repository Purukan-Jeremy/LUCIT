import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginModal from "../LoginModal";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
};

function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);
  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      return;
    }

    event.preventDefault();

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

        <nav className="nav-links">
          <Link to="/" onClick={handleHomeClick}>
            Home
          </Link>
          <a href="#about">About</a>
          <Link to="/#contact">Contact Us</Link>
          <a href="#history">History</a>
        </nav>

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
