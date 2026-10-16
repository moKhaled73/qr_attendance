const router = require("express").Router();
const multer = require("multer");
const ExcelJS = require("exceljs");
const crypto = require("crypto");
const QRCode = require("qrcode");

const Student = require("../models/Student.js");

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

// Return a printable QR image for a student to the admin.
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

// Export all students with their QR codes embedded in Excel.
router.get("/export-qr-excel", async (req, res) => {
  try {
    const { courseCode } = req.query;

    // التأكد من إرسال كود المادة
    if (!courseCode || typeof courseCode !== "string" || !courseCode.trim()) {
      return res.status(400).json({
        error: "من فضلك ابعت كود المادة",
      });
    }

    const normalizedCourseCode = courseCode.trim();

    // جلب طلاب المادة المطلوبة فقط
    const students = await Student.find({
      courseCode: normalizedCourseCode,
    })
      .select("+qrToken studentCode fullName courseCode")
      .sort({ studentCode: 1 });

    if (students.length === 0) {
      return res.status(404).json({
        error: "لا يوجد طلاب مسجلون في هذه المادة",
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Student QR Codes");

    sheet.columns = [
      { header: "Student Code", key: "studentCode", width: 22 },
      { header: "Full Name", key: "fullName", width: 35 },
      { header: "Course Code", key: "courseCode", width: 20 },
      { header: "QR Code", key: "qr", width: 18 },
    ];

    sheet.getRow(1).font = { bold: true, size: 12 };
    sheet.getRow(1).height = 25;

    for (const student of students) {
      const row = sheet.addRow({
        studentCode: student.studentCode,
        fullName: student.fullName,
        courseCode: student.courseCode,
      });

      row.height = 85;

      const qrPayload = JSON.stringify({
        studentCode: student.studentCode,
        courseCode: student.courseCode,
        qrToken: student.qrToken,
      });

      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: "H",
      });

      const imageId = workbook.addImage({
        base64: qrDataUrl,
        extension: "png",
      });

      sheet.addImage(imageId, {
        tl: {
          col: 3,
          row: row.number - 1,
        },
        ext: {
          width: 300,
          height: 300,
        },
      });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="student-qrcodes.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("QR Excel export error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "تعذر إنشاء ملف QR للطلاب",
      });
    }

    res.destroy(error);
  }
});

module.exports = router;
