document.getElementById("importBtn").addEventListener("click", async () => {
  const importBtn = document.getElementById("importBtn");
  const file = document.getElementById("studentsFile").files[0];

  if (!file) return showMessage("اختر ملف Excel أولًا", true);

  const originalText = importBtn.textContent;

  importBtn.disabled = true;
  importBtn.textContent = "جاري استرداد الطلاب...";

  const formData = new FormData();
  formData.append("file", file);

  try {
    const data = await api("/api/students/import", {
      method: "POST",
      headers: { "X-Requested-With": "AttendanceApp" },
      body: formData,
    });

    showMessage(
      `تم الاستيراد.\nإجمالي الطلاب: ${data.total}\n` +
        `طلاب جدد: ${data.inserted}\nتم تحديث بيانات: ${data.updated}`,
    );
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = originalText;
  }
});
