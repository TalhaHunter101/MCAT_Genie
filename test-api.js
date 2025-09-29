// Simple API test script
const http = require('http');

const testCases = [
  {
    name: '10-week study plan',
    params: {
      start_date: '2025-10-06',
      test_date: '2025-12-15',
      priorities: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B',
      availability: 'Mon,Tue,Thu,Fri,Sat',
      fl_weekday: 'Sat'
    }
  },
  {
    name: '8-week intensive plan',
    params: {
      start_date: '2025-11-01',
      test_date: '2025-12-27',
      priorities: '1A,1B,3A,3B,4A,4B,5A,5D',
      availability: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
      fl_weekday: 'Sun'
    }
  },
  {
    name: 'Part-time study plan',
    params: {
      start_date: '2025-09-01',
      test_date: '2026-01-15',
      priorities: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B',
      availability: 'Mon,Wed,Fri,Sat',
      fl_weekday: 'Sat'
    }
  }
];

function makeRequest(params) {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams(params).toString();
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/full-plan?${queryString}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Running API tests...\n');

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`   Parameters: ${JSON.stringify(testCase.params, null, 2)}`);
    
    try {
      const result = await makeRequest(testCase.params);
      
      if (result.status === 200) {
        console.log(`   ✅ Status: ${result.status}`);
        console.log(`   📊 Schedule days: ${result.data.schedule?.length || 0}`);
        console.log(`   📈 Study days: ${result.data.metadata?.study_days || 0}`);
        console.log(`   🏃 Break days: ${result.data.metadata?.break_days || 0}`);
        console.log(`   📚 Phase 1: ${result.data.metadata?.phase_1_days || 0} days`);
        console.log(`   📚 Phase 2: ${result.data.metadata?.phase_2_days || 0} days`);
        console.log(`   📚 Phase 3: ${result.data.metadata?.phase_3_days || 0} days`);
        console.log(`   🎯 Full lengths: ${result.data.metadata?.full_length_days || 0} days`);
      } else {
        console.log(`   ❌ Status: ${result.status}`);
        console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  // Test health endpoint
  console.log('🏥 Testing health endpoint...');
  try {
    const healthResult = await makeRequest({});
    console.log(`   Status: ${healthResult.status}`);
    console.log(`   Response: ${JSON.stringify(healthResult.data, null, 2)}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

// Check if server is running
async function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET'
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  console.log('🚀 MCAT Study Schedule Planner - API Test Suite\n');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   npm run dev');
    console.log('   or');
    console.log('   npm start\n');
    process.exit(1);
  }

  console.log('✅ Server is running\n');
  await runTests();
  console.log('✨ Test suite completed!');
}

main().catch(console.error);
