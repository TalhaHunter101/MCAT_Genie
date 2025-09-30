#!/usr/bin/env node

/**
 * MCAT Study Schedule Planner - Test Suite Demo
 * 
 * Demonstrates the test suite functionality with a single test
 */

const http = require('http');

// Demo configuration
const DEMO_CONFIG = {
    name: 'demo_test',
    params: {
        start_date: '2025-10-06',
        test_date: '2025-12-15',
        priorities: '1A,1B,1D,3A,3B',
        availability: 'Mon,Tue,Thu,Fri,Sat',
        fl_weekday: 'Sat'
    }
};

// Simple validation functions
const validators = {
    validateBasicResponse(response) {
        const errors = [];
        
        if (!response.schedule || !Array.isArray(response.schedule)) {
            errors.push('Missing or invalid schedule array');
        }
        
        if (!response.metadata) {
            errors.push('Missing metadata');
        }
        
        return { valid: errors.length === 0, errors };
    },
    
    validateScheduleStructure(schedule) {
        const errors = [];
        const studyDays = schedule.filter(d => d.kind === 'study');
        const fullLengthDays = schedule.filter(d => d.kind === 'full_length');
        
        if (studyDays.length === 0) {
            errors.push('No study days found');
        }
        
        if (fullLengthDays.length !== 6) {
            errors.push(`Expected 6 full-length tests, got ${fullLengthDays.length}`);
        }
        
        return { valid: errors.length === 0, errors, studyDays: studyDays.length, fullLengths: fullLengthDays.length };
    },
    
    validateTimeBudget(schedule) {
        const studyDays = schedule.filter(d => d.kind === 'study');
        const errors = [];
        let totalTime = 0;
        let daysOverBudget = 0;
        
        studyDays.forEach(day => {
            if (day.blocks) {
                const resourceTime = day.blocks.total_resource_minutes || 0;
                totalTime += resourceTime;
                
                if (resourceTime > 240) {
                    daysOverBudget++;
                    errors.push(`Day ${day.date}: ${resourceTime} min exceeds 240 min budget`);
                }
            }
        });
        
        const avgTime = studyDays.length > 0 ? totalTime / studyDays.length : 0;
        const utilization = (avgTime / 240) * 100;
        
        return {
            valid: errors.length === 0,
            errors,
            avgTime: avgTime.toFixed(1),
            utilization: utilization.toFixed(1),
            daysOverBudget
        };
    }
};

// Make HTTP request
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, { timeout: 30000 }, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`Invalid JSON response: ${error.message}`));
                }
            });
        });

        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Run demo test
async function runDemo() {
    console.log('🎯 MCAT Study Schedule Planner - Test Suite Demo');
    console.log('=' .repeat(60));
    
    const config = DEMO_CONFIG;
    console.log(`\n🧪 Running demo test: ${config.name}`);
    console.log(`   Description: Demo test with basic configuration`);
    
    try {
        // Build URL
        const params = new URLSearchParams(config.params);
        const url = `http://localhost:3000/full-plan?${params.toString()}`;
        
        console.log(`   URL: ${url}`);
        
        // Make request
        const startTime = Date.now();
        const response = await makeRequest(url);
        const responseTime = Date.now() - startTime;
        
        console.log(`   ✅ Response received in ${responseTime}ms`);
        
        // Run validations
        const validations = {
            basicResponse: validators.validateBasicResponse(response),
            scheduleStructure: validators.validateScheduleStructure(response.schedule),
            timeBudget: validators.validateTimeBudget(response.schedule)
        };
        
        // Calculate score
        const totalValidations = Object.keys(validations).length;
        const passedValidations = Object.values(validations).filter(v => v.valid).length;
        const score = (passedValidations / totalValidations) * 100;
        
        // Display results
        console.log(`\n📊 Results:`);
        console.log(`   Total Days: ${response.metadata?.total_days || 'N/A'}`);
        console.log(`   Study Days: ${response.metadata?.study_days || 'N/A'}`);
        console.log(`   Score: ${score.toFixed(1)}% (${score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'F'})`);
        
        console.log(`\n✅ Validation Results:`);
        Object.entries(validations).forEach(([name, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`   ${status} ${name}: ${result.valid ? 'PASS' : result.errors.length + ' errors'}`);
            
            if (!result.valid && result.errors.length <= 2) {
                result.errors.forEach(error => console.log(`      - ${error}`));
            }
        });
        
        // Show sample schedule entries
        if (response.schedule && response.schedule.length > 0) {
            console.log(`\n📅 Sample Schedule Entries:`);
            const sampleEntries = response.schedule.slice(0, 3);
            sampleEntries.forEach(entry => {
                if (entry.kind === 'study') {
                    const resourceTime = entry.blocks?.total_resource_minutes || 0;
                    const phase = entry.phase || 'N/A';
                    console.log(`   • ${entry.date} (Phase ${phase}): ${resourceTime} min resources`);
                } else if (entry.kind === 'full_length') {
                    console.log(`   • ${entry.date} (Full Length): ${entry.name || 'FL Test'}`);
                } else {
                    console.log(`   • ${entry.date} (${entry.kind})`);
                }
            });
            
            if (response.schedule.length > 3) {
                console.log(`   ... and ${response.schedule.length - 3} more entries`);
            }
        }
        
        console.log(`\n🎉 Demo completed successfully!`);
        console.log(`\n💡 To run the full test suite:`);
        console.log(`   cd tests && ./run-tests.sh`);
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        console.log(`\n🔧 Troubleshooting:`);
        console.log(`   1. Make sure the server is running: npm run dev`);
        console.log(`   2. Check if the API is accessible: curl http://localhost:3000/health`);
        console.log(`   3. Verify the server is responding to requests`);
    }
}

// Run demo if this script is executed directly
if (require.main === module) {
    runDemo().catch(error => {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    });
}

module.exports = { runDemo, validators };
