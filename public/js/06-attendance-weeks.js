// تحديد الأسبوع الحالي لمادة معينة

document.getElementById("setWeekBtn").addEventListener("click", async () => {
  const courseCode = document.getElementById("courseCode").value.trim();
  const week = Number(document.getElementById("week").value);

  if (!courseCode) {
    showMessage("من فضلك أدخل كود المادة.", true);
    document.getElementById("courseCode").focus();
    return;
  }

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
  }
});

// إغلاق أسبوع المادة وتسجيل الغياب

document.getElementById("closeWeekBtn").addEventListener("click", async () => {
  const courseCode = document.getElementById("courseCode").value.trim();

  if (!courseCode) {
    showMessage("من فضلك أدخل كود المادة.", true);

    document.getElementById("courseCode").focus();

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
  }
});
