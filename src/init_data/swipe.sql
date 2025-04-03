/*
CREATE TABLE swipes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    swipe_action swipe_direction_enum NOT NULL,
    swiped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/