let currentGroup = null;

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
        name    : minigameForm.querySelector('groupName'),
        friends : userIDs
      })
    });
    const data = await res.json();

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
    }

  } catch (err) {
    console.error(err);
  }
});

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
