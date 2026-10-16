const router = require("express").Router();
const Student = require("../models/Student.js");
const Settings = require("../models/Settings.js");
const ExcelJS = require("exceljs");

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({
      error: "يجب تسجيل الدخول أولًا",
    });
  }
  next();
}

// الحصول على إعدادات الترم الحالي أو إنشاؤها
async function getSettings(courseCode) {
  if (typeof courseCode !== "string" || !courseCode.trim()) {
    throw new Error("Course code is required");
  }

  const normalizedCourseCode = courseCode.trim();

  let settings = await Settings.findOne({
    courseCode: normalizedCourseCode,
  });

  if (!settings) {
    settings = await Settings.create({
      courseCode: normalizedCourseCode,
      totalWeeks: 14,
      currentWeek: 1,
      closedWeeks: [],
    });
  }

  return settings;
}

// تسجيل الحضور باستخدام QR
router.post("/scan", requireAdmin, async (req, res) => {
  try {
    const { token, courseCode } = req.body || {};

    // التأكد من وجود المادة المختارة
    if (typeof courseCode !== "string" || !courseCode.trim()) {
      return res.status(400).json({
        error: "من فضلك اختر المادة أولًا",
      });
    }

    const selectedCourseCode = courseCode.trim();

    // قراءة بيانات QR
    if (typeof token !== "string" || token.length > 2000) {
      return res.status(400).json({
        error: "رمز QR غير صالح",
      });
    }

    let qrData;

    try {
      qrData = JSON.parse(token);
    } catch {
      return res.status(400).json({
        error: "بيانات QR غير صالحة",
      });
    }

    const { studentCode, courseCode: qrCourseCode, qrToken } = qrData;

    if (
      typeof studentCode !== "string" ||
      typeof qrCourseCode !== "string" ||
      typeof qrToken !== "string" ||
      !/^[a-f0-9]{64}$/i.test(qrToken)
    ) {
      return res.status(400).json({
        error: "بيانات QR غير مكتملة أو غير صالحة",
      });
    }

    // التأكد أن QR يخص المادة المختارة
    if (qrCourseCode.trim() !== selectedCourseCode) {
      return res.status(409).json({
        error: "رمز QR لا يخص المادة المختارة",
      });
    }

    // جلب إعدادات المادة فقط
    const settings = await getSettings(selectedCourseCode);
    const week = settings.currentWeek;

    if (week > settings.totalWeeks) {
      return res.status(409).json({
        error: "الأسبوع الحالي يتجاوز عدد أسابيع المادة",
      });
    }

    if (settings.closedWeeks.includes(week)) {
      return res.status(409).json({
        error: "الأسبوع الحالي مغلق لهذه المادة",
      });
    }

    // التحقق من الطالب والمادة والـ QR معًا
    const studentFilter = {
      studentCode: studentCode.trim(),
      courseCode: selectedCourseCode,
      qrToken,
    };

    // تسجيل الحضور مرة واحدة فقط في الأسبوع الحالي
    const student = await Student.findOneAndUpdate(
      {
        ...studentFilter,
        [`attendance.${week}`]: { $exists: false },
      },
      {
        $set: {
          [`attendance.${week}`]: "present",
        },
      },
      {
        new: true,
      },
    );

    if (student) {
      return res.json({
        success: true,
        status: "present",
        student: {
          studentCode: student.studentCode,
          fullName: student.fullName,
          courseCode: student.courseCode,
        },
        courseCode: selectedCourseCode,
        week,
        message: `تم تسجيل حضور ${student.fullName}`,
      });
    }

    // التحقق هل الطالب والـ QR صحيحان لكن الحضور مسجل بالفعل
    const existingStudent = await Student.findOne(studentFilter);

    if (!existingStudent) {
      return res.status(404).json({
        error: "الطالب أو رمز QR غير صحيح لهذه المادة",
      });
    }

    return res.status(409).json({
      error: "تم تسجيل حضور هذا الطالب بالفعل في الأسبوع الحالي",
      student: {
        studentCode: existingStudent.studentCode,
        fullName: existingStudent.fullName,
        courseCode: existingStudent.courseCode,
      },
      courseCode: selectedCourseCode,
      week,
    });
  } catch (error) {
    console.error("Scan error:", error);

    return res.status(500).json({
      error: "حدث خطأ أثناء تسجيل الحضور",
    });
  }
});

// إغلاق أسبوع مادة وتسجيل الغياب
router.post("/close-week", requireAdmin, async (req, res) => {
  try {
    const { courseCode } = req.body || {};

    if (typeof courseCode !== "string" || !courseCode.trim()) {
      return res.status(400).json({
        error: "من فضلك اختر المادة أولًا",
      });
    }

    const selectedCourseCode = courseCode.trim();
    const settings = await getSettings(selectedCourseCode);
    const week = settings.currentWeek;

    if (week > settings.totalWeeks) {
      return res.status(400).json({
        error: "رقم الأسبوع يتجاوز عدد أسابيع المادة",
      });
    }

    if (settings.closedWeeks.includes(week)) {
      return res.status(409).json({
        error: "هذا الأسبوع مغلق بالفعل لهذه المادة",
      });
    }

    // تسجيل الغياب للطلاب المسجلين في المادة فقط
    const result = await Student.updateMany(
      {
        courseCode: selectedCourseCode,
        [`attendance.${week}`]: { $exists: false },
      },
      {
        $set: {
          [`attendance.${week}`]: "absent",
        },
      },
    );

    // إغلاق الأسبوع في إعدادات المادة فقط
    settings.closedWeeks.addToSet(week);
    await settings.save();

    return res.json({
      success: true,
      courseCode: selectedCourseCode,
      week,
      absentCount: result.modifiedCount,
      message: `تم إغلاق الأسبوع ${week} للمادة ${selectedCourseCode}`,
    });
  } catch (error) {
    console.error("Close week error:", error);

    return res.status(500).json({
      error: "تعذر إغلاق الأسبوع",
    });
  }
});

// تحديد الأسبوع الحالي لمادة معينة
router.post("/set-week", requireAdmin, async (req, res) => {
  try {
    const { week, courseCode } = req.body || {};

    if (typeof courseCode !== "string" || !courseCode.trim()) {
      return res.status(400).json({
        error: "من فضلك اختر المادة أولًا",
      });
    }

    const selectedCourseCode = courseCode.trim();
    const settings = await getSettings(selectedCourseCode);

    if (!Number.isInteger(week) || week < 1 || week > settings.totalWeeks) {
      return res.status(400).json({
        error: "رقم الأسبوع غير صالح",
      });
    }

    if (settings.closedWeeks.includes(week)) {
      return res.status(409).json({
        error: "لا يمكن اختيار أسبوع مغلق لهذه المادة",
      });
    }

    settings.currentWeek = week;
    await settings.save();

    return res.json({
      success: true,
      courseCode: selectedCourseCode,
      currentWeek: settings.currentWeek,
      message: `تم تحديد الأسبوع ${week} للمادة ${selectedCourseCode}`,
    });
  } catch (error) {
    console.error("Set week error:", error);

    return res.status(500).json({
      error: "تعذر تغيير الأسبوع",
    });
  }
});

// تصدير كشف الترم إلى Excel بناءً على كود المادة
router.get("/export", requireAdmin, async (req, res) => {
  try {
    const courseCode = String(req.query.courseCode || "").trim();

    if (!courseCode) {
      return res.status(400).json({
        error: "من فضلك أدخل كود المادة",
      });
    }

    const settings = await getSettings(courseCode);

    const students = await Student.find({ courseCode })
      .select("studentCode fullName attendance")
      .sort({ studentCode: 1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("الحضور");

    sheet.columns = [
      { header: "الكود", key: "studentCode", width: 18 },
      { header: "الاسم", key: "fullName", width: 32 },
      ...Array.from({ length: settings.totalWeeks }, (_, index) => ({
        header: `الأسبوع ${index + 1}`,
        key: `week${index + 1}`,
        width: 16,
      })),
    ];

    for (const student of students) {
      const row = {
        studentCode: student.studentCode,
        fullName: student.fullName,
      };

      for (let week = 1; week <= settings.totalWeeks; week++) {
        const status = student.attendance?.[week];

        row[`week${week}`] =
          status === "present" ? "حاضر" : status === "absent" ? "غائب" : "";
      }

      sheet.addRow(row);
    }

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${courseCode.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error.message);
    res.status(500).json({
      error: "تعذر تصدير ملف Excel",
    });
  }
});

// GET /api/attendance/courses
router.get("/courses", async (req, res) => {
  try {
    const courses = await Settings.find().lean();

    res.json({
      success: true,
      courses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);

    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب المواد",
    });
  }
});

router.get("/course-status", async (req, res) => {
  try {
    const courseCode = String(req.query.courseCode || "").trim();

    if (!courseCode) {
      return res.status(400).json({
        error: "كود المادة مطلوب",
      });
    }

    const settings = await Settings.findOne({ courseCode }).lean();

    if (!settings) {
      return res.status(404).json({
        error: "إعدادات المادة غير موجودة",
      });
    }

    const currentWeek = settings.currentWeek;
    const isClosed = (settings.closedWeeks || []).includes(currentWeek);

    res.json({
      success: true,
      courseCode: settings.courseCode,
      courseName: settings.courseName,
      currentWeek,
      isClosed,
    });
  } catch (error) {
    console.error("Course status error:", error);

    res.status(500).json({
      error: "تعذر تحميل حالة الحضور",
    });
  }
});

module.exports = router;
