// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : App Settings -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/src/views/layouts',
  partialsDir: __dirname + '/src/views/partials',
});

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
// <!-- Section 4 : Routes -->
// *****************************************************

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('Pages/login', { message: req.query.message });
});

app.get('/register', (req, res) => {
  res.render('Pages/register', { message: req.query.message });
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
  
  // Get pending friend requests
  const pendingRequests = [];
  const requestIds = friendRequests.get(req.session.user.user_id) || [];
  
  for (const requesterId of requestIds) {
    const requester = USERS.find(u => u.user_id === requesterId);
    if (requester) {
      pendingRequests.push({
        user_id: requester.user_id,
        username: requester.username
      });
    }
  }
  
  // Get all users who are not already friends for the "Add Friend" feature
  const nonFriends = USERS.filter(user => 
    user.user_id !== req.session.user.user_id && 
    !userFriendIds.includes(user.user_id) &&
    !requestIds.includes(user.user_id)
  ).map(user => ({
    user_id: user.user_id,
    username: user.username
  }));
  
  res.render('Pages/friends', {
    friends: userFriends,
    requests: pendingRequests,
    users: nonFriends
  });
});

app.post('/register', async (req, res) => {
  if (req.body.username === TEST_USER.username) {
    return res.render('Pages/register', { message: 'Username already exists' });
  }
  res.redirect('/login');
});

app.post('/login', async (req, res) => {
  if (req.body.username === TEST_USER.username && req.body.password === '1234') {
    req.session.user = TEST_USER;
    req.session.save(() => {
      res.redirect('/home');
    });
  } else {
    res.render('Pages/login', { message: 'Incorrect username or password' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(function (err) {
    res.render('Pages/logout');
  });
});

// Friend-related routes
app.post('/friends/request', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const targetUserId = parseInt(req.body.user_id);
  
  if (!targetUserId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  // Check if user exists
  const targetUser = USERS.find(u => u.user_id === targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Add to target user's pending requests
  const targetRequests = friendRequests.get(targetUserId) || [];
  if (!targetRequests.includes(req.session.user.user_id)) {
    targetRequests.push(req.session.user.user_id);
    friendRequests.set(targetUserId, targetRequests);
  }
  
  res.json({ success: true });
});

app.post('/friends/accept', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const requesterId = parseInt(req.body.user_id);
  
  if (!requesterId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  // Check if there's actually a request
  const pendingRequests = friendRequests.get(req.session.user.user_id) || [];
  if (!pendingRequests.includes(requesterId)) {
    return res.status(400).json({ error: 'No pending request from this user' });
  }
  
  // Add to friends list (both ways)
  const userFriends = friends.get(req.session.user.user_id) || [];
  const requesterFriends = friends.get(requesterId) || [];
  
  userFriends.push(requesterId);
  requesterFriends.push(req.session.user.user_id);
  
  friends.set(req.session.user.user_id, userFriends);
  friends.set(requesterId, requesterFriends);
  
  // Remove from pending requests
  friendRequests.set(
    req.session.user.user_id, 
    pendingRequests.filter(id => id !== requesterId)
  );
  
  res.json({ success: true });
});

app.post('/friends/decline', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const requesterId = parseInt(req.body.user_id);
  
  if (!requesterId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  // Remove from pending requests
  const pendingRequests = friendRequests.get(req.session.user.user_id) || [];
  friendRequests.set(
    req.session.user.user_id, 
    pendingRequests.filter(id => id !== requesterId)
  );
  
  res.json({ success: true });
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

// Authentication Middleware
const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Authentication Required
app.use(auth);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
