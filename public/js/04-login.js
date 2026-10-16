// login

document

   .getElementById("loginForm")

   .addEventListener("submit", async (event) => {

      event.preventDefault();

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

         console.error("Login failed:", error);

         alert(error.message || "تعذر تسجيل الدخول");

         showMessage(error.message, true);

      }

   });
