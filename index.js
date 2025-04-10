




// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('ioredis');

const pubClient = createClient({ host: 'redis', port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

pubClient.on('connect', () => console.log('✅ Redis pubClient connected'));
subClient.on('connect', () => console.log('✅ Redis subClient connected'));


const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Store active swipe sessions and readiness state
const activeSessions = new Map(); // { groupId: { users: Set, ready: Set } }

Handlebars.registerHelper('charAt', function (str, index) {
  return str && str.charAt(index);
});

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: path.join(__dirname, '/src/views/layouts'),
  partialsDir: path.join(__dirname, '/src/views/partials'),
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
// <!-- Section 4 : Middleware -->
// *****************************************************
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});


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
  if (req.body.password !== req.body.confirmPassword) {
    return res.render('Pages/register', { message : 'Passwords do not match' });
  }
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.none(`INSERT INTO Users (username, password_hash) VALUES ($1, $2)`, [req.body.username, hash]);
    req.session.user = req.body.username;
    req.session.save(() => res.redirect('/login'));
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

    // Set session user
    req.session.user = user;

    // Mark user as active and set last active time 
    await db.none(`
      UPDATE Users SET active = TRUE, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1
    `, [user.user_id]);
    
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
// Middleware
const auth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

app.use(auth); // This line must come after the function is defined

// *****************************************************
// <!-- Section 8 : Authenticated Routes -->
// *****************************************************
app.use(auth);

app.get('/home', async (req, res) => {
  const userId = req.session.user?.user_id;
  if (!userId) return res.redirect('/login');

  try {
    // 1. Fetch active groups where user is a member or creator
    const userGroups = await db.any(`
      SELECT g.*
      FROM Groups g
      LEFT JOIN GroupMembers gm ON g.group_id = gm.group_id
      WHERE g.creator_user_id = $1
         OR gm.user_id = $1
    `, [userId]);

    // 2. Fetch friends with their user info
    const userFriends = await db.any(`
      SELECT u.*
      FROM Users u
      JOIN Friends f ON (
        (f.user_id_1 = $1 AND f.user_id_2 = u.user_id)
        OR
        (f.user_id_2 = $1 AND f.user_id_1 = u.user_id)
      )
    `, [userId]);

    res.render('Pages/Home', { groups: userGroups, friends: userFriends });
  } catch (err) {
    console.error('Error loading home page:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/profile', (req, res) => res.render('Pages/Profile'));

app.get('/friends', async (req, res) => {
  try {
    const friendsList = await db.any(`
      SELECT u.user_id, u.username, u.email, u.created_at, u.active
      FROM Users u
      JOIN Friends f ON (u.user_id = f.user_id_1 OR u.user_id = f.user_id_2)
      WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
        AND u.user_id != $1
    `, [req.session.user.user_id]);
    
    res.render('Pages/friends', { friends: friendsList });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.render('Pages/friends', { error: 'Failed to load friends' });
  }
});
app.post('/session/invite', async (req, res) => {
  try {
    const currentUserId = req.session.userId;              // ID of the current user (inviter)
    const friendUsername = req.body.friendUsername;        // username entered in the form

    // 1. Lookup the friend's user ID by username
    const [[userRow]] = await db.execute(
      'SELECT id FROM users WHERE username = ?', 
      [friendUsername]
    );
    if (!userRow) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const friendId = userRow.id;

    // 2. (Optional) Verify friendship exists
    const [[friendshipRow]] = await db.execute(
      'SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?', 
      [currentUserId, friendId]
    );
    if (!friendshipRow) {
      return res.status(403).json({ success: false, message: "User is not in your friends list" });
    }

    // 3. Create a new swipe session (for simplicity, just an object here)
    const sessionId = createSession(currentUserId, friendId);  // assume this returns a session identifier
    // e.g., you might insert into a sessions table and get an ID, and also insert into a session_members table.

    // 4. Emit invite to the friend via Socket.IO
    const invitePayload = { sessionId, fromUsername: req.user.username };
    io.to(friendId.toString()).emit('sessionInvite', invitePayload);

    // 5. Respond to the inviter
    return res.json({ success: true, sessionId });
  } catch (err) {
    console.error("Error inviting friend:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
  const searchQuery = req.query.q?.trim();
  const currentUserId = req.session.user?.user_id;

  if (!searchQuery || !currentUserId) return res.json([]);

  try {
    const users = await db.any(`
      SELECT 
        u.user_id, 
        u.username,
        u.active,
        EXISTS (
          SELECT 1 FROM Friends 
          WHERE 
            (user_id_1 = $1 AND user_id_2 = u.user_id) OR 
            (user_id_2 = $1 AND user_id_1 = u.user_id)
        ) AS is_friend
      FROM Users u
      WHERE LOWER(u.username) LIKE LOWER($2)
        AND u.user_id != $1
    `, [currentUserId, `%${searchQuery}%`]);

    res.json(users);
  } catch (err) {
    console.error('Error in /search-users:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/users/:userId', async (req, res) => {
  try {
    const user = await db.oneOrNone(
      `SELECT user_id, username, email, created_at, active, last_active_at FROM Users WHERE user_id = $1`,
      [req.params.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error loading user profile:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/groups', async (req, res) => {
  const userId = req.session.user?.user_id;
  if (!userId) return res.status(401).json({ success: false, error: 'Not logged in' });

  const { name, location, friends, lat, lng } = req.body;

  try {
    // Create the group with lat/lng and placeholder for excluded_cuisines
    const group = await db.one(`
      INSERT INTO Groups (creator_user_id, location_latitude, location_longitude, excluded_cuisines)
      VALUES ($1, $2, $3, $4)
      RETURNING group_id
    `, [userId, lat, lng, '[]']);

    // Add group members
    await db.none(`INSERT INTO GroupMembers (group_id, user_id) VALUES ($1, $2)`, [group.group_id, userId]);

    if (Array.isArray(friends)) {
      for (const friendId of friends) {
        await db.none(`INSERT INTO GroupMembers (group_id, user_id) VALUES ($1, $2)`, [group.group_id, friendId]);
      }
    }

    res.json({ success: true, group_id: group.group_id });
  } catch (err) {
    console.error('❌ Error in POST /groups:', err); // <<< Make sure this exists
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

const Busboy = require('busboy');
const fs = require('fs');


app.post('/profile/upload', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  const busboy = Busboy({ headers: req.headers });
  const userId = req.session.user.user_id;

  let filePath = '';
  let savePath = '';
  let responseSent = false;

  busboy.on('file', (fieldname, file, { filename, encoding, mimeType }) => {
    console.log('File received:');
    console.log('filename:', filename);
    console.log('mimeType:', mimeType);

    if (!filename) {
      file.resume();
      if (!responseSent) {
        res.status(400).json({ error: 'No filename' });
        responseSent = true;
      }
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      file.resume();
      if (!responseSent) {
        res.status(400).json({ error: 'Invalid file type' });
        responseSent = true;
      }
      return;
    }

    const ext = path.extname(filename).toLowerCase();
    const newFilename = `user_${userId}${ext}`;
    filePath = `/uploads/${newFilename}`;
    savePath = path.join(__dirname, 'public', filePath);

    // Ensure the uploads directory exists
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    console.log('📦 Saving to:', savePath);
    const writeStream = fs.createWriteStream(savePath);
    file.pipe(writeStream);
  });

  busboy.on('finish', async () => {
    if (responseSent) return;

    if (!filePath) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      await db.none(`UPDATE Users SET profile_picture_url = $1 WHERE user_id = $2`, [filePath, userId]);
      req.session.user.profile_picture_url = filePath;
      res.json({ profile_picture_url: filePath });
    } catch (err) {
      console.error('DB error:', err);
      res.status(500).json({ error: 'Failed to save profile picture' });
    }
  });

  req.pipe(busboy);
});

app.post('/profile/update', async (req, res) => {
  const userId = req.session.user?.user_id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { email, currentPassword, newPassword, confirmNewPassword } = req.body;

  try {
    const user = await db.oneOrNone(`SELECT * FROM Users WHERE user_id = $1`, [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 1. Update email (if changed)
    if (email && email !== user.email) {
      await db.none(`UPDATE Users SET email = $1 WHERE user_id = $2`, [email, userId]);
      req.session.user.email = email;
    }

    // 2. Handle password update
    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ error: 'All password fields are required' });
      }

      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) {
        return res.status(403).json({ error: 'Current password is incorrect' });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        return res.status(400).json({ error: 'New password cannot be the same as the current password' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await db.none(`UPDATE Users SET password_hash = $1 WHERE user_id = $2`, [hashed, userId]);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const router = express.Router();


// Save food preferences
router.post('/preferences', async (req, res) => {
  const userId = req.session.user?.user_id; 

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const { cuisines, dietary, priceRange } = req.body;

  try {
    // INSERT preferences
    await db.query(`
      INSERT INTO user_preferences (user_id, cuisines, dietary, price_range)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET cuisines = EXCLUDED.cuisines,
                    dietary = EXCLUDED.dietary,
                    price_range = EXCLUDED.price_range;
    `, [userId, cuisines, dietary, priceRange]);

    res.json({ message: 'Preferences saved' });
  } catch (err) {
    console.error('Error saving preferences:', err);
    res.status(500).json({ error: 'Server error saving preferences' });
  }
});
app.use('/profile', router);



app.get('/logout', async (req, res) => {
  try {
    if (req.session.user) {
      const userId = req.session.user.user_id;
      await db.none(`
        UPDATE Users SET active = FALSE, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1
      `, [userId]);
      
    }

    req.session.destroy(() => res.redirect('/login'));
  } catch (err) {
    console.error('Error logging out:', err);
    res.redirect('/login');
  }});

// Create new group
app.post('/groups', async (req, res) => {
  try {
    const groupId = Date.now(); // Use timestamp as group ID
    const newGroup = {
      group_id: groupId,
      name: req.body.name || 'Solo Session',
      created_by: req.session.user.user_id,
      location: req.body.location || 'No Location', // Location not needed for minigames
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

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// *****************************************************
// <!-- Section 6 : Socket.IO Real-Time Sync Logic -->
// *****************************************************

const readyForInvite = new Set(); // userId → is ready
const activeGroups = new Map();  // groupId -> Set of userIds

const connectedUsers = new Map(); // userId → socket.id

io.on('connection', async (socket) => {
  let currentUserId = null;

  socket.on('register-user', ({ userId }) => {
    currentUserId = userId;
    connectedUsers.set(userId, socket.id);
    socket.join(`user-${userId}`);
    console.log(`👤 Registered and joined user room: user-${userId}`);
  });

  socket.on('ready-for-invites', ({ userId }) => {
    console.log(`✅ User ${userId} is ready to receive invites`);
    readyForInvite.add(userId);
  });

  socket.on('join-session', ({ groupId, userId }) => {
    if (!activeGroups.has(groupId)) activeGroups.set(groupId, new Set());
    activeGroups.get(groupId).add(userId);
    socket.join(`group-${groupId}`);
    console.log(`🧩 ${userId} joined group ${groupId}`);
  });

  socket.on('debug-message', ({ userId, message }) => {
    io.to(`user-${userId}`).emit('debug-reply', { message: `Reply to: ${message}` });
  });

  socket.on('ready-to-swipe', async ({ groupId, userId }) => {
    const session = activeSessions.get(groupId);
    if (!session) return;

    session.ready.add(userId);
    if (session.ready.size === session.users.size) {
      console.log(`🚀 Everyone is ready for group ${groupId}, emitting start-swiping`);

      const group = await db.oneOrNone(
        'SELECT location_latitude, location_longitude FROM Groups WHERE group_id = $1',
        [groupId]
      );

      if (!group) {
        console.warn(`⚠️ Could not fetch location for group ${groupId}`);
        return;
      }

      io.to(`group-${groupId}`).emit('start-swiping', {
        lat: parseFloat(group.location_latitude),
        lng: parseFloat(group.location_longitude),
        types: session.types || []
      });
    }
  });

  socket.on('invite-user-by-username', async ({ username, groupId, lat, lng, types }) => {
    console.log('📨 Received invite-user-by-username event for:', username);
    console.log(`📤 Sending invite with types:`, types);

    try {
      const target = await db.oneOrNone('SELECT user_id FROM Users WHERE username = $1', [username]);
      if (!target) {
        console.log('❌ No user found with username:', username);
        return;
      }

      const room = `user-${target.user_id}`;
      if (!activeSessions.has(groupId)) {
        activeSessions.set(groupId, { users: new Set(), ready: new Set(), types });
      } else {
        activeSessions.get(groupId).types = types;
      }
      
      
      for (let i = 0; i < 20; i++) {
        const sockets = await io.in(room).fetchSockets();


        if (sockets.length > 0) {
          console.log(`✅ User ${target.user_id} found in room ${room}, sending invite`);
          io.to(room).emit('invite-user-to-session', {
            groupId,
            lat,
            lng,
            types
          });

          return;
        }

        console.log(`⏳ Waiting for ${room} to be ready... Retry ${i + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      console.warn(`❌ Failed to emit to ${room} after retries`);
    } catch (err) {
      console.error('❌ Error in invite-user-by-username:', err);
    }
  });

  socket.on('accept-session-invite', async ({ groupId, userId }) => {
    if (!activeSessions.has(groupId)) {
      activeSessions.set(groupId, { users: new Set(), ready: new Set(), types: [] });
    }

    const session = activeSessions.get(groupId);
    session.users.add(userId);
    session.ready.add(userId);

    if (session.ready.size === session.users.size) {
      console.log(`🚀 Everyone is ready for group ${groupId}, emitting start-swiping`);

      try {
        const group = await db.oneOrNone(
          `SELECT location_latitude, location_longitude FROM Groups WHERE group_id = $1`,
          [groupId]
        );

        if (!group) {
          console.warn('⚠️ Could not find group', groupId);
          return;
        }

        io.to(`group-${groupId}`).emit('start-swiping', {
          lat: group.location_latitude,
          lng: group.location_longitude,
          types: session.types || []
        });

        console.log('✅ Emitted start-swiping to group with coords:', group.location_latitude, group.location_longitude);
      } catch (err) {
        console.error('❌ Error fetching group lat/lng:', err);
      }
    }
  });

  socket.on('user-swipe', async ({ groupId, userId, restaurant }) => {
    try {
      let restaurantId;
      const existing = await db.oneOrNone(
        `SELECT restaurant_id FROM Restaurants WHERE api_restaurant_id = $1`,
        [restaurant.place_id]
      );

      if (existing) {
        restaurantId = existing.restaurant_id;
      } else {
        const newRest = await db.one(
          `INSERT INTO Restaurants (api_restaurant_id, name, address, latitude, longitude, api_data)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING restaurant_id`,
          [
            restaurant.place_id,
            restaurant.name,
            restaurant.address || '',
            restaurant.lat,
            restaurant.lng,
            restaurant
          ]
        );
        restaurantId = newRest.restaurant_id;
      }

      await db.none(
        `INSERT INTO Swipes (group_id, user_id, restaurant_id, swipe_direction)
         VALUES ($1, $2, $3, $4)`,
        [groupId, userId, restaurantId, restaurant.swipeDirection]
      );

      socket.to(`group-${groupId}`).emit('peer-swipe', {
        userId,
        restaurantId,
        direction: restaurant.swipeDirection
      });
    } catch (err) {
      console.error('❌ Error handling swipe:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket ${socket.id} disconnected`);
  });
});


// *****************************************************
// <!-- Section 7 : Start Server -->
// *****************************************************
http.listen(3000, () => console.log('Server listening on port 3000'));