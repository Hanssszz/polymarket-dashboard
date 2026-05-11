const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server);

// store seen markets
let seen = new Set();

// serve dashboard
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// fetch Polymarket markets
async function checkMarkets() {
  try {
    const res = await axios.get(
      "https://gamma-api.polymarket.com/markets?active=true"
    );

    const markets = res.data;

    for (let m of markets) {
      if (!seen.has(m.id)) {
        seen.add(m.id);

        const data = {
          id: m.id,
          title: m.question,
          url: "https://polymarket.com",
          time: new Date().toISOString(),
        };

        console.log("NEW MARKET:", m.question);

        // send live update to dashboard
        io.emit("newMarket", data);
      }
    }
  } catch (err) {
    console.log("Fetch error:", err.message);
  }
}

// AUTO RUN LOOP (no buttons, no manual start)
setInterval(checkMarkets, 15000);
checkMarkets(); // run immediately on startup

// socket connection
io.on("connection", (socket) => {
  console.log("User connected to dashboard");
});

// Railway requires dynamic port
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});