-- Insert Users
INSERT INTO users (username, email, password_hash) VALUES
('alice', 'alice@example.com', 'hash1'),
('bob', 'bob@example.com', 'hash2'),
('carol', 'carol@example.com', 'hash3'),
('dave', 'dave@example.com', 'hash4'),
('eve', 'eve@example.com', 'hash5'),
('frank', 'frank@example.com', 'hash6'),
('grace', 'grace@example.com', 'hash7'),
('heidi', 'heidi@example.com', 'hash8'),
('ivan', 'ivan@example.com', 'hash9'),
('judy', 'judy@example.com', 'hash10');



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
