// const express = require('express');
// const exphbs  = require('express-handlebars');
// const bodyParser = require('body-parser');
// const mysql = require('mysql2');

// // Create Express app
// const app = express();
// const port = process.env.PORT || 3000;

// // Middleware
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// app.use(express.static('public'));

// // Set up Handlebars
// app.engine('handlebars', exphbs.engine({ defaultLayout: 'layout' }));
// app.set('view engine', 'handlebars');

// // Create MySQL connection pool
// const pool = mysql.createPool({
//   host: process.env.DB_HOST || 'localhost',
//   user: process.env.DB_USER || 'root',
//   password: process.env.DB_PASSWORD || 'secret',
//   database: process.env.DB_NAME || 'swipedb'
// });

// // Render homepage with swipeable items
// app.get('/', (req, res) => {
//   // In a real app, you would query the DB for items to swipe
//   const items = [
//     { id: 1, name: 'Restaurant A', description: 'Delicious meals' },
//     { id: 2, name: 'Restaurant B', description: 'Cozy ambiance' }
//   ];
//   res.render('index', { items });
// });

// // Endpoint to handle swipe actions
// app.post('/swipe', (req, res) => {
//   const { user_id, item_id, swipe_action } = req.body;
  
//   // Insert swipe action into the database
//   const query = 'INSERT INTO swipes (user_id, item_id, swipe_action) VALUES (?, ?, ?)';
//   pool.query(query, [user_id, item_id, swipe_action], (err, results) => {
//     if (err) {
//       console.error(err);
//       return res.status(500).json({ message: 'Database error' });
//     }
//     res.json({ message: 'Swipe recorded', swipeId: results.insertId });
//   });
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
