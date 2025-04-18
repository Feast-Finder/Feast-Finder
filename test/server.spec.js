// ********************** Initialize server **********************************

const server = require('../index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;
const bcryptjs = require('bcryptjs');
const app = require('../index'); // or wherever your Express app is



// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************
// Example Positive Testcase :
// API: /add_user
// Input: {id: 5, name: 'John Doe', dob: '2020-02-20'}
// Expect: res.status == 200 and res.body.message == 'Success'
// Result: This test case should pass and return a status 200 along with a "Success" message.
// Explanation: The testcase will call the /add_user API with the following input
// and expects the API to return a status of 200 along with the "Success" message.

describe('Testing Add User API', () => {
  it('positive : /register_test', done => {
    chai
      .request(server)
      .post('/register_test')
      .send({ username: 'JohnDoe', password: '2020' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.result).to.equals('Success');
        done();
      });
  });

  // Example Negative Testcase :
  // API: /add_user
  // Input: {id: 5, name: 10, dob: '2020-02-20'}
  // Expect: res.status == 400 and res.body.message == 'Invalid input'
  // Result: This test case should pass and return a status 400 along with a "Invalid input" message.
  // Explanation: The testcase will call the /add_user API with the following invalid inputs
  // and expects the API to return a status of 400 along with the "Invalid input" message.
  it('Negative : /register_test. Checking invalid name', done => {
    chai
      .request(server)
      .post('/register_test')
      .send({ username: 'alice', password: '2020' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.result).to.equals('Username already exists');
        done();
      });
  });
});

describe('Friends Route Tests', () => {
  let agent;
  const testUser = {
    username: 'rex',
    password: '123',
  };
  const db = require('./db');

  before(async () => {
    await db.query('TRUNCATE TABLE Friends, Users RESTART IDENTITY CASCADE');
    const hashedPassword = await bcryptjs.hash(testUser.password, 10);
    await db.query(
      'INSERT INTO Users (username, password_hash) VALUES ($1, $2)',
      [testUser.username, hashedPassword]
    );
  });

  beforeEach(() => {
    agent = chai.request.agent(app);
  });

  afterEach(() => {
    agent.close();
  });

  after(async () => {
    await db.query('TRUNCATE TABLE Friends, Users RESTART IDENTITY CASCADE');
  });

  describe('GET /friends_test', () => {
    it('should return 401 if user is not authenticated', done => {
      chai
        .request(app)
        .get('/friends_test')
        .end((err, res) => {

          expect(res.text).to.equal('Not authenticated');
          done();
        });
    });

    it('should return user profile when authenticated', async () => {
      const agent = chai.request.agent(app);
      await agent.post('/login').send(testUser);
      const res = await agent.get('/friends_test');

      expect(res.body).to.have.property('username', testUser.username);
      agent.close();
    });
  });

});

// ********************************************************************************