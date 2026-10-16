document.getElementById("logoutBtn").addEventListener("click", async () => {

   try {

      await api("/api/auth/logout", {

         method: "POST",

         headers: { "X-Requested-With": "AttendanceApp" },

      });

      showLogin();

      showMessage("تم تسجيل الخروج");

   } catch (error) {

      showMessage(error.message, true);

   }

});

checkSession();
