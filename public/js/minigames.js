let currentGroup = null;

// Existing event listeners remain unchanged.
document.getElementById('selectMinigameBtn').addEventListener('click', async (event) => {
  event.preventDefault(); // Prevent form submission

  const minigameForm = document.getElementById('minigameForm');
  const minigameSelect = minigameForm.querySelector('#minigameSelect');
  const submitBtn = document.getElementById('selectMinigameBtn');

  const selectedFriends = document.getElementById('minigameSelectedFriends');
  const userSpans = selectedFriends.querySelectorAll('span');
  const userIDs = Array.from(userSpans).map(span => span.dataset.user_id);

  try {
    const res = await fetch('/groups', {
      method  : 'POST',
      headers : { 'Content-Type' : 'application/json' },
      body    : JSON.stringify({
        name    : minigameForm.querySelector('#groupName').value, // Changed: query selector fixed to get the value.
        friends : userIDs
      })
    });
    const data = await res.json();
    currentGroup = data; // Store group data (assumes group id is in data._id)

    // Programmatically open the modal
    let modalId;
    switch (minigameSelect.value) {
      case 'minigame1':
        modalId = 'minigameModal1';
        break;
      case 'minigame2':
        modalId = 'minigameModal2';
        break;
      case 'minigame3':
        modalId = 'minigameModal3';
        break;
      default:
        modalId = null;
        break;
    }

    if (modalId) {
      const myModal = new bootstrap.Modal(document.getElementById(modalId));
      myModal.show();

      // NEW: If the selected game is minigame1 (Hot Potato), initialize the game.
      if (minigameSelect.value === 'minigame1') {
        initHotPotato();
      }
    }

  } catch (err) {
    console.error(err);
  }
});

// Existing friend-adding code remains unchanged.
document.getElementById('minigameAddFriendBtn').addEventListener('click', async () => {
  const selectedFriends = document.getElementById('minigameSelectedFriends');
  const minigameForm = document.getElementById('minigameForm');
  const friendID = minigameForm.querySelector('#minigameFriendSelect').value;

  try {
    const res = await fetch(`/users/${friendID}`, {
      method : 'GET',
      headers : { 'Content-Type' : 'application/json' }
    });
    const data = await res.json();

    // Check if a span with the same username already exists
    const existingFriendSpan = selectedFriends.querySelector(`span[data-username="${data.username}"]`);

    if (!existingFriendSpan) {
      const friendSpan = document.createElement('span');
      const rmFriendBtn = document.createElement('button');

      friendSpan.textContent = data.username;
      friendSpan.dataset.username = data.username;
      friendSpan.dataset.user_id = data.user_id;
      friendSpan.classList = 'badge bg-primary d-flex align-items-center';

      rmFriendBtn.classList = 'btn-close btn-close-white ms-2';
      rmFriendBtn.addEventListener('click', () => {
        selectedFriends.removeChild(friendSpan);
      });

      friendSpan.appendChild(rmFriendBtn);
      selectedFriends.appendChild(friendSpan);
    }

  } catch (err) {
    console.error(err);
  }
});

function initHotPotato() {
  if (!currentGroup || !currentGroup._id) {
    console.error('Group data missing. Cannot initialize hot potato game.');
    return;
  }

  const groupId = currentGroup._id;

  const socket = io();
  const username = prompt("Enter your username for Hot Potato:") || ("Player" + Math.floor(Math.random() * 1000));

  socket.emit('joinGame', { groupId, username });

  document.getElementById('passPotatoBtn').style.display = 'none';

  socket.on('updatePlayers', (players) => {
    const container = document.getElementById('playersContainer');
    container.innerHTML = '';
    players.forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player';
      playerDiv.id = player.id;
      playerDiv.innerHTML = `
        <img src="path/to/avatar.png" alt="${player.username}" class="avatar">
        <span>${player.username}</span>
      `;
      container.appendChild(playerDiv);
    });
  });
  socket.on('potatoUpdate', (data) => {
    const { potatoHolder } = data;
    const players = document.getElementsByClassName('player');
    for (let p of players) {
      if (p.id === potatoHolder) {
        p.classList.add('has-potato');
      } else {
        p.classList.remove('has-potato');
      }
    }
    const passBtn = document.getElementById('passPotatoBtn');
    passBtn.disabled = (socket.id !== potatoHolder);
  });
  socket.on('gameOver', (data) => {
    const { loser } = data;
    const players = document.getElementsByClassName('player');
    let loserName = '';
    for (let p of players) {
      if (p.id === loser) {
        loserName = p.textContent;
        p.classList.add('loser');
        break;
      }
    }
    document.getElementById('gameStatus').textContent = `Game Over! ${loserName} has lost.`;
    document.getElementById('passPotatoBtn').disabled = true;
  });
  document.getElementById('startHotPotatoBtn').addEventListener('click', () => {
    socket.emit('startGame', groupId);

    document.getElementById('passPotatoBtn').style.display = 'inline-block';
  });
  document.getElementById('passPotatoBtn').addEventListener('click', () => {
    const players = Array.from(document.getElementsByClassName('player'));
    const otherPlayers = players.filter(p => p.id !== socket.id);
    if (otherPlayers.length === 0) return;
    const randomIndex = Math.floor(Math.random() * otherPlayers.length);
    const newHolderId = otherPlayers[randomIndex].id;
    socket.emit('passPotato', { groupId, newHolderId });
  });
}

