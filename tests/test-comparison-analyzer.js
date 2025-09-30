#!/usr/bin/env node

/**
 * MCAT Study Schedule Planner - Test Results Comparison Analyzer
 * 
 * Analyzes and compares test results across different configurations
 * Generates detailed comparison reports
 */

const fs = require('fs');
const path = require('path');

class TestComparisonAnalyzer {
    constructor(resultsDir) {
        this.resultsDir = resultsDir;
        this.reportsDir = path.join(resultsDir, 'reports');
        
        // Ensure reports directory exists
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }
    
    /**
     * Load all test result files
     */
    loadTestResults() {
        const files = fs.readdirSync(this.resultsDir)
            .filter(file => file.startsWith('test-results-') && file.endsWith('.json'));
        
        const results = [];
        files.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(this.resultsDir, file), 'utf8'));
                results.push({
                    filename: file,
                    timestamp: data[0]?.timestamp || file.split('-')[2]?.split('.')[0],
                    data
                });
            } catch (error) {
                console.warn(`Warning: Could not load ${file}: ${error.message}`);
            }
        });
        
        return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    /**
     * Compare two test results
     */
    compareResults(result1, result2) {
        const comparison = {
            test1: result1.filename,
            test2: result2.filename,
            timestamp1: result1.timestamp,
            timestamp2: result2.timestamp,
            differences: []
        };
        
        // Compare each test configuration
        const tests1 = new Map(result1.data.map(t => [t.config?.name, t]));
        const tests2 = new Map(result2.data.map(t => [t.config?.name, t]));
        
        // Find common tests
        const commonTests = [...tests1.keys()].filter(name => tests2.has(name));
        
        commonTests.forEach(testName => {
            const test1 = tests1.get(testName);
            const test2 = tests2.get(testName);
            
            const diff = this.compareTestResult(test1, test2);
            if (diff.hasDifferences) {
                comparison.differences.push({
                    testName,
                    differences: diff.differences
                });
            }
        });
        
        return comparison;
    }
    
    /**
     * Compare individual test results
     */
    compareTestResult(test1, test2) {
        const differences = [];
        
        // Compare basic metrics
        if (test1.response?.actual?.total_days !== test2.response?.actual?.total_days) {
            differences.push({
                metric: 'total_days',
                test1: test1.response?.actual?.total_days,
                test2: test2.response?.actual?.total_days
            });
        }
        
        if (test1.response?.actual?.study_days !== test2.response?.actual?.study_days) {
            differences.push({
                metric: 'study_days',
                test1: test1.response?.actual?.study_days,
                test2: test2.response?.actual?.study_days
            });
        }
        
        // Compare validation scores
        if (test1.score?.percentage !== test2.score?.percentage) {
            differences.push({
                metric: 'overall_score',
                test1: test1.score?.percentage,
                test2: test2.score?.percentage
            });
        }
        
        // Compare individual validations
        const validations = ['fullLengths', 'phaseDistribution', 'neverRepeat', 'timeBudget', 'phaseStructure'];
        validations.forEach(validation => {
            const val1 = test1.validations?.[validation]?.valid;
            const val2 = test2.validations?.[validation]?.valid;
            
            if (val1 !== val2) {
                differences.push({
                    metric: `validation_${validation}`,
                    test1: val1 ? 'PASS' : 'FAIL',
                    test2: val2 ? 'PASS' : 'FAIL'
                });
            }
        });
        
        return {
            hasDifferences: differences.length > 0,
            differences
        };
    }
    
    /**
     * Generate performance trend analysis
     */
    generateTrendAnalysis(results) {
        const trends = {
            overallScores: [],
            validationTrends: {},
            testSpecificTrends: {}
        };
        
        // Initialize validation trend tracking
        const validations = ['fullLengths', 'phaseDistribution', 'neverRepeat', 'timeBudget', 'phaseStructure'];
        validations.forEach(validation => {
            trends.validationTrends[validation] = [];
        });
        
        results.forEach(result => {
            const timestamp = new Date(result.timestamp);
            
            // Calculate overall score for this run
            const successfulTests = result.data.filter(t => !t.error);
            const overallScore = successfulTests.length > 0 
                ? successfulTests.reduce((sum, t) => sum + parseFloat(t.score?.percentage || 0), 0) / successfulTests.length
                : 0;
            
            trends.overallScores.push({
                timestamp,
                score: overallScore,
                passedTests: successfulTests.length,
                totalTests: result.data.length
            });
            
            // Track validation trends
            validations.forEach(validation => {
                const passed = successfulTests.filter(t => t.validations?.[validation]?.valid).length;
                const total = successfulTests.length;
                trends.validationTrends[validation].push({
                    timestamp,
                    passed,
                    total,
                    percentage: total > 0 ? (passed / total * 100) : 0
                });
            });
            
            // Track test-specific trends
            result.data.forEach(test => {
                if (!test.error) {
                    const testName = test.config?.name;
                    if (!trends.testSpecificTrends[testName]) {
                        trends.testSpecificTrends[testName] = [];
                    }
                    
                    trends.testSpecificTrends[testName].push({
                        timestamp,
                        score: test.score?.percentage,
                        grade: test.score?.grade
                    });
                }
            });
        });
        
        return trends;
    }
    
    /**
     * Generate configuration impact analysis
     */
    generateConfigurationAnalysis(results) {
        const analysis = {
            byStudyDays: {},
            byPriorities: {},
            byAvailability: {},
            byDuration: {}
        };
        
        results.forEach(result => {
            result.data.forEach(test => {
                if (test.error) return;
                
                const config = test.config?.params;
                const score = parseFloat(test.score?.percentage || 0);
                
                // Analyze by study days per week
                const studyDaysPerWeek = config?.availability?.split(',').length || 0;
                if (!analysis.byStudyDays[studyDaysPerWeek]) {
                    analysis.byStudyDays[studyDaysPerWeek] = [];
                }
                analysis.byStudyDays[studyDaysPerWeek].push(score);
                
                // Analyze by number of priorities
                const priorityCount = config?.priorities?.split(',').length || 0;
                if (!analysis.byPriorities[priorityCount]) {
                    analysis.byPriorities[priorityCount] = [];
                }
                analysis.byPriorities[priorityCount].push(score);
                
                // Analyze by availability pattern
                const availability = config?.availability || '';
                if (!analysis.byAvailability[availability]) {
                    analysis.byAvailability[availability] = [];
                }
                analysis.byAvailability[availability].push(score);
                
                // Analyze by duration
                const startDate = new Date(config?.start_date);
                const endDate = new Date(config?.test_date);
                const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                const durationGroup = this.getDurationGroup(duration);
                if (!analysis.byDuration[durationGroup]) {
                    analysis.byDuration[durationGroup] = [];
                }
                analysis.byDuration[durationGroup].push(score);
            });
        });
        
        // Calculate averages
        Object.keys(analysis).forEach(category => {
            Object.keys(analysis[category]).forEach(key => {
                const scores = analysis[category][key];
                analysis[category][key] = {
                    scores,
                    average: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
                    count: scores.length
                };
            });
        });
        
        return analysis;
    }
    
    /**
     * Get duration group for analysis
     */
    getDurationGroup(days) {
        if (days <= 42) return '6_weeks_or_less';
        if (days <= 56) return '7_8_weeks';
        if (days <= 84) return '9_12_weeks';
        if (days <= 112) return '13_16_weeks';
        return '17_weeks_or_more';
    }
    
    /**
     * Generate comprehensive comparison report
     */
    generateComparisonReport() {
        console.log('🔍 Generating test comparison report...');
        
        const results = this.loadTestResults();
        
        if (results.length < 2) {
            console.log('⚠️  Need at least 2 test result files for comparison');
            return;
        }
        
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalRuns: results.length,
                latestRun: results[0].filename,
                oldestRun: results[results.length - 1].filename
            },
            trendAnalysis: this.generateTrendAnalysis(results),
            configurationAnalysis: this.generateConfigurationAnalysis(results),
            pairwiseComparisons: [],
            summary: {
                bestPerformingConfigurations: [],
                worstPerformingConfigurations: [],
                mostStableConfigurations: [],
                recommendations: []
            }
        };
        
        // Generate pairwise comparisons
        for (let i = 0; i < results.length - 1; i++) {
            const comparison = this.compareResults(results[i], results[i + 1]);
            if (comparison.differences.length > 0) {
                report.pairwiseComparisons.push(comparison);
            }
        }
        
        // Generate summary insights
        this.generateSummaryInsights(report);
        
        // Save report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.reportsDir, `comparison-report-${timestamp}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        // Print summary
        this.printReportSummary(report);
        
        console.log(`\n💾 Comparison report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Generate summary insights
     */
    generateSummaryInsights(report) {
        const configAnalysis = report.configurationAnalysis;
        
        // Best performing configurations
        Object.entries(configAnalysis.byStudyDays).forEach(([studyDays, data]) => {
            if (data.average >= 90) {
                report.summary.bestPerformingConfigurations.push({
                    type: 'study_days_per_week',
                    value: studyDays,
                    averageScore: data.average.toFixed(1),
                    testCount: data.count
                });
            }
        });
        
        Object.entries(configAnalysis.byPriorities).forEach(([priorityCount, data]) => {
            if (data.average >= 90) {
                report.summary.bestPerformingConfigurations.push({
                    type: 'priority_count',
                    value: priorityCount,
                    averageScore: data.average.toFixed(1),
                    testCount: data.count
                });
            }
        });
        
        // Worst performing configurations
        Object.entries(configAnalysis.byStudyDays).forEach(([studyDays, data]) => {
            if (data.average < 70) {
                report.summary.worstPerformingConfigurations.push({
                    type: 'study_days_per_week',
                    value: studyDays,
                    averageScore: data.average.toFixed(1),
                    testCount: data.count
                });
            }
        });
        
        // Most stable configurations (lowest variance)
        Object.entries(configAnalysis.byStudyDays).forEach(([studyDays, data]) => {
            if (data.scores.length > 1) {
                const variance = this.calculateVariance(data.scores);
                report.summary.mostStableConfigurations.push({
                    type: 'study_days_per_week',
                    value: studyDays,
                    averageScore: data.average.toFixed(1),
                    variance: variance.toFixed(2),
                    testCount: data.count
                });
            }
        });
        
        // Sort by variance (ascending)
        report.summary.mostStableConfigurations.sort((a, b) => a.variance - b.variance);
        
        // Generate recommendations
        this.generateRecommendations(report);
    }
    
    /**
     * Calculate variance
     */
    calculateVariance(scores) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
    }
    
    /**
     * Generate recommendations
     */
    generateRecommendations(report) {
        const recommendations = [];
        
        // Check overall trend
        const latestScore = report.trendAnalysis.overallScores[0]?.score || 0;
        const oldestScore = report.trendAnalysis.overallScores[report.trendAnalysis.overallScores.length - 1]?.score || 0;
        
        if (latestScore > oldestScore + 5) {
            recommendations.push({
                type: 'positive_trend',
                message: `Performance has improved by ${(latestScore - oldestScore).toFixed(1)}% over time`,
                priority: 'info'
            });
        } else if (latestScore < oldestScore - 5) {
            recommendations.push({
                type: 'negative_trend',
                message: `Performance has declined by ${(oldestScore - latestScore).toFixed(1)}% over time`,
                priority: 'warning'
            });
        }
        
        // Check validation stability
        Object.entries(report.trendAnalysis.validationTrends).forEach(([validation, trend]) => {
            const latestPassRate = trend[0]?.percentage || 0;
            if (latestPassRate < 80) {
                recommendations.push({
                    type: 'validation_concern',
                    message: `${validation} validation passing at only ${latestPassRate.toFixed(1)}%`,
                    priority: 'high'
                });
            }
        });
        
        // Configuration recommendations
        const bestStudyDays = report.summary.bestPerformingConfigurations
            .filter(c => c.type === 'study_days_per_week')
            .sort((a, b) => b.averageScore - a.averageScore)[0];
        
        if (bestStudyDays) {
            recommendations.push({
                type: 'optimal_configuration',
                message: `${bestStudyDays.value} study days per week yields best performance (${bestStudyDays.averageScore}%)`,
                priority: 'info'
            });
        }
        
        report.summary.recommendations = recommendations;
    }
    
    /**
     * Print report summary
     */
    printReportSummary(report) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST COMPARISON REPORT SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`\n📈 Performance Trends:`);
        console.log(`   Latest Overall Score: ${report.trendAnalysis.overallScores[0]?.score.toFixed(1)}%`);
        console.log(`   Oldest Overall Score: ${report.trendAnalysis.overallScores[report.trendAnalysis.overallScores.length - 1]?.score.toFixed(1)}%`);
        
        console.log(`\n🔍 Validation Trends:`);
        Object.entries(report.trendAnalysis.validationTrends).forEach(([validation, trend]) => {
            const latest = trend[0]?.percentage || 0;
            console.log(`   ${validation}: ${latest.toFixed(1)}% pass rate`);
        });
        
        if (report.summary.bestPerformingConfigurations.length > 0) {
            console.log(`\n🏆 Best Performing Configurations:`);
            report.summary.bestPerformingConfigurations.forEach(config => {
                console.log(`   ${config.type}: ${config.value} (${config.averageScore}% avg)`);
            });
        }
        
        if (report.summary.recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            report.summary.recommendations.forEach(rec => {
                const icon = rec.priority === 'high' ? '🚨' : rec.priority === 'warning' ? '⚠️' : '💡';
                console.log(`   ${icon} ${rec.message}`);
            });
        }
    }
}

// Main execution
if (require.main === module) {
    const resultsDir = path.join(__dirname, 'results');
    const analyzer = new TestComparisonAnalyzer(resultsDir);
    analyzer.generateComparisonReport();
}

module.exports = TestComparisonAnalyzer;
