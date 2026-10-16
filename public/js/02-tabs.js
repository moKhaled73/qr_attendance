const tabButtons = document.querySelectorAll(".tab-button");

const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((button) => {

   button.addEventListener("click", () => {

      const targetTab = button.dataset.tab;

      // إخفاء كل الكروت

      tabContents.forEach((content) => {

         content.classList.add("hidden");

      });

      // إزالة التحديد من كل Tabs

      tabButtons.forEach((tabButton) => {

         tabButton.classList.remove("active");

      });

      // إظهار الكارد المختار

      document.getElementById(targetTab).classList.remove("hidden");

      button.classList.add("active");

   });

});
