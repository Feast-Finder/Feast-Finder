// test/form.spec.js
const { expect } = require('chai');
const sinon = require('sinon');

// wire up your DOMContentLoaded listeners
require('../src/index');

describe('Bootstrap-style form submit handler', () => {
  let form, submitEvent;

  beforeEach(() => {
    document.body.innerHTML = `
      <form class="needs-validation" novalidate>
        <input required />
        <button type="submit">Send</button>
      </form>
    `;
    form = document.querySelector('form');

    // create a cancelable submit event
    submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    sinon.spy(submitEvent, 'preventDefault');
    sinon.spy(submitEvent, 'stopPropagation');

    // trigger DOMContentLoaded to attach listeners
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  it('blocks invalid submit and adds was-validated', () => {
    form.dispatchEvent(submitEvent);

    expect(submitEvent.preventDefault.called).to.be.true;
    expect(submitEvent.stopPropagation.called).to.be.true;
    expect(form.classList.contains('was-validated')).to.be.true;
  });

  it('allows submit when form is valid', () => {
    // satisfy required field
    form.querySelector('input').value = 'foo';
    form.dispatchEvent(submitEvent);

    expect(submitEvent.preventDefault.called).to.be.false;
    expect(form.classList.contains('was-validated')).to.be.true;
  });
});