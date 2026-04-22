import React, { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import "../../assets/style.css";
import { storeAuthenticatedUser } from "../../utils/session";
import { getSupabaseClient } from "../../utils/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_TARGET_LABEL = API_BASE_URL || "Vite proxy (/api -> 127.0.0.1:8000)";
const OTP_SEND_COOLDOWNS_SEC = [60, 90, 120];
const MAX_OTP_SEND_ATTEMPTS = 3;
const RESET_OTP_RATE_LIMIT_STORAGE_PREFIX = "lucit_reset_otp_rate_limit";

type ResetOtpRateLimitState = {
  attempts: number;
  cooldownEndsAt: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getResetOtpRateLimitStorageKey(email: string) {
  return `${RESET_OTP_RATE_LIMIT_STORAGE_PREFIX}:${normalizeEmail(email)}`;
}

function readResetOtpRateLimitState(email: string): ResetOtpRateLimitState {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { attempts: 0, cooldownEndsAt: 0 };
  }

  const rawValue = sessionStorage.getItem(
    getResetOtpRateLimitStorageKey(normalizedEmail),
  );
  if (!rawValue) {
    return { attempts: 0, cooldownEndsAt: 0 };
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<ResetOtpRateLimitState>;
    const attempts = Number(parsedValue.attempts);
    const cooldownEndsAt = Number(parsedValue.cooldownEndsAt);

    return {
      attempts: Number.isFinite(attempts) ? attempts : 0,
      cooldownEndsAt: Number.isFinite(cooldownEndsAt) ? cooldownEndsAt : 0,
    };
  } catch {
    sessionStorage.removeItem(getResetOtpRateLimitStorageKey(normalizedEmail));
    return { attempts: 0, cooldownEndsAt: 0 };
  }
}

function writeResetOtpRateLimitState(
  email: string,
  state: ResetOtpRateLimitState,
) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  sessionStorage.setItem(
    getResetOtpRateLimitStorageKey(normalizedEmail),
    JSON.stringify(state),
  );
}

function clearResetOtpRateLimitState(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  sessionStorage.removeItem(getResetOtpRateLimitStorageKey(normalizedEmail));
}

function getRequestErrorMessage(err: unknown, fallbackMessage: string) {
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return `Cannot reach backend at ${API_TARGET_LABEL}. Make sure the backend server is running and Frontend/.env uses the correct VITE_API_URL.`;
  }

  return err instanceof Error ? err.message : fallbackMessage;
}

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

const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] =
    useState(false);
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
  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [resetStep, setResetStep] = useState<"otp" | "password">("otp");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetAccessToken, setResetAccessToken] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [otpSendAttempts, setOtpSendAttempts] = useState(0);
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const sendCodeInFlightRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSignUp(false);
      setShowPassword(false);
      setShowResetNewPassword(false);
      setShowResetConfirmPassword(false);
      setShowForgotPasswordUI(false);
      setLoginAttempts(0);
      setIsResetMode(false);
      setFormData({ fullName: "", email: "", password: "" });
      setResetEmail("");
      setVerificationCode(["", "", "", "", "", ""]);
      setResetStep("otp");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetAccessToken("");
      setIsSendingCode(false);
      setOtpSendAttempts(0);
      sendCodeInFlightRef.current = false;
      setResendTimer(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const rateLimitState = readResetOtpRateLimitState(resetEmail);
    const remainingSeconds = Math.max(
      0,
      Math.ceil((rateLimitState.cooldownEndsAt - Date.now()) / 1000),
    );

    setOtpSendAttempts(rateLimitState.attempts);
    setResendTimer(remainingSeconds);
  }, [resetEmail, isResetMode]);

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

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
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
        toast.error(getRequestErrorMessage(err, "Something went wrong"));
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
          setLoginAttempts((prev) => prev + 1);
          if (loginAttempts >= 0) {
            setShowForgotPasswordUI(true);
          }
          throw new Error(result.message || "Invalid credentials");
        }
      } catch (err) {
        toast.error(getRequestErrorMessage(err, "Invalid email or password"));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSendCode = async () => {
    if (sendCodeInFlightRef.current || isSendingCode || resendTimer > 0) {
      return;
    }

    const normalizedResetEmail = normalizeEmail(resetEmail);

    if (!normalizedResetEmail) {
      toast.error("Please enter your email address first.");
      return;
    }

    const currentRateLimitState =
      readResetOtpRateLimitState(normalizedResetEmail);
    const remainingSeconds = Math.max(
      0,
      Math.ceil((currentRateLimitState.cooldownEndsAt - Date.now()) / 1000),
    );

    if (currentRateLimitState.attempts >= MAX_OTP_SEND_ATTEMPTS) {
      setOtpSendAttempts(currentRateLimitState.attempts);
      setResendTimer(remainingSeconds);
      toast.error(
        "You have reached the maximum of 3 verification code requests for this session.",
      );
      return;
    }

    if (remainingSeconds > 0) {
      setOtpSendAttempts(currentRateLimitState.attempts);
      setResendTimer(remainingSeconds);
      return;
    }

    sendCodeInFlightRef.current = true;
    setIsSendingCode(true);
    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      const response = await fetch(
        `${API_BASE_URL}/api/password-reset/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedResetEmail,
          }),
        },
      );

      const result = await parseApiBody(response);
      if (!response.ok) {
        throw new Error(
          result.message || result.error || "Failed to send verification code",
        );
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedResetEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw new Error(
          error.message || "Failed to send verification code via Supabase",
        );
      }

      setResetStep("otp");
      setVerificationCode(["", "", "", "", "", ""]);
      setResetAccessToken("");
      const nextAttempts = currentRateLimitState.attempts + 1;
      const cooldownSeconds =
        OTP_SEND_COOLDOWNS_SEC[
          Math.min(nextAttempts - 1, OTP_SEND_COOLDOWNS_SEC.length - 1)
        ];
      const nextRateLimitState = {
        attempts: nextAttempts,
        cooldownEndsAt: Date.now() + cooldownSeconds * 1000,
      };

      writeResetOtpRateLimitState(normalizedResetEmail, nextRateLimitState);
      setOtpSendAttempts(nextAttempts);
      setResendTimer(cooldownSeconds);
      toast.success(
        nextAttempts >= MAX_OTP_SEND_ATTEMPTS
          ? "Verification code sent. This was your last allowed request for this session."
          : `Verification code sent. You can request a new code again in ${cooldownSeconds} seconds.`,
      );
    } catch (err) {
      toast.error(
        getRequestErrorMessage(err, "Failed to send verification code"),
      );
    } finally {
      sendCodeInFlightRef.current = false;
      setIsSendingCode(false);
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = verificationCode.join("");
    if (code.length < 6) {
      toast.error("Please enter the full 6-digit verification code.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email: resetEmail,
        token: code,
        type: "email",
      });

      if (error) {
        throw new Error(error.message || "Failed to verify OTP");
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error(
          "Supabase did not return an authenticated session after OTP verification.",
        );
      }

      setResetAccessToken(accessToken);
      setResetStep("password");
      toast.success("Verification code confirmed.");
    } catch (err) {
      toast.error(getRequestErrorMessage(err, "Failed to verify OTP"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!newPassword || !confirmNewPassword) {
      toast.error("Please enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    if (!resetAccessToken) {
      toast.error("Verify the OTP code first.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      const response = await fetch(
        `${API_BASE_URL}/api/password-reset/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: resetEmail,
            access_token: resetAccessToken,
            new_password: newPassword,
            confirm_password: confirmNewPassword,
          }),
        },
      );

      const result = await parseApiBody(response);
      if (!response.ok) {
        throw new Error(
          result.message || result.error || "Failed to reset password",
        );
      }

      const { error: supabasePasswordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      const supabasePasswordMessage = (
        supabasePasswordError?.message || ""
      ).toLowerCase();
      const isSamePasswordError =
        supabasePasswordMessage.includes("different from the old password") ||
        supabasePasswordMessage.includes("same as the old password");

      if (supabasePasswordError && !isSamePasswordError) {
        throw new Error(
          supabasePasswordError.message ||
            "Failed to update password in Supabase",
        );
      }

      toast.success(result.message || "Password updated successfully.");
      setIsResetMode(false);
      setResetEmail("");
      setVerificationCode(["", "", "", "", "", ""]);
      setResetStep("otp");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowResetNewPassword(false);
      setShowResetConfirmPassword(false);
      setResetAccessToken("");
      clearResetOtpRateLimitState(resetEmail);
      setOtpSendAttempts(0);
      setResendTimer(0);
      await supabase.auth.signOut();
    } catch (err) {
      toast.error(getRequestErrorMessage(err, "Failed to reset password"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasReachedOtpSendLimit = otpSendAttempts >= MAX_OTP_SEND_ATTEMPTS;

  if (isResetMode) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
          <h2 className="modal-title">Reset Password</h2>
          <p className="modal-subtitle">
            {resetStep === "otp"
              ? "Enter your email and the verification code sent to you"
              : "Set your new password after OTP verification"}
          </p>

          <div className="reset-form-container">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetStep === "password"}
                required
              />
            </div>

            {resetStep === "otp" ? (
              <>
                <div className="form-group">
                  <label>Verification Code</label>
                  <div className="verification-code-container">
                    {verificationCode.map((digit, i) => (
                      <input
                        key={i}
                        type="text"
                        maxLength={1}
                        value={digit}
                        ref={(el) => {
                          codeInputsRef.current[i] = el;
                        }}
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
                  disabled={
                    resendTimer > 0 ||
                    isLoading ||
                    isSendingCode ||
                    hasReachedOtpSendLimit
                  }
                  style={{ width: "100%", marginBottom: "10px" }}
                >
                  {isSendingCode || isLoading
                    ? "Processing..."
                    : hasReachedOtpSendLimit
                      ? "Maximum Attempts Reached"
                      : resendTimer > 0
                        ? `Send again in ${resendTimer}s`
                        : "Send Verification Code"}
                </button>
                <p
                  className="modal-subtitle"
                  style={{ marginTop: "0", marginBottom: "12px" }}
                >
                  {hasReachedOtpSendLimit
                    ? "You have used all 3 verification code requests for this session."
                    : `${Math.max(0, MAX_OTP_SEND_ATTEMPTS - otpSendAttempts)} verification code request(s) remaining.`}
                </p>

                <button
                  className="submit-btn"
                  onClick={handleVerifyOtp}
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Confirm OTP"}
                </button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>New Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showResetNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowResetNewPassword((prev) => !prev)}
                      aria-label={
                        showResetNewPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showResetNewPassword ? (
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

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showResetConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() =>
                        setShowResetConfirmPassword((prev) => !prev)
                      }
                      aria-label={
                        showResetConfirmPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showResetConfirmPassword ? (
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

                <button
                  className="submit-btn"
                  onClick={handleConfirmReset}
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Update Password"}
                </button>
              </>
            )}

            <div className="modal-footer" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="toggle-mode-btn"
                style={{ display: "block", width: "100%" }}
                onClick={() => {
                  setIsResetMode(false);
                  setResetStep("otp");
                }}
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

        <h2 className="modal-title">
          {isSignUp ? "Create an Account" : "Sign In"}
        </h2>
        <p className="modal-subtitle">
          {isSignUp
            ? "Fill in the details to get started"
            : "Enter your email and password to continue"}
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
                  placeholder={
                    isSignUp ? "Create a password" : "Enter your password"
                  }
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
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
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
