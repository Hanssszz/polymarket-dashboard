require("dotenv").config();
console.log("EMAIL:", process.env.GMAIL_USER);
console.log("PASS:", process.env.GMAIL_PASS);
const axios = require("axios");
const nodemailer = require("nodemailer");
const fs = require("fs");
const cron = require("node-cron");

const SEEN_FILE = "./seenMarkets.json";

// Load seen markets
function loadSeen() {
  if (!fs.existsSync(SEEN_FILE)) return [];
  return JSON.parse(fs.readFileSync(SEEN_FILE));
}

// Save seen markets
function saveSeen(data) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(data, null, 2));
}

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Send email
async function sendEmail(market) {
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.TO_EMAIL,
    subject: `🆕 New Polymarket Market`,
    text: `${market.question || "New market detected"}\n\nhttps://polymarket.com`,
  });
}

// Fetch markets
async function fetchMarkets() {
  const res = await axios.get(
    "https://gamma-api.polymarket.com/markets?active=true"
  );
  return res.data;
}

// Main check
async function checkMarkets() {
  try {
    const markets = await fetchMarkets();
    let seen = loadSeen();

    for (let market of markets) {
      if (!seen.includes(market.id)) {
        console.log("NEW MARKET:", market.question);

        await sendEmail(market);

        seen.push(market.id);
      }
    }

    saveSeen(seen);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

// Run every 30 seconds
cron.schedule("*/30 * * * * *", () => {
  checkMarkets();
});

console.log("Polymarket watcher running...");
checkMarkets();