


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
// <!-- Section 3 : In-Memory Storage -->
// *****************************************************

// Test account credentials
const TEST_USER = {
  username: 'java2022',
  password: '$2a$10$YourHashedPasswordHere', // This is a placeholder, we'll use direct comparison
  user_id: 1
};

// Sample users for testing
const USERS = [
  TEST_USER,
  { username: 'testuser1', password: '1234', user_id: 2 },
  { username: 'testuser2', password: '1234', user_id: 3 },
  { username: 'testuser3', password: '1234', user_id: 4 }
];

// In-memory storage for groups, votes, friends and friend requests
const groups = new Map();
const votes = new Map();
const friends = new Map(); // userId -> array of friend user_ids
const friendRequests = new Map(); // userId -> array of pending friend request user_ids

// Initialize some friends for TEST_USER
friends.set(1, [2, 3]); // TEST_USER has testuser1 and testuser2 as friends
friends.set(2, [1]); // testuser1 has TEST_USER as friend
friends.set(3, [1]); // testuser2 has TEST_USER as friend
friends.set(4, []); // testuser3 has no friends

// Initialize friend requests
friendRequests.set(1, [4]); // TEST_USER has a request from testuser3
friendRequests.set(2, []);
friendRequests.set(3, []);
friendRequests.set(4, []);

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************
// Authentication Middleware.
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});
app.get('/home', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  // Get user's active groups
  const userGroups = Array.from(groups.values())
    .filter(group => group.active && group.members.includes(req.session.user.user_id));
  
  // Get user's friends
  const userFriends = [];
  const userFriendIds = friends.get(req.session.user.user_id) || [];
  
  for (const friendId of userFriendIds) {
    const friend = USERS.find(u => u.user_id === friendId);
    if (friend) {
      userFriends.push({
        user_id: friend.user_id,
        username: friend.username
      });
    }
  }
  
  res.render('Pages/Home', { 
    groups: userGroups,
    friends: userFriends
  });
});

app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('Pages/Profile');
});

app.get('/friends', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  // Get user's friends
  const userFriends = [];
  const userFriendIds = friends.get(req.session.user.user_id) || [];
  
  for (const friendId of userFriendIds) {
    const friend = USERS.find(u => u.user_id === friendId);
    if (friend) {
      userFriends.push({
        user_id: friend.user_id,
        username: friend.username
      });
    }
  }
  
  
  // Get all users who are not already friends for the "Add Friend" feature
  const nonFriends = USERS.filter(user => 
    user.user_id !== req.session.user.user_id && 
    !userFriendIds.includes(user.user_id)
  ).map(user => ({
    user_id: user.user_id,
    username: user.username
  }));
  
  res.render('Pages/friends', {
    friends: userFriends,
    users: nonFriends
  });
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
    const user = await db.oneOrNone(
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


app.post('/friends/remove', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const friendId = parseInt(req.body.user_id);
  
  if (!friendId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  // Remove from both users' friend lists
  const userFriends = friends.get(req.session.user.user_id) || [];
  const otherUserFriends = friends.get(friendId) || [];
  
  friends.set(
    req.session.user.user_id,
    userFriends.filter(id => id !== friendId)
  );
  
  friends.set(
    friendId,
    otherUserFriends.filter(id => id !== req.session.user.user_id)
  );
  
  res.json({ success: true });
});

// Create new group
app.post('/groups', async (req, res) => {
  try {
    const groupId = Date.now(); // Use timestamp as group ID
    const newGroup = {
      group_id: groupId,
      name: req.body.name || 'Solo Session',
      created_by: req.session.user.user_id,
      location: req.body.location,
      created_at: new Date(),
      active: true,
      members: [req.session.user.user_id]
    };
    
    // Add friends to the group if provided
    if (req.body.friends && Array.isArray(req.body.friends)) {
      for (const friendId of req.body.friends) {
        const userFriends = friends.get(req.session.user.user_id) || [];
        if (userFriends.includes(parseInt(friendId))) {
          newGroup.members.push(parseInt(friendId));
        }
      }
    }

    groups.set(groupId, newGroup);
    res.json({ success: true, group_id: groupId });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Record restaurant like/dislike
app.post('/restaurants/vote', async (req, res) => {
  try {
    const voteKey = `${req.session.user.user_id}-${req.body.group_id}-${req.body.place_id}`;
    votes.set(voteKey, {
      user_id: req.session.user.user_id,
      group_id: req.body.group_id,
      place_id: req.body.place_id,
      restaurant_name: req.body.restaurant_name,
      liked: req.body.liked,
      created_at: new Date()
    });

    // Check for matches
    let isMatch = false;
    let matchedRestaurant = null;
    
    if (req.body.liked) {
      const group = groups.get(parseInt(req.body.group_id));
      
      if (group) {
        // Check if all members of the group liked this restaurant
        isMatch = true;
        
        for (const memberId of group.members) {
          const memberVoteKey = `${memberId}-${req.body.group_id}-${req.body.place_id}`;
          const memberVote = votes.get(memberVoteKey);
          
          if (!memberVote || !memberVote.liked) {
            isMatch = false;
            break;
          }
        }
        
        if (isMatch) {
          matchedRestaurant = {
            place_id: req.body.place_id,
            restaurant_name: req.body.restaurant_name
          };
        }
      }
    }

    res.json({ 
      success: true, 
      isMatch: isMatch,
      restaurant: matchedRestaurant
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});
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
