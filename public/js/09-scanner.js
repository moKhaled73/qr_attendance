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
