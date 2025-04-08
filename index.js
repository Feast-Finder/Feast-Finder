// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');

Handlebars.registerHelper('charAt', function (str, index) {
  return str && str.charAt(index);
});


const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/src/views/layouts',
  partialsDir: __dirname + '/src/views/partials',
});

const dbConfig = {
  host: 'db',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);
db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done();
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'PLACEHOLDER_SECRET',
  saveUninitialized: false,
  resave: false,
}));

// *****************************************************
// <!-- Section 4 : Sample Test Data (In-Memory) -->
// *****************************************************
const TEST_USER = {
  username: 'java2022',
  password: '$2a$10$YourHashedPasswordHere',
  user_id: 1
};

const USERS = [
  TEST_USER,
  { username: 'testuser1', password: '1234', user_id: 2 },
  { username: 'testuser2', password: '1234', user_id: 3 },
  { username: 'testuser3', password: '1234', user_id: 4 }
];

const groups = new Map();
const votes = new Map();
const friends = new Map();
const friendRequests = new Map();

friends.set(1, [2, 3]);
friends.set(2, [1]);
friends.set(3, [1]);
friends.set(4, []);

friendRequests.set(1, [4]);
friendRequests.set(2, []);
friendRequests.set(3, []);
friendRequests.set(4, []);

// *****************************************************
// <!-- Section 5 : Middleware -->
// *****************************************************
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

const auth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// *****************************************************
// <!-- Section 6 : Public Routes -->
// *****************************************************
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('Pages/login'));
app.get('/register', (req, res) => res.render('Pages/register'));

app.post('/check-username', async (req, res) => {
  try {
    const user = await db.oneOrNone(`SELECT * FROM Users WHERE username = $1`, [req.body.username]);
    res.json({ exists: !!user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.none(`INSERT INTO Users (username, password_hash) VALUES ($1, $2)`, [req.body.username, hash]);
    res.redirect('/login');
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await db.oneOrNone(`SELECT * FROM Users WHERE username = $1`, [req.body.username]);
    if (!user) return res.render('Pages/login', { message: 'User not found. <a href="/register">Create one</a>' });

    const match = await bcrypt.compare(req.body.password, user.password_hash);
    if (!match) return res.render('Pages/login', { message: 'Incorrect password.' });

    req.session.user = user;
    
    req.session.save(() => res.redirect('/home'));
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
});

// *****************************************************
// <!-- Section 7 : lab 11/testing Routes -->
// *****************************************************

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});
//identical to register route but used for testing for lab 11 
app.post('/register_test', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.none(`INSERT INTO Users (username, password_hash) VALUES ($1, $2)`, [req.body.username, hash]);
    res.json({ result: 'Success' });
   // res.redirect('/login');
  } catch (err) {
    console.log(err);
    return res.status(400).json({ result: 'Username already exists' });
  }
});
app.get('/friends_test', async (req, res) => {
  if (!req.session || !req.session.user) {
    // Force plain text so your test gets what it expects
    return res.status(401).type('text/plain').send('Not authenticated');
  }

  try {
    const friendsList = await db.any(`
      SELECT u.user_id, u.username FROM Users u
      JOIN Friends f ON 
        (u.user_id = f.user_id_1 AND f.user_id_2 = $1)
        OR 
        (u.user_id = f.user_id_2 AND f.user_id_1 = $1)
      WHERE u.user_id != $1
    `, [req.session.user.user_id]);

    res.json({
      username: req.session.user.username,
      friends: friendsList
    });
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});
// *****************************************************
// <!-- Section 8 : Authenticated Routes -->
// *****************************************************
app.use(auth);

app.get('/home', (req, res) => {
  const userGroups = Array.from(groups.values()).filter(g => g.active && g.members.includes(req.session.user.user_id));
  const userFriends = (friends.get(req.session.user.user_id) || []).map(fid => USERS.find(u => u.user_id === fid));
  res.render('Pages/Home', { groups: userGroups, friends: userFriends });
});

app.get('/profile', (req, res) => res.render('Pages/Profile'));

app.get('/friends', async (req, res) => {
  try {
    const friendsList = await db.any(`
      SELECT u.user_id, u.username FROM users u
      JOIN friends f ON (u.user_id = f.user_id_1 AND f.user_id_2 = $1)
                   OR (u.user_id = f.user_id_2 AND f.user_id_1 = $1)
      WHERE u.user_id != $1`,
      [req.session.user.user_id]);
    res.render('Pages/friends', { friends: friendsList });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.render('Pages/friends', { error: 'Failed to load friends' });
  }
});

app.post('/send-friend-request', async (req, res) => {
  const currentUserId = req.session.user?.user_id;
  const friendId = parseInt(req.body.friend_id);
  const [user1, user2] = currentUserId < friendId ? [currentUserId, friendId] : [friendId, currentUserId];
  try {
    const already = await db.oneOrNone(`SELECT 1 FROM Friends WHERE user_id_1 = $1 AND user_id_2 = $2`, [user1, user2]);
    if (already) return res.redirect('/friends?error=already_friends');
    await db.none(`INSERT INTO Friends (user_id_1, user_id_2) VALUES ($1, $2)`, [user1, user2]);
    res.redirect('/friends?success=added');
  } catch (err) {
    console.error('Error sending friend request:', err);
    res.redirect('/friends?error=server_error');
  }
});

app.post('/friends/remove', async (req, res) => {
  const [user1, user2] = req.session.user.user_id < req.body.friend_id
    ? [req.session.user.user_id, req.body.friend_id]
    : [req.body.friend_id, req.session.user.user_id];
  try {
    await db.none(`DELETE FROM Friends WHERE user_id_1 = $1 AND user_id_2 = $2`, [user1, user2]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing friend:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.get('/search-users', async (req, res) => {
  const query = req.query.q;
  const currentUserId = req.session.user?.username;

  if (!query) return res.json([]);
  try {
    const results = await db.any(
      `SELECT user_id, username 
       FROM Users 
       WHERE username ILIKE $1 AND username != $2 
       LIMIT 10`,
      [`%${query}%`, currentUserId]
    );
    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.oneOrNone(`SELECT user_id, username, email, created_at FROM users WHERE user_id = $1`, [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// *****************************************************
// <!-- Section 10 : Start Server -->
// *****************************************************
//app.listen(3000, () => console.log('Server is listening on port 3000'));
module.exports = app.listen(3000, () => console.log('Server is listening on port 3000'));