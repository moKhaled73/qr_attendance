require("dotenv").config();

const https = require("https");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const path = require("path");

const app = express();

const tlsOptions = {
  cert: fs.readFileSync(path.join(__dirname, "../certs/192.168.1.8+2.pem")),
  key: fs.readFileSync(path.join(__dirname, "../certs/192.168.1.8+2-key.pem")),
};

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("Configure a strong SESSION_SECRET");
}

// app.disable("x-powered-by");
// app.use(helmet());
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
  express.static(
    require("path").join(__dirname, "../node_modules/html5-qrcode"),
  ),
);

app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth", require("./routes/auth.js"));
app.use("/api/students", require("./routes/students.js"));
app.use("/api/attendance", require("./routes/attendance.js"));

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);

  https
    .createServer(tlsOptions, app)
    .listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
      console.log("HTTPS server running on port 3000");
    });
}

start().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
