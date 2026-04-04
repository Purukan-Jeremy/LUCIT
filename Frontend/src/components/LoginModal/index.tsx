import React, { useEffect, useState } from "react";
import "../../assets/style.css";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { fullname: string; email: string }) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsSignUp(false);
      setFormData({ fullName: "", email: "", password: "" });
      setMessage(null);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (isSignUp) {
      try {
        const response = await fetch("http://localhost:8000/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullname: formData.fullName,
            email: formData.email,
            password: formData.password,
          }),
        });

        const result = await response.json();
        if (response.ok) {
          setMessage({ type: "success", text: "Account created successfully! You can now login." });
          setIsSignUp(false);
          setFormData({ fullName: "", email: "", password: "" });
        } else {
          throw new Error(result.error || "Failed to sign up");
        }
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong" });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Logic for Login
      try {
        const response = await fetch("http://localhost:8000/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const result = await response.json();
        if (response.ok && result.status === "success") {
          const userData = {
            fullname: result.user.fullname,
            email: result.user.email,
          };
          localStorage.setItem("lucit_user", JSON.stringify(userData));
          onLoginSuccess(userData);
          onClose();
        } else {
          throw new Error(result.message || "Invalid credentials");
        }
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Invalid email or password" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        
        <h2 className="modal-title">{isSignUp ? "Create an Account" : "Login to LUCIT"}</h2>
        <p className="modal-subtitle">
          {isSignUp ? "Fill in the details to get started" : "Choose your preferred login method"}
        </p>

        {message && (
          <div className={`modal-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="login-options">
          {!isSignUp && (
            <>
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
            </>
          )}

          <form className="manual-login-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input 
                  type="text" 
                  id="fullName" 
                  placeholder="Enter your full name" 
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required 
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input 
                type="email" 
                id="email" 
                placeholder="name@example.com" 
                value={formData.email}
                onChange={handleInputChange}
                required 
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                placeholder={isSignUp ? "Create a password" : "Enter your password"} 
                value={formData.password}
                onChange={handleInputChange}
                required 
              />
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? "Processing..." : (isSignUp ? "Sign Up" : "Login")}
            </button>
          </form>

          <div className="modal-footer">
            <p>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                type="button" 
                className="toggle-mode-btn" 
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? "Login here" : "Sign up here"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
