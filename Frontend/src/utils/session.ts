export const USER_STORAGE_KEY = "lucit_user";
export const SESSION_LAST_ACTIVITY_KEY = "lucit_last_activity";
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type LucitUser = {
  fullname: string;
  email: string;
};

function dispatchAuthChanged(user: LucitUser | null) {
  window.dispatchEvent(
    new CustomEvent("lucit:auth-changed", {
      detail: { user },
    }),
  );
}

export function clearSession() {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
}

export function getLastActivity() {
  const rawValue = localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
  if (!rawValue) return null;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

export function isSessionExpired() {
  const lastActivity = getLastActivity();
  if (lastActivity === null) return true;
  return Date.now() - lastActivity >= SESSION_TIMEOUT_MS;
}

export function readStoredUser(): LucitUser | null {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) return null;

  if (isSessionExpired()) {
    clearSession();
    return null;
  }

  try {
    return JSON.parse(rawUser) as LucitUser;
  } catch {
    clearSession();
    return null;
  }
}

export function hasActiveSession() {
  return Boolean(readStoredUser());
}

export function touchSessionActivity(force = false) {
  if (!localStorage.getItem(USER_STORAGE_KEY)) return;

  const now = Date.now();
  const lastActivity = getLastActivity();

  if (!force && lastActivity !== null && now - lastActivity < 15000) {
    return;
  }

  localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(now));
}

export function storeAuthenticatedUser(user: LucitUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  touchSessionActivity(true);
  dispatchAuthChanged(user);
}

export function logoutUser(reason: "manual" | "expired" = "manual") {
  clearSession();
  dispatchAuthChanged(null);

  if (reason === "expired") {
    window.dispatchEvent(new Event("lucit:session-expired"));
  }
}
