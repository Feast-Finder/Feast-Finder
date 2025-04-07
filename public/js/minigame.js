// // app.js
// const express = require('express');
// const session = require('express-session');
// const exphbs = require('express-handlebars');

// const app = express();
// app.use(express.urlencoded({ extended: true }));

// // Set up session middleware to keep game state
// app.use(session({
//   secret: 'secret-key',
//   resave: false,
//   saveUninitialized: true
// }));

// // Set up Handlebars as the view engine
// app.engine('handlebars', exphbs());
// app.set('view engine', 'handlebars');

// // Define card values (for simplicity, Ace is always 11)
// const cardValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];

// function drawCard() {
//   return cardValues[Math.floor(Math.random() * cardValues.length)];
// }

// // Initialize game state with an array of player objects.
// function initializeGame(playerNames) {
//   const players = playerNames.map(name => ({
//     name,
//     score: drawCard() + drawCard(), // each player starts with 2 cards
//     busted: false,
//     stand: false
//   }));
//   return {
//     players,
//     currentIndex: 0
//   };
// }

// // Home page: ask for player names.
// app.get('/', (req, res) => {
//   res.render('home');
// });

// // Start game: create initial game state from a comma-separated list of players.
// app.post('/start', (req, res) => {
//   const { players } = req.body; // expect a comma separated string
//   const playerNames = players.split(',')
//     .map(name => name.trim())
//     .filter(Boolean);
//   req.session.game = initializeGame(playerNames);
//   res.redirect('/game');
// });

// // Game page: show current player's turn and overall game state.
// app.get('/game', (req, res) => {
//   const game = req.session.game;
//   if (!game) return res.redirect('/');
//   const currentPlayer = game.players[game.currentIndex];
//   res.render('game', { game, currentPlayer });
// });

// // Process the player's action ("hit" or "stand")
// app.post('/action', (req, res) => {
//   const { action } = req.body;
//   const game = req.session.game;
//   let currentPlayer = game.players[game.currentIndex];

//   if (action === 'hit') {
//     const card = drawCard();
//     currentPlayer.score += card;
//     if (currentPlayer.score > 21) {
//       currentPlayer.busted = true;
//     }
//   } else if (action === 'stand') {
//     currentPlayer.stand = true;
//   }

//   // Advance turn
//   game.currentIndex = (game.currentIndex + 1) % game.players.length;

//   // If all players have either busted or stood, determine the outcome.
//   if (game.players.every(p => p.stand || p.busted)) {
//     const validPlayers = game.players.filter(p => !p.busted);
//     if (validPlayers.length === 0) {
//       req.session.result = 'All players busted. No winner this round.';
//       return res.redirect('/result');
//     }
//     const maxScore = Math.max(...validPlayers.map(p => p.score));
//     const winners = validPlayers.filter(p => p.score === maxScore);

//     if (winners.length > 1) {
//       // Tie: restart game with only tied players.
//       req.session.game = initializeGame(winners.map(p => p.name));
//       req.session.tie = true;
//       return res.redirect('/game');
//     } else {
//       req.session.result = `${winners[0].name} wins with a score of ${winners[0].score}!`;
//       return res.redirect('/result');
//     }
//   }

//   res.redirect('/game');
// });

// // Result page: display the outcome.
// app.get('/result', (req, res) => {
//   res.render('result', { result: req.session.result });
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
