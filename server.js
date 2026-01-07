// =======================
// Imports & Setup
// =======================
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const fetch = require("node-fetch");
const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// Middleware
// =======================
app.use(cors());
app.use(bodyParser.json());

// Ensure videos folder exists
const VIDEOS_DIR = path.join(__dirname, 'videos');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

// Serve videos statically
app.use('/videos', express.static(VIDEOS_DIR));

// =======================
// In-memory storage
// =======================
const PAID_USERS = {}; // { "email_type": true }

// =======================
// Utility functions
// =======================
//function resetPaidUsers() {
//  for (let key in PAID_USERS) {
//    delete PAID_USERS[key];
//  }
//  console.log('PAID_USERS has been reset');
//}

//OpenAI API key used to enhance the user prompt to cinematic version as below

const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function enhancePrompt(prompt) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Convert prompts into cinematic video descriptions" },
      { role: "user", content: prompt }
    ]
  });

  return res.choices[0].message.content;
}


// Placeholder AI video generator
// MUST return a Buffer

async function callAIvideoAPI(prompt, type, apiKey) {
  const enhancedPrompt = await enhancePrompt(prompt);

  const start = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "damo-vilab/text-to-video-ms-1.7b",
      input: {
        prompt: enhancedPrompt,
        num_frames: type === "short" ? 24 : 48
      }
    })
  });

  let prediction = await start.json();

  while (prediction.status !== "succeeded") {
    if (prediction.status === "failed") {
      throw new Error("Video generation failed");
    }

    await new Promise(r => setTimeout(r, 3000));
    const poll = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: {
          "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
        }
      }
    );

    prediction = await poll.json();
  }

  const videoRes = await fetch(prediction.output[0]);
  const buffer = await videoRes.arrayBuffer();
  return Buffer.from(buffer);
}


// =======================
// Routes
// =======================

// Health check
app.get('/', (req, res) => {
  res.send('AI Video Backend is running');
});

// Video generation endpoint
app.post('/generate', async (req, res) => {
  const { email, prompt, type } = req.body;

  // Validation
  if (!email || !prompt || !type) {
    return res.status(400).json({
      success: false,
      message: 'email, prompt, and type are required'
    });
  }

  // Payment check
  if (!PAID_USERS[`${email}_${type}`]) {
    return res.json({
      success: false,
      message: 'Payment not verified yet. Complete payment first.'
    });
  }

  try {
    const apiKey = process.env.AI_VIDEO_API_KEY;
    const videoBuffer = await callAIvideoAPI(prompt, type, apiKey);
    const filename = `${type}_${crypto.randomUUID()}.mp4`;
    const filePath = path.join(VIDEOS_DIR, filename);

    await fs.promises.writeFile(filePath, videoBuffer);

    const BASE_URL =
      process.env.BASE_URL;

    const videoUrl = `${BASE_URL}/videos/${filename}`;

    res.json({
      success: true,
      videoUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Error generating video'
    });
  }
});

// Simulated Razorpay webhook
app.post('/razorpay-webhook', (req, res) => {
  const { email, type } = req.body;

  if (!email || !type) {
    return res.sendStatus(400);
  }

  // ⚠️ In production, VERIFY Razorpay signature here
  PAID_USERS[`${email}_${type}`] = true;

  res.sendStatus(200);
});

// Optional admin reset (comment out in production)
//app.post('/admin/reset-paid-users', (req, res) => {
//  resetPaidUsers();
//  res.json({ success: true });
//});

// =======================
// Startup
// =======================
//resetPaidUsers(); // remove this if you want persistence

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
