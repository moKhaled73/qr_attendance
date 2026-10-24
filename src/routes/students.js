const router = require("express").Router();
const multer = require("multer");
const ExcelJS = require("exceljs");
const crypto = require("crypto");
const QRCode = require("qrcode");
const sharp = require("sharp");
const JSZip = require("jszip");

const Student = require("../models/Student.js");
const Settings = require("../models/Settings");

const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const fs = require("fs");

GlobalFonts.registerFromPath(
  path.join(process.cwd(), "assets", "NotoNaskhArabic-Regular.ttf"),
  "NotoNaskhArabic",
);

GlobalFonts.registerFromPath(
  path.join(process.cwd(), "assets", "DejaVuSans.ttf"),
  "DejaVuSans",
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({
      error: "يجب تسجيل الدخول أولًا",
    });
  }

  next();
}

async function createStudentQrImage(student) {
  const qrPayload = JSON.stringify({
    studentCode: student.studentCode,
    courseCode: student.courseCode,
    qrToken: student.qrToken,
  });

  const qrBuffer = await QRCode.toBuffer(qrPayload, {
    type: "png",
    width: 900,
    margin: 0.5,
    errorCorrectionLevel: "H",
  });

  const canvas = createCanvas(1000, 1200);
  const ctx = canvas.getContext("2d");

  // خلفية بيضاء
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1000, 1200);

  // وضع QR في المنتصف
  const qrImage = await require("@napi-rs/canvas").loadImage(qrBuffer);
  ctx.drawImage(qrImage, 50, 50, 900, 900);

  // اسم الطالب
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'bold 48px "NotoNaskhArabic"';
  ctx.direction = "ltr";
  ctx.fillText(
    `${student.studentCode || ""} ${student.fullName || ""}`,
    500,
    1000,
    960,
  );

  // كود المادة واسمها
  ctx.font = '42px "DejaVuSans"';
  ctx.direction = "ltr";
  ctx.fillText(
    `${student.courseCode || ""}: ${student.courseName || ""}`,
    500,
    1100,
    960,
  );

  return canvas.toBuffer("image/png");
}

router.use(requireAdmin);

router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "ارفع ملف Excel أولًا",
    });
  }

  if (!/\.xlsx$/i.test(req.file.originalname)) {
    return res.status(400).json({
      error: "يُسمح بملفات XLSX فقط",
    });
  }

  if (req.file.buffer.subarray(0, 4).toString("hex") !== "504b0304") {
    return res.status(400).json({
      error: "الملف ليس ملف XLSX صالحًا",
    });
  }

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.worksheets[0];

    if (!sheet || sheet.rowCount < 2 || sheet.rowCount > 1001) {
      return res.status(400).json({
        error: "الملف يجب أن يحتوي على طالب واحد على الأقل، وبحد أقصى 1000 صف",
      });
    }

    const headers = sheet
      .getRow(1)
      .values.slice(1)
      .map((value) => String(value ?? "").trim());

    const codeColumn = headers.indexOf("studentCode") + 1;
    const nameColumn = headers.indexOf("fullName") + 1;
    const sectionColumn = headers.indexOf("section") + 1;
    const courseCodeColumn = headers.indexOf("courseCode") + 1;
    const courseColumn = headers.indexOf("courseName") + 1;

    if (
      !codeColumn ||
      !nameColumn ||
      !sectionColumn ||
      !courseCodeColumn ||
      !courseColumn
    ) {
      return res.status(400).json({
        error:
          "الأعمدة المطلوبة هي studentCode و fullName و section و courseCode و courseName",
      });
    }

    const students = [];
    const seen = new Set();

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);

      const studentCode = String(row.getCell(codeColumn).text ?? "").trim();
      const fullName = String(row.getCell(nameColumn).text ?? "").trim();
      const section = String(row.getCell(sectionColumn).text ?? "").trim();
      const courseName = String(row.getCell(courseColumn).text ?? "").trim();
      const courseCode = String(
        row.getCell(courseCodeColumn).text ?? "",
      ).trim();

      if (!studentCode && !fullName && !section && !courseName && !courseCode)
        continue;

      if (
        !/^[a-zA-Z0-9_-]{1,30}$/.test(studentCode) ||
        !fullName ||
        fullName.length > 150 ||
        !section ||
        section.length > 50 ||
        !courseName ||
        courseName.length > 150 ||
        !courseCode ||
        courseCode.length > 30
      ) {
        return res.status(400).json({
          error: `بيانات غير صحيحة في الصف ${i}`,
        });
      }

      const enrollmentKey = JSON.stringify([studentCode, courseCode]);

      if (seen.has(enrollmentKey)) {
        return res.status(400).json({
          error: `تكرار نفس الطالب ونفس المادة في الصف ${i}`,
        });
      }

      seen.add(enrollmentKey);
      students.push({
        studentCode,
        fullName,
        section,
        courseCode,
        courseName,
      });
    }

    if (students.length > 0) {
      const { courseCode, courseName } = students[0];

      await Settings.findOneAndUpdate(
        { courseCode },
        {
          $set: { courseName },
          $setOnInsert: {
            semesterName: "الفصل الدراسي الحالي",
            totalWeeks: 12,
            currentWeek: 1,
            closedWeeks: [],
          },
        },
        {
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );
    }

    let inserted = 0;
    let updated = 0;

    for (const item of students) {
      const existing = await Student.findOne({
        studentCode: item.studentCode,
        courseCode: item.courseCode,
      });

      if (existing) {
        // Update student details without changing QR or past attendance.
        existing.fullName = item.fullName;
        existing.section = item.section;
        existing.courseName = item.courseName;

        await existing.save();
        updated++;
      } else {
        await Student.create({
          ...item,
          qrToken: crypto.randomBytes(32).toString("hex"),
        });

        inserted++;
      }
    }

    res.json({
      message: "تم استيراد الطلاب بنجاح",
      total: students.length,
      inserted,
      updated,
    });
  } catch (error) {
    console.error("Import error:", error.message);

    res.status(400).json({
      error: "تعذر قراءة الملف أو حفظ البيانات",
    });
  }
});

router.get("/export-qr-excel", async (req, res) => {
  try {
    const { courseCode } = req.query;

    if (!courseCode || typeof courseCode !== "string" || !courseCode.trim()) {
      return res.status(400).json({
        error: "من فضلك ابعت كود المادة",
      });
    }

    const normalizedCourseCode = courseCode.trim();

    const students = await Student.find({
      courseCode: normalizedCourseCode,
    })
      .select("+qrToken studentCode fullName courseCode courseName")
      .sort({ section: 1, studentCode: 1 });

    if (students.length === 0) {
      return res.status(404).json({
        error: "لا يوجد طلاب مسجلون في هذه المادة",
      });
    }

    const zip = new JSZip();

    for (const student of students) {
      const imageBuffer = await createStudentQrImage(student);

      const safeCode = String(student.studentCode).replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        "_",
      );

      const safeName = String(student.fullName || "student")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .trim();

      zip.file(`${safeCode}_${safeName}.png`, imageBuffer);
    }

    // إنشاء ملف ZIP كامل قبل إرسال الاستجابة
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

    res.setHeader("Content-Type", "application/zip");

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="student-qrcodes.zip"',
    );

    res.setHeader("Content-Length", zipBuffer.length);

    return res.end(zipBuffer);
  } catch (error) {
    console.error("QR ZIP export error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "تعذر إنشاء ملف صور QR للطلاب",
      });
    }

    res.destroy(error);
  }
});

router.get("/:studentCode/qr", async (req, res) => {
  try {
    const student = await Student.findOne({
      studentCode: req.params.studentCode,
    }).select("+qrToken studentCode fullName");

    if (!student) {
      return res.status(404).json({
        error: "الطالب غير موجود",
      });
    }

    const png = await QRCode.toBuffer(student.qrToken, {
      type: "png",
      width: 300,
      margin: 2,
    });

    res.type("png").send(png);
  } catch {
    res.status(500).json({
      error: "تعذر إنشاء QR",
    });
  }
});

module.exports = router;
