const http = require('http');

// Test parameters
const params = new URLSearchParams({
  start_date: '2025-10-06',
  test_date: '2025-12-15',
  priorities: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B',
  availability: 'Mon,Tue,Thu,Fri,Sat',
  fl_weekday: 'Sat'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/full-plan?${params.toString()}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🧪 Testing MCAT Study Schedule Planner API...');
console.log(`📡 Request: GET http://localhost:3000${options.path}`);
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`📋 Headers:`, res.headers);
    console.log('');
    
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        console.log('✅ Success! Schedule generated:');
        console.log(`📅 Total days: ${response.metadata.total_days}`);
        console.log(`📚 Study days: ${response.metadata.study_days}`);
        console.log(`🏖️  Break days: ${response.metadata.break_days}`);
        console.log(`📖 Phase 1 days: ${response.metadata.phase_1_days}`);
        console.log(`📖 Phase 2 days: ${response.metadata.phase_2_days}`);
        console.log(`📖 Phase 3 days: ${response.metadata.phase_3_days}`);
        console.log(`📝 Full length days: ${response.metadata.full_length_days}`);
        console.log('');
        console.log('📋 Sample schedule entries:');
        response.schedule.slice(0, 5).forEach((day, index) => {
          console.log(`  ${index + 1}. ${day.date} - ${day.kind}${day.phase ? ` (Phase ${day.phase})` : ''}`);
        });
        console.log(`  ... and ${response.schedule.length - 5} more days`);
      } catch (error) {
        console.log('❌ Error parsing JSON response:');
        console.log(data);
      }
    } else {
      console.log('❌ Error response:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request failed:', error.message);
  console.log('');
  console.log('💡 Make sure the server is running:');
  console.log('   npm run dev');
});

req.end();
