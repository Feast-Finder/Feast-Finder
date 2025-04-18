-- Insert Users
INSERT INTO users (username, email, phone, password_hash, active, last_active_at) VALUES
('alice', 'alice@example.com', '123-456-7890', 'hash1', TRUE, NULL),
('bob', 'bob@example.com', '234-567-8901', 'hash2', FALSE, '2025-04-06 14:23:00+00'),
('carol', 'carol@example.com', '345-678-9012', 'hash3', TRUE, NULL),
('dave', 'dave@example.com', '456-789-0123', 'hash4', FALSE, '2025-04-05 09:15:00+00'),
('eve', 'eve@example.com', '567-890-1234', 'hash5', TRUE, NULL),
('frank', 'frank@example.com', '678-901-2345', 'hash6', FALSE, '2025-04-07 17:45:00+00'),
('grace', 'grace@example.com', '789-012-3456', 'hash7', TRUE, NULL),
('heidi', 'heidi@example.com', '890-123-4567', 'hash8', TRUE, NULL),
('ivan', 'ivan@example.com', '901-234-5678', 'hash9', FALSE, '2025-04-03 20:00:00+00'),
('judy', 'judy@example.com', '012-345-6789', 'hash10', TRUE, NULL),
('testuser', 'testuser@example.com', '111-222-3333', '$2a$12$TeXldp3nLYmoot.CufTgiOKl/nyZhR6VEIvP2QXsi7Al9aEC87uSa', TRUE, NULL);

-- Insert Friends
INSERT INTO Friends (user_id_1, user_id_2) VALUES
(1, 2),
(1, 3),
(1, 4),
(2, 3),
(2, 5),
(3, 6),
(4, 5),
(6, 7),
(7, 8),
(9, 10);

-- Insert Groups
INSERT INTO Groups (creator_user_id, location_latitude, location_longitude, max_distance, excluded_cuisines) VALUES
(1, 37.7749, -122.4194, 10, '["Fast Food"]'),
(2, 40.7128, -74.0060, 15, '["Seafood"]'),
(3, 34.0522, -118.2437, 8, '["Mexican"]'),
(4, 41.8781, -87.6298, 12, '["Sushi"]'),
(5, 29.7604, -95.3698, 5, '["Indian"]'),
(6, 39.9526, -75.1652, 20, '["Chinese"]'),
(7, 33.7490, -84.3880, 25, '["Thai"]'),
(8, 47.6062, -122.3321, 7, '["Burgers"]'),
(9, 32.7767, -96.7970, 9, '["Pizza"]'),
(10, 42.3601, -71.0589, 10, '["BBQ"]');

-- Insert GroupMembers
INSERT INTO GroupMembers (group_id, user_id) VALUES
(1, 1), (1, 2), (1, 3),
(2, 2), (2, 4), (2, 5),
(3, 3), (3, 6), (3, 7),
(4, 4), (4, 8), (4, 9),
(5, 5), (5, 10),
(6, 6), (6, 1),
(7, 7), (7, 2),
(8, 8), (8, 3),
(9, 9), (9, 4),
(10, 10), (10, 5);

-- Insert Restaurants
INSERT INTO Restaurants (api_restaurant_id, name, address, latitude, longitude, cuisine, price_range, rating, image_url, api_data) VALUES
('rest1', 'Sushi Zen', '123 Sushi St', 37.7749, -122.4194, 'Sushi', '$$$', 4.6, 'http://example.com/img1.jpg', '{"source": "yelp"}'),
('rest2', 'Pizza Palace', '456 Pizza Ave', 40.7128, -74.0060, 'Pizza', '$$', 4.3, 'http://example.com/img2.jpg', '{"source": "yelp"}'),
('rest3', 'Burger Shack', '789 Burger Rd', 34.0522, -118.2437, 'Burgers', '$$', 4.1, 'http://example.com/img3.jpg', '{"source": "yelp"}'),
('rest4', 'Curry House', '101 Curry Blvd', 41.8781, -87.6298, 'Indian', '$$', 4.7, 'http://example.com/img4.jpg', '{"source": "yelp"}'),
('rest5', 'Taco Town', '202 Taco Ln', 29.7604, -95.3698, 'Mexican', '$', 4.0, 'http://example.com/img5.jpg', '{"source": "yelp"}'),
('rest6', 'Pho Place', '303 Pho Ave', 39.9526, -75.1652, 'Vietnamese', '$$', 4.5, 'http://example.com/img6.jpg', '{"source": "yelp"}'),
('rest7', 'BBQ Joint', '404 BBQ Rd', 33.7490, -84.3880, 'BBQ', '$$', 4.6, 'http://example.com/img7.jpg', '{"source": "yelp"}'),
('rest8', 'Ramen Spot', '505 Ramen St', 47.6062, -122.3321, 'Ramen', '$$', 4.4, 'http://example.com/img8.jpg', '{"source": "yelp"}'),
('rest9', 'Dumpling Den', '606 Dumpling Way', 32.7767, -96.7970, 'Chinese', '$', 4.2, 'http://example.com/img9.jpg', '{"source": "yelp"}'),
('rest10', 'Vegan Vibes', '707 Plant Blvd', 42.3601, -71.0589, 'Vegan', '$$', 4.8, 'http://example.com/img10.jpg', '{"source": "yelp"}');

-- Insert Swipes
INSERT INTO Swipes (group_id, user_id, restaurant_id, swipe_direction) VALUES
(1, 1, 1, 'right'), (1, 2, 1, 'right'), (1, 3, 1, 'left'),
(2, 2, 2, 'right'), (2, 4, 2, 'right'), (2, 5, 2, 'right'),
(3, 3, 3, 'left'), (3, 6, 3, 'right'), (3, 7, 3, 'left'),
(4, 4, 4, 'right'), (4, 8, 4, 'right'), (4, 9, 4, 'right'),
(5, 5, 5, 'left'), (5, 10, 5, 'left');

-- Insert Matches (based on majority 'right' swipes)
INSERT INTO Matches (group_id, restaurant_id) VALUES
(1, 1),
(2, 2),
(4, 4),
(6, 6),
(7, 7),
(8, 8),
(9, 9),
(10, 10),
(3, 6),  
(5, 8);  

-- Insert User Preferences
INSERT INTO user_preferences (user_id, cuisines, dietary, price_range) VALUES
(1, ARRAY['italian', 'mexican'], ARRAY['vegetarian'], '$$'),
(2, ARRAY['chinese', 'thai'], ARRAY['glutenFree'], '$'),
(3, ARRAY['indian', 'fastfood'], ARRAY['vegan'], '$$$'),
(4, ARRAY['mexican', 'thai'], ARRAY[]::TEXT[], '$'),
(5, ARRAY['italian', 'fastfood', 'chinese'], ARRAY['glutenFree', 'vegan'], '$$'),
(6, ARRAY['indian'], ARRAY['vegetarian'], '$$$'),
(7, ARRAY['thai', 'mexican'], ARRAY[]::TEXT[], '$'),
(8, ARRAY['chinese', 'italian'], ARRAY['vegan'], '$$'),
(9, ARRAY['fastfood'], ARRAY['glutenFree'], '$'),
(10, ARRAY['italian', 'indian', 'thai'], ARRAY[]::TEXT[], '$$$');

-- Add default preferences for the test user as well
INSERT INTO user_preferences (user_id, cuisines, dietary, price_range)
SELECT user_id, ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'any'
FROM users WHERE username = 'testuser'
ON CONFLICT (user_id) DO NOTHING;
