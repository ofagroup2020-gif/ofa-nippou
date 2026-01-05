// auth.js
const KEY_ROLE = "ofa_role"; // "driver" | "admin"
const KEY_LOGIN_AT = "ofa_login_at";

window.auth = {
  getRole() {
    return localStorage.getItem(KEY_ROLE) || "";
  },
  isDriver() {
    return this.getRole() === "driver";
  },
  isAdmin() {
    return this.getRole() === "admin";
  },
  login(role, password) {
    const c = window.OFA_CONFIG;
    if (role === "driver" && password === c.DRIVER_PASSWORD) {
      localStorage.setItem(KEY_ROLE, "driver");
      localStorage.setItem(KEY_LOGIN_AT, String(Date.now()));
      return true;
    }
    if (role === "admin" && password === c.ADMIN_PASSWORD) {
      localStorage.setItem(KEY_ROLE, "admin");
      localStorage.setItem(KEY_LOGIN_AT, String(Date.now()));
      return true;
    }
    return false;
  },
  logout() {
    localStorage.removeItem(KEY_ROLE);
    localStorage.removeItem(KEY_LOGIN_AT);
  },
  requireAnyLogin() {
    if (!this.getRole()) {
      location.href = "./index.html";
    }
  },
  requireAdmin() {
    if (!this.isAdmin()) {
      location.href = "./index.html";
    }
  },
};

window.renderLoginState = function () {
  const role = window.auth.getRole();
  const stateEl = $("#loginState");
  const badge = $("#badgeMode");
  if (stateEl) stateEl.textContent = role ? `ログイン中：${role}` : "未ログイン";
  if (badge) badge.textContent = role ? (role === "admin" ? "管理者" : "ドライバー") : "未ログイン";
};
