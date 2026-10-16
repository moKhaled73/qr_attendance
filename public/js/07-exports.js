// تنزيل ملف QR للمادة المختارة
document.getElementById("exportQrBtn").addEventListener("click", async () => {
  const qrCourseSelect = document.getElementById("qrCourseCode");
  const courseCode = qrCourseSelect.value.trim();

  if (!courseCode) {
    showMessage("من فضلك اختر المادة أولًا.", true);
    qrCourseSelect.focus();
    return;
  }

  exportQrBtn.disabled = true;

  try {
    const response = await fetch(
      `/api/students/export-qr-excel?courseCode=${encodeURIComponent(courseCode)}`,
      {
        method: "GET",
        credentials: "same-origin",
      },
    );

    if (response.status === 401 || response.status === 403) {
      throw new Error("ليس لديك صلاحية لتنزيل ملف QR.");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "تعذر تنزيل ملف QR للطلاب.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `student-qrcodes-${courseCode.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showMessage(`تم تنزيل ملف QR لمادة ${courseCode} بنجاح.`);
  } catch (error) {
    showMessage(error.message || "حدث خطأ أثناء تنزيل الملف.", true);
  } finally {
    exportQrBtn.disabled = false;
  }
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  const exportCourseSelect = document.getElementById("exportCourseCode");
  const courseCode = exportCourseSelect.value.trim();

  if (!courseCode) {
    showMessage("من فضلك أدخل كود المادة.", true);
    courseCodeInput.focus();
    return;
  }

  try {
    const response = await fetch(
      `/api/attendance/export?courseCode=${encodeURIComponent(courseCode)}`,
      { credentials: "same-origin" },
    );

    if (response.status === 401) {
      throw new Error("انتهت الجلسة، سجّل الدخول مرة أخرى");
    }

    if (response.status === 403) {
      throw new Error("ليس لديك صلاحية لتصدير كشف الحضور");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "تعذر تنزيل ملف Excel");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `attendance-${courseCode.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showMessage(`تم تجهيز كشف Excel للمادة ${courseCode} للتنزيل`);
  } catch (error) {
    showMessage(error.message, true);
  }
});
