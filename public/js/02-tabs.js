const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

// تحميل جميع المواد من السيرفر
async function loadQrCourses(selectBox) {
  selectBox.disabled = true;
  selectBox.innerHTML = '<option value="">جاري تحميل المواد...</option>';

  try {
    const response = await fetch("/api/attendance/courses", {
      method: "GET",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("تعذر تحميل قائمة المواد.");
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.courses)) {
      throw new Error("بيانات المواد غير صحيحة.");
    }

    selectBox.innerHTML = '<option value="">-- اختر المادة --</option>';

    data.courses.forEach((course) => {
      const option = document.createElement("option");

      option.value = course.courseCode;
      option.textContent = `${course.courseName} (${course.courseCode})`;

      selectBox.appendChild(option);
    });

    if (data.courses.length === 0) {
      selectBox.innerHTML = '<option value="">لا توجد مواد مسجلة</option>';
    }
  } catch (error) {
    selectBox.innerHTML = '<option value="">تعذر تحميل المواد</option>';

    showMessage(error.message, true);
  } finally {
    selectBox.disabled = false;
  }
}

const tabCourseSelects = {
  weekTab: "courseCode",
  scanTab: "scanCourseCode",
  exportTab: "exportCourseCode",
  qrExportTab: "qrCourseCode",
};

tabButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const targetTab = button.dataset.tab;

    tabContents.forEach((content) => {
      content.classList.add("hidden");
    });

    tabButtons.forEach((tabButton) => {
      tabButton.classList.remove("active");
    });

    const tabContent = document.getElementById(targetTab);

    if (!tabContent) return;

    tabContent.classList.remove("hidden");
    button.classList.add("active");

    // تحديد قائمة المواد الخاصة بالتبويب المفتوح
    const selectId = tabCourseSelects[targetTab];

    if (!selectId) return;

    const selectBox = document.getElementById(selectId);

    if (!selectBox || selectBox.dataset.loaded === "true") return;

    await loadQrCourses(selectBox);

    // إعادة المحاولة عند فتح التبويب مرة أخرى لو فشل التحميل
    if (
      selectBox.options.length > 0 &&
      selectBox.options[0].value === "" &&
      selectBox.options[0].textContent !== "تعذر تحميل المواد"
    ) {
      selectBox.dataset.loaded = "true";
    }
  });
});
