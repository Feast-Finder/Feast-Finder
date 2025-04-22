// test/validation.test.js

// bring in a DOM for all tests (via .mocharc.js: require: ['jsdom-global/register'])
const { expect } = require('chai');

// your validation helpers must export themselves when run under Node:
const {
  validateUsername,
  validateEmail,
  validatePhone,
  setInvalid,
  setValid
} = require('../public/js/validation');

describe('validation.js helpers', () => {
  let usernameInput, emailInput, phoneInput;
  let usernameFeedback, emailFeedback, phoneFeedback;
  let originalFetch;

  beforeEach(() => {
    // snapshot any existing fetch
    originalFetch = global.fetch;

    // rebuild our DOM fixtures
    document.body.innerHTML = `
      <input id="username" />
      <div id="invalidUsername"></div>
      <input id="email" />
      <div id="invalidEmail"></div>
      <input id="phone" />
      <div id="invalidPhone"></div>
    `;
    usernameInput    = document.getElementById('username');
    usernameFeedback = document.getElementById('invalidUsername');
    emailInput       = document.getElementById('email');
    emailFeedback    = document.getElementById('invalidEmail');
    phoneInput       = document.getElementById('phone');
    phoneFeedback    = document.getElementById('invalidPhone');
  });

  afterEach(() => {
    // restore fetch
    global.fetch = originalFetch;
  });

  describe('setInvalid / setValid', () => {
    it('setInvalid toggles classes and writes message', () => {
      usernameInput.classList.add('is-valid');
      setInvalid(usernameInput, usernameFeedback, 'Bad!');
      expect(usernameInput.classList.contains('is-invalid')).to.be.true;
      expect(usernameInput.classList.contains('is-valid')).to.be.false;
      expect(usernameFeedback.textContent).to.equal('Bad!');
    });

    it('setValid toggles classes correctly', () => {
      usernameInput.classList.add('is-invalid');
      setValid(usernameInput);
      expect(usernameInput.classList.contains('is-valid')).to.be.true;
      expect(usernameInput.classList.contains('is-invalid')).to.be.false;
    });
  });

  describe('validateUsername()', () => {
    it('invalidates empty value', async () => {
      usernameInput.value = '';
      await validateUsername(usernameInput);
      expect(usernameInput.classList.contains('is-invalid')).to.be.true;
      expect(usernameFeedback.textContent).to.equal('Username is required.');
    });

    it('invalidates when server says taken', async () => {
      usernameInput.value = 'bob';
      // stub fetch to pretend the username exists
      global.fetch = () =>
        Promise.resolve({
          json: () => Promise.resolve({ exists: true })
        });

      await validateUsername(usernameInput);
      expect(usernameInput.classList.contains('is-invalid')).to.be.true;
      expect(usernameFeedback.textContent).to.equal('Username is already taken.');
    });

    it('validates when server says free', async () => {
      usernameInput.value = 'alice';
      global.fetch = () =>
        Promise.resolve({
          json: () => Promise.resolve({ exists: false })
        });

      await validateUsername(usernameInput);
      expect(usernameInput.classList.contains('is-valid')).to.be.true;
      expect(usernameInput.classList.contains('is-invalid')).to.be.false;
    });
  });

  describe('validateEmail()', () => {
    it('treats empty email as valid (optional)', async () => {
      emailInput.value = '';
      await validateEmail(emailInput);
      expect(emailInput.classList.contains('is-valid')).to.be.true;
      expect(emailInput.classList.contains('is-invalid')).to.be.false;
    });

    it('invalidates malformed email', async () => {
      emailInput.value = 'not@anemail';
      await validateEmail(emailInput);
      expect(emailInput.classList.contains('is-invalid')).to.be.true;
      expect(emailFeedback.textContent).to.equal('Invalid email format.');
    });

    it('invalidates when server says exists', async () => {
      emailInput.value = 'foo@bar.com';
      global.fetch = () =>
        Promise.resolve({
          json: () => Promise.resolve({ exists: true })
        });

      await validateEmail(emailInput);
      expect(emailInput.classList.contains('is-invalid')).to.be.true;
      expect(emailFeedback.textContent).to.equal('Email is already registered.');
    });

    it('validates when server says free', async () => {
      emailInput.value = 'foo@bar.com';
      global.fetch = () =>
        Promise.resolve({
          json: () => Promise.resolve({ exists: false })
        });

      await validateEmail(emailInput);
      expect(emailInput.classList.contains('is-valid')).to.be.true;
      expect(emailInput.classList.contains('is-invalid')).to.be.false;
    });
  });

  describe('validatePhone()', () => {
    it('treats empty phone as valid (optional)', async () => {
      phoneInput.value = '';
      await validatePhone(phoneInput);
      expect(phoneInput.classList.contains('is-valid')).to.be.true;
      expect(phoneInput.classList.contains('is-invalid')).to.be.false;
    });

    it('invalidates bad format', async () => {
      phoneInput.value = '12345';
      await validatePhone(phoneInput);
      expect(phoneInput.classList.contains('is-invalid')).to.be.true;
      expect(phoneFeedback.textContent)
        .to.equal('Invalid phone format (e.g. 123-456-7890)');
    });

    it('invalidates when server says exists', async () => {
      phoneInput.value = '123-456-7890';
      global.fetch = () =>
        Promise.resolve({
          json: () => Promise.resolve({ exists: true })
        });

      await validatePhone(phoneInput);
      expect(phoneInput.classList.contains('is-invalid')).to.be.true;
      expect(phoneFeedback.textContent)
        .to.equal('Phone number is already registered.');
    });

    it('validates when server says free', async () => {
      phoneInput.value = '(123) 456-7890';
      global.fetch = () =>
        Promise.resolve({
          json: () => Promise.resolve({ exists: false })
        });

      await validatePhone(phoneInput);
      expect(phoneInput.classList.contains('is-valid')).to.be.true;
      expect(phoneInput.classList.contains('is-invalid')).to.be.false;
    });
  });
});
