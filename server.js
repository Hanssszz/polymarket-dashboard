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
const io = new Server(server);

// store seen markets + history log
let seen = new Set();
let marketHistory = []; // NEW: persistent session history

// homepage route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// format timestamp nicely
function getTime() {
  return new Date().toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/**
 * FETCH POLYMARKET DATA
 */
async function checkMarkets() {
  try {
    const res = await axios.get(
      "https://gamma-api.polymarket.com/markets?active=true"
    );

    const markets = res.data;

    for (let m of markets) {
      if (!seen.has(m.id)) {
        seen.add(m.id);

        const marketEvent = {
          id: m.id,
          title: m.question,
          time: getTime(), // NEW: formatted timestamp
          rawTime: Date.now(), // optional for sorting later
        };

        // store history
        marketHistory.push(marketEvent);

        console.log(`[${marketEvent.time}] NEW MARKET:`, m.question);

        // send to frontend
        io.emit("newMarket", marketEvent);
      }
    }
  } catch (err) {
    console.log("Fetch error:", err.message);
  }
}

// API endpoint to fetch full history (NEW FEATURE)
app.get("/history", (req, res) => {
  res.json(marketHistory);
});

// auto-run bot
setInterval(checkMarkets, 10000); // faster updates (10s)
checkMarkets();

// socket connection
io.on("connection", (socket) => {
  console.log("Client connected");

  // send history immediately on connect
  socket.emit("history", marketHistory);
});

// Railway-compatible port
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});