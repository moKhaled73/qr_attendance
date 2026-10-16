const loginSection = document.getElementById("loginSection");
const dashboard = document.getElementById("dashboard");
const messageBox = document.getElementById("message");
const logoutBtn = document.getElementById("logoutBtn");

function showMessage(text, isError = false) {
  messageBox.textContent = text;
  messageBox.className = isError ? "error" : "success";
}

function showDashboard() {
  loginSection.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
  dashboard.classList.remove("hidden");
}

function showLogin() {
  dashboard.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  loginSection.classList.remove("hidden");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "حدث خطأ في الطلب");
  }

  return data;
}

async function checkSession() {
  try {
    await api("/api/auth/me");

    showDashboard();
  } catch {
    showLogin();
  }
}
