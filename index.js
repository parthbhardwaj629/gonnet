// index.js - FINAL ✅ with WhatsApp (Twilio Sandbox) added
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const multer = require("multer");
const QRCode = require("qrcode");

// --- env (for Twilio keys) ---
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ----- CONFIG (your existing values kept) -----
const GMAIL_USER = "hello.gonnet@gmail.com";
const GMAIL_PASS = "skbr momu eagm lmfh";
const MONGO_URL =
  "mongodb+srv://parthbhardwaj629_db_user:qwerty1234567890@gonnetdb.t3067xh.mongodb.net/GonnetDB?retryWrites=true&w=majority&appName=GonnetDB";
const BASE_URL = `http://localhost:3000`;

// ----- Twilio WhatsApp (Sandbox) -----
const twilio = require("twilio");
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const WA_FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886
const ADMIN_WA = process.env.ADMIN_WA;            // e.g. whatsapp:+919368544500

async function sendWA(to, body) {
  try {
    if (!to || !body) return;
    const msg = await twilioClient.messages.create({ from: WA_FROM, to, body });
    console.log("✅ WhatsApp sent:", msg.sid);
  } catch (e) {
    console.error("❌ WhatsApp error:", e.message);
  }
}

// Normalize user mobile to Twilio Sandbox format (India)
function waTo(mob) {
  if (!mob) return null;
  const digits = ("" + mob).replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return null;
  return "whatsapp:+91" + digits;
}
// -------------------------------------------------------

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer for photo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// MongoDB
mongoose
  .connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Schema
const customerSchema = new mongoose.Schema({
  uniqueId: String,
  name: String,
  mobile: String,
  carNumber: String,
  email: String,
  emergencyName: String,
  emergencyRelation: String,
  emergencyNumber: String,
  bio: String,
  photo: String,
  socialLinks: {
    instagram: String,
    linkedin: String,
    github: String,
    twitter: String,
    facebook: String,
    website: String,
  },
  visibility: Object,
  isRegistered: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
});
const Customer = mongoose.model("Customer", customerSchema);


// Nodemailer transporter (POOLED)
const transporter = nodemailer.createTransport({
  service: "gmail",
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  socketTimeout: 30000
});
// ---------- ROUTES ----------

// Home
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// Generate unique profile + redirect to input
app.get("/generate", async (req, res) => {
  try {
    const uniqueId = uuidv4();
    const newCustomer = new Customer({ uniqueId });
    await newCustomer.save();

    const profileUrl = `${BASE_URL}/profile/${uniqueId}/view`;
    const qrUrl = `${BASE_URL}/profile/${uniqueId}/qr`;
    const inputUrl = `${BASE_URL}/profile/${uniqueId}/input`;
    const qrImage = await QRCode.toDataURL(inputUrl);

    // ---- Email to Admin ----
    (async () => {
      try {
        await transporter.sendMail({
          from: `Gonnet <${GMAIL_USER}>`,
          to: GMAIL_USER,
          subject: `New QR Created - ${uniqueId}`,
          html: `
            <h2>New QR Profile Created</h2>
            <p><b>Unique ID:</b> ${uniqueId}</p>
            <ul>
              <li><b>Input Page:</b> <a href="${inputUrl}">${inputUrl}</a></li>
              <li><b>View Page:</b> <a href="${profileUrl}">${profileUrl}</a></li>
              <li><b>QR Page:</b> <a href="${qrUrl}">${qrUrl}</a></li>
            </ul>
            <p><b>QR Image:</b></p>
            <img src="${qrImage}" alt="QR" style="width:200px;height:200px;"/>
            <br><br>
            <p style="color:#777;">© Gonnet — Powered by Ganga Motors</p>
          `,
        });

        // ---- WhatsApp to Admin ----
        await sendWA(
          ADMIN_WA,
          `New QR Created\nID: ${uniqueId}\nInput: ${inputUrl}\nView: ${profileUrl}\nQR: ${qrUrl}`
        );

        console.log("📩 Admin notified for new QR");
      } catch (mailErr) {
        console.error("Admin mail/WA error:", mailErr);
      }
    })();

    // ---- Redirect user straight to input ----
    res.redirect(inputUrl);
  } catch (err) {
    console.error("❌ /generate error:", err);
    res.status(500).send("Failed to create profile");
  }
});

// Input page
app.get("/profile/:uniqueId/input", async (req, res) => {
  const { uniqueId } = req.params;
  const customer = await Customer.findOne({ uniqueId }).lean();
  if (customer && customer.isRegistered && !req.query.fromOtp) {
    return res.redirect(`/profile/${uniqueId}/view`);
  }
  return res.sendFile(path.join(__dirname, "public", "input.html"));
});

// View page
app.get("/profile/:uniqueId/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "display.html"));
});

app.get("/profile/:uniqueId/qr", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "qr-card.html"));
});

app.get("/api/qr/:uniqueId", async (req, res) => {
  const profileUrl = `${BASE_URL}/profile/${req.params.uniqueId}/view`;
  const qrImage = await QRCode.toDataURL(profileUrl);
  res.json({ qrImage });
});

// Fetch profile
app.get("/api/profile/:uniqueId", async (req, res) => {
  const c = await Customer.findOne({ uniqueId: req.params.uniqueId }).lean();
  if (!c) return res.status(404).json({ error: "Profile not found" });
  res.json(c);
});

app.get("/debug/wa", async (req, res) => {
  try {
    await sendWA(process.env.ADMIN_WA, "Test: Gonnet WA is live ✅");
    res.send("Sent.");
  } catch (e) {
    res.status(500).send("Fail: " + (e.message || e));
  }
});

// Register / Update
app.post("/api/register/:uniqueId", upload.single("photo"), async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const body = req.body || {};

    body.socialLinks = {
      instagram: body.instagram || "",
      linkedin: body.linkedin || "",
      github: body.github || "",
      twitter: body.twitter || "",
      facebook: body.facebook || "",
      website: body.website || "",
    };

    // Visibility handling ✅
    body.visibility = {
      name: body.visible_name === "on" || body.visible_name === "true",
      mobile: body.visible_mobile === "on" || body.visible_mobile === "true",
      email: body.visible_email === "on" || body.visible_email === "true",
      carNumber: body.visible_carNumber === "on" || body.visible_carNumber === "true",
      emergencyName:
        body.visible_emergencyName === "on" || body.visible_emergencyName === "true",
      emergencyRelation:
        body.visible_emergencyRelation === "on" || body.visible_emergencyRelation === "true",
      emergencyNumber:
        body.visible_emergencyNumber === "on" || body.visible_emergencyNumber === "true",
    };
    if (req.file) body.photo = "/uploads/" + req.file.filename;
    body.isRegistered = true;

    const updated = await Customer.findOneAndUpdate(
      { uniqueId },
      { $set: body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Profile not found" });

    res.json({ message: "✅ Saved successfully", redirect: `/profile/${uniqueId}/view` });

    // build URLs & QR
    const profileUrl = `${BASE_URL}/profile/${uniqueId}/view`;
    const inputUrl = `${BASE_URL}/profile/${uniqueId}/input`;
    const qrUrl = `${BASE_URL}/profile/${uniqueId}/qr`;
    const qrImage = await QRCode.toDataURL(profileUrl);

    // ---- MAILS + WHATSAPP ----
    (async () => {
      try {
        // Customer Mail
        if (body.email) {
          await transporter.sendMail({
            from: `Gonnet <${GMAIL_USER}>`,
            to: body.email,
            subject: "Registration Successful - Gonnet",
            html: `
              <div style="font-family:Segoe UI,Arial;">
                <h2>Welcome to Gonnet</h2>
                <p>Dear ${body.name || "User"}, your profile is live.</p>
                <h4>Your Submitted Details</h4>
                <ul>
                  <li><b>Name:</b> ${body.name || "-"}</li>
                  <li><b>Mobile:</b> ${body.mobile || "-"}</li>
                  <li><b>Email:</b> ${body.email || "-"}</li>
                  <li><b>Car Number:</b> ${body.carNumber || "-"}</li>
                  <li><b>Emergency:</b> ${body.emergencyName || "-"} (${body.emergencyRelation || "-"}) - ${body.emergencyNumber || "-"}</li>
                  <li><b>Bio:</b> ${body.bio || "-"}</li>
                </ul>
                <p><a href="${profileUrl}">👉 View Your Profile</a></p>
                <p style="font-size:12px;color:#777;">© Gonnet — Powered by Ganga Motors</p>
              </div>`,
          });
        }

        // Admin Mail
        await transporter.sendMail({
          from: `Gonnet <${GMAIL_USER}>`,
          to: GMAIL_USER,
          subject: `Registration - ${body.name || "Unknown"}`,
          html: `
            <h3>New Registration</h3>
            <p><b>Profile ID:</b> ${uniqueId}</p>
            <p><b>Input URL:</b> ${inputUrl}</p>
            <p><b>View URL:</b> ${profileUrl}</p>
            <p><b>QR URL:</b> ${qrUrl}</p>
            <p><img src="${qrImage}" style="width:200px;"/></p>
          `,
        });

        // Admin WA
        await sendWA(
          ADMIN_WA,
          `Registration\nID: ${uniqueId}\nName: ${body.name || "Unknown"}\nView: ${profileUrl}\nQR: ${qrUrl}`
        );

        // User WA (if they have mobile and joined sandbox)
        const userWA = waTo(body.mobile);
        if (userWA) {
          await sendWA(
            userWA,
            `Hi ${body.name || "there"}, your Gonnet profile is live: ${profileUrl}`
          );
        }
      } catch (err) {
        console.error("Mail/WA error:", err);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: "Something went wrong while saving" });
  }
});

// OTP Send
app.post("/api/send-otp/:uniqueId", async (req, res) => {
  try {
    const customer = await Customer.findOne({ uniqueId: req.params.uniqueId });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    customer.otp = otp;
    customer.otpExpiry = Date.now() + 5 * 60 * 1000;
    await customer.save();

    res.json({ message: "OTP sent" });

    // Email OTP
    if (customer.email) {
      await transporter.sendMail({
        from: `Gonnet <${GMAIL_USER}>`,
        to: customer.email,
        subject: "OTP for Profile Update",
        html: `<p>Your OTP is <b>${otp}</b></p>`,
      });
    }

    // WhatsApp OTP (if mobile exists & joined sandbox)
    const userWA = waTo(customer.mobile);
    if (userWA) {
      await sendWA(userWA, `Your Gonnet OTP is ${otp}. It is valid for 5 minutes.`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// OTP Verify
app.post("/api/verify-otp/:uniqueId", async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const { otp } = req.body;
    const customer = await Customer.findOne({ uniqueId });
    if (!customer || customer.otp !== otp || Date.now() > customer.otpExpiry) {
      return res.status(400).json({ error: "Invalid/expired OTP" });
    }
    customer.otp = null;
    customer.otpExpiry = null;
    await customer.save();
    res.json({
      success: true,
      redirect: `/profile/${uniqueId}/input?fromOtp=true`,
    });
  } catch {
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// Static feature pages
["car-bike", "pets", "products", "emergency", "identity", "custom-qr"].forEach(
  (p) => app.get("/" + p, (req, res) =>
    res.sendFile(path.join(__dirname, "public", `${p}.html`))
  )
);

app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));