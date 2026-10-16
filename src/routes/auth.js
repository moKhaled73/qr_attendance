const router = require("express").Router();
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 80 ||
    password.length > 200
  ) {
    return res.status(400).json({
      error: "بيانات الدخول غير صحيحة",
    });
  }

  try {
    const validUsername = username === process.env.ADMIN_USERNAME;

    const validPassword = await bcrypt.compare(
      password,
      process.env.ADMIN_PASSWORD_HASH || "",
    );

    if (!validUsername || !validPassword) {
      return res.status(401).json({
        error: "اسم المستخدم أو كلمة المرور غير صحيحة",
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          error: "تعذر إنشاء جلسة الدخول",
        });
      }

      req.session.isAdmin = true;

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({
            error: "تعذر حفظ جلسة الدخول",
          });
        }

        res.json({ message: "تم تسجيل الدخول" });
      });
    });
  } catch {
    res.status(500).json({
      error: "حدث خطأ في الخادم",
    });
  }
});

router.post("/logout", (req, res) => {
  if (req.get("X-Requested-With") !== "AttendanceApp") {
    return res.status(403).json({
      error: "تم رفض الطلب",
    });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        error: "تعذر تسجيل الخروج",
      });
    }

    res.clearCookie("attendance.sid", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.json({ message: "تم تسجيل الخروج" });
  });
});

router.get("/me", (req, res) => {
  if (!req.session?.isAdmin) {
    return res.status(401).json({
      error: "غير مسجل الدخول",
    });
  }

  res.json({ authenticated: true });
});

module.exports = router;
