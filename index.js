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
const moment = require('moment');
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
Handlebars.registerHelper('formatDate', function (datetime, format) {
  return datetime ? moment(datetime).format(format) : '';
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
  const { username, password, confirmPassword, email, phone } = req.body;

  if (password !== confirmPassword) {
    return res.render('Pages/register', { message: 'Passwords do not match' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    // Insert new user
    const newUser = await db.one(`
      INSERT INTO Users (username, password_hash, email, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [username, hash, email || null, phone || null]);

    // Insert into user_preferences with default blank values
    await db.none(`
      INSERT INTO user_preferences (user_id, cuisines, dietary, price_range)
      VALUES ($1, ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'any')
    `, [newUser.user_id]);

    // Set session and mark active
    req.session.user = newUser;

    await db.none(`
      UPDATE Users SET active = TRUE, last_active_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `, [newUser.user_id]);

    req.session.save(() => res.redirect('/home'));
  } catch (err) {
    console.error(err);
    res.render('Pages/register', { message: 'Registration failed. Username/email might already be taken.' });
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


app.get('/profile', async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser) return res.redirect('/login');

    const userId = currentUser.user_id;

    const user = await db.oneOrNone(`SELECT * FROM users WHERE user_id = $1`, [userId]);
    const preferences = await db.oneOrNone(`SELECT * FROM user_preferences WHERE user_id = $1`, [userId]);

    const userHistory = await db.any(`
      SELECT h.*, r.name AS restaurant_name
      FROM UserMatchHistory h
      JOIN Restaurants r ON h.restaurant_id = r.restaurant_id
      WHERE h.user_id = $1
      ORDER BY h.matched_at DESC
      LIMIT 10
    `, [userId]);


    const matchStats = await db.one(`
      SELECT COUNT(*) AS total
      FROM UserMatchHistory
      WHERE user_id = $1 AND matched_with != 'Solo'
    `, [userId]);

    const topFriends = await db.any(`
      SELECT matched_with, COUNT(*) as count
      FROM UserMatchHistory
      WHERE user_id = $1 AND matched_with != 'Solo'
      GROUP BY matched_with
      ORDER BY count DESC
      LIMIT 3
    `, [userId]);
    const timelineData = await db.any(`
      SELECT h.*, r.name
      FROM UserMatchHistory h
      JOIN Restaurants r ON h.restaurant_id = r.restaurant_id
      WHERE h.user_id = $1
      ORDER BY h.matched_at DESC
      LIMIT 10
    `, [userId]);



    res.render('Pages/Profile', {
      user: currentUser,
      history: userHistory,
      matchStats,
      topFriends,
      timelineData // 👈 add this
    });

  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).send('Server error');
  }
});


app.get('/friends', async (req, res) => {
  try {
    const userId = req.session.user.user_id;

    const friendsList = await db.any(`

      SELECT u.user_id, u.username, u.email, u.created_at, u.active, u.profile_picture_url
      FROM Users u
      JOIN Friends f ON (u.user_id = f.user_id_1 OR u.user_id = f.user_id_2)
      WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
        AND u.user_id != $1
    `, [userId]);


    const recentMatches = await db.any(`
      SELECT h.matched_with, h.group_name, h.matched_at, r.name AS restaurant_name
      FROM UserMatchHistory h
      JOIN Restaurants r ON r.restaurant_id = h.restaurant_id
      WHERE h.user_id = $1
      ORDER BY h.matched_at DESC
      LIMIT 5
    `, [userId]);

    res.render('Pages/friends', {
      friends: friendsList,
      matches: recentMatches
    });

  } catch (error) {
    console.error('Error fetching friends or match history:', error);
    res.render('Pages/friends', {
      error: 'Failed to load friends or match history'
    });
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
        u.profile_picture_url,
        EXISTS (
          SELECT 1 FROM Friends 
          WHERE 
            (user_id_1 = $1 AND user_id_2 = u.user_id) OR 
            (user_id_2 = $1 AND user_id_1 = u.user_id)
        ) AS is_friend

      FROM Users u
      WHERE u.user_id != $1
        AND (
          LOWER(u.username) LIKE LOWER($2)
          OR LOWER(u.email) LIKE LOWER($2)
          OR u.phone LIKE $2
        )

    `, [currentUserId, `%${searchQuery}%`]);

    res.json(users);
  } catch (err) {
    console.error('Error in /search-users:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/users/:userid', async (req, res) => {
  const targetUserId = parseInt(req.params.userid);
  const currentUserId = req.session.user?.user_id;

  if (!currentUserId || !targetUserId) {
    return res.status(400).json({ error: 'Invalid user IDs' });
  }

  try {

    const user = await db.oneOrNone(`
      SELECT u.user_id, u.username, u.active, u.last_active_at, u.profile_picture_url,
             p.cuisines, p.dietary, p.price_range
      FROM users u
      LEFT JOIN user_preferences p ON u.user_id = p.user_id
      WHERE u.user_id = $1
    `, [targetUserId]);


    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mutualFriends = await db.one(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT CASE 
                 WHEN f.user_id_1 = $1 THEN f.user_id_2 
                 ELSE f.user_id_1 
               END AS friend
        FROM Friends f
        WHERE $1 IN (f.user_id_1, f.user_id_2)
      ) AS current_friends
      INNER JOIN (
        SELECT CASE 
                 WHEN f.user_id_1 = $2 THEN f.user_id_2 
                 ELSE f.user_id_1 
               END AS friend
        FROM Friends f
        WHERE $2 IN (f.user_id_1, f.user_id_2)
      ) AS target_friends
      ON current_friends.friend = target_friends.friend
    `, [currentUserId, targetUserId]);

    user.mutual_friends_count = parseInt(mutualFriends.count, 10);

    res.json(user);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.delete('/profile/delete', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    const userId = req.session.user.user_id;

    // Delete user from the database
    await db.none('DELETE FROM Users WHERE user_id = $1', [userId]);

    // Optionally: delete any related data (FK ON DELETE CASCADE can help)
    req.session.destroy(); // Clear the session

    res.json({ success: true });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: 'Something went wrong while deleting your account.' });
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




const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const busboy = require('busboy');

app.post('/profile/upload', (req, res) => {
  const userId = req.session.user?.user_id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const bb = busboy({ headers: req.headers });

  let filePath = '';
  let fileName = '';
  let oldPictureUrl = '';

  // 1. Get existing profile picture
  db.oneOrNone('SELECT profile_picture_url FROM users WHERE user_id = $1', [userId])
    .then(user => {
      oldPictureUrl = user?.profile_picture_url || '';

      bb.on('file', (name, file, info) => {
        const { filename, mimeType } = info;
        const ext = path.extname(filename);
        fileName = `${uuidv4()}${ext}`;
        filePath = path.join(__dirname, 'public', 'uploads', fileName);

        const writeStream = fs.createWriteStream(filePath);
        file.pipe(writeStream);
      });

      bb.on('finish', async () => {
        try {
          const dbPath = `/uploads/${fileName}`;
          await db.none('UPDATE users SET profile_picture_url = $1 WHERE user_id = $2', [dbPath, userId]);

          // 2. Delete old picture from filesystem
          if (oldPictureUrl && oldPictureUrl.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, 'public', oldPictureUrl);
            fs.unlink(oldPath, err => {
              if (err && err.code !== 'ENOENT') console.error('Error deleting old image:', err);
            });
          }

          res.json({ profile_picture_url: dbPath });
        } catch (err) {
          console.error('Upload error:', err);
          res.status(500).json({ error: 'Failed to upload image' });
        }
      });

      req.pipe(bb);
    })
    .catch(err => {
      console.error('DB error:', err);
      res.status(500).json({ error: 'Failed to check old image' });
    });
});

app.get('/profile/match-stats', async (req, res) => {
  const userId = req.session.user?.user_id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const stats = await db.one(`
      SELECT 
        COUNT(*) AS total_matches,
        COUNT(*) FILTER (WHERE group_name IS NULL) AS solo_matches,
        COUNT(*) FILTER (WHERE group_name IS NOT NULL) AS group_matches,
        MAX(matched_at) AS last_matched
      FROM UserMatchHistory
      WHERE user_id = $1
    `, [userId]);

    res.json(stats);
  } catch (err) {
    console.error('Error fetching match stats:', err);
    res.status(500).json({ error: 'Failed to fetch match stats' });
  }
});


app.post('/profile/update', async (req, res) => {
  const { email, phone, currentPassword, newPassword, confirmNewPassword } = req.body;
  const userId = req.session.user?.user_id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Validate phone format if provided
    if (phone && !/^\+?\d{10,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Start update payload
    const updates = [];
    const values = [];
    let idx = 1;

    if (email) {
      updates.push(`email = $${idx++}`);
      values.push(email);
    }

    if (phone) {
      updates.push(`phone = $${idx++}`);
      values.push(phone);
    }

    // If user is trying to change password
    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ error: 'All password fields are required to change your password' });
      }

      if (newPassword === currentPassword) {
        return res.status(400).json({ error: 'New password must be different from current password' });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      // Fetch current hashed password
      const existing = await db.one('SELECT hashed_password FROM users WHERE user_id = $1', [userId]);
      const match = await bcrypt.compare(currentPassword, existing.hashed_password);

      if (!match) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      updates.push(`hashed_password = $${idx++}`);
      values.push(hashed);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    values.push(userId);
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx}`;
    await db.none(updateQuery, values);

    res.json({ success: true });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Server error' });
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
    await pubClient.set(`activeGroup:${currentUserId}`, groupId); 
    await pubClient.hset(`invitePending:${target}`, groupId, JSON.stringify({ groupId, lat, lng, types }));
    await pubClient.hset(pendingNotifiesKey, groupId, currentUserId);
    await pubClient.hset('groupInvitees', groupId, target);

    for (let i = 0; i < 20; i++) {
      const sockets = await io.in(`user-${target}`).fetchSockets();
      if (sockets.length > 0) {
        console.log(`✅ Found socket for user-${target}, sending invite`);
        io.to(`user-${target}`).emit('invite-user-to-session', {
          groupId, // ✅ lowercase
          lat,
          lng,
          types,
          senderId: currentUserId // optional
        });
        
        return;
      }
      await new Promise(res => setTimeout(res, 250));
    }
   
await pubClient.set(`activeGroup:${currentUserId}`, groupId);

  });

  socket.on('join-session', async (payload) => {
    const groupId = payload.groupId;
    const userId = payload.userId;
  
    if (!groupId || !userId) {
      console.error('❌ Missing groupId or userId in join-session');
      return;
    }
  
    if (!activeGroups.has(groupId)) activeGroups.set(groupId, new Set());
    activeGroups.get(groupId).add(userId);
    socket.join(`group-${groupId}`);
  
    try {
      await pubClient.set(`activeGroup:${userId}`, groupId);
      console.log(`✅ Stored active group for user ${userId}: ${groupId}`);
    } catch (err) {
      console.error('❌ Failed to store active group in Redis:', err);
    }
  });
  

  socket.on('accept-session-invite', async ({ groupId, userId }) => {
    if (!activeSessions.has(groupId)) {
      activeSessions.set(groupId, { users: new Set(), ready: new Set(), types: [] });
    }
    const session = activeSessions.get(groupId);
    session.users.add(userId);
    session.ready.add(userId);
// Add user to GroupMembers table if not already present
await db.none(`
  INSERT INTO groupmembers (group_id, user_id)
  VALUES ($1, $2)
  ON CONFLICT (group_id, user_id) DO NOTHING
`, [groupId, userId]);

    await pubClient.hset(`${groupId}:accepted`, userId, 'true');

    const senderId = await pubClient.hget(pendingNotifiesKey, groupId);
    if (senderId) {
      const senderSocketId = await pubClient.hget(connectedUsersKey, senderId);
      if (senderSocketId) io.to(senderSocketId).emit('friend-accepted-invite');
    }

    io.to(`group-${groupId}`).emit('friend-accepted-invite');
    await pubClient.hdel(`invitePending:${userId}`, groupId);
  });

  socket.on('disconnect', () => {
    pubClient.hdel(connectedUsersKey, currentUserId);
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
    await db.none('DELETE FROM swipes WHERE group_id = $1', [groupId]);
  });
});
async function getPhotoUrlFromDBOrPlaces(place_id) {
  try {
    const result = await db.oneOrNone(
      `SELECT image_url FROM restaurants WHERE api_restaurant_id = $1`,
      [place_id]
    );

    if (result?.image_url) {
      return result.image_url;
    } else {
      return 'https://via.placeholder.com/800x600?text=Restaurant+Image';
    }
  } catch (err) {
    console.error('❌ Error fetching image_url from DB:', err);
    return 'https://via.placeholder.com/800x600?text=Restaurant+Image';
  }
}




app.post('/restaurants/vote', async (req, res) => {
  const { groupId, place_id, restaurant_name, liked } = req.body;
  const user_id = req.session.user?.user_id;

  console.log('🚨 Incoming vote payload:', req.body);

  if (!user_id || !groupId || !place_id) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    // Step 1: Get or insert restaurant
    let restaurant = await db.oneOrNone(`
      SELECT restaurant_id FROM restaurants WHERE api_restaurant_id = $1
    `, [place_id]);

    if (!restaurant) {
      // Insert minimal info if it doesn't exist
      await db.none(`
        INSERT INTO restaurants (api_restaurant_id, name, latitude, longitude)
        VALUES ($1, $2, 0, 0)
        ON CONFLICT (api_restaurant_id) DO NOTHING
      `, [place_id, restaurant_name]);
      
      restaurant = await db.one(`
        SELECT restaurant_id FROM restaurants WHERE api_restaurant_id = $1
      `, [place_id]);
      
    }

    const restaurant_id = restaurant.restaurant_id;

    // Step 2: Save or update the swipe
    await db.none(`
      INSERT INTO swipes (group_id, user_id, restaurant_id, swipe_direction)
      VALUES ($1, $2, $3, 'right')
      ON CONFLICT (group_id, user_id, restaurant_id) DO UPDATE SET swipe_direction = 'right'
    `, [groupId, user_id, restaurant_id]);

    // Step 3: Only check for match if user liked it
    if (liked) {
      const { count } = await db.one(`
        SELECT COUNT(DISTINCT user_id) FROM swipes
        WHERE group_id = $1 AND restaurant_id = $2 AND swipe_direction = 'right'
      `, [groupId, restaurant_id]);
      const groupMembers = await db.any(`
        SELECT * FROM groupmembers WHERE group_id = $1
      `, [groupId]);
      
      console.log(`👥 Raw group members for group ${groupId}:`, groupMembers);
      
      const { total } = await db.one(`
        SELECT COUNT(*) AS total FROM groupmembers WHERE group_id = $1
      `, [groupId]);
      
      
      console.log('🧮 Match check — count of likes:', count, 'group total members:', total);

      if (parseInt(count) === parseInt(total)) {
        console.log(`✅ Match found in group ${groupId} for ${restaurant_name}`);

        const photoUrl = await getPhotoUrlFromDBOrPlaces(place_id);

        // Clean up swipes after match
        await db.none(`DELETE FROM swipes WHERE group_id = $1`, [groupId]);

// 1. Emit to entire group (still useful if swiping in sync)
io.to(`group-${groupId}`).emit('match-found', {
  restaurant: {
    place_id,
    restaurant_name,
    photoUrl: photoUrl || null,
  }
});

// 2. Also send directly to each user socket in the group
const members = await db.any(`
  SELECT user_id FROM groupmembers WHERE group_id = $1
`, [groupId]);

for (const member of members) {
  const socketId = await pubClient.hget('connectedUsers', member.user_id);
  if (socketId) {
    io.to(socketId).emit('match-found', {
      restaurant: {
        place_id,
        restaurant_name,
        photoUrl: photoUrl || null,
      }
    });
  }
}


        return res.json({ success: true, isMatch: true, restaurant: { place_id, restaurant_name, photoUrl } });
      }
    }

    res.json({ success: true, isMatch: false });

  } catch (err) {
    console.error('❌ Error in /restaurants/vote:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Example route to get groupId for a sender
app.get('/session/group-for-sender', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ success: false });

  try {
    const groupId = await pubClient.get(`activeGroup:${userId}`);
    if (!groupId) return res.json({ success: false });

    res.json({ success: true, groupId });
  } catch (err) {
    console.error('Error fetching group for sender:', err);
    res.status(500).json({ success: false });
  }
});




  



// *****************************************************
// <!-- Section 7 : Start Server -->
// *****************************************************
http.listen(3000, () => console.log('Server listening on port 3000'));