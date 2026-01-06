const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/videos', express.static(path.join(__dirname,'videos')));

const PAID_USERS = {}; // Store payment verification

// AI Video Generation Endpoint
app.post('/generate', async (req,res)=>{
  const {email,prompt,type} = req.body;
  if(!PAID_USERS[email+'_'+type]){
    return res.json({success:false,message:'Payment not verified yet. Complete payment first.'});
  }

  try{
    // Replace this placeholder with real API call using your key
    // Your provided API key stored in .env: AI_VIDEO_API_KEY
    const apiKey = process.env.AI_VIDEO_API_KEY;

    // Example POST request to AI Video API (pseudo-code)
    // You need a real API provider like Runway or Pika
    // const videoBuffer = await callAIvideoAPI(prompt, type, apiKey);
    // const filename = `${type}_${Date.now()}.mp4`;
    // fs.writeFileSync(`videos/${filename}`, videoBuffer);
    // const videoUrl = `http://localhost:5000/videos/${filename}`;

    // For demo, we use placeholders
    const videoFile = type==='short' ? 'sample_short.mp4' : 'sample_long.mp4';
    const videoUrl = `http://localhost:5000/videos/${videoFile}`;

    return res.json({success:true, videoUrl});
  } catch(e){
    console.error(e);
    return res.json({success:false,message:'Error generating video'});
  }
});

// Simulated Razorpay webhook
app.post('/razorpay-webhook', (req,res)=>{
  const {email,type} = req.body;
  PAID_USERS[email+'_'+type] = true;
  res.sendStatus(200);
});

app.listen(5000, ()=> console.log('Backend running on port 5000'));
