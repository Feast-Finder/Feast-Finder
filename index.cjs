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
  if (req.session.user) {
    res.locals.user = req.session.user;
  }
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
    const user = await db.oneOrNone(`SELECT * FROM users WHERE username = $1`, [req.body.username]);
    res.json({ exists: !!user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/register', async (req, res) => {
  if (req.body.password !== req.body.confirmPassword) {
    return res.render('Pages/register', { message: 'Passwords do not match' });
  }
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.none(`INSERT INTO users (username, password_hash) VALUES ($1, $2)`, [req.body.username, hash]);
    req.session.user = req.body.username;
    req.session.save(() => res.redirect('/login'));
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await db.oneOrNone(`SELECT * FROM users WHERE username = $1`, [req.body.username]);
    if (!user) return res.render('Pages/login', { message: 'User not found. <a href="/register">Create one</a>' });

    const match = await bcrypt.compare(req.body.password, user.password_hash);
    if (!match) return res.render('Pages/login', { message: 'Incorrect password.' });

    // Set session user
    req.session.user = user;

    // Mark user as active and set last active time 
    await db.none(`
      UPDATE users SET active = TRUE, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1
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
  res.json({ status: 'success', message: 'Welcome!' });
});
//identical to register route but used for testing for lab 11 
app.post('/register_test', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.none(`INSERT INTO users (username, password_hash) VALUES ($1, $2)`, [req.body.username, hash]);
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
      SELECT u.user_id, u.username FROM users u
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
      FROM users u
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
      FROM users u
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
    const currentUserId = req.session.user?.user_id;
    // ID of the current user (inviter)
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
      FROM users u
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
      `SELECT user_id, username, email, created_at, active, last_active_at FROM users WHERE user_id = $1`,
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
      await db.none(`UPDATE users SET profile_picture_url = $1 WHERE user_id = $2`, [filePath, userId]);
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
    const user = await db.oneOrNone(`SELECT * FROM users WHERE user_id = $1`, [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 1. Update email (if changed)
    if (email && email !== user.email) {
      await db.none(`UPDATE users SET email = $1 WHERE user_id = $2`, [email, userId]);
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
      await db.none(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [hashed, userId]);
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
        UPDATE users SET active = FALSE, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1
      `, [userId]);

    }

    req.session.destroy(() => res.redirect('/login'));
  } catch (err) {
    console.error('Error logging out:', err);
    res.redirect('/login');
  }
});

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

app.get('/debug-sockets', async (req, res) => {
  const sockets = await pubClient.hgetall(connectedUsersKey);
  res.json(sockets);
});

app.get('/session/status', async (req, res) => {
  const { groupId } = req.query;
  if (!groupId) return res.status(400).json({ error: 'Missing groupId' });

  try {
    const accepted = await pubClient.hgetall(`${groupId}:accepted`);
    res.json({ accepted: Object.keys(accepted).length > 0 });
  } catch (err) {
    console.error('Error checking session status:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// *****************************************************
// <!-- Section 6 : Socket.IO Real-Time Sync Logic -->
// *****************************************************

const connectedUsersKey = 'connectedUsers';
const pendingNotifiesKey = 'pendingNotifies';


const readyForInvite = new Set();
const activeGroups = new Map();

io.on('connection', (socket) => {
  let currentUserId = null;

  socket.on('register-user', async ({ userId }) => {
    currentUserId = userId;
    await pubClient.hset(connectedUsersKey, userId, socket.id);
    socket.join(`user-${userId}`);
  
    try {
      const user = await db.one('SELECT username FROM users WHERE user_id = $1', [userId]);
      await pubClient.hset('usernamesToIds', user.username, userId);
    } catch (err) {
      console.error('Failed to cache username in Redis:', err);
    }
    const [pendingInvite, cancelled] = await Promise.all([
      pubClient.hgetall(`invitePending:${userId}`),
      pubClient.hgetall(`inviteCancelled:${userId}`)
    ]);

    for (const [groupId, raw] of Object.entries(pendingInvite)) {
      if (cancelled && cancelled[groupId]) {
        await pubClient.hdel(`invitePending:${userId}`, groupId);
        continue;
      }
      const payload = JSON.parse(raw);
      io.to(socket.id).emit('invite-user-to-session', payload);
    }

    for (const groupId of Object.keys(cancelled)) {
      io.to(socket.id).emit('swipe-session-cancelled', { groupId });
      await pubClient.hdel(`inviteCancelled:${userId}`, groupId);
    }
  });

  socket.on('ready-for-invites', ({ userId }) => {
    readyForInvite.add(userId);
  });

  socket.on('invite-user-by-username', async ({ username, groupId, lat, lng, types }) => {
    const target = await pubClient.hget('usernamesToIds', username);
    if (!target) return;

    await pubClient.hset(`invitePending:${target}`, groupId, JSON.stringify({ groupId, lat, lng, types }));
    await pubClient.hset(pendingNotifiesKey, groupId, currentUserId);
    await pubClient.hset('groupInvitees', groupId, target);

    for (let i = 0; i < 20; i++) {
      const sockets = await io.in(`user-${target}`).fetchSockets();
      if (sockets.length > 0) {
        console.log(`✅ Found socket for user-${target}, sending invite`);
        io.to(`user-${target}`).emit('invite-user-to-session', { groupId, lat, lng, types });
        return;
      }
      await new Promise(res => setTimeout(res, 250));
    }
  });

  socket.on('join-session', ({ groupId, userId }) => {
    if (!activeGroups.has(groupId)) activeGroups.set(groupId, new Set());
    activeGroups.get(groupId).add(userId);
    socket.join(`group-${groupId}`);
  });

  socket.on('accept-session-invite', async ({ groupId, userId }) => {
    if (!activeSessions.has(groupId)) {
      activeSessions.set(groupId, { users: new Set(), ready: new Set(), types: [] });
    }
    const session = activeSessions.get(groupId);
    session.users.add(userId);
    session.ready.add(userId);

    await pubClient.hset(`${groupId}:accepted`, userId, 'true');

    const senderId = await pubClient.hget(pendingNotifiesKey, groupId);
    if (senderId) {
      const senderSocketId = await pubClient.hget(connectedUsersKey, senderId);
      if (senderSocketId) io.to(senderSocketId).emit('friend-accepted-invite');
    }

    io.to(`group-${groupId}`).emit('friend-accepted-invite');
    await pubClient.hdel(`invitePending:${userId}`, groupId);
  });

  socket.on('ready-to-swipe', async ({ groupId, userId, lat, lng, types }) => {
    if (!activeSessions.has(groupId)) {
      activeSessions.set(groupId, { users: new Set(), ready: new Set(), types });
    }
    const session = activeSessions.get(groupId);
    session.users.add(userId);
    session.ready.add(userId);

    if (session.users.size === session.ready.size) {
      io.to(`group-${groupId}`).emit('start-swiping', { lat, lng, types });
      await pubClient.del(`${groupId}:accepted`);
      await pubClient.hdel(pendingNotifiesKey, groupId);
    }
  });

  socket.on('cancel-swipe-session', async ({ groupId, userId }) => {
    await pubClient.sadd('cancelledGroups', groupId);
    io.to(socket.id).emit('cancel-ack', { groupId });

    const inviteeId = await pubClient.hget('groupInvitees', groupId);
    if (inviteeId) {
      const inviteeSocketId = await pubClient.hget('connectedUsers', inviteeId);
      console.log('🧹 Cancel logic triggered for group:', groupId);
      console.log('🔗 Invitee ID:', inviteeId);
      console.log('📡 Invitee socket ID:', inviteeSocketId);
      if (inviteeSocketId) {
        io.to(inviteeSocketId).emit('swipe-session-cancelled', { groupId });
      }
    }

    
    await pubClient.hdel(`invitePending:${inviteeId}`, groupId); // not userId
    await pubClient.hdel(`inviteCancelled:${inviteeId}`, groupId);
    await pubClient.del(`${groupId}:accepted`);
    await pubClient.del(`groupInvitees:${groupId}`);
    
  });
});


// *****************************************************
// <!-- Section 7 : Start Server -->
// *****************************************************
http.listen(3000, () => console.log('Server listening on port 3000'));