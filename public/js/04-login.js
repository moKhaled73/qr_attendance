document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const loginBtn = document.querySelector('#loginForm button[type="submit"]');

    const originalText = loginBtn.textContent;

    loginBtn.disabled = true;
    loginBtn.textContent = "دخول...";

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("username").value,
          password: document.getElementById("password").value,
        }),
      });

      showMessage(data.message || "تم تسجيل الدخول");
      showDashboard();
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = originalText;
    }
  });
