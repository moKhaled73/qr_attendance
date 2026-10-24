require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const path = require("path");

const app = express();

process.env.FONTCONFIG_PATH = path.join(process.cwd(), "assets", "fonts");

process.env.FONTCONFIG_FILE = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "fonts.conf",
);

const sharp = require("sharp");

app.get("/debug/font-test", async (req, res) => {
  try {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg"
           width="800" height="250">
        <rect width="100%" height="100%" fill="white"/>

        <text x="20" y="80"
              font-family="Noto Sans Arabic"
              font-size="40" fill="black">
          Hello Student 123
        </text>

        <text x="20" y="170"
              font-family="Noto Sans Arabic"
              font-size="40" fill="black">
          اسم الطالب محمد
        </text>
      </svg>
    `;

    const image = await sharp(Buffer.from(svg)).png().toBuffer();

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store");
    res.send(image);
  } catch (err) {
    console.error("Font test failed:", err);
    res.status(500).send("Font test failed");
  }
});

if (!process.env.MONGODB_URI) {
  throw new Error("Configure MONGODB_URI");
}

// Required when running behind Vercel's proxy.
app.set("trust proxy", 1);

app.use(express.json({ limit: "20kb" }));

app.use(
  session({
    name: "attendance.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),

    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 2 * 60 * 60 * 1000,
    },
  }),
);

app.use(
  "/vendor/html5-qrcode",
  express.static(path.join(__dirname, "../node_modules/html5-qrcode")),
);

app.use(express.static(path.join(__dirname, "../public")));

// Connect to MongoDB before handling API requests.
let connectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI)
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.use("/api/auth", require("./routes/auth.js"));
app.use("/api/students", require("./routes/students.js"));
app.use("/api/attendance", require("./routes/attendance.js"));

// Export the Express app for Vercel.
module.exports = app;

// Start a regular server only when running locally.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;

  connectDB()
    .then(() => {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Startup failed:", error.message);
      process.exit(1);
    });
}
