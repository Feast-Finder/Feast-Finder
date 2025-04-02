CREATE TABLE swipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    swipe_action ENUM('like', 'dislike') NOT NULL,
    swiped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
