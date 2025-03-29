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
      `INSERT INTO users (username, password) VALUES ($1,$2)`,
      [req.body.username, hash]
    );
    res.redirect('/login');
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
})


app.post('/login', async (req, res) => {
  try {
    const user = await db.one(
      `SELECT * FROM users u WHERE u.username = $1`,
      [req.body.username]
    );
    if (!user) {
      return res.render('/register');
    }


    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) {
      return res.render('/login', { message: 'Incorrect username or password.' });
    }
    // Save user details in session
    req.session.user = user;
    req.session.save(() => {
      res.redirect('/discover');
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

// Authentication Required
app.use(auth);

app.get('/logout', (req, res) => {
  req.session.destroy(function (err) {
    res.render('src/Pages/logout');
  });
});


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');
