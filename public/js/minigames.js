// Should be included in /home

document.addEventListener('DOMContentLoaded', () => {
  const overlay   = document.getElementById('gameWaitingOverlay');

  let selectedGameName;

  // 'minigame name' => minigameFunction
  const minigames = new Map([
    ['quickdraw', quickdraw]
  ]);

  function hideAllModals() {
    Array.from(document.getElementsByClassName('modal')).forEach((m) => {
      bootstrap.Modal.getInstance(m)?.hide();
    });
  }

  document.getElementById('startGameBtn').addEventListener('click', () => {
    const modal     = bootstrap.Modal.getInstance(document.getElementById('startGameModal'));
    const form      = document.getElementById('gameForm');
    const selection = form.querySelector('#gameSelection');

    if (!minigames.has(selection.value)) {
      console.error('Please select a game');
    }

    selectedGameName = selection.value;

    socket.emit('request-game-start', {
      groupId  : currentGroupId,
      userId   : sessionStorage.getItem('userId'),
      gameName : selection.value
    });

    modal.hide();
    overlay.classList.remove('d-none');
  });

  document.getElementById('joinGameBtn').addEventListener('click', () => {
    hideAllModals();
    overlay.classList.remove('d-none');

    socket.emit('accept-game-invite', {
      groupId  : currentGroupId,
      userId   : sessionStorage.getItem('userId'),
      gameName : selectedGameName
    });
  });

  socket.on('game-invite', ({ gameName }) => {
    if (!selectedGameName) {
      const modalEl = document.getElementById('gameInviteModal');
      const modal   = bootstrap.Modal.getOrCreateInstance(modalEl);

      hideAllModals();

      const body = modalEl.getElementsByClassName('modal-body')[0];
      body.textContent = `A friend invited you to play ${gameName}`;
      modal.show();

      selectedGameName = gameName;
    }
  });

  socket.on('game-start', ({ gameName }) => {
    hideAllModals();
    overlay.classList.add('d-none');

    minigames.get(gameName)();
  });

  function quickdraw() {
    const quickdrawModalEl = document.getElementById('quickdrawModal');
    if (!quickdrawModalEl) {
      console.error('quickdrawModal element not found');
      return;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(quickdrawModalEl);
    if (!modal) {
      console.error('Could not get or create instance of quickdrawModal');
      return;
    }
    modal.show();

    const quickdrawButton = document.getElementById('quickdrawButton');
    let timer;
    let startTime;
    let gameStarted = false;
    const delay = Math.random() * (7000 - 2000) + 2000;
    let reactionTime;

    quickdrawButton.addEventListener('mousedown', () => {
      if (!gameStarted) {
        gameStarted = true;

        quickdrawButton.classList.remove('btn-primary');
        quickdrawButton.classList.add('btn-danger');
        quickdrawButton.textContent = 'Click when the button turns green';

        timer = setTimeout(turnGreen, delay)

      } else if (quickdrawButton.classList.contains('btn-danger')) {
        clearTimeout(timer);

        quickdrawButton.classList.remove('btn-danger');
        quickdrawButton.classList.add('btn-warning');
        quickdrawButton.textContent = 'Too soon! Wait until the button turns green';

        timer = setTimeout(turnGreen, delay);

      } else {
        reactionTime = Date.now() - startTime;

        quickdrawButton.disabled    = true;
        quickdrawButton.textContent = `You took ${reactionTime}ms to click`;
      }
    });

    function turnGreen() {
      quickdrawButton.classList.remove('btn-danger', 'btn-warning');
      quickdrawButton.classList.add('btn-success');
      quickdrawButton.textContent = 'Click now!';
      startTime = Date.now();
    }
  }
});
