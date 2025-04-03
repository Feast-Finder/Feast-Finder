// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/src/views/layouts',
  partialsDir: __dirname + '/src/views/partials',
});

hbs.handlebars.registerHelper('charAt', function (str, index) {
  return str && str.charAt(index);
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'PLACEHOLDER_SECRET',
    saveUninitialized: false,
    resave: false,
  })
);



app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************
// Authentication Middleware.
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});


app.get('/', (req, res) => {
  res.render('Pages/Home')
});
app.get('/login', (req, res) => {
  res.render('Pages/login')
});
app.get('/register', (req, res) => {
  res.render('Pages/register')
});
app.get('/home', (req, res) => {
  res.render('Pages/Home')
});
app.get('/profile', (req, res) => {
  res.render('Pages/Profile')
});
app.get('/friends', (req, res) => {
  res.render('Pages/friends')
});

app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.none(
      `INSERT INTO Users (username, password_hash) VALUES ($1,$2)`,
      [req.body.username, hash]
    );
    res.redirect('/login');
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
})

app.post('/check-username', async (req, res) => {
  try {
    const userc = await db.oneOrNone(
      `SELECT * FROM Users u WHERE u.username = $1`,
      [req.body.username]
    );
    res.json({ exists : !!userc });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post('/login', async (req, res) => {
  try {
    const user = await db.one(
      `SELECT * FROM Users u WHERE u.username = $1`,
      [req.body.username]
    );
    if (!user) {
      return res.render('src/views/Pages/register',{message:'No Such User' });
    }


    const match = await bcrypt.compare(req.body.password, user.password_hash);
    if (!match) {
      return res.render('src/views/Pages/login', { message: 'Incorrect username or password.' });
    }
    // Save user details in session
    req.session.user = user;
    req.session.save(() => {
      return res.redirect('/home');
    })
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
})
const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to login page.
    return res.redirect('/login');
  }
  next();
};

app.get('/search-users', async (req, res) => {
  const query = req.query.q;
  const currentUserId = req.session.user?.user_id;

  if (!query) return res.json([]);

  try {
    const results = await db.any(
      `SELECT user_id, username FROM Users 
       WHERE username ILIKE $1 AND user_id != $2 
       LIMIT 10`,
      [`%${query}%`, currentUserId]
    );
    res.json(results);
  } catch (err) {
    console.error('Error during user search:', err);
    res.status(500).json({ error: 'Internal server error during user search' });
  }
});

app.post('/send-friend-request', async (req, res) => {
  const currentUserId = req.session.user?.user_id;
  const friendId = req.body.friend_id;

  if (!currentUserId || !friendId || currentUserId === friendId) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const [user1, user2] = currentUserId < friendId
    ? [currentUserId, friendId]
    : [friendId, currentUserId];

  try {
    // Check if friendship already exists
    const alreadyFriends = await db.oneOrNone(
      `SELECT * FROM Friends WHERE user_id_1 = $1 AND user_id_2 = $2 LIMIT 1`,
      [user1, user2]
    );

    if (alreadyFriends) {
      return res.status(409).json({ error: 'You are already friends.' });
    }

    // Insert new friendship
    await db.none(
      `INSERT INTO friends (user_id_1, user_id_2) VALUES ($1, $2)`,
      [user1, user2]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error sending friend request:', err);
    res.status(500).json({ error: 'Internal server error while sending friend request' });
  }
});



// Authentication Required
app.use(auth);

app.get('/logout', (req, res) => {
  req.session.destroy(function (err) {
    res.render('Pages/logout');
  });
});


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');
