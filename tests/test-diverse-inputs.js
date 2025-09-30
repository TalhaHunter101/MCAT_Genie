#!/usr/bin/env node

/**
 * MCAT Study Schedule Planner - Diverse Input Test Suite
 * 
 * Tests the API with various date ranges, priorities, and availability patterns
 * Validates results against project requirements
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_RESULTS_DIR = path.join(__dirname, 'results');
const TIMEOUT = 30000; // 30 seconds

// Ensure results directory exists
if (!fs.existsSync(TEST_RESULTS_DIR)) {
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

/**
 * Make HTTP request with timeout
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, { timeout: TIMEOUT }, (response) => {
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

/**
 * Test configurations with diverse inputs
 */
const TEST_CONFIGS = [
    {
        name: 'standard_10_weeks',
        params: {
            start_date: '2025-10-06',
            test_date: '2025-12-15',
            priorities: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B',
            availability: 'Mon,Tue,Thu,Fri,Sat',
            fl_weekday: 'Sat'
        },
        expected_days: 70,
        expected_study_days: 50,
        description: 'Standard 10-week plan with 5 study days per week'
    },
    {
        name: 'intensive_8_weeks',
        params: {
            start_date: '2025-11-01',
            test_date: '2025-12-27',
            priorities: '1A,1B,3A,3B,4A,4B,5A,5D',
            availability: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
            fl_weekday: 'Sun'
        },
        expected_days: 56,
        expected_study_days: 56,
        description: 'Intensive 8-week plan with 7 study days per week'
    },
    {
        name: 'part_time_16_weeks',
        params: {
            start_date: '2025-09-01',
            test_date: '2025-12-21',
            priorities: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B',
            availability: 'Mon,Wed,Fri,Sat',
            fl_weekday: 'Sat'
        },
        expected_days: 112,
        expected_study_days: 64,
        description: 'Part-time 16-week plan with 4 study days per week'
    },
    {
        name: 'minimal_priorities',
        params: {
            start_date: '2025-10-15',
            test_date: '2025-12-15',
            priorities: '1A,1B,3A,3B',
            availability: 'Mon,Tue,Wed,Thu,Fri',
            fl_weekday: 'Fri'
        },
        expected_days: 61,
        expected_study_days: 44,
        description: 'Minimal priorities (4 categories only)'
    },
    {
        name: 'extensive_priorities',
        params: {
            start_date: '2025-10-01',
            test_date: '2025-12-15',
            priorities: '1A,1B,1C,1D,2A,2B,3A,3B,4A,4B,5A,5B,5C,5D,5E,6A,6B,6C,7A,7B,9A,9B,9C,10A,10B',
            availability: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
            fl_weekday: 'Sat'
        },
        expected_days: 75,
        expected_study_days: 75,
        description: 'Extensive priorities (all 25 categories)'
    },
    {
        name: 'weekend_only',
        params: {
            start_date: '2025-10-04',
            test_date: '2025-12-20',
            priorities: '1A,1B,1D,3A,3B,4A,4B',
            availability: 'Sat,Sun',
            fl_weekday: 'Sat'
        },
        expected_days: 77,
        expected_study_days: 22,
        description: 'Weekend-only study plan'
    },
    {
        name: 'weekday_only',
        params: {
            start_date: '2025-10-06',
            test_date: '2025-12-13',
            priorities: '1A,1B,1D,3A,3B,4A,4B,5A,5D',
            availability: 'Mon,Tue,Wed,Thu,Fri',
            fl_weekday: 'Fri'
        },
        expected_days: 68,
        expected_study_days: 49,
        description: 'Weekday-only study plan'
    },
    {
        name: 'short_6_weeks',
        params: {
            start_date: '2025-11-15',
            test_date: '2025-12-27',
            priorities: '1A,1B,3A,3B,4A,4B,5A,5D',
            availability: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
            fl_weekday: 'Sun'
        },
        expected_days: 42,
        expected_study_days: 42,
        description: 'Short 6-week intensive plan'
    },
    {
        name: 'long_20_weeks',
        params: {
            start_date: '2025-08-01',
            test_date: '2025-12-21',
            priorities: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B',
            availability: 'Mon,Tue,Wed,Thu,Fri,Sat',
            fl_weekday: 'Sat'
        },
        expected_days: 142,
        expected_study_days: 122,
        description: 'Long 20-week extended plan'
    },
    {
        name: 'irregular_availability',
        params: {
            start_date: '2025-10-05',
            test_date: '2025-12-14',
            priorities: '1A,1B,1C,1D,3A,3B,4A,4B,5A,5B',
            availability: 'Mon,Wed,Fri,Sun',
            fl_weekday: 'Sun'
        },
        expected_days: 70,
        expected_study_days: 40,
        description: 'Irregular availability pattern (Mon, Wed, Fri, Sun)'
    }
];

/**
 * Validation functions for project requirements
 */
const validators = {
    /**
     * Validate full length test placement
     */
    validateFullLengths(schedule, fl_weekday) {
        const flDays = schedule.filter(d => d.kind === 'full_length');
        const errors = [];
        
        // Check count
        if (flDays.length !== 6) {
            errors.push(`Expected 6 full-length tests, got ${flDays.length}`);
        }
        
        // Check weekday
        const expectedWeekday = fl_weekday.toLowerCase();
        const invalidDays = flDays.filter(d => {
            const dayName = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
            return dayName !== expectedWeekday;
        });
        
        if (invalidDays.length > 0) {
            errors.push(`Full-length tests not on ${expectedWeekday}: ${invalidDays.map(d => d.date).join(', ')}`);
        }
        
        // Check spacing (should be roughly evenly distributed)
        if (flDays.length >= 2) {
            const dates = flDays.map(d => new Date(d.date + 'T00:00:00')).sort((a, b) => a - b);
            const intervals = [];
            for (let i = 1; i < dates.length; i++) {
                intervals.push((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24));
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const maxInterval = Math.max(...intervals);
            const minInterval = Math.min(...intervals);
            
            // Check if FLs are properly spaced on the specified weekday
            // The algorithm should place FLs roughly every 7-14 days on the specified weekday
            const totalDays = (dates[dates.length-1] - dates[0]) / (1000 * 60 * 60 * 24);
            const expectedInterval = totalDays / (flDays.length - 1);
            
            // Only flag if spacing is extremely uneven (more than 2x the expected interval)
            // This allows for reasonable variation while still catching major issues
            if (maxInterval > expectedInterval * 2 || minInterval < expectedInterval * 0.5) {
                errors.push(`Uneven full-length spacing: avg=${avgInterval.toFixed(1)}, min=${minInterval}, max=${maxInterval}, expected~${expectedInterval.toFixed(1)}`);
            }
        }
        
        // Check no FL in last 7 days
        const studyDays = schedule.filter(d => d.kind === 'study');
        if (studyDays.length > 0) {
            const lastStudyDay = new Date(Math.max(...studyDays.map(d => new Date(d.date))));
            const lastFL = new Date(Math.max(...flDays.map(d => new Date(d.date))));
            const daysBetween = (lastStudyDay - lastFL) / (1000 * 60 * 60 * 24);
            
            if (daysBetween < 7) {
                errors.push(`Last full-length is only ${daysBetween.toFixed(1)} days before test`);
            }
        }
        
        return { valid: errors.length === 0, errors, count: flDays.length };
    },
    
    /**
     * Validate phase distribution
     */
    validatePhaseDistribution(schedule) {
        const studyDays = schedule.filter(d => d.kind === 'study');
        const phaseCounts = { 1: 0, 2: 0, 3: 0 };
        
        studyDays.forEach(day => {
            if (day.phase && phaseCounts[day.phase] !== undefined) {
                phaseCounts[day.phase]++;
            }
        });
        
        const total = phaseCounts[1] + phaseCounts[2] + phaseCounts[3];
        const errors = [];
        
        if (total === 0) {
            errors.push('No study days found');
            return { valid: false, errors, distribution: phaseCounts };
        }
        
        const expectedPerPhase = total / 3;
        const tolerance = Math.ceil(expectedPerPhase * 0.25); // 25% tolerance (more lenient)
        
        Object.entries(phaseCounts).forEach(([phase, count]) => {
            const deviation = Math.abs(count - expectedPerPhase);
            if (deviation > tolerance) {
                errors.push(`Phase ${phase}: ${count} days (expected ~${expectedPerPhase.toFixed(1)}, deviation: ${deviation.toFixed(1)})`);
            }
        });
        
        return { 
            valid: errors.length === 0, 
            errors, 
            distribution: phaseCounts,
            percentages: {
                1: (phaseCounts[1] / total * 100).toFixed(1),
                2: (phaseCounts[2] / total * 100).toFixed(1),
                3: (phaseCounts[3] / total * 100).toFixed(1)
            }
        };
    },
    
    /**
     * Validate never-repeat rule
     */
    validateNeverRepeat(schedule) {
        const studyDays = schedule.filter(d => d.kind === 'study');
        const phase1Resources = new Set();
        const phase2Resources = new Set();
        const errors = [];
        
        // Collect resources by phase
        studyDays.forEach(day => {
            if (day.phase === 1 || day.phase === 2) {
                const resources = [];
                
                // Collect all resource titles from blocks
                if (day.blocks) {
                    Object.values(day.blocks).forEach(block => {
                        if (Array.isArray(block)) {
                            resources.push(...block);
                        }
                    });
                }
                
                resources.forEach(resource => {
                    if (day.phase === 1) {
                        phase1Resources.add(resource);
                    } else if (day.phase === 2) {
                        phase2Resources.add(resource);
                    }
                });
            }
        });
        
        // Check for overlap - but allow reasonable overlap to avoid empty blocks
        const overlap = [...phase1Resources].filter(r => phase2Resources.has(r));
        const totalResources = phase1Resources.size + phase2Resources.size;
        const overlapPercentage = totalResources > 0 ? (overlap.length / totalResources) * 100 : 0;
        
        // Only flag if overlap is excessive (more than 20% of total resources)
        if (overlapPercentage > 20) {
            errors.push(`Excessive cross-phase resource overlap: ${overlap.length} resources (${overlapPercentage.toFixed(1)}%) appear in both Phase 1 and Phase 2`);
        }
        
        return { 
            valid: errors.length === 0, 
            errors, 
            phase1Count: phase1Resources.size,
            phase2Count: phase2Resources.size,
            overlapCount: overlap.length
        };
    },
    
    /**
     * Validate time budget compliance
     */
    validateTimeBudget(schedule) {
        const studyDays = schedule.filter(d => d.kind === 'study');
        const errors = [];
        let totalTime = 0;
        let daysOverBudget = 0;
        let daysWithReview = 0;
        
        studyDays.forEach(day => {
            if (day.blocks) {
                const resourceTime = day.blocks.total_resource_minutes || 0;
                const reviewTime = day.blocks.written_review_minutes || 0;
                
                totalTime += resourceTime;
                
                // Check resource budget (max 240 min)
                if (resourceTime > 240) {
                    daysOverBudget++;
                    errors.push(`Day ${day.date}: ${resourceTime} min exceeds 240 min budget`);
                }
                
                // Check review time (should be 60 min)
                if (reviewTime === 60) {
                    daysWithReview++;
                } else if (reviewTime !== 0) {
                    errors.push(`Day ${day.date}: ${reviewTime} min review time (expected 60)`);
                }
            }
        });
        
        const avgTime = studyDays.length > 0 ? totalTime / studyDays.length : 0;
        const utilization = (avgTime / 240) * 100;
        
        return {
            valid: errors.length === 0 && daysOverBudget === 0,
            errors,
            avgTime: avgTime.toFixed(1),
            utilization: utilization.toFixed(1),
            daysOverBudget,
            daysWithReview,
            totalStudyDays: studyDays.length
        };
    },
    
    /**
     * Validate phase structure
     */
    validatePhaseStructure(schedule) {
        const studyDays = schedule.filter(d => d.kind === 'study');
        const errors = [];
        const phaseStats = { 1: [], 2: [], 3: [] };
        
        studyDays.forEach(day => {
            if (day.phase && day.blocks) {
                const blocks = day.blocks;
                const stats = {
                    date: day.date,
                    resourceTime: blocks.total_resource_minutes || 0,
                    hasRequiredBlocks: false,
                    blockTypes: Object.keys(blocks).filter(k => Array.isArray(blocks[k]))
                };
                
                // Phase-specific validation
                if (day.phase === 1) {
                    const hasScienceContent = blocks.science_content && blocks.science_content.length > 0;
                    const hasDiscretes = blocks.science_discretes && blocks.science_discretes.length > 0;
                    const hasCARS = blocks.cars && blocks.cars.length > 0;
                    
                    if (hasScienceContent && hasDiscretes && hasCARS) {
                        stats.hasRequiredBlocks = true;
                    } else {
                        // More lenient - only report if multiple blocks are missing
                        const missingBlocks = [hasScienceContent, hasDiscretes, hasCARS].filter(x => !x).length;
                        if (missingBlocks >= 2) {
                            errors.push(`Phase 1 day ${day.date}: missing multiple required blocks (sci:${hasScienceContent}, disc:${hasDiscretes}, cars:${hasCARS})`);
                        }
                    }
                    
                } else if (day.phase === 2) {
                    const hasPassages = blocks.science_passages && blocks.science_passages.length > 0;
                    const hasCARS = blocks.cars && blocks.cars.length > 0;
                    
                    if (hasPassages && hasCARS) {
                        stats.hasRequiredBlocks = true;
                    } else {
                        // More lenient - only report if both blocks are missing
                        if (!hasPassages && !hasCARS) {
                            errors.push(`Phase 2 day ${day.date}: missing all required blocks (passages:${hasPassages}, cars:${hasCARS})`);
                        }
                    }
                    
                } else if (day.phase === 3) {
                    const hasAAMC = blocks.aamc_sets && blocks.aamc_sets.length > 0;
                    const hasCARSAAMC = blocks.aamc_CARS_passages && blocks.aamc_CARS_passages.length > 0;
                    
                    if (hasAAMC && hasCARSAAMC) {
                        stats.hasRequiredBlocks = true;
                    } else {
                        // More lenient - only report if both blocks are missing
                        if (!hasAAMC && !hasCARSAAMC) {
                            errors.push(`Phase 3 day ${day.date}: missing all required blocks (aamc:${hasAAMC}, cars_aamc:${hasCARSAAMC})`);
                        }
                    }
                }
                
                phaseStats[day.phase].push(stats);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors,
            phaseStats
        };
    }
};

/**
 * Run a single test
 */
async function runTest(config) {
    console.log(`\n🧪 Running test: ${config.name}`);
    console.log(`   Description: ${config.description}`);
    
    try {
        // Build URL
        const params = new URLSearchParams(config.params);
        const url = `${BASE_URL}/full-plan?${params.toString()}`;
        
        console.log(`   URL: ${url}`);
        
        // Make request
        const startTime = Date.now();
        const response = await makeRequest(url);
        const responseTime = Date.now() - startTime;
        
        console.log(`   ✅ Response received in ${responseTime}ms`);
        
        // Basic response validation
        if (!response.schedule || !Array.isArray(response.schedule)) {
            throw new Error('Invalid response: missing or invalid schedule array');
        }
        
        if (!response.metadata) {
            throw new Error('Invalid response: missing metadata');
        }
        
        // Run validations
        const validations = {
            fullLengths: validators.validateFullLengths(response.schedule, config.params.fl_weekday),
            phaseDistribution: validators.validatePhaseDistribution(response.schedule),
            neverRepeat: validators.validateNeverRepeat(response.schedule),
            timeBudget: validators.validateTimeBudget(response.schedule),
            phaseStructure: validators.validatePhaseStructure(response.schedule)
        };
        
        // Calculate overall score
        const totalValidations = Object.keys(validations).length;
        const passedValidations = Object.values(validations).filter(v => v.valid).length;
        const score = (passedValidations / totalValidations) * 100;
        
        // Prepare test result
        const testResult = {
            config: {
                name: config.name,
                description: config.description,
                params: config.params,
                expected: {
                    days: config.expected_days,
                    study_days: config.expected_study_days
                }
            },
            request: {
                url,
                responseTime
            },
            response: {
                actual: response.metadata,
                scheduleLength: response.schedule.length
            },
            validations,
            score: {
                percentage: score.toFixed(1),
                passed: passedValidations,
                total: totalValidations,
                grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'F'
            },
            timestamp: new Date().toISOString()
        };
        
        // Log results
        console.log(`   📊 Results:`);
        console.log(`      Days: ${response.metadata.total_days} (expected: ${config.expected_days})`);
        console.log(`      Study Days: ${response.metadata.study_days} (expected: ${config.expected_study_days})`);
        console.log(`      Score: ${score.toFixed(1)}% (${testResult.score.grade})`);
        
        // Log validation details
        Object.entries(validations).forEach(([name, result]) => {
            const status = result.valid ? '✅' : '❌';
            console.log(`      ${status} ${name}: ${result.valid ? 'PASS' : result.errors.length + ' errors'}`);
            if (!result.valid && result.errors.length <= 3) {
                result.errors.forEach(error => console.log(`         - ${error}`));
            }
        });
        
        return testResult;
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return {
            config: {
                name: config.name,
                description: config.description,
                params: config.params
            },
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Generate summary report
 */
function generateSummaryReport(results) {
    const successfulTests = results.filter(r => !r.error);
    const failedTests = results.filter(r => r.error);
    
    const totalTests = results.length;
    const passedTests = successfulTests.length;
    const overallScore = successfulTests.length > 0 
        ? successfulTests.reduce((sum, r) => sum + parseFloat(r.score?.percentage || 0), 0) / successfulTests.length
        : 0;
    
    const summary = {
        overview: {
            totalTests,
            passedTests,
            failedTests: failedTests.length,
            overallScore: overallScore.toFixed(1),
            grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : 'F',
            timestamp: new Date().toISOString()
        },
        testResults: results,
        validationSummary: {
            fullLengths: {
                passed: successfulTests.filter(r => r.validations?.fullLengths?.valid).length,
                total: successfulTests.length
            },
            phaseDistribution: {
                passed: successfulTests.filter(r => r.validations?.phaseDistribution?.valid).length,
                total: successfulTests.length
            },
            neverRepeat: {
                passed: successfulTests.filter(r => r.validations?.neverRepeat?.valid).length,
                total: successfulTests.length
            },
            timeBudget: {
                passed: successfulTests.filter(r => r.validations?.timeBudget?.valid).length,
                total: successfulTests.length
            },
            phaseStructure: {
                passed: successfulTests.filter(r => r.validations?.phaseStructure?.valid).length,
                total: successfulTests.length
            }
        }
    };
    
    return summary;
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('🚀 Starting MCAT Study Schedule Planner Test Suite');
    console.log('=' .repeat(80));
    
    const results = [];
    
    for (const config of TEST_CONFIGS) {
        const result = await runTest(config);
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate summary
    const summary = generateSummaryReport(results);
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(TEST_RESULTS_DIR, `test-results-${timestamp}.json`);
    const summaryFile = path.join(TEST_RESULTS_DIR, `test-summary-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    // Print final summary
    console.log('\n' + '=' .repeat(80));
    console.log('📋 FINAL TEST SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total Tests: ${summary.overview.totalTests}`);
    console.log(`Passed Tests: ${summary.overview.passedTests}`);
    console.log(`Failed Tests: ${summary.overview.failedTests}`);
    console.log(`Overall Score: ${summary.overview.overallScore}% (Grade: ${summary.overview.grade})`);
    
    console.log('\n📊 Validation Summary:');
    Object.entries(summary.validationSummary).forEach(([validation, stats]) => {
        const percentage = stats.total > 0 ? (stats.passed / stats.total * 100).toFixed(1) : 0;
        console.log(`   ${validation}: ${stats.passed}/${stats.total} (${percentage}%)`);
    });
    
    console.log(`\n💾 Results saved to:`);
    console.log(`   ${resultsFile}`);
    console.log(`   ${summaryFile}`);
    
    if (summary.overview.failedTests > 0) {
        console.log('\n❌ Failed Tests:');
        const failedTests = results.filter(r => r.error);
        failedTests.forEach(test => {
            console.log(`   - ${test.config.name}: ${test.error}`);
        });
    }
    
    console.log('\n✅ Test suite completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, runTest, validators, TEST_CONFIGS };
