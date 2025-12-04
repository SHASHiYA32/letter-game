import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// const PORT = 3000;

// Rooms structure: { roomCode: { players: [], hostId, pickerIndex, currentLetter, answers, state } }
const rooms = {};

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("createRoom", (playerName, callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      hostId: socket.id,
      players: [],
      pickerIndex: 0,
      currentLetter: null,
      answers: {},
      state: "lobby", // "lobby" | "choosingLetter" | "answering" | "results"
    };

    socket.join(roomCode);
    const player = { id: socket.id, name: playerName, score: 0 };
    rooms[roomCode].players.push(player);

    callback({ roomCode, player, isHost: true });
    io.to(roomCode).emit("playersUpdated", rooms[roomCode].players);
  });

  socket.on("joinRoom", (roomCode, playerName, callback) => {
    const room = rooms[roomCode];
    if (!room) {
      callback({ error: "Room not found" });
      return;
    }

    socket.join(roomCode);
    const player = { id: socket.id, name: playerName, score: 0 };
    room.players.push(player);

    callback({ roomCode, player, isHost: room.hostId === socket.id });
    io.to(roomCode).emit("playersUpdated", room.players);
  });

  socket.on("startGame", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.pickerIndex = 0;
    room.state = "choosingLetter";
    room.currentLetter = null;
    room.answers = {};

    const picker = room.players[room.pickerIndex];
    io.to(roomCode).emit("roundStart", {
      pickerId: picker.id,
      pickerName: picker.name,
      letter: null,
    });
  });

  // Player whose turn it is chooses the letter
  socket.on("chooseLetter", (roomCode, letter) => {
    const room = rooms[roomCode];
    if (!room) return;

    const picker = room.players[room.pickerIndex];
    if (!picker || picker.id !== socket.id) {
      return; // Not your turn
    }

    room.currentLetter = letter.toUpperCase();
    room.state = "answering";
    room.answers = {};

    io.to(roomCode).emit("letterChosen", {
      letter: room.currentLetter,
    });
  });

  // Player submits their row of answers
  socket.on("submitAnswers", (roomCode, answers) => {
    const room = rooms[roomCode];
    if (!room || room.state !== "answering") return;

    room.answers[socket.id] = answers;

    // If all players have submitted, calculate scores
    if (Object.keys(room.answers).length === room.players.length) {
      room.state = "results";

      const result = calculateScores(room);
      // Update scores in room
      result.forEach((r) => {
        const p = room.players.find((pl) => pl.id === r.id);
        if (p) p.score += r.roundScore;
      });

      io.to(roomCode).emit("roundResults", {
        round: result,
        players: room.players,
      });
    }
  });

  // Move to next round (host calls this, or auto later)
  socket.on("nextRound", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.pickerIndex = (room.pickerIndex + 1) % room.players.length;
    room.currentLetter = null;
    room.answers = {};
    room.state = "choosingLetter";

    const picker = room.players[room.pickerIndex];
    io.to(roomCode).emit("roundStart", {
      pickerId: picker.id,
      pickerName: picker.name,
      letter: null,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove from all rooms
    for (const [roomCode, room] of Object.entries(rooms)) {
      const index = room.players.findIndex((p) => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomCode).emit("playersUpdated", room.players);

        // If room empty -> delete
        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          // Fix pickerIndex if needed
          if (room.pickerIndex >= room.players.length) {
            room.pickerIndex = 0;
          }
        }
      }
    }
  });
});

// Scoring: unique answer -> 10, duplicate (non-empty) -> 5, empty/invalid -> 0
function calculateScores(room) {
  const categories = ["women", "men", "flower", "fruit", "animal", "city"];
  const results = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    answers: room.answers[p.id] || {},
    roundScore: 0,
  }));

  categories.forEach((cat) => {
    // Collect all answers for this category
    const values = results.map((r) => ({
      id: r.id,
      value: (r.answers[cat] || "").trim().toLowerCase(),
    }));

    // Count frequencies
    const freq = {};
    values.forEach((v) => {
      if (!v.value) return;
      freq[v.value] = (freq[v.value] || 0) + 1;
    });

    // Score
    values.forEach((v) => {
      if (!v.value) return;
      const playerResult = results.find((r) => r.id === v.id);
      if (!playerResult) return;

      if (freq[v.value] === 1) {
        playerResult.roundScore += 10;
      } else {
        playerResult.roundScore += 5;
      }
    });
  });

  return results;
}

// server.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

const express = require("express");
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

