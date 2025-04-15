// Should be included in /home

document.getElementById('startGameBtn').addEventListener('click', () => {
  const modal     = bootstrap.Modal.getInstance(document.getElementById('startGameModal'));
  const form      = document.getElementById('gameForm');
  const selection = form.querySelector('#gameSelection');

  let gameFn;
  switch (selection.value) {
    case 'quickdraw':
      gameFn    = quickdraw;
      break;
  }

  if (gameFn) {
    modal.hide();
    gameFn();
  } else {
    console.error('Please select a game');
  }
})

function quickdraw() {
  console.log('playing quickdraw');
}
