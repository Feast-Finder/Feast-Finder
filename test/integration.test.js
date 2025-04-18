const chai = require('chai');
const chaiHttp = require('chai-http');
const { app, server } = require('../index'); // Import your app

chai.use(chaiHttp);
const expect = chai.expect;

// Use an agent to persist cookies across requests
const agent = chai.request.agent(app);

// --- IMPORTANT: Replace with your actual test credentials & config ---
// Consider using environment variables (e.g., process.env.TEST_USER, process.env.TEST_PASS)
const TEST_USERNAME = 'testuser'; // Replace with a valid test username
const TEST_PASSWORD = 'testpassword'; // Replace with the test user's password
const LOGIN_ROUTE = '/login';     // Your login POST route (seems correct)
const USERNAME_FIELD = 'username'; // Name attribute of username input in login.hbs
const PASSWORD_FIELD = 'password'; // Name attribute of password input in login.hbs
// ---

describe('Integration Tests', () => {

    // Log in the test user before running authenticated tests
    before((done) => {
        agent
            .post(LOGIN_ROUTE)
            .send({
                [USERNAME_FIELD]: TEST_USERNAME,
                [PASSWORD_FIELD]: TEST_PASSWORD
            })
            .end((err, res) => {
                // Log the response details regardless of error
                console.log('[TEST_DEBUG] Login Response Status:', res?.status);
                console.log('[TEST_DEBUG] Login Response Headers:', JSON.stringify(res?.headers, null, 2));
                // console.log('[TEST_DEBUG] Login Response Body:', res?.text); // Uncomment to see full HTML if needed

                if (err) {
                    console.error("[TEST_DEBUG] Login request failed in test:", err);
                    return done(err); // Fail fast if request itself errors
                }
                if (!res.headers.location || !res.headers.location.includes('/home')) {
                    console.error(`[TEST_DEBUG] Login did not redirect to /home as expected. Location: ${res.headers.location}`);
                    // Optionally log the body here too if redirect fails
                    // console.error('[TEST_DEBUG] Login Response Body on Failure:', res?.text); 
                }

                // Expect a redirect after successful login
                expect(res).to.redirect;
                // Check that the location header ENDS WITH /home, ignoring host/port
                expect(res.headers.location).to.match(/\/home$/);
                console.log('[TEST_DEBUG] Test user logged in successfully.');
                done();
            });
    });

    // Close the agent and server after tests
    after((done) => {
        agent.close(); // Close the agent
        if (server && server.listening) {
            server.close(() => {
                console.log('Server closed for testing.');
                done();
            });
        } else {
            console.log('Server was not running or already closed.');
            done();
        }
    });

    describe('GET / (Unauthenticated)', () => {
        // This test uses the original chai.request, not the agent
        it('should redirect unauthenticated user to /login', (done) => {
            chai.request(app) // Use plain chai.request
                .get('/')
                .end((err, res) => {
                    expect(res).to.redirect; // '/' redirects to '/login' (index.js line 100)
                    expect(res).to.redirectTo('/login');
                    done();
                });
        });

        it('should render the login page for /login', (done) => {
            chai.request(app) // Use plain chai.request
                .get('/login') // Directly access /login
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.text).to.include('<h2 class="card-title text-center mb-4">Login</h2>'); // Check for login form title
                    expect(res.text).to.include(`name="${USERNAME_FIELD}"`);
                    expect(res.text).to.include(`name="${PASSWORD_FIELD}"`);
                    done();
                });
        });
    });

    describe('GET /home (Authenticated)', () => {
        // This test uses the 'agent' which now has the login cookie
        it('should return status 200 and render the authenticated homepage', (done) => {
            agent // Use the agent here
                .get('/home') // Access the page users are redirected to after login
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    // Adjust based on unique content on your authenticated /home page
                    // Example: Check for the restaurant card container from Home.hbs
                    expect(res.text).to.include('<div id="restaurant-card"');
                    expect(res.text).to.include('id="startSessionBtn"'); // Check for start session button
                    done();
                });
        });
    });

    describe('GET /search (Authenticated - Assuming it requires login)', () => {
        // This test uses the 'agent'
        it('should return status 200 for logged-in user (if /search exists and is protected)', (done) => {
            agent // Use the agent here
                .get('/search') // Assuming /search is a valid route for logged-in users
                .end((err, res) => {
                    // If /search redirects logged-in users elsewhere (e.g., /home), adjust this
                    expect(res).to.have.status(200);
                    // Add specific assertions for the content of the /search page when logged in
                    // expect(res.text).to.include('Some Search Page Specific Content'); 
                    done();
                });
        });
    });

    // Add more tests for other authenticated routes using the 'agent'
    // e.g., describe('POST /profile/update (Authenticated)', () => { ... agent.post(...).send({...}) ... });

});