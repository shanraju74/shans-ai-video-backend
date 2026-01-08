/**
 * server.js
 * Complete Razorpay Payment Page + Webhook + Video Generation Backend
 * Works standalone on Render
 */

require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

/* ----------------------------------------------------
   CORS configuration
---------------------------------------------------- */
app.use(
  cors({
    origin: "https://shan-ai-video-gen.netlify.app",
    methods: ["GET", "POST"]
  })
);

/* ----------------------------------------------------
   Razorpay webhook requires raw body
---------------------------------------------------- */
app.use("/webhook", bodyParser.raw({ type: "application/json" }));
app.use(express.json());

/* ----------------------------------------------------
   In-memory storage
   Replace with database in production
---------------------------------------------------- */
const jobs = new Map();

/* ----------------------------------------------------
   Create payment
---------------------------------------------------- */
app.post("/create-payment", (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const jobId = uuidv4();

    jobs.set(jobId, {
      jobId,
      prompt,
      paymentStatus: "PENDING",
      videoStatus: "NOT_STARTED",
      videoUrl: null,
      createdAt: Date.now()
    });

    const PAYMENT_PAGE_URL = "https://rzp.io/i/XXXXXXXX";

    res.json({
      jobId: jobId,
      paymentUrl: PAYMENT_PAGE_URL + "?reference_id=" + jobId
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ----------------------------------------------------
   Razorpay webhook
---------------------------------------------------- */
app.post("/webhook", (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const jobId = payment.reference_id;

      const job = jobs.get(jobId);
      if (!job) {
        return res.json({ status: "Job not found" });
      }

      job.paymentStatus = "SUCCESS";
      job.videoStatus = "PROCESSING";

      generateVideo(jobId);
    }

    res.json({ status: "ok" });
  } catch (error) {
    res.status(500).send("Webhook error");
  }
});

/* ----------------------------------------------------
   Check status
---------------------------------------------------- */
app.get("/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json({
    jobId: job.jobId,
    paymentStatus: job.paymentStatus,
    videoStatus: job.videoStatus,
    videoUrl: job.videoUrl
  });
});

/* ----------------------------------------------------
   Video generation simulation
---------------------------------------------------- */
function generateVideo(jobId) {
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) return;

    job.videoStatus = "COMPLETED";
    job.videoUrl = "https://cdn.example.com/videos/" + jobId + ".mp4";
  }, 15000);
}

/* ----------------------------------------------------
   Health check
---------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("Backend running");
});

/* ----------------------------------------------------
   Start server
---------------------------------------------------- */
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
