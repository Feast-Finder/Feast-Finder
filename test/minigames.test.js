// test/minigames.test.js

const { expect } = require('chai');

describe('minigames.js', () => {
  let hideCalls, showCalls, overlay, startBtn, joinBtn;
  let startModalEl, inviteModalEl, quickdrawModalEl;
  let form, selection;
  let handlers, emitted;

  beforeEach(() => {
    // reset spies
    hideCalls = [];
    showCalls = [];

    // build DOM
    document.body.innerHTML = `
      <div id="gameWaitingOverlay" class="d-none"></div>
      <button id="startGameBtn"></button>
      <button id="joinGameBtn"></button>
      <div id="startGameModal" class="modal"><div class="modal-body"></div></div>
      <div id="gameInviteModal" class="modal"><div class="modal-body"></div></div>
      <form id="gameForm">
        <select id="gameSelection">
          <option value="">— choose —</option>
          <option value="quickdraw">Quickdraw</option>
        </select>
      </form>
      <div id="quickdrawModal" class="modal">
        <button id="quickdrawButton" class="btn-primary"></button>
        <div id="quickdrawText"></div>
      </div>
    `;
    overlay        = document.getElementById('gameWaitingOverlay');
    startBtn       = document.getElementById('startGameBtn');
    joinBtn        = document.getElementById('joinGameBtn');
    startModalEl   = document.getElementById('startGameModal');
    inviteModalEl  = document.getElementById('gameInviteModal');
    quickdrawModalEl = document.getElementById('quickdrawModal');
    form           = document.getElementById('gameForm');
    selection      = document.getElementById('gameSelection');

    // stub bootstrap.Modal
    global.bootstrap = {
      Modal: {
        getInstance: (el) => ({ hide: () => hideCalls.push(el.id) }),
        getOrCreateInstance: (el) => ({
          show: () => showCalls.push(el.id),
          hide: () => hideCalls.push(el.id)
        })
      }
    };

    // stub sessionStorage and globals
    global.sessionStorage = { getItem: () => 'user123' };
    global.currentGroupId = 'groupABC';

    // stub socket
    handlers = {};
    emitted   = [];
    global.socket = {
      on:    (evt, cb) => { handlers[evt] = cb; },
      emit:  (evt, payload) => { emitted.push({ evt, payload }); }
    };

    // load the script and fire DOMContentLoaded
    require('../public/js/minigames.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    // clear computed cache so re-require works
    delete require.cache[require.resolve('../public/js/minigames.js')];
  });

  it('startGameBtn click emits request-game-start and shows overlay, hides modal', () => {
    // pick a game
    selection.value = 'quickdraw';
    startBtn.click();

    expect(emitted).to.deep.include({
      evt: 'request-game-start',
      payload: {
        groupId: 'groupABC',
        userId: 'user123',
        gameName: 'quickdraw'
      }
    });

    expect(overlay.classList.contains('d-none')).to.be.false;
    // startGameModal.hide() should have been called
    expect(hideCalls).to.include('startGameModal');
  });

  it('joinGameBtn click emits accept-game-invite and shows overlay, hides all modals', () => {
    // simulate prior selection
    selection.value = 'quickdraw';
    startBtn.click();  // sets selectedGameName

    // now click join
    joinBtn.click();

    expect(emitted).to.deep.include({
      evt: 'accept-game-invite',
      payload: {
        groupId: 'groupABC',
        userId: 'user123',
        gameName: 'quickdraw'
      }
    });

    expect(overlay.classList.contains('d-none')).to.be.false;
    // both modals hidden by hideAllModals
    expect(hideCalls).to.include.members(['startGameModal','gameInviteModal']);
  });

  it('on game-invite shows invite modal and sets its body text', () => {
    // fire invite
    handlers['game-invite']({ gameName: 'quickdraw' });

    expect(showCalls).to.include('gameInviteModal');
    const body = inviteModalEl.querySelector('.modal-body');
    expect(body.textContent).to.equal('A friend invited you to play quickdraw');
  });

  it('on game-start hides modals, re-hides overlay, and opens quickdraw modal', () => {
    // prepare overlay visible
    overlay.classList.remove('d-none');
    // fire start
    handlers['game-start']({ gameName: 'quickdraw' });

    // modals hidden
    expect(hideCalls).to.include.members(['startGameModal','gameInviteModal','quickdrawModal']);
    // overlay hidden
    expect(overlay.classList.contains('d-none')).to.be.true;
    // quickdrawModal shown
    expect(showCalls).to.include('quickdrawModal');
  });

  it('on game-results marks button red when user loses', () => {
    // first show quickdraw modal to create button/text
    handlers['game-start']({ gameName: 'quickdraw' });

    const btn  = document.getElementById('quickdrawButton');
    const text = document.getElementById('quickdrawText');

    // simulate loss
    handlers['game-results']({ loserId: 'user123' });

    expect(btn.classList.contains('btn-danger')).to.be.true;
    expect(btn.classList.contains('btn-success')).to.be.false;
    expect(text.textContent).to.equal('Too slow! You have to pay.');
  });

  it('on game-results congratulates when friend loses', () => {
    // ensure quickdraw rendered
    handlers['game-start']({ gameName: 'quickdraw' });

    const text = document.getElementById('quickdrawText');

    // simulate friend loss
    handlers['game-results']({ loserId: 'someoneElse' });

    expect(text.textContent).to.equal("Great job! You don't have to pay!");
  });
});
