document.getElementById("setWeekBtn").addEventListener("click", async () => {
  const setWeekBtn = document.getElementById("setWeekBtn");
  const courseCodeInput = document.getElementById("courseCode");
  const courseCode = courseCodeInput.value.trim();
  const week = Number(document.getElementById("week").value);

  if (!courseCode) {
    showMessage("من فضلك أدخل كود المادة.", true);
    courseCodeInput.focus();
    return;
  }

  const originalText = setWeekBtn.textContent;

  setWeekBtn.disabled = true;
  setWeekBtn.textContent = "جاري تحديد الأسبوع...";

  try {
    const data = await api("/api/attendance/set-week", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "AttendanceApp",
      },
      body: JSON.stringify({
        courseCode,
        week,
      }),
    });

    showMessage(
      `تم تحديد الأسبوع ${data.currentWeek} للمادة ${data.courseCode}`,
    );
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setWeekBtn.disabled = false;
    setWeekBtn.textContent = originalText;
  }
});

document.getElementById("closeWeekBtn").addEventListener("click", async () => {
  const closeWeekBtn = document.getElementById("closeWeekBtn");
  const courseCodeInput = document.getElementById("courseCode");
  const courseCode = courseCodeInput.value.trim();

  if (!courseCode) {
    showMessage("من فضلك أدخل كود المادة.", true);
    courseCodeInput.focus();
    return;
  }

  if (
    !confirm(
      `هل أنت متأكد من إغلاق الأسبوع الحالي للمادة ${courseCode}؟\n` +
        "سيتم تسجيل غائب لكل طالب لم يسجل حضوره في هذا الأسبوع.",
    )
  ) {
    return;
  }

  const originalText = closeWeekBtn.textContent;

  closeWeekBtn.disabled = true;
  closeWeekBtn.textContent = "جاري إغلاق الأسبوع وتسجيل الغياب...";

  try {
    const data = await api("/api/attendance/close-week", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "AttendanceApp",
      },
      body: JSON.stringify({
        courseCode,
      }),
    });

    showMessage(
      `تم إغلاق الأسبوع ${data.week} للمادة ${data.courseCode}.\n` +
        `عدد حالات الغياب المسجلة: ${data.absentCount}`,
    );
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    closeWeekBtn.disabled = false;
    closeWeekBtn.textContent = originalText;
  }
});
