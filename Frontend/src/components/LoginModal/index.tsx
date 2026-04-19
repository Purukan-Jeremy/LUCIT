import React, { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
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
  const [showForgotPasswordUI, setShowForgotPasswordUI] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  
  const [resetEmail, setResetEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSignUp(false);
      setShowPassword(false);
      setShowForgotPasswordUI(false);
      setLoginAttempts(0);
      setIsResetMode(false);
      setFormData({ fullName: "", email: "", password: "" });
      setResetEmail("");
      setVerificationCode(["", "", "", "", "", ""]);
      setResendTimer(0);
    }
  }, [isOpen]);

  // Handle countdown timer for verification code
  useEffect(() => {
    let interval: number;
    if (resendTimer > 0) {
      interval = window.setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    if (value && index < 5) {
      codeInputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

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

        const result = await parseApiBody(response);

        if (response.ok) {
          toast.success("Account created successfully! You can now login.");
          setIsSignUp(false);
          setFormData({ fullName: "", email: "", password: "" });
        } else {
          throw new Error(result.error || "Failed to sign up");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
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
          toast.success(`Welcome back, ${userData.fullname}!`);
          storeAuthenticatedUser(userData);
          onLoginSuccess(userData);
          onClose();
        } else {
          setLoginAttempts(prev => prev + 1);
          if (loginAttempts >= 0) { 
            setShowForgotPasswordUI(true);
          }
          throw new Error(result.message || "Invalid credentials");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Invalid email or password");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSendCode = () => {
    if (!resetEmail) {
      toast.error("Please enter your email address first.");
      return;
    }
    
    // Start 60s timer and show toast
    setResendTimer(60);
    toast.success("Verification code sent to your email!");
    console.log(`[Reset] Code requested for: ${resetEmail}`);
  };

  const handleConfirmReset = () => {
    const code = verificationCode.join("");
    if (code.length < 6) {
      toast.error("Please enter the full 6-digit verification code.");
      return;
    }
    toast.info("Verification feature is currently under maintenance.");
  };

  if (!isOpen) return null;

  if (isResetMode) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>&times;</button>
          <h2 className="modal-title">Reset Password</h2>
          <p className="modal-subtitle">Enter your email and the verification code sent to you</p>
          
          <div className="reset-form-container">
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                placeholder="name@example.com" 
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required 
              />
            </div>

            <div className="form-group">
              <label>Verification Code</label>
              <div className="verification-code-container">
                {verificationCode.map((digit, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    value={digit}
                    ref={(el) => (codeInputsRef.current[i] = el)}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="code-input"
                  />
                ))}
              </div>
            </div>

            <button 
              className="secondary-btn" 
              onClick={handleSendCode} 
              disabled={resendTimer > 0}
              style={{ width: '100%', marginBottom: '10px' }}
            >
              {resendTimer > 0 ? `Send again in ${resendTimer}s` : "Send Verification Code"}
            </button>
            
            <button className="submit-btn" onClick={handleConfirmReset}>
              Confirm
            </button>

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button 
                type="button" 
                className="toggle-mode-btn" 
                style={{ display: 'block', width: '100%' }}
                onClick={() => setIsResetMode(false)}
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                >
                  {showPassword ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="password-toggle-icon">
                      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9.88 5.09A10.94 10.94 0 0112 4.91c5 0 8.27 4.19 9 5.09-.35.43-1.28 1.52-2.72 2.58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.61 6.61C4.54 7.97 3.28 9.66 3 10c.73.9 4 5.09 9 5.09 1.5 0 2.86-.38 4.08-.96" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="password-toggle-icon">
                      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </div>
              
              {!isSignUp && showForgotPasswordUI && (
                <div className="forgot-password-link-container">
                  <button 
                    type="button" 
                    className="forgot-password-btn"
                    onClick={() => setIsResetMode(true)}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="button-spinner" />
                  <span>Processing...</span>
                </>
              ) : (
                isSignUp ? "Sign Up" : "Sign In"
              )}
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
                  setShowForgotPasswordUI(false);
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
