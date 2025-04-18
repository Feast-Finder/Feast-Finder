// test/validation.spec.js
const { expect } = require('chai');
const sinon = require('sinon');
const {
  validateUsername,
  setInvalid,
  setValid
} = require('../src/validation');

describe('validateUsername()', () => {
  let input, feedback, fetchStub;

  beforeEach(() => {
    // set up DOM elements
    document.body.innerHTML = `
      <input id="username" />
      <div id="invalidUsername"></div>
    `;
    input    = document.getElementById('username');
    feedback = document.getElementById('invalidUsername');
    // stub global fetch
    fetchStub = sinon.stub(global, 'fetch');
  });

  afterEach(() => {
    fetchStub.restore();
  });

  it('marks empty username as invalid', async () => {
    input.value = '   ';
    await validateUsername(input);

    expect(input.classList.contains('is-invalid')).to.be.true;
    expect(input.classList.contains('is-valid')).to.be.false;
    expect(feedback.textContent).to.equal('Username is required.');
  });

  it('flags already-taken username', async () => {
    input.value = 'bob';
    fetchStub.resolves({ json: () => Promise.resolve({ exists: true }) });

    await validateUsername(input);

    expect(fetchStub.calledOnce).to.be.true;
    expect(input.classList.contains('is-invalid')).to.be.true;
    expect(feedback.textContent).to.equal('Username is already taken.');
  });

  it('accepts available username', async () => {
    input.value = 'alice';
    fetchStub.resolves({ json: () => Promise.resolve({ exists: false }) });

    await validateUsername(input);

    expect(input.classList.contains('is-valid')).to.be.true;
    expect(input.classList.contains('is-invalid')).to.be.false;
  });

  it('does not throw on fetch error', async () => {
    input.value = 'carl';
    fetchStub.rejects(new Error('network down'));

    // should resolve without throwing
    await validateUsername(input);
  });
});
