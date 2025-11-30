const socket = io();

let currentRoomCode = null;
let currentPlayer = null;
let isHost = false;
let currentPickerId = null;

const authDiv = document.getElementById("auth");
const roomDiv = document.getElementById("room");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const playerNameDisplay = document.getElementById("playerNameDisplay");
const hostTag = document.getElementById("hostTag");
const playersList = document.getElementById("playersList");
const startGameBtn = document.getElementById("startGameBtn");

const gameArea = document.getElementById("gameArea");
const pickerNameSpan = document.getElementById("pickerName");
const currentLetterSpan = document.getElementById("currentLetter");
const pickerControls = document.getElementById("pickerControls");
const letterInput = document.getElementById("letterInput");
const chooseLetterBtn = document.getElementById("chooseLetterBtn");

const answerArea = document.getElementById("answerArea");
const ansWomen = document.getElementById("ansWomen");
const ansMen = document.getElementById("ansMen");
const ansFlower = document.getElementById("ansFlower");
const ansFruit = document.getElementById("ansFruit");
const ansAnimal = document.getElementById("ansAnimal");
const ansCity = document.getElementById("ansCity");
const submitAnswersBtn = document.getElementById("submitAnswersBtn");

const resultsArea = document.getElementById("resultsArea");
const resultsText = document.getElementById("resultsText");
const nextRoundBtn = document.getElementById("nextRoundBtn");

document.getElementById("createRoomBtn").onclick = () => {
  const name = document.getElementById("playerName").value.trim();
  if (!name) return alert("Enter your name");
  socket.emit("createRoom", name, (res) => {
    if (res.error) {
      alert(res.error);
      return;
    }
    afterJoin(res);
  });
};

document.getElementById("joinRoomBtn").onclick = () => {
  const name = document.getElementById("playerName").value.trim();
  const roomCode = document.getElementById("joinRoomCode").value.trim();
  if (!name || !roomCode) return alert("Enter name and room code");
  socket.emit("joinRoom", roomCode, name, (res) => {
    if (res.error) {
      alert(res.error);
      return;
    }
    afterJoin(res);
  });
};

function afterJoin({ roomCode, player, isHost: host }) {
  currentRoomCode = roomCode;
  currentPlayer = player;
  isHost = host;

  authDiv.classList.add("hidden");
  roomDiv.classList.remove("hidden");

  roomCodeDisplay.textContent = roomCode;
  playerNameDisplay.textContent = player.name;
  hostTag.textContent = isHost ? "(Host)" : "";

  if (isHost) {
    startGameBtn.classList.remove("hidden");
  }
}

startGameBtn.onclick = () => {
  socket.emit("startGame", currentRoomCode);
};

socket.on("playersUpdated", (players) => {
  playersList.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (Score: ${p.score})`;
    playersList.appendChild(li);
  });
});

// New round started: someone will choose a letter
socket.on("roundStart", ({ pickerId, pickerName }) => {
  currentPickerId = pickerId;

  gameArea.classList.remove("hidden");
  resultsArea.classList.add("hidden");
  currentLetterSpan.textContent = "";
  pickerNameSpan.textContent = pickerName;
  clearAnswers();
  answerArea.classList.add("hidden");

  if (pickerId === socket.id) {
    pickerControls.classList.remove("hidden");
  } else {
    pickerControls.classList.add("hidden");
  }
});

// When picker chooses the letter
socket.on("letterChosen", ({ letter }) => {
  currentLetterSpan.textContent = letter;
  pickerControls.classList.add("hidden");

  // Now everyone can answer
  answerArea.classList.remove("hidden");
});

chooseLetterBtn.onclick = () => {
  const letter = letterInput.value.trim();
  if (!letter || letter.length !== 1 || !/[a-zA-Z]/.test(letter)) {
    return alert("Enter a single letter A-Z");
  }
  socket.emit("chooseLetter", currentRoomCode, letter);
  letterInput.value = "";
};

submitAnswersBtn.onclick = () => {
  const answers = {
    women: ansWomen.value,
    men: ansMen.value,
    flower: ansFlower.value,
    fruit: ansFruit.value,
    animal: ansAnimal.value,
    city: ansCity.value,
  };
  socket.emit("submitAnswers", currentRoomCode, answers);
  answerArea.classList.add("hidden");
};

socket.on("roundResults", ({ round, players }) => {
  // Update players list with new scores
  playersList.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (Score: ${p.score})`;
    playersList.appendChild(li);
  });

  // Show detailed round results
  let text = "Round Results:\n\n";
  round.forEach((r) => {
    text += `${r.name} - Round Score: ${r.roundScore}\n`;
    text += `  Women: ${r.answers.women || ""}\n`;
    text += `  Men: ${r.answers.men || ""}\n`;
    text += `  Flower: ${r.answers.flower || ""}\n`;
    text += `  Fruit: ${r.answers.fruit || ""}\n`;
    text += `  Animal: ${r.answers.animal || ""}\n`;
    text += `  City: ${r.answers.city || ""}\n\n`;
  });

  resultsText.textContent = text;
  resultsArea.classList.remove("hidden");

  // Only host sees "Next Round" button
  if (isHost) {
    nextRoundBtn.classList.remove("hidden");
  } else {
    nextRoundBtn.classList.add("hidden");
  }
});

nextRoundBtn.onclick = () => {
  socket.emit("nextRound", currentRoomCode);
};

function clearAnswers() {
  ansWomen.value = "";
  ansMen.value = "";
  ansFlower.value = "";
  ansFruit.value = "";
  ansAnimal.value = "";
  ansCity.value = "";
}
