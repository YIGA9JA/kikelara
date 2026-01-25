const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your_email@gmail.com",
    pass: "your_app_password" // NOT your gmail password
  }
});

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const ordersFile = path.join(__dirname, 'data/orders.json');

// Ensure orders.json exists
if (!fs.existsSync(ordersFile)) {
  fs.writeFileSync(ordersFile, '[]', 'utf-8');
}

// ---------------- POST ORDER ----------------
app.post('/order', (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf-8'));
    const newOrder = {
      id: Date.now(),
      ...req.body
    };
    orders.push(newOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to save order' });
  }
});

// ---------------- GET ALL ORDERS ----------------
app.get('/orders', (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf-8'));
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ---------------- PATCH ORDER STATUS ----------------
app.patch('/orders/:id/status', (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf-8'));
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) return res.status(404).json({ message: 'Order not found' });

    orders[orderIndex].status = status;
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    res.json({ success: true, order: orders[orderIndex] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));




app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, msg: "All fields required" });
    }

    const mailOptions = {
      from: email,
      to: "your_email@gmail.com",
      subject: `New Contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    };

    await transporter.sendMail(mailOptions);

    // Also notify WhatsApp (D)
    notifyWhatsApp(name, email, message);

    res.json({ success: true, msg: "Message received — we will reply soon!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});
async function notifyWhatsApp(name, email, message) {
  try {
    const text = `📩 New Contact Request\n\nName: ${name}\nEmail: ${email}\nMessage: ${message}`;

    await fetch("https://graph.facebook.com/v17.0/YOUR_PHONE_NUMBER_ID/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer YOUR_ACCESS_TOKEN`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: "234XXXXXXXXXX", // your number
        text: { body: text }
      })
    });

  } catch (err) {
    console.error("WhatsApp Notification Error:", err);
  }
}


const express = require("express");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 4000;

app.use(express.static("public"));
app.use(bodyParser.json());

const messagesFile = path.join(__dirname, "messages.json");

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "dollarmastar@gmail.com",
    pass: "dmbt invl fhmu zela" // app password
  }
});

// Contact endpoint
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;

  if(!name || !email || !message) return res.json({success:false});

  const mailOptions = {
    from: "dollarmastar@gmail.com",
    to: "oluwasegunonayiga@gmail.com",
    subject: `New Contact Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if(err){
      console.error(err);
      return res.json({success:false});
    }

    // Save to messages.json
    let messages = [];
    if(fs.existsSync(messagesFile)){
      messages = JSON.parse(fs.readFileSync(messagesFile));
    }

    messages.push({ name, email, message, date: new Date().toISOString() });
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));

    res.json({success:true});
  });
});

// Admin dashboard
app.get("/admin/messages", (req,res) => {
  if(fs.existsSync(messagesFile)){
    const messages = JSON.parse(fs.readFileSync(messagesFile));
    res.json(messages);
  } else {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
