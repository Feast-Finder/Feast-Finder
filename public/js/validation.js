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
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    usernameInput.addEventListener('input', async () => {
      await validateUsername(usernameInput);
    });

    if (emailInput) {
      emailInput.addEventListener('input', async () => {
        await validateEmail(emailInput);
      });
    }

    if (phoneInput) {
      phoneInput.addEventListener('input', async () => {
        await validatePhone(phoneInput);
      });
    }
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

// check email format and uniqueness
async function validateEmail(emailInput) {
  const email = emailInput.value.trim();
  const feedback = document.getElementById('invalidEmail');

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    setValid(emailInput); // optional field
  } else if (!emailPattern.test(email)) {
    setInvalid(emailInput, feedback, 'Invalid email format.');
  } else {
    try {
      const res = await fetch('/check-email', {
        method  : 'POST',
        headers : { 'Content-Type' : 'application/json' },
        body    : JSON.stringify({ email })
      });

      const data = await res.json();
      if (data.exists) {
        setInvalid(emailInput, feedback, 'Email is already registered.');
      } else {
        setValid(emailInput);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

// check phone format and uniqueness
async function validatePhone(phoneInput) {
  const phone = phoneInput.value.trim();
  const feedback = document.getElementById('invalidPhone');

  const phonePattern = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

  if (!phone) {
    setValid(phoneInput); // optional field
  } else if (!phonePattern.test(phone)) {
    setInvalid(phoneInput, feedback, 'Invalid phone format (e.g. 123-456-7890)');
  } else {
    try {
      const res = await fetch('/check-phone', {
        method  : 'POST',
        headers : { 'Content-Type' : 'application/json' },
        body    : JSON.stringify({ phone })
      });

      const data = await res.json();
      if (data.exists) {
        setInvalid(phoneInput, feedback, 'Phone number is already registered.');
      } else {
        setValid(phoneInput);
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
if (typeof module !== 'undefined') {
  module.exports = {
    validateUsername,
    validateEmail,
    validatePhone,
    setInvalid,
    setValid
  };
}
