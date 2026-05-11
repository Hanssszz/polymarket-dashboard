const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

/**
 * =========================
 * STATE (in-memory cache)
 * =========================
 */
let seen = new Set();
let marketHistory = [];

/**
 * HEALTH CHECK (important for Railway)
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    markets: marketHistory.length
  });
});

/**
 * FRONTEND
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/**
 * SAFE TIME FORMATTER
 */
function getTime() {
  return new Date().toISOString();
}

/**
 * =========================
 * CORE FETCHER (production safe)
 * =========================
 */
async function fetchMarkets() {
  try {
    const res = await axios.get(
      "https://gamma-api.polymarket.com/markets?active=true",
      { timeout: 10000 }
    );

    const markets = res.data;

    if (!Array.isArray(markets)) return;

    for (const m of markets) {
      if (!m?.id || seen.has(m.id)) continue;

      seen.add(m.id);

      const event = {
        id: m.id,
        title: m.question || "Unknown Market",
        time: getTime(),
        timestamp: Date.now()
      };

      marketHistory.push(event);

      // prevent memory explosion (keep last 5000)
      if (marketHistory.length > 5000) {
        marketHistory.shift();
      }

      console.log(`[NEW] ${event.time} - ${event.title}`);

      io.emit("newMarket", event);
    }
  } catch (err) {
    console.error("[FETCH ERROR]", err.message);
  }
}

/**
 * CLIENT CONNECTION
 */
io.on("connection", (socket) => {
  console.log("Client connected");

  // send latest state
  socket.emit("history", marketHistory.slice(-200));
});

/**
 * =========================
 * AUTO LOOP (production-safe)
 * =========================
 */
async function startLoop() {
  await fetchMarkets();
  setTimeout(startLoop, 10000); // safer than setInterval
}

startLoop();

/**
 * =========================
 * SERVER START
 * =========================
 */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Production server running on", PORT);
});