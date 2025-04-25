const chai = require('chai');
const chaiHttp = require('chai-http');
const { app, server } = require('../index'); // Import your app
const { URL } = require('url'); // Add URL require at the top

chai.use(chaiHttp);
const expect = chai.expect;

// Use an agent to persist cookies across requests
const agent = chai.request.agent(app);

// --- Credentials ---
const TEST_USERNAME = 'testuser';
const TEST_PASSWORD = 'testpassword';
const TEST_USER_EMAIL = 'testuser@example.com';
const TEST_USERNAME_2 = 'testuser2';
const TEST_PASSWORD_2 = 'testpassword2';
const TEST_USER_EMAIL_2 = 'testuser2@example.com';
let testUserId = null; // To store the logged-in user's ID
let testUserId2 = null; // To store the second user's ID

const LOGIN_ROUTE = '/login';
const REGISTER_ROUTE = '/register';
const USERNAME_FIELD = 'username';
const PASSWORD_FIELD = 'password';
// ---

describe('Integration Tests', () => {

    // --- Unauthenticated Tests ---

    // Log in the test user before running authenticated tests
    before(async () => {
        // Ensure testuser2 exists for friend tests
        try {
            // Attempt to register testuser2
            await chai.request(app)
                .post(REGISTER_ROUTE)
                .send({
                    username: TEST_USERNAME_2,
                    password: TEST_PASSWORD_2,
                    confirmPassword: TEST_PASSWORD_2,
                    email: TEST_USER_EMAIL_2
                });
            // Login as testuser2 to get its ID (or query DB if easier)
            const loginRes2 = await chai.request(app)
                .post(LOGIN_ROUTE)
                .send({ username: TEST_USERNAME_2, password: TEST_PASSWORD_2 });

            console.log(`[TEST] Registered/Ensured ${TEST_USERNAME_2} exists.`);

        } catch (err) {
            // Ignore registration errors if user already exists
            if (err.response && err.response.text && err.response.text.includes('Username/email might already be taken')) {
                console.log(`[TEST] ${TEST_USERNAME_2} likely already exists.`);
            } else {
                console.error(`[TEST] Error setting up ${TEST_USERNAME_2}:`, err);
                throw err; // Rethrow unexpected errors
            }
        }

        // Log in the main test user (testuser)
        console.log(`[TEST] Attempting login for ${TEST_USERNAME}...`);
        const res = await agent
            .post(LOGIN_ROUTE)
            .send({
                [USERNAME_FIELD]: TEST_USERNAME,
                [PASSWORD_FIELD]: TEST_PASSWORD
            });

        expect(res).to.have.status(200);
        console.log('[TEST] Login attempt completed (Status 200). Assuming agent is authenticated.');
    });

    // Close the agent and server after tests
    after((done) => {
        agent.close(); // Close the agent
        if (server && server.listening) {
            server.close(() => {
                console.log('[TEST] Server closed.');
                done();
            });
        } else {
            console.log('[TEST] Server was not running or already closed.');
            done();
        }
    });

    // --- Keep other tests as they were ---

    describe('GET /home (Authenticated)', () => {
        // This test uses the 'agent' which should now have the login cookie
        it('should return status 200 and render the authenticated homepage', (done) => {
            agent // Use the agent here
                .get('/home') // Access the page users are redirected to after login
                .end((err, res) => {
                    if (err) return done(err); // Handle potential errors
                    expect(res).to.have.status(200);
                    // Check for content expected on the authenticated /home page
                    expect(res.text).to.include('<div id="restaurant-card"');
                    expect(res.text).to.include('id="startSessionBtn"');
                    done();
                });
        });
    });

    describe('GET /search-users (Authenticated - Assuming it requires login)', () => {
        // This test uses the 'agent'
        it('should return status 200 for logged-in user (if /search-users exists and is protected)', (done) => {
            agent // Use the agent here
                .get('/search-users') // Assuming /search-users is a valid route for logged-in users
                .end((err, res) => {
                    if (err) return done(err); // Handle potential errors
                    // Adjust status/assertions based on actual /search-users behavior for logged-in users
                    expect(res).to.have.status(200);
                    // expect(res.text).to.include('Some search-users Page Specific Content');
                    done();
                });
        });
    });

    describe('GET /search-users (Authenticated)', () => {
        it('should return status 200 and find the second test user', (done) => {
            agent
                .get('/search-users')
                .query({ q: TEST_USERNAME_2 }) // Search specifically for testuser2
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('array');
                    // Find testuser2 in the results
                    const foundUser = res.body.find(user => user.username === TEST_USERNAME_2);
                    expect(foundUser).to.exist;
                    expect(foundUser.user_id).to.be.a('number');
                    testUserId2 = foundUser.user_id; // Store the ID for later tests
                    console.log(`[TEST] Found ${TEST_USERNAME_2} with ID: ${testUserId2}`);
                    done();
                });
        });
    });

    describe('POST /friends/remove (Authenticated)', () => {
        it('should remove testuser2 as a friend and return success', (done) => {
            expect(testUserId2, 'testUserId2 should be set by search test').to.be.a('number');
            agent
                .post('/friends/remove')
                .send({ friend_id: testUserId2 })
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
                    expect(res.body.success).to.equal(true);
                    done();
                });
        });

        // Optional: Add test for trying to remove a non-friend
    });

    describe('POST /check-username', () => {
        it('should return exists: true for an existing username', (done) => {
            chai.request(app) // Use chai.request directly, no auth needed
                .post('/check-username')
                .send({ username: TEST_USERNAME }) // Use the known test username
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
                    expect(res.body.exists).to.equal(true);
                    done();
                });
        });

        it('should return exists: false for a non-existent username', (done) => {
            chai.request(app)
                .post('/check-username')
                .send({ username: `nonexistent-${Date.now()}` })
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
                    expect(res.body.exists).to.equal(false);
                    done();
                });
        });
    });

});