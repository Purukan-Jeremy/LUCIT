import React, { useEffect } from "react";
import "../../assets/style.css";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        
        <h2 className="modal-title">Login to LUCIT</h2>
        <p className="modal-subtitle">Choose your preferred login method</p>

        <div className="login-options">
          <button className="google-login-btn">
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google logo" 
              className="google-icon"
            />
            <span>Continue with Google</span>
          </button>

          <div className="divider">
            <span className="divider-text">OR</span>
          </div>

          <form className="manual-login-form" onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input 
                type="email" 
                id="email" 
                placeholder="name@example.com" 
                required 
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                placeholder="Enter your password" 
                required 
              />
            </div>

            <button type="submit" className="submit-btn">
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
