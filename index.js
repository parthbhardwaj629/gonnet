// index.js - FINAL ✅ with WhatsApp (Twilio Sandbox) added
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const multer = require("multer");
const QRCode = require("qrcode");
const Order = require("./models/Order");
const Razorpay = require("razorpay");
const PDFDocument = require("pdfkit");

require("dotenv").config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

//const razorpay = new Razorpay({
//  key_id: "rzp_test_SdLiHDdbY4X8uR",
//  key_secret: "pjSPHrKGNXLT70peaeDSOYUH"
//});



// --- env (for Twilio keys) ---
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;


// ----- CONFIG (your existing values kept) -----
const GMAIL_USER = "hello.gonnet@gmail.com";
const GMAIL_PASS = "hymteiykjuvouedk";
const MONGO_URL =
  "mongodb+srv://parthbhardwaj629_db_user:qwerty1234567890@gonnetdb.t3067xh.mongodb.net/GonnetDB?retryWrites=true&w=majority&appName=GonnetDB";
const BASE_URL =
  process.env.BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://gonnet.in"
    : "http://localhost:3000");

    console.log("👉 BASE_URL =", BASE_URL);
console.log("👉 NODE_ENV =", process.env.NODE_ENV);

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

// Normalize mobile number for database
function normalizeMobile(mobile) {
  if (!mobile) return null;

  let digits = mobile.replace(/\D/g, "");

  // remove leading zero
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  // if 10 digit Indian number
  if (digits.length === 10) {
    return "+91" + digits;
  }

  // if already has country code
  if (digits.length > 10) {
    return "+" + digits;
  }

  return digits;
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
  brandName: String,
  isActive: { type: Boolean, default: true },
  scanCount: { type: Number, default: 0 },
    lastScanAt: Date,
    lastScanIP: String,
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
customerSchema.index({ uniqueId: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ mobile: 1 });
const Customer = mongoose.model("Customer", customerSchema);


// Nodemailer transporter (POOLED)
const transporter = nodemailer.createTransport({
  service: "gmail",
  pool: true,
  maxConnections: 5,
  maxMessages: 200,
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});
// ---------- ROUTES ----------

// Home
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/order", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "order.html"));
});

app.post("/api/create-order", async (req, res) => {
 //  console.log("🔥 CREATE ORDER HIT");

  try {
    const { total } = req.body;

    const options = {
      amount: total * 100,
      currency: "INR",
      receipt: "order_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json(order);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

app.post("/api/save-order", async (req, res) => {
  try {

    console.log("📨 EMAIL:", req.body.email); // ✅ ADD HERE
    console.log("🧾 FULL BODY:", req.body);   // 🔥 BONUS DEBUG

    // 🔐 VERIFY PAYMENT FIRST
    const crypto = require("crypto");

    const {
      paymentId,
      orderId,
      signature
    } = req.body;

    if (!paymentId || !orderId || !signature) {
      return res.status(400).json({ error: "Missing payment data" });
    }

    const body = orderId + "|" + paymentId;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // ✅ ONLY AFTER VERIFY → SAVE
    const order = new Order({
      ...req.body,
      status: "paid"
    });

    await order.save();

    res.json({ success: true });
    // ✅ CREATE PDF
    const doc = new PDFDocument({
  size: "A4",
  margin: 40
});

doc.addPage = () => {}; // ❌ disable extra pages

    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));

    // ==================
    // 🎨 DESIGN
    // ==================

    const invoiceId = "GN-" + Date.now();
    const today = new Date().toLocaleDateString();

// SIMPLE CLEAN HEADER (NO BLACK BOX)

// ✅ QR IN HEADER
//const qrBuffer = await QRCode.toBuffer("https://gonnet.in");
// doc.image(qrBuffer, 500, 30, { width: 60 });

doc.fillColor("#000")
  .fontSize(28)
  .text("GONNET", 50, 40);

doc.fontSize(12)
  .text("Scan. Call. Connect.", 50, 65);

// RIGHT SIDE
doc.fontSize(10)
  .text(`Invoice ID: ${invoiceId}`, 400, 40)
  .text(`Date: ${today}`, 400, 55);




    // CUSTOMER BOX
    doc.rect(50, 120, 500, 100).stroke();

    doc.fillColor("#000")
      .fontSize(12)
      .text("Customer Details", 60, 130);

    doc.fontSize(10)
      .text(`${req.body.name}`, 60, 150)
      .text(`${req.body.email}`, 60, 165)
      .text( `Address - ${req.body.address}`, 60, 180)
      .text(`${req.body.city}, ${req.body.state} - ${req.body.pincode}`, 60, 195);

    
// TABLE START
const tableTop = 250;

// OUTER BOX
doc.rect(50, tableTop, 500, 120).stroke();


// COLUMN X POSITIONS (fix kar de)
const colProduct = 60;
const colQty = 300;
const colPrice = 380;
const colTotal = 460;

// HEADER ROW
const headerY = tableTop + 10;

doc.text("Product", colProduct, headerY);
doc.text("Qty", colQty, headerY, { width: 50, align: "center" });
doc.text("Price", colPrice, headerY, { width: 60, align: "right" });
doc.text("Subtotal", colTotal, headerY, { width: 60, align: "right" });

// LINE
doc.moveTo(50, tableTop + 30).lineTo(550, tableTop + 30).stroke();

// PRODUCT ROW
const rowY = tableTop + 45;

// PRODUCT
doc.text("Gonnet Smart QR Sticker", colProduct, rowY, {
  width: 200
});

// QTY
doc.text(String(req.body.quantity), colQty, rowY, {
  width: 50,
  align: "center"
});

// PRICE
doc.text("249", colPrice, rowY, {
  width: 60,
  align: "right"
});

// SUBTOTAL
doc.text(`${249 * req.body.quantity}`, colTotal, rowY, {
  width: 60,
  align: "right"
});

// DELIVERY ROW
doc.text("Delivery Charges", 60, tableTop + 70)
// doc.text("—", 300, tableTop + 70)
doc.text("", 380, tableTop + 70)
doc.text("50", 460, tableTop + 70, { width: 60, align: "right" });

// LINE
doc.moveTo(50, tableTop + 95).lineTo(550, tableTop + 95).stroke();

// TOTAL ROW
const finalTotal = (249 * req.body.quantity) + 50;

doc.fontSize(11)
  .text("Total", 300, tableTop + 105)
  .text(`${finalTotal}`, 460, tableTop + 105, { width: 60, align: "right" });


    // MESSAGE
    doc.fillColor("#000")
      .fontSize(12)
      doc.text("Thank you for choosing Gonnet", 50, doc.y + 20);

    // FOOTER
const footerY = 780; // FIXED POSITION (A4 safe)

doc.rect(0, footerY, 600, 60).fill("#111");

doc.fillColor("#fff")
  .fontSize(10)
  .text("www.gonnet.in", 50, footerY + 20)
  .text("hello.gonnet@gmail.com", 200, footerY + 20)
  .text("Made in India", 400, footerY + 20);


    // ==================
    // ✅ EMAIL AFTER PDF READY (FIXED)
    // ==================

    doc.on("end", async () => {

  const pdfData = Buffer.concat(buffers);

  // ✅ USER EMAIL

  try {
    await new Promise(r => setTimeout(r, 500));
  await transporter.sendMail({
    from: `Gonnet <${GMAIL_USER}>`,
    to: req.body.email,
    subject: "Order Confirmed - Gonnet",
    html: `
      <h2>Order Confirmed ✅</h2>
      <p>Hi ${req.body.name},</p>
      <p>Your order has been successfully placed.</p>
      <p><b>Quantity:</b> ${req.body.quantity}</p>
      <p><b>Total Paid:</b> ₹${req.body.total}</p>
      <br>
      <p> Mobile Number you provided:${req.body.mobile}</p>
      <p>📦 Your sticker will be delivered soon.</p>
      <p>— Team Gonnet</p>
    `,
    attachments: [
      {
        filename: "invoice.pdf",
        content: pdfData
      }
    ]
  });

  console.log("✅ USER EMAIL SENT");

} catch (err) {
  console.log("❌ USER EMAIL ERROR:", err);
}
// =====================
// 🖨️ ADMIN PRINT PDF (FIXED LAYOUT)
// =====================

const printDoc = new PDFDocument({
  size: [400, 600],
  margin: 20
});

let buffers2 = [];
printDoc.on("data", buffers2.push.bind(buffers2));

// ---------------------
// 🔷 HEADER
// ---------------------
printDoc.font("Helvetica-Bold")
  .fontSize(20)
  .text("GONNET", 20, 30);

printDoc.font("Helvetica")
  .fontSize(10)
  .text("Scan. Connect. Stay Secure.", 20, 55);


// ---------------------
// 📍 ADDRESS BLOCK
// ---------------------
let startY = 90;

printDoc.font("Helvetica")
  .fontSize(10)
  .text("TO,", 20, startY);

printDoc.font("Helvetica-Bold")
  .fontSize(11)
  .text(req.body.name, 20, startY + 15);

printDoc.font("Helvetica")
  .fontSize(10)
  .text(req.body.address, 20, startY + 35)
  .text(`${req.body.city}, ${req.body.state} - ${req.body.pincode}`, 20, startY + 50)
  .text(`Mobile: ${req.body.mobile}`, 20, startY + 70);


// ---------------------
// 💬 MESSAGE BLOCK (IMPROVED CONTENT)
// ---------------------
let msgY = startY + 120;

printDoc.font("Helvetica-Bold")
  .fontSize(14)
  .text("Welcome to Gonnet", 20, msgY);

printDoc.font("Helvetica")
  .fontSize(10)
  .text(
`Your Gonnet QR sticker helps you stay connected instantly.

•  Create your digital profile in seconds
•  Get a personal dashboard with your email
•  Add multiple vehicles under one account
•  Access anytime via OTP login (no password)

Thank you for choosing Gonnet.
— Team Gonnet`,
    20,
    msgY + 20,
    { width: 360 }
  );


// ---------------------
// 📌 FIXED BOTTOM SECTION (KEY FIX)
// ---------------------

const pageHeight = 600;
let bottomY = pageHeight - 180;

// LEFT → HOW TO USE
printDoc.font("Helvetica-Bold")
  .fontSize(10)
  .text("How to use:", 20, bottomY);

printDoc.font("Helvetica")
  .fontSize(9)
  .text(
`• Peel and paste sticker
• Place inside windshield
• Scan QR to create profile
• Save and manage via dashboard`,
    20,
    bottomY + 15,
    { width: 180 }
  );


// RIGHT → QR BOX
printDoc.rect(250, bottomY, 120, 120).stroke();



// ---------------------
// 🌐 FOOTER (FIXED)
// ---------------------
printDoc.fontSize(8)
  .fillColor("gray")
  .text("www.gonnet.in", 20, 560);


// =====================
// 📩 EMAIL SEND
// =====================

printDoc.on("end", async () => {

  const pdfData2 = Buffer.concat(buffers2);

  try {
    await transporter.sendMail({
      from: `Gonnet <${GMAIL_USER}>`,
      to: GMAIL_USER,
      subject: "Gonnet - Printing",
      html: `<p>New order ready for printing</p>`,
      attachments: [
        {
          filename: "gonnet-print.pdf",
          content: pdfData2
        }
      ]
    });

    console.log("✅ ADMIN EMAIL SENT");

  } catch (err) {
    console.log("❌ ADMIN EMAIL ERROR:", err);
  }
});

printDoc.end();
});

    // ✅ END PDF LAST
    doc.end();

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Save failed" });
  }
  
});

app.post("/api/admin/orders", async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    let filter = {};

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    res.json({ orders });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/dashboard",(req,res)=>{
res.sendFile(path.join(__dirname,"public","dashboard.html"));
});


 app.post("/api/dashboard-data", async (req,res)=>{

  const {email}=req.body;

  if(!email){
    return res.status(400).json({error:"Email missing"});
  }

  const vehicles = await Customer.find({
  email,
  $or: [
    { isActive: true },
    { isActive: { $exists: false } }
  ]
}).lean();

  res.json({vehicles});

});

app.delete("/api/delete-profile/:id", async (req,res)=>{

  const {id}=req.params;

  await Customer.updateOne(
  { uniqueId: id },
  { $set: { isActive: false } }
);

res.json({ message: "Profile deactivated" });
  

});

app.get("/debug/email", async (req,res)=>{

  try{

    await transporter.sendMail({
      from: `Gonnet <${GMAIL_USER}>`,
      to: GMAIL_USER,
      subject: "Test Email",
      html: "<h2>Email working</h2>"
    });

    res.send("Email sent");

  }catch(e){

    console.log(e);
    res.send("Email failed");

  }

});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "privacy.html"));
});

// 🔁 CENTRAL DECISION ROUTE
app.get("/profile/:uniqueId", async (req, res) => {

  
  try {
    const { uniqueId } = req.params;

    const customer = await Customer.findOne({ uniqueId }).lean();

    if (!customer) {
      return res.status(404).send("QR not found");
    }

    if (!customer.isActive) {
      return res.send("This profile is no longer active")
    }

    // If NOT registered → go to input
    if (!customer.isRegistered) {
      return res.redirect(`/profile/${uniqueId}/input`);
    }

    // If registered → go to display
    return res.redirect(`/profile/${uniqueId}/view`);

  } catch (err) {
    console.error("Decision route error:", err);
    res.status(500).send("Something went wrong");
  }

  await Customer.updateOne(
  { uniqueId },
  {
    $inc: { scanCount: 1 },
    $set: {
      lastScanAt: new Date(),
      lastScanIP: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    }
  }
);
});


// Generate unique profile + redirect to input
app.get("/generate", async (req, res) => {
  try {
    const uniqueId = uuidv4();
    const newCustomer = new Customer({
       uniqueId,
      brandName: "Gonnet",
    isActive: true
   });
    await newCustomer.save();

const mainUrl = `${BASE_URL}/profile/${uniqueId}`;
const inputUrl = `${BASE_URL}/profile/${uniqueId}/input`;
const profileUrl = `${BASE_URL}/profile/${uniqueId}/view`;
const qrUrl = `${BASE_URL}/profile/${uniqueId}/qr`;

const qrImage = await QRCode.toDataURL(mainUrl);



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
            <p style="color:#777;">© Gonnet</p>
          `,
        });

        // ---- WhatsApp to Admin ----
    //    await sendWA(
    //      ADMIN_WA,
    //      `New QR Created\nID: ${uniqueId}\nInput: ${inputUrl}\nView: ${profileUrl}\nQR: ${qrUrl}`
    //    );

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

  const ua = req.headers['user-agent'] || "";

  // ✅ Allow puppeteer (HeadlessChrome)
  const isInternal = ua.includes("Headless");

  if (!isInternal) {
    return res.status(403).send("Access Denied");
  }

  res.sendFile(path.join(__dirname, "public", "qr-card.html"));
});

app.get("/api/qr/:uniqueId", async (req, res) => {
  const profileUrl = `${BASE_URL}/profile/${req.params.uniqueId}`;
  const qrImage = await QRCode.toDataURL(profileUrl);
  res.json({ qrImage });
});

// Fetch profile
app.get("/api/profile/:uniqueId", async (req, res) => {
  const c = await Customer.findOne({ uniqueId: req.params.uniqueId }).lean();
  if (!c) return res.status(404).json({ error: "Profile not found" });
  res.json(c);
});

app.post("/api/dashboard", async (req,res)=>{

try{

const {email} = req.body;

if(!email){
return res.status(400).json({error:"Email required"});
}

const vehicles = await Customer.find({
email:email
}).lean();

res.json({vehicles});

}catch(err){

console.log(err);
res.status(500).json({error:"Dashboard fetch failed"});

}

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

    // 🚗 NORMALIZE
    if (body.carNumber) {
      body.carNumber = body.carNumber.toUpperCase().replace(/\s+/g, "");
    }

    body.mobile = normalizeMobile(body.mobile);
    body.emergencyNumber = normalizeMobile(body.emergencyNumber);

    // ✅ FETCH ONCE
    const currentProfile = await Customer.findOne({ uniqueId });

    // 🚗 CAR CHECK
    if (body.carNumber && currentProfile?.carNumber !== body.carNumber) {
      const existingCar = await Customer.findOne({ carNumber: body.carNumber });

      if (existingCar) {
        return res.status(400).json({
          error: "This vehicle is already registered"
        });
      }
    }

  

// 📱 MOBILE CHECK (ONLY IF CHANGED)
if (
  body.mobile &&
  normalizeMobile(currentProfile?.mobile) !== normalizeMobile(body.mobile)
) {
  const existingUser = await Customer.findOne({
    mobile: body.mobile,
    uniqueId: { $ne: uniqueId } // 🔥 IMPORTANT FIX
  });

  if (existingUser) {
    return res.status(400).json({
      error: "This mobile number is already registered."
    });
  }
}

    // बाकी tera existing code yahan se continue hoga

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
                <p style="font-size:12px;color:#777;">© Gonnet</p>
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

    // ✅ RESPONSE FIRST (FAST)
    res.json({ message: "OTP sent" });

    // ✅ BACKGROUND TASKS (NO DELAY)
    (async () => {
      try {

        // Email
        try {
  await transporter.sendMail({
    from: `Gonnet <${GMAIL_USER}>`,
    to: customer.email,
    subject: "OTP for Profile Update",
    html: `<p>Your OTP is <b>${otp}</b></p>`,
  });

  console.log("EMAIL SENT");
} catch (err) {
  console.log("EMAIL ERROR:", err.message);
}

        // WhatsApp
        const userWA = waTo(customer.mobile);
        if (userWA) {
          await sendWA(
            userWA,
            `Your Gonnet OTP is ${otp}. It is valid for 5 minutes.`
          );
        }

      } catch (err) {
        console.error("OTP background error:", err);
      }
    })();

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


// ============================
// LOGIN OTP (EMAIL BASED)
// ============================

// Send login OTP
app.post("/api/login/send-otp", async (req,res)=>{

  try{

    const {email}=req.body;

    if(!email){
      return res.status(400).json({error:"Email required"});
    }

    const customers=await Customer.find({email}).lean();

    if(!customers || customers.length===0){
      return res.status(404).json({error:"No profiles found for this email"});
    }

    const otp=Math.floor(100000 + Math.random()*900000).toString();

    // store OTP
    await Customer.updateMany(
      {email},
      {
        $set:{
          otp:otp,
          otpExpiry:Date.now()+5*60*1000
        }
      }
    );

    // ✅ SEND RESPONSE FIRST (FAST)
    res.json({message:"OTP sent"});

    // ✅ EMAIL IN BACKGROUND (NO DELAY)
    (async () => {
      try{
        await transporter.sendMail({
          from:`Gonnet <${GMAIL_USER}>`,
          to:email,
          subject:"Gonnet Login OTP",
          html:`
            <h2>Your Gonnet Login OTP</h2>
            <p>Your OTP is:</p>
            <h1>${otp}</h1>
            <p>This OTP is valid for 5 minutes.</p>
          `
        });
      }catch(err){
        console.log("Email error:", err);
      }
    })();

  }catch(e){

    console.log(e);
    res.status(500).json({error:"Failed to send OTP"});

  }

});


// Verify login OTP
app.post("/api/login/verify-otp", async (req,res)=>{

  try{

    const {email,otp}=req.body;

    if(!email || !otp){
      return res.status(400).json({error:"Missing data"});
    }

    const customer=await Customer.findOne({email});

    if(!customer){
      return res.status(404).json({error:"User not found"});
    }

    if(customer.otp!==otp || Date.now()>customer.otpExpiry){
      return res.status(400).json({error:"Invalid or expired OTP"});
    }

    // clear otp
    await Customer.updateMany(
      {email},
      {
        $set:{
          otp:null,
          otpExpiry:null
        }
      }
    );

    res.json({success:true});

  }catch(e){

    console.log(e);
    res.status(500).json({error:"OTP verification failed"});

  }

});

// Static feature pages
["car-bike", "pets", "products", "emergency", "identity", "custom-qr"].forEach(
  (p) => app.get("/" + p, (req, res) =>
    res.sendFile(path.join(__dirname, "public", `${p}.html`))
  )
);

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

const puppeteer = require("puppeteer");

app.get("/internal/bulk-qr", async (req, res) => {
  try {
    const ADMIN_KEY = process.env.ADMIN_KEY || "parth_bulk_2026";
    if (req.query.key !== ADMIN_KEY) {
      return res.status(403).send("Unauthorized");
    }

    const count = parseInt(req.query.count) || 20;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const stickers = [];

    for (let i = 0; i < count; i++) {
      const brand = req.query.brand || "Gonnet";

const uniqueId = uuidv4();

await Customer.create({
  uniqueId,
  brandName: brand,
  isRegistered: false,
  isActive: true
});

      stickers.push(`
        <div class="sticker">
          <iframe src="${BASE_URL}/profile/${uniqueId}/qr"
                  width="345"
                  height="180"
                  style="border:none;">
          </iframe>
        </div>
      `);
    }

    const html = `
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
          }
          .a3 {
            width: 1190px;
            height: 842px;
            display: flex;
            flex-wrap: wrap;
          }
          .sticker {
            width: 345px;
            height: 180px;
          }
        </style>
      </head>
      <body>
        <div class="a3">
          ${stickers.join("")}
        </div>
      </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: "domcontentloaded" });


    const pdf = await page.pdf({
      width: "1190px",
      height: "842px",
      printBackground: true
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=gonnet-bulk-${count}.pdf`);
    res.send(pdf);

  } catch (err) {
    console.error(err);
    res.status(500).send("Bulk generation failed");
  }
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});



app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));