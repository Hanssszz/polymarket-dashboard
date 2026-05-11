const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server);

let seen = new Set();
let marketHistory = [];

/**
 * Homepage
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    trackedMarkets: marketHistory.length,
    uptime: process.uptime()
  });
});

/**
 * Fetch ONLY real recent markets
 */
async function fetchMarkets() {
  try {
    const res = await axios.get(
      "https://gamma-api.polymarket.com/markets?active=true",
      { timeout: 10000 }
    );

    const markets = res.data;
    const now = Date.now();

    for (const m of markets) {
      if (!m?.id || seen.has(m.id)) continue;

      // created time from API
      const createdTime = new Date(m.createdAt || 0).getTime();

      // only allow markets created in last 10 mins
      const isRecent = now - createdTime < 10 * 60 * 1000;

      if (!isRecent) continue;

      seen.add(m.id);

      const event = {
        id: m.id,
        title: m.question || "Unknown Market",
        createdAt: m.createdAt,
        detectedAt: new Date().toISOString()
      };

      marketHistory.push(event);

      // keep memory manageable
      if (marketHistory.length > 1000) {
        marketHistory.shift();
      }

      console.log("REAL NEW MARKET:", event.title);

      io.emit("newMarket", event);
    }
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

/**
 * Send history to new clients
 */
io.on("connection", (socket) => {
  console.log("Client connected");
  socket.emit("history", marketHistory);
});

/**
 * Recursive polling loop
 */
async function loop() {
  await fetchMarkets();
  setTimeout(loop, 10000); // check every 10 sec
}

loop();

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});