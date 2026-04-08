import React, { useEffect, useState } from "react";
import "../../assets/style.css";
import { storeAuthenticatedUser } from "../../utils/session";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_TARGET_LABEL = API_BASE_URL || "Vite proxy (/api -> 127.0.0.1:8000)";

async function parseApiBody(response: Response) {
  const rawText = await response.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return { error: rawText.slice(0, 240) };
  }
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { fullname: string; email: string }) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      setShowPassword(false);
      setFormData({ fullName: "", email: "", password: "" });
      setMessage(null);
    }
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
        const response = await fetch(`${API_BASE_URL}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullname: formData.fullName,
            email: formData.email,
            password: formData.password,
          }),
        });

        console.log("Registration response status:", response.status);
        const result = await parseApiBody(response);
        console.log("Registration response body:", result);

        if (response.ok) {
          setMessage({ type: "success", text: "Account created successfully! You can now login." });
          setIsSignUp(false);
          setFormData({ fullName: "", email: "", password: "" });
        } else {
          // If response is not ok (e.g., 409 Conflict), throw the specific error message from the backend
          const errorMsg = result.error || "Failed to sign up";
          throw new Error(errorMsg);
        }
      } catch (err) {
        const text =
          err instanceof TypeError
            ? `Cannot reach backend at ${API_TARGET_LABEL}. Make sure backend is running.`
            : err instanceof Error
              ? err.message
              : "Something went wrong";
        setMessage({ type: "error", text });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Logic for Login
      try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const result = await parseApiBody(response);
        if (response.ok && result.status === "success") {
          const userData = {
            fullname: result.user.fullname,
            email: result.user.email,
          };
          storeAuthenticatedUser(userData);
          onLoginSuccess(userData);
          onClose();
        } else {
          throw new Error(result.message || "Invalid credentials");
        }
      } catch (err) {
        const text =
          err instanceof TypeError
            ? `Cannot reach backend at ${API_TARGET_LABEL}. Make sure backend is running.`
            : err instanceof Error
              ? err.message
              : "Invalid email or password";
        setMessage({ type: "error", text });
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
        
        <h2 className="modal-title">{isSignUp ? "Create an Account" : "Sign In"}</h2>
        <p className="modal-subtitle">
          {isSignUp ? "Fill in the details to get started" : "Enter your email and password to continue"}
        </p>

        {message && (
          <div className={`modal-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="login-options">
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
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder={isSignUp ? "Create a password" : "Enter your password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="password-toggle-icon"
                    >
                      <path
                        d="M3 3L21 21"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.88 5.09A10.94 10.94 0 0112 4.91c5 0 8.27 4.19 9 5.09-.35.43-1.28 1.52-2.72 2.58"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.61 6.61C4.54 7.97 3.28 9.66 3 10c.73.9 4 5.09 9 5.09 1.5 0 2.86-.38 4.08-.96"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="password-toggle-icon"
                    >
                      <path
                        d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? "Processing..." : (isSignUp ? "Sign Up" : "Sign In")}
            </button>
          </form>

          <div className="modal-footer">
            <p>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                type="button" 
                className="toggle-mode-btn" 
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setShowPassword(false);
                }}
              >
                {isSignUp ? "Sign in" : "Sign up here"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;