const studentsFileInput = document.getElementById("studentsFile");
const uploadDropzone = document.getElementById("uploadDropzone");
const selectedFileInfo = document.getElementById("selectedFileInfo");
const selectedFileName = document.getElementById("selectedFileName");
const selectedFileSize = document.getElementById("selectedFileSize");
const removeSelectedFile = document.getElementById("removeSelectedFile");
const importButton = document.getElementById("importBtn");

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function updateSelectedFile() {
  const file = studentsFileInput.files?.[0];

  if (!file) {
    selectedFileInfo.classList.add("hidden");
    selectedFileName.textContent = "";
    selectedFileSize.textContent = "";
    importButton.disabled = true;
    return;
  }

  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = formatFileSize(file.size);
  selectedFileInfo.classList.remove("hidden");

  const isXlsx = /\.xlsx$/i.test(file.name);
  const withinLimit = file.size <= 5 * 1024 * 1024;

  importButton.disabled = !isXlsx || !withinLimit;

  if (!isXlsx) {
    showMessage("من فضلك اختر ملف Excel بامتداد .xlsx", true);
  } else if (!withinLimit) {
    showMessage("حجم الملف أكبر من الحد المسموح (5 MB).", true);
  }
}

studentsFileInput.addEventListener("change", updateSelectedFile);

removeSelectedFile.addEventListener("click", () => {
  studentsFileInput.value = "";
  updateSelectedFile();
});

uploadDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadDropzone.classList.add("drag-over");
});

uploadDropzone.addEventListener("dragleave", () => {
  uploadDropzone.classList.remove("drag-over");
});

uploadDropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadDropzone.classList.remove("drag-over");

  const file = event.dataTransfer.files?.[0];
  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  studentsFileInput.files = transfer.files;

  updateSelectedFile();
});

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

const loginSection = document.getElementById("loginSection");
const dashboard = document.getElementById("dashboard");
const messageBox = document.getElementById("message");
const logoutBtn = document.getElementById("logoutBtn");

function showMessage(text, isError = false) {
  messageBox.textContent = text;
  messageBox.className = isError ? "error" : "success";
}

function showDashboard() {
  loginSection.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
  dashboard.classList.remove("hidden");
}

function showLogin() {
  dashboard.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  loginSection.classList.remove("hidden");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "حدث خطأ في الطلب");
  }

  return data;
}

async function checkSession() {
  try {
    await api("/api/auth/me");
    showDashboard();
  } catch {
    showLogin();
  }
}

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

document.getElementById("exportBtn").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/attendance/export");

    if (response.status === 401) {
      throw new Error("انتهت الجلسة، سجّل الدخول مرة أخرى");
    }

    if (!response.ok) {
      throw new Error("تعذر تنزيل ملف Excel");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "attendance.xlsx";
    link.click();

    URL.revokeObjectURL(url);
    showMessage("تم تجهيز كشف Excel للتنزيل");
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById("exportQrBtn").addEventListener("click", async () => {
  const button = document.getElementById("exportQrBtn");
  const courseCodeInput = document.getElementById("qrCourseCode");
  const courseCode = courseCodeInput.value.trim();

  // التأكد من إدخال كود المادة
  if (!courseCode) {
    showMessage("من فضلك أدخل كود المادة.", true);
    courseCodeInput.focus();
    return;
  }

  button.disabled = true;

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
    button.disabled = false;
  }
});

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

const cameraSelect = document.getElementById("cameraSelect");
const startScannerBtn = document.getElementById("startScannerBtn");
const stopScannerBtn = document.getElementById("stopScannerBtn");
const scanResult = document.getElementById("scanResult");

let qrScanner = null;
let scanning = false;
let starting = false;
let processingScan = false;
let lastScannedToken = "";
let lastScannedAt = 0;

function getSelectedCourseCode() {
  const input = document.getElementById("courseCode");
  const courseCode = input?.value.trim();

  if (!courseCode) {
    showScanResult("من فضلك أدخل كود المادة أولًا.", false);
    input?.focus();
    return null;
  }

  return courseCode;
}

function showScanResult(text, success = true) {
  scanResult.textContent = text;
  scanResult.className = success ? "success" : "error";
}

async function startScanner() {
  if (starting || scanning) return;

  starting = true;
  startScannerBtn.disabled = true;

  try {
    if (typeof Html5Qrcode === "undefined") {
      throw new Error("مكتبة html5-qrcode لم يتم تحميلها");
    }

    showScanResult("جارٍ البحث عن الكاميرات...");

    const cameras = await Html5Qrcode.getCameras();

    if (!cameras.length) {
      throw new Error("لم يتم العثور على كاميرا");
    }

    cameraSelect.replaceChildren();

    cameras.forEach((camera, index) => {
      const option = document.createElement("option");
      option.value = camera.id;
      option.textContent = camera.label || `كاميرا ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    const preferredCamera =
      cameras.find((camera) =>
        /back|rear|environment|خلف/i.test(camera.label || ""),
      ) || cameras[0];

    cameraSelect.value = preferredCamera.id;

    // أنشئ قارئًا جديدًا فقط إذا لم يكن موجودًا.
    if (!qrScanner) {
      qrScanner = new Html5Qrcode("reader");
    }

    showScanResult("جارٍ تشغيل الكاميرا...");

    await qrScanner.start(
      { deviceId: { exact: cameraSelect.value } },
      {
        fps: 10,
        qrbox: (width, height) => {
          const size = Math.floor(Math.min(width, height) * 0.7);
          return { width: size, height: size };
        },
      },
      async (decodedText) => {
        const now = Date.now();

        // منع إرسال نفس الرمز عدة مرات متتالية.
        if (
          processingScan ||
          (decodedText === lastScannedToken && now - lastScannedAt < 2000)
        ) {
          return;
        }

        processingScan = true;
        lastScannedToken = decodedText;
        lastScannedAt = now;

        try {
          const selectedCourseCode = getSelectedCourseCode();
          if (!selectedCourseCode) return;

          const data = await api("/api/attendance/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "AttendanceApp",
            },
            body: JSON.stringify({
              token: decodedText,
              courseCode: selectedCourseCode,
            }),
          });

          showScanResult(`✅ ${data.message}\nالأسبوع: ${data.week}`);
        } catch (error) {
          showScanResult(`⚠️ ${error.message}`, false);
        } finally {
          setTimeout(() => {
            processingScan = false;
          }, 1000);
        }
      },
    );

    scanning = true;

    // فحص هل المتصفح يعرض إطارات فيديو فعلية.
    const video = document.querySelector("#reader video");

    if (!video) {
      showScanResult(
        "بدأ القارئ، لكن عنصر الفيديو غير موجود. افحص Console.",
        false,
      );
    } else {
      showScanResult(
        `الكاميرا بدأت. دقة الفيديو: ${video.videoWidth} × ${video.videoHeight}`,
      );
    }
  } catch (error) {
    console.error("Scanner startup error:", error);
    showScanResult(`تعذر تشغيل الكاميرا: ${error.message || error}`, false);
  } finally {
    starting = false;
    startScannerBtn.disabled = false;
  }
}

async function stopScanner() {
  if (!qrScanner || !scanning) return;

  try {
    await qrScanner.stop();
    scanning = false;
    showScanResult("تم إيقاف الكاميرا.");
  } catch (error) {
    console.error("Scanner stop error:", error);
    showScanResult("تعذر إيقاف الكاميرا.", false);
  }
}

startScannerBtn.addEventListener("click", startScanner);
stopScannerBtn.addEventListener("click", stopScanner);

cameraSelect.addEventListener("change", async () => {
  if (!scanning || !qrScanner) return;

  try {
    await qrScanner.stop();
    scanning = false;

    showScanResult("جارٍ تغيير الكاميرا...");

    await qrScanner.start(
      { deviceId: { exact: cameraSelect.value } },
      {
        fps: 10,
        qrbox: (width, height) => {
          const size = Math.floor(Math.min(width, height) * 0.7);
          return { width: size, height: size };
        },
      },
      async (decodedText) => {
        if (processingScan) return;

        processingScan = true;

        try {
          const data = await api("/api/attendance/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "AttendanceApp",
            },
            body: JSON.stringify({ token: decodedText }),
          });

          showScanResult(`✅ ${data.message}\nالأسبوع: ${data.week}`);
        } catch (error) {
          showScanResult(`⚠️ ${error.message}`, false);
        } finally {
          setTimeout(() => {
            processingScan = false;
          }, 1000);
        }
      },
    );

    scanning = true;
    showScanResult("تم تشغيل الكاميرا المختارة.");
  } catch (error) {
    scanning = false;
    console.error("Camera switch error:", error);
    showScanResult("تعذر تغيير الكاميرا.", false);
  }
});
