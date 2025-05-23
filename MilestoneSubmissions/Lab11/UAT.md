# User Acceptance Test Plan

## Feature 1: User Registration
### Test Cases
1. **Test Case Name**: Successful Registration  
    - **Test Data**:  
      - Username: `username`  
      - Password: `Password1!`  
    - **User Activity**:  
      - Navigate to the registration page.  
      - Fill in the username and password fields.  
      - Click the "Register" button.  
    - **Expected Results**:  
      - User is redirected to the dashboard.  
      - A success message is displayed: "Registration successful."  

2. **Test Case Name**: Registration with Invalid Credentials  
    - **Test Data**:  
      - Username: `user name`  
      - Password: `password`  
    - **User Activity**:  
      - Navigate to the registration page.  
      - Fill in the invalid username and password fields.  
      - Click the "Register" button.  
    - **Expected Results**:  
      - An error message is displayed: "Please enter a valid username/password."  

### Testers  
- Team members:  
    - Sam Westlake
    - Denys Davidenko
## Test Results
Our team of testers was instructed to register with `username` and `password1!` which both testers successfully completed. Then they attempted to register with the invalid credentials: `user name` and `password` which was unsuccessful, alerting users to the improper syntax.

---

## Feature 2: User Login
### Test Cases

1.  **Test Case Name**: Successful Login
    -   **Test Data**:
        -   Username: `testuser`
        -   Password: `Password1!`
    -   **User Activity**:
        -   Navigate to the login page.
        -   Fill in the username and password fields with valid credentials.
        -   Click the "Login" button.
    -   **Expected Results**:
        -   User is redirected to the dashboard or main app page.
        -   The application indicates the user is logged in (e.g., displays username in the navigation).

2.  **Test Case Name**: Login with Incorrect Password
    -   **Test Data**:
        -   Username: `testuser`
        -   Password: `wrongpassword`
    -   **User Activity**:
        -   Navigate to the login page.
        -   Fill in the username field with `testuser`.
        -   Fill in the password field with `wrongpassword`.
        -   Click the "Login" button.
    -   **Expected Results**:
        -   User remains on the login page.
        -   An error message is displayed: "Invalid username or password."

3.  **Test Case Name**: Login with Non-existent Username
    -   **Test Data**:
        -   Username: `nonexistentuser`
        -   Password: `anypassword`
    -   **User Activity**:
        -   Navigate to the login page.
        -   Fill in the username field with `nonexistentuser`.
        -   Fill in the password field with `anypassword`.
        -   Click the "Login" button.
    -   **Expected Results**:
        -   User remains on the login page.
        -   An error message is displayed: "Invalid username or password."

### Test Environment
-   **Environment**: Localhost / Cloud (Staging environment - if available).
-   **Database**: Test database instance (PostgreSQL) populated with at least one test user.

### Test Data
-   **Users Table**:  Requires at least one pre-registered user for valid login tests.
    -   Username: `testuser`
    -   Password: `Password1!` (Hashed password in the database for `Password1!`)

### Testers
-   Team members:
    - Denys Davidenko
    - Jakob Boro
## Test Results
This team was instructed to login with the username and passwords from the previous test which resulted in a sucessful redirect to the home page. Then they attempted to login with the credentials `testuser` (which is a valid username) and `wrongpassword` (which is incorrect) this appropriately alerted the user and did not redirect. After this the team attempted to login with a non-existance username and password, `nonexistantusername` and `anypassword`, this also alerted the user about thier error and did not redirect.

---

## Feature 3: Create a Group
### Test Cases

1.  **Test Case Name**: Successful Group Creation
    -   **Test Data**:
        -   Logged-in User: `testuser`
        -   Location: Latitude: `34.0522`, Longitude: `-118.2437`
        -   Max Distance: `10`
        -   Excluded Cuisines: `["Fast Food", "American (New)"]`
    -   **User Activity**:
        -   Navigate to the "Create Group" page.
        -   Enter location details.
        -   Set Max Distance to `10`.
        -   Select "Fast Food" and "American (New)" as excluded cuisines.
        -   Click the "Create Group" button.
    -   **Expected Results**:
        -   A new group is created in the database.
        -   User is redirected to the group's page or success page.
        -   A success message is displayed: "Group created successfully."

2.  **Test Case Name**: Group Creation with Missing Location
    -   **Test Data**:
        -   Logged-in User: `testuser`
        -   Location:  *Leave location fields empty*
        -   Max Distance: `5`
        -   Excluded Cuisines: `[]`
    -   **User Activity**:
        -   Navigate to the "Create Group" page.
        -   *Intentionally do not provide location information.*
        -   Set Max Distance and Excluded Cuisines (optional).
        -   Click the "Create Group" button.
    -   **Expected Results**:
        -   Group creation fails.
        -   User remains on the "Create Group" page.
        -   An error message is displayed: "Please select a location for the group."

3.  **Test Case Name**: Group Creation with Invalid Max Distance
    -   **Test Data**:
        -   Logged-in User: `testuser`
        -   Location: Latitude: `40.7128`, Longitude: `-74.0060`
        -   Excluded Cuisines: `[]`
    -   **User Activity**:
        -   Navigate to the "Create Group" page.
        -   Enter location details.
        -   Click the "Create Group" button.
    -   **Expected Results**:
        -   Group creation fails.
        -   User remains on the "Create Group" page.
        -   An error message is displayed: "Please enter a valid positive number for Maximum Distance."

### Test Environment
-   **Environment**: Localhost / Cloud (Staging environment - if available).
-   **Database**: Test database instance (PostgreSQL).

### Test Data
-   **Users Table**: Requires `testuser` to be logged in.
-   **Groups Table**: Should be initially empty or easily verifiable.

### Testers
-   Team members:
    - Quinci Owen
    - Sadie Schwarz
## Test Results
To test the swiping functionality, this group was setup with a logged in test user and instructed to select "Create Group", input "40.7128, -74.0060" as the location, leave the filters as is, and choose a friend of the testuser, both users completed this successfully. Then they were instructed to repeat this without selecting any friends, and again without inputting a location, both of these failed and prompted the user with their respective modals asking for those fields to be filled. 