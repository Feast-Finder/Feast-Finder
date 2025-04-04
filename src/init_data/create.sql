-- Create the ENUM type for swipe direction
CREATE TYPE swipe_direction_enum AS ENUM ('left', 'right');

-- 1. Users Table
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255), -- LATER IMPLEMENT HASHING bcrypt or argon
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE Users IS 'Stores information about users of the Feast Finder app.';
COMMENT ON COLUMN Users.user_id IS 'Unique identifier for each user.';
COMMENT ON COLUMN Users.username IS 'Username for login and display.';
COMMENT ON COLUMN Users.email IS 'User''s email address (optional).';
COMMENT ON COLUMN Users.password_hash IS 'Hashed password for secure authentication.';
COMMENT ON COLUMN Users.created_at IS 'Timestamp when the user account was created.';
COMMENT ON COLUMN Users.location_latitude IS 'User''s current latitude.';
COMMENT ON COLUMN Users.location_longitude IS 'User''s current longitude.';

-- 2. Friends Table
CREATE TABLE Friends (
    friendship_id SERIAL PRIMARY KEY,
    user_id_1 INTEGER NOT NULL,
    user_id_2 INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id_1, user_id_2), -- Prevent duplicate friendships
    FOREIGN KEY (user_id_1) REFERENCES Users(user_id),
    FOREIGN KEY (user_id_2) REFERENCES Users(user_id),
    CHECK (user_id_1 < user_id_2)
);

COMMENT ON TABLE Friends IS 'Manages friend relationships between users.';
COMMENT ON COLUMN Friends.friendship_id IS 'Unique identifier for each friendship.';
COMMENT ON COLUMN Friends.user_id_1 IS 'ID of one user in the friendship.';
COMMENT ON COLUMN Friends.user_id_2 IS 'ID of the other user in the friendship.';
COMMENT ON COLUMN Friends.created_at IS 'Timestamp when the friendship was established.';

-- Index for Friends table (for efficient friend lookups)
CREATE INDEX idx_friends_user_id_1 ON Friends (user_id_1);
CREATE INDEX idx_friends_user_id_2 ON Friends (user_id_2);

-- 3. Groups Table
CREATE TABLE Groups (
    group_id SERIAL PRIMARY KEY,
    creator_user_id INTEGER NOT NULL,
    location_latitude DECIMAL(10, 6) NOT NULL,
    location_longitude DECIMAL(10, 6) NOT NULL,
    max_distance INTEGER, -- Distance in miles or kilometers (specify in application logic)
    excluded_cuisines JSONB, -- Using JSONB for efficient querying
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_user_id) REFERENCES Users(user_id)
);

COMMENT ON TABLE Groups IS 'Stores information about each group created for finding a restaurant.';
COMMENT ON COLUMN Groups.group_id IS 'Unique identifier for each group.';
COMMENT ON COLUMN Groups.creator_user_id IS 'ID of the user who created the group.';
COMMENT ON COLUMN Groups.location_latitude IS 'Latitude of the location set for the group.';
COMMENT ON COLUMN Groups.location_longitude IS 'Longitude of the location set for the group.';
COMMENT ON COLUMN Groups.max_distance IS 'Maximum distance filter selected by the group creator (in miles or kilometers).';
COMMENT ON COLUMN Groups.excluded_cuisines IS 'List of excluded cuisines in JSON format.';
COMMENT ON COLUMN Groups.created_at IS 'Timestamp when the group was created.';

-- Index for Groups table
CREATE INDEX idx_groups_creator_user_id ON Groups (creator_user_id);

-- 4. GroupMembers Table
CREATE TABLE GroupMembers (
    group_member_id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_id, user_id), -- Ensure a user can't be added to the same group multiple times
    FOREIGN KEY (group_id) REFERENCES Groups(group_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

COMMENT ON TABLE GroupMembers IS 'Tracks which users are participating in which group.';
COMMENT ON COLUMN GroupMembers.group_member_id IS 'Unique identifier for each group membership record.';
COMMENT ON COLUMN GroupMembers.group_id IS 'ID of the group.';
COMMENT ON COLUMN GroupMembers.user_id IS 'ID of the user in the group.';
COMMENT ON COLUMN GroupMembers.joined_at IS 'Timestamp when the user joined the group.';

-- Indexes for GroupMembers table
CREATE INDEX idx_group_members_group_id ON GroupMembers (group_id);
CREATE INDEX idx_group_members_user_id ON GroupMembers (user_id);

-- 5. Restaurants Table
CREATE TABLE Restaurants (
    restaurant_id SERIAL PRIMARY KEY,
    api_restaurant_id VARCHAR(255) UNIQUE NOT NULL, -- Unique ID from the API (Yelp, Google Places)
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    cuisine VARCHAR(255),
    price_range VARCHAR(50),
    rating DECIMAL(3, 2),
    image_url TEXT,
    api_data JSONB -- Store the entire API response or relevant parts in JSONB for flexibility
);

COMMENT ON TABLE Restaurants IS 'Stores restaurant information fetched from the API.';
COMMENT ON COLUMN Restaurants.restaurant_id IS 'Unique identifier for each restaurant in our database.';
COMMENT ON COLUMN Restaurants.api_restaurant_id IS 'Unique identifier for the restaurant from the API (e.g., Yelp ID).';
COMMENT ON COLUMN Restaurants.name IS 'Name of the restaurant.';
COMMENT ON COLUMN Restaurants.address IS 'Full address of the restaurant.';
COMMENT ON COLUMN Restaurants.latitude IS 'Latitude of the restaurant.';
COMMENT ON COLUMN Restaurants.longitude IS 'Longitude of the restaurant.';
COMMENT ON COLUMN Restaurants.cuisine IS 'Cuisine category of the restaurant (based on API categories).';
COMMENT ON COLUMN Restaurants.price_range IS 'Price range (e.g., "$", "$$", "$$$").';
COMMENT ON COLUMN Restaurants.rating IS 'Restaurant rating from the API.';
COMMENT ON COLUMN Restaurants.image_url IS 'URL of the restaurant''s image.';
COMMENT ON COLUMN Restaurants.api_data IS 'Stores the entire JSON response (or relevant parts) from the API for this restaurant.';

-- Index for Restaurants table (for quick lookups by API ID)
CREATE INDEX idx_restaurants_api_restaurant_id ON Restaurants (api_restaurant_id);

-- 6. Swipes Table
CREATE TABLE Swipes (
    swipe_id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    swipe_direction swipe_direction_enum NOT NULL,
    swiped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES Groups(group_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id)
);

COMMENT ON TABLE Swipes IS 'Records user swipes on restaurants within a group.';
COMMENT ON COLUMN Swipes.swipe_id IS 'Unique identifier for each swipe.';
COMMENT ON COLUMN Swipes.group_id IS 'ID of the group in which the swipe occurred.';
COMMENT ON COLUMN Swipes.user_id IS 'ID of the user who swiped.';
COMMENT ON COLUMN Swipes.restaurant_id IS 'ID of the restaurant that was swiped on.';
COMMENT ON COLUMN Swipes.swipe_direction IS 'Direction of the swipe (left or right).';
COMMENT ON COLUMN Swipes.swiped_at IS 'Timestamp when the swipe was made.';

-- Indexes for Swipes table
CREATE INDEX idx_swipes_group_id ON Swipes (group_id);
CREATE INDEX idx_swipes_user_id ON Swipes (user_id);
CREATE INDEX idx_swipes_restaurant_id ON Swipes (restaurant_id);

-- 7. Matches Table
CREATE TABLE Matches (
    match_id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES Groups(group_id),
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id)
);

COMMENT ON TABLE Matches IS 'Records when a group successfully matches with a restaurant.';
COMMENT ON COLUMN Matches.match_id IS 'Unique identifier for each match.';
COMMENT ON COLUMN Matches.group_id IS 'ID of the group that matched.';
COMMENT ON COLUMN Matches.restaurant_id IS 'ID of the matched restaurant.';
COMMENT ON COLUMN Matches.matched_at IS 'Timestamp when the match was determined.';

-- Indexes for Matches table
CREATE INDEX idx_matches_group_id ON Matches (group_id);
CREATE INDEX idx_matches_restaurant_id ON Matches (restaurant_id);
--Below: Tentative for possible being able to display a user's most favorited restaurant. 
-- -- 8. UserSwipeAggregates Table
-- CREATE TABLE IF NOT EXISTS UserSwipeAggregates (
--     aggregate_id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL,
--     restaurant_id INTEGER NOT NULL,
--     left_swipe_count INTEGER DEFAULT 0,
--     right_swipe_count INTEGER DEFAULT 0,
--     last_swiped_at TIMESTAMP WITH TIME ZONE,
--     UNIQUE (user_id, restaurant_id), -- Ensure a single aggregate record per user/restaurant
--     FOREIGN KEY (user_id) REFERENCES Users(user_id),
--     FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id)
-- );

-- COMMENT ON TABLE UserSwipeAggregates IS 'Stores aggregated swipe data per user for each restaurant.';
-- COMMENT ON COLUMN UserSwipeAggregates.aggregate_id IS 'Unique identifier for the swipe aggregate record.';
-- COMMENT ON COLUMN UserSwipeAggregates.user_id IS 'ID of the user who swiped.';
-- COMMENT ON COLUMN UserSwipeAggregates.restaurant_id IS 'ID of the restaurant that was swiped on.';
-- COMMENT ON COLUMN UserSwipeAggregates.left_swipe_count IS 'Number of left swipes by the user for this restaurant.';
-- COMMENT ON COLUMN UserSwipeAggregates.right_swipe_count IS 'Number of right swipes by the user for this restaurant.';
-- COMMENT ON COLUMN UserSwipeAggregates.last_swiped_at IS 'Timestamp of the most recent swipe.';
