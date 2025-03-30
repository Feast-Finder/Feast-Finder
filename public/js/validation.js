// prevent being able to submit if form is invalid
document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('.needs-validation');

  forms.forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }

      form.classList.add('was-validated');
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('register-form')) {
    const usernameInput = document.getElementById('username');

    usernameInput.addEventListener('input', async () => {
      await validateUsername(usernameInput);
    });
  }
});

// notify user if username is empty or already taken
async function validateUsername(usernameInput) {
  const username = usernameInput.value.trim();
  const feedback = document.getElementById('invalidUsername');

  if (!username) {
    setInvalid(usernameInput, feedback, 'Username is required.');
  } else {
    try {
      const res = await fetch('/check-username', {
        method  : 'POST',
        headers : { 'Content-Type' : 'application/json' },
        body    : JSON.stringify({ username })
      });

      const data = await res.json();
      if (data.exists) {
        setInvalid(usernameInput, feedback, 'Username is already taken.');
      } else {
        setValid(usernameInput);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

function setInvalid(input, feedback, msg) {
  input.classList.add('is-invalid');
  input.classList.remove('is-valid');
  feedback.textContent = msg;
}

function setValid(input) {
  input.classList.add('is-valid');
  input.classList.remove('is-invalid');
}
