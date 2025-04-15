// Should be included in /home

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('startGameBtn').addEventListener('click', () => {
    const modal     = bootstrap.Modal.getInstance(document.getElementById('startGameModal'));
    const form      = document.getElementById('gameForm');
    const selection = form.querySelector('#gameSelection');

    let gameFn;
    switch (selection.value) {
      case 'quickdraw':
        gameFn = quickdraw;
        break;
    }

    if (gameFn) {
      modal.hide();
      gameFn();
    } else {
      console.error('Please select a game');
    }
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
