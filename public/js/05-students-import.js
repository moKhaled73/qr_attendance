// import students

document.getElementById("importBtn").addEventListener("click", async () => {
  const file = document.getElementById("studentsFile").files[0];

  if (!file) {
    return showMessage("اختر ملف Excel أولًا", true);
  }

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
  }
});
