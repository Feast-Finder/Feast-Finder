// Should be included in /home

document.addEventListener("DOMContentLoaded", () => {
  let gameInitiator;
  let selectedGameName;

  const userId = sessionStorage.getItem("userId");

  // 'minigame name' => minigameFunction
  const minigames = new Map([
    ["quickdraw", quickdraw],
    ["hot potato", initHotPotato],
  ]);

  function hideAllModals() {
    Array.from(document.getElementsByClassName("modal")).forEach((m) => {
      bootstrap.Modal.getInstance(m)?.hide();
    });
  }

  document.getElementById("startGameBtn").addEventListener("click", () => {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("startGameModal"),
    );
    const form = document.getElementById("gameForm");
    const selection = form.querySelector("#gameSelection");
    const overlay = document.getElementById("gameWaitingOverlay");

    if (!minigames.has(selection.value)) {
      console.error("Please select a game");
    }

    gameInitiator = true;
    selectedGameName = selection.value;

    socket.emit("request-game-start", {
      groupId: currentGroupId,
      userId: userId,
      gameName: selection.value,
    });

    modal.hide();
    overlay.classList.remove("d-none");
  });

  document.getElementById("joinGameBtn").addEventListener("click", () => {
    socket.emit("accept-game-invite", {
      groupId: currentGroupId,
      userId: userId,
      gameName: selectedGameName,
    });
  });

  socket.on("game-invite", ({ gameName }) => {
    if (!gameInitiator) {
      const modalEl = document.getElementById("gameInviteModal");
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

      hideAllModals();

      const body = modalEl.getElementsByClassName("modal-body")[0];
      body.textContent = `A friend invited you to play ${gameName}`;
      modal.show();

      selectedGameName = gameName;
    }
  });

  socket.on("game-start", ({ gameName }) => {
    if (gameInitiator) {
      const overlay = document.getElementById("gameWaitingOverlay");
      overlay.classList.add("d-none");
    }

    hideAllModals();

    minigames.get(gameName)();
  });

  socket.on("game-results", ({ loserId }) => {
    const quickdrawButton = document.getElementById("quickdrawButton");
    const quickdrawText = document.getElementById("quickdrawText");

    if (userId === loserId) {
      quickdrawButton.classList.remove("btn-success");
      quickdrawButton.classList.add("btn-danger");

      quickdrawText.textContent = "Too slow! You have to pay.";
    } else {
      quickdrawText.textContent = "Great job! You don't have to pay!";
    }
  });

  function quickdraw() {
    const modalEl = document.getElementById("quickdrawModal");
    if (!modalEl) {
      console.error("quickdrawModal element not found");
      return;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    if (!modal) {
      console.error("Could not get or create instance of quickdrawModal");
      return;
    }
    modal.show();

    const quickdrawButton = document.getElementById("quickdrawButton");
    const quickdrawText = document.getElementById("quickdrawText");
    let timer;
    let startTime;
    let gameStarted = false;
    const delay = Math.random() * (7000 - 2000) + 2000;
    let reactionTime;

    quickdrawButton.addEventListener("mousedown", () => {
      if (!gameStarted) {
        gameStarted = true;

        quickdrawButton.classList.remove("btn-primary");
        quickdrawButton.classList.add("btn-danger");
        quickdrawButton.textContent = "Click when the button turns green.";

        timer = setTimeout(turnGreen, delay);
      } else if (quickdrawButton.classList.contains("btn-danger")) {
        clearTimeout(timer);

        quickdrawButton.classList.remove("btn-danger");
        quickdrawButton.classList.add("btn-warning");
        quickdrawButton.textContent =
          "Too soon! Wait until the button turns green.";

        timer = setTimeout(turnGreen, delay);
      } else if (quickdrawButton.classList.contains("btn-warning")) {
        clearTimeout(timer);
        quickdrawButton.textContent = "Wait for green!";
        timer = setTimeout(turnGreen, delay);
      } else {
        reactionTime = Date.now() - startTime;

        quickdrawButton.disabled = true;
        quickdrawButton.textContent = `You took ${reactionTime}ms to click.`;

        quickdrawText.textContent =
          "Waiting for your friend's reaction time...";

        socket.emit("submit-quickdraw-score", {
          groupId: currentGroupId,
          userId: userId,
          score: reactionTime,
        });
      }
    });

    function turnGreen() {
      quickdrawButton.classList.remove("btn-danger", "btn-warning");
      quickdrawButton.classList.add("btn-success");
      quickdrawButton.textContent = "Click now!";
      startTime = Date.now();
    }
  }
});

// --------------------
// HOT POTATO GAME CODE
// --------------------

// This function initializes the Hot Potato game for minigame1.
// It connects via Socket.IO, joins the current group (using currentGroup._id), and sets up event listeners.
function initHotPotato() {
  // Ensure currentGroup exists and that Socket.IO is available.
  if (!currentGroupId) {
    console.error("Group data missing. Cannot initialize hot potato game.");
    return;
  }

  // Connect to the Socket.IO server (assumes the client script is loaded in the template).
  const socket = io();

  // For demonstration, we'll use a prompt for the username.
  const username =
    prompt("Enter your username for Hot Potato:") ||
    "Player" + Math.floor(Math.random() * 1000);

  // Join the game room.
  socket.emit("joinGame", { currentGroupId, username });

  // Initially hide the Pass Potato button.
  document.getElementById("passPotatoBtn").style.display = "none";

  // Update players list in the Hot Potato game UI.
  socket.on("updatePlayers", (players) => {
    const container = document.getElementById("playersContainer");
    container.innerHTML = "";
    players.forEach((player) => {
      const playerDiv = document.createElement("div");
      playerDiv.className = "player";
      playerDiv.id = player.id;
      playerDiv.innerHTML = `
        <img src="path/to/avatar.png" alt="${player.username}" class="avatar">
        <span>${player.username}</span>
      `;
      container.appendChild(playerDiv);
    });
  });

  // Update which player holds the potato.
  socket.on("potatoUpdate", (data) => {
    const { potatoHolder } = data;
    const players = document.getElementsByClassName("player");
    for (let p of players) {
      if (p.id === potatoHolder) {
        p.classList.add("has-potato");
      } else {
        p.classList.remove("has-potato");
      }
    }
    // Enable the pass button only if you are the potato holder.
    const passBtn = document.getElementById("passPotatoBtn");
    passBtn.disabled = socket.id !== potatoHolder;
  });

  // Handle game-over event.
  socket.on("gameOver", (data) => {
    const { loser } = data;
    const players = document.getElementsByClassName("player");
    let loserName = "";
    for (let p of players) {
      if (p.id === loser) {
        loserName = p.textContent;
        p.classList.add("loser");
        break;
      }
    }
    document.getElementById("gameStatus").textContent =
      `Game Over! ${loserName} has lost.`;
    document.getElementById("passPotatoBtn").disabled = true;
  });

  // --- MODIFIED SECTION ---

  // Start game button inside hot potato modal.
  document.getElementById("startHotPotatoBtn").addEventListener("click", () => {
    // Immediately start the game by emitting the event.
    socket.emit("startGame", currentGroupId);

    // Reveal the Pass Potato button once the game has started.
    document.getElementById("passPotatoBtn").style.display = "inline-block";
  });

  // Pass potato button event handler.
  document.getElementById("passPotatoBtn").addEventListener("click", () => {
    // Pass the potato to a random other player.
    const players = Array.from(document.getElementsByClassName("player"));
    const otherPlayers = players.filter((p) => p.id !== socket.id);
    if (otherPlayers.length === 0) return;
    const randomIndex = Math.floor(Math.random() * otherPlayers.length);
    const newHolderId = otherPlayers[randomIndex].id;
    socket.emit("passPotato", { currentGroupId, newHolderId });
  });
}
