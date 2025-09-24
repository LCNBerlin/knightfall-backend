// Authentication test script
const http = require('http');

const BASE_URL = 'http://localhost:3001/api';

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testAuthentication() {
  console.log('🔐 Testing Knightfall Authentication System...\n');
  
  let authToken = null;
  let testUserId = null;

  try {
    // Test 1: Register a new user
    console.log('1️⃣ Testing User Registration...');
    const registerData = {
      username: 'testuser_' + Date.now(),
      email: `test${Date.now()}@knightfall.com`,
      password: 'TestPass123!'
    };

    const registerResponse = await makeRequest('POST', '/auth/register', registerData);
    console.log(`   Status: ${registerResponse.statusCode}`);
    
    if (registerResponse.statusCode === 201) {
      console.log('   ✅ Registration successful');
      authToken = registerResponse.data.data.token;
      testUserId = registerResponse.data.data.user.id;
    } else {
      console.log('   ❌ Registration failed:', registerResponse.data);
    }

    // Test 2: Login with the new user
    console.log('\n2️⃣ Testing User Login...');
    const loginData = {
      username: registerData.username,
      password: registerData.password
    };

    const loginResponse = await makeRequest('POST', '/auth/login', loginData);
    console.log(`   Status: ${loginResponse.statusCode}`);
    
    if (loginResponse.statusCode === 200) {
      console.log('   ✅ Login successful');
      authToken = loginResponse.data.data.token;
    } else {
      console.log('   ❌ Login failed:', loginResponse.data);
    }

    // Test 3: Get user profile (authenticated)
    console.log('\n3️⃣ Testing Get Profile (Authenticated)...');
    const profileResponse = await makeRequest('GET', '/auth/profile', null, authToken);
    console.log(`   Status: ${profileResponse.statusCode}`);
    
    if (profileResponse.statusCode === 200) {
      console.log('   ✅ Profile retrieved successfully');
    } else {
      console.log('   ❌ Profile retrieval failed:', profileResponse.data);
    }

    // Test 4: Get user profile (unauthenticated)
    console.log('\n4️⃣ Testing Get Profile (Unauthenticated)...');
    const unauthenticatedProfileResponse = await makeRequest('GET', '/auth/profile');
    console.log(`   Status: ${unauthenticatedProfileResponse.statusCode}`);
    
    if (unauthenticatedProfileResponse.statusCode === 401) {
      console.log('   ✅ Correctly rejected unauthenticated request');
    } else {
      console.log('   ❌ Should have rejected unauthenticated request:', unauthenticatedProfileResponse.data);
    }

    // Test 5: Get leaderboard (public endpoint)
    console.log('\n5️⃣ Testing Get Leaderboard (Public)...');
    const leaderboardResponse = await makeRequest('GET', '/users/leaderboard');
    console.log(`   Status: ${leaderboardResponse.statusCode}`);
    
    if (leaderboardResponse.statusCode === 200) {
      console.log('   ✅ Leaderboard retrieved successfully');
    } else {
      console.log('   ❌ Leaderboard retrieval failed:', leaderboardResponse.data);
    }

    // Test 6: Update profile
    console.log('\n6️⃣ Testing Update Profile...');
    const updateData = {
      username: registerData.username + '_updated'
    };

    const updateResponse = await makeRequest('PUT', '/auth/profile', updateData, authToken);
    console.log(`   Status: ${updateResponse.statusCode}`);
    
    if (updateResponse.statusCode === 200) {
      console.log('   ✅ Profile updated successfully');
    } else {
      console.log('   ❌ Profile update failed:', updateResponse.data);
    }

    // Test 7: Logout
    console.log('\n7️⃣ Testing Logout...');
    const logoutResponse = await makeRequest('POST', '/auth/logout', null, authToken);
    console.log(`   Status: ${logoutResponse.statusCode}`);
    
    if (logoutResponse.statusCode === 200) {
      console.log('   ✅ Logout successful');
    } else {
      console.log('   ❌ Logout failed:', logoutResponse.data);
    }

    console.log('\n🎉 Authentication system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the backend server is running: npm run dev');
    console.log('2. Check if the server is accessible on port 3001');
    console.log('3. Verify database connection (if using database)');
  }
}

testAuthentication(); 