# 🧪 MCAT Study Schedule Planner - Test Suite

Comprehensive test suite for validating the MCAT Study Schedule Planner API with diverse inputs and configurations.

## 📁 Test Suite Structure

```
tests/
├── README.md                    # This file
├── test-diverse-inputs.js       # Main test script with 10 diverse configurations
├── test-comparison-analyzer.js  # Analyzes and compares test results
├── run-tests.sh                # Shell script to run the complete test suite
├── results/                    # Test results (auto-created)
│   ├── test-results-*.json     # Detailed test results
│   ├── test-summary-*.json     # Summary reports
│   └── reports/                # Comparison reports (auto-created)
│       └── comparison-report-*.json
└── sample-configs/             # Sample test configurations
```

## 🚀 Quick Start

### 1. Prerequisites
- Node.js server running on `http://localhost:3000`
- Server accessible and responding to `/health` endpoint

### 2. Run Complete Test Suite
```bash
cd tests
chmod +x run-tests.sh
./run-tests.sh
```

### 3. Run Individual Components
```bash
# Check API status only
./run-tests.sh --check-only

# Run tests only (no comparison)
./run-tests.sh --tests-only

# Generate comparison report only
./run-tests.sh --compare-only

# Show summary of existing results
./run-tests.sh --summary-only
```

## 📊 Test Configurations

The test suite includes **10 diverse configurations** covering various scenarios:

### 1. **Standard 10-week Plan**
- **Duration**: 70 days (Oct 6 - Dec 15, 2025)
- **Study Days**: Mon, Tue, Thu, Fri, Sat (5 days/week)
- **Priorities**: 13 categories (1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B)
- **Full Length Day**: Saturday
- **Expected**: 50 study days

### 2. **Intensive 8-week Plan**
- **Duration**: 56 days (Nov 1 - Dec 27, 2025)
- **Study Days**: All 7 days/week
- **Priorities**: 8 categories (focused set)
- **Full Length Day**: Sunday
- **Expected**: 56 study days

### 3. **Part-time 16-week Plan**
- **Duration**: 112 days (Sep 1 - Dec 21, 2025)
- **Study Days**: Mon, Wed, Fri, Sat (4 days/week)
- **Priorities**: 13 categories
- **Full Length Day**: Saturday
- **Expected**: 64 study days

### 4. **Minimal Priorities**
- **Duration**: 61 days (Oct 15 - Dec 15, 2025)
- **Study Days**: Weekdays only (5 days/week)
- **Priorities**: 4 categories only (1A,1B,3A,3B)
- **Full Length Day**: Friday
- **Expected**: 44 study days

### 5. **Extensive Priorities**
- **Duration**: 75 days (Oct 1 - Dec 15, 2025)
- **Study Days**: All 7 days/week
- **Priorities**: All 25 categories
- **Full Length Day**: Saturday
- **Expected**: 75 study days

### 6. **Weekend Only**
- **Duration**: 77 days (Oct 4 - Dec 20, 2025)
- **Study Days**: Sat, Sun only (2 days/week)
- **Priorities**: 8 categories
- **Full Length Day**: Saturday
- **Expected**: 22 study days

### 7. **Weekday Only**
- **Duration**: 68 days (Oct 6 - Dec 13, 2025)
- **Study Days**: Mon-Fri only (5 days/week)
- **Priorities**: 9 categories
- **Full Length Day**: Friday
- **Expected**: 49 study days

### 8. **Short 6-week Plan**
- **Duration**: 42 days (Nov 15 - Dec 27, 2025)
- **Study Days**: All 7 days/week
- **Priorities**: 8 categories
- **Full Length Day**: Sunday
- **Expected**: 42 study days

### 9. **Long 20-week Plan**
- **Duration**: 142 days (Aug 1 - Dec 21, 2025)
- **Study Days**: 6 days/week (Mon-Sat)
- **Priorities**: 13 categories
- **Full Length Day**: Saturday
- **Expected**: 122 study days

### 10. **Irregular Availability**
- **Duration**: 70 days (Oct 5 - Dec 14, 2025)
- **Study Days**: Mon, Wed, Fri, Sun (4 days/week, irregular)
- **Priorities**: 10 categories
- **Full Length Day**: Sunday
- **Expected**: 40 study days

## 🔍 Validation Criteria

Each test validates **5 key requirement categories**:

### 1. **Full Length Test Placement**
- ✅ Exactly 6 AAMC full-length tests
- ✅ All on specified weekday
- ✅ Evenly distributed throughout study period
- ✅ None in last 7 days before exam

### 2. **Phase Distribution**
- ✅ Study days split into roughly equal thirds
- ✅ Phase 1: Content review (Kaplan + KA + discretes + CARS)
- ✅ Phase 2: Passage practice (passages + UWorld + discretes + CARS)
- ✅ Phase 3: AAMC only (AAMC sets + CARS)

### 3. **Never-Repeat Rule**
- ✅ Zero resources appear in both Phase 1 and Phase 2
- ✅ No duplicate resources within Phase 1
- ✅ No duplicate resources within Phase 2
- ✅ UWorld and AAMC can repeat (as specified)

### 4. **Time Budget Compliance**
- ✅ No study day exceeds 240 minutes of resources
- ✅ 60 minutes reserved for written review
- ✅ Optimal utilization (target: 75%+ of 240 min budget)

### 5. **Phase Structure**
- ✅ Phase 1: Required blocks present (science content, discretes, CARS)
- ✅ Phase 2: Required blocks present (passages, UWorld, discretes, CARS)
- ✅ Phase 3: Required blocks present (AAMC sets, AAMC CARS)

## 📈 Scoring System

Each test receives a score based on validation results:

- **A Grade (90-100%)**: Excellent compliance
- **B Grade (80-89%)**: Good compliance with minor issues
- **C Grade (70-79%)**: Acceptable with some issues
- **F Grade (<70%)**: Significant issues requiring attention

## 📊 Test Results Analysis

### Individual Test Results
Each test generates a detailed JSON file with:
- Configuration parameters
- API response data
- Validation results for all 5 categories
- Individual scores and overall grade
- Error details (if any)

### Summary Reports
Overall summary includes:
- Total tests run
- Pass/fail statistics
- Average scores across all tests
- Validation category breakdown
- Failed test details

### Comparison Reports
Trend analysis across multiple test runs:
- Performance trends over time
- Configuration impact analysis
- Stability metrics
- Recommendations for optimization

## 🛠️ Manual Testing

### Test Individual Configuration
```bash
# Example: Test standard 10-week configuration
curl "http://localhost:3000/full-plan?start_date=2025-10-06&test_date=2025-12-15&priorities=1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B&availability=Mon,Tue,Thu,Fri,Sat&fl_weekday=Sat" | jq .
```

### Validate Specific Requirements
```bash
# Check health endpoint
curl "http://localhost:3000/health"

# Test with minimal parameters
curl "http://localhost:3000/full-plan?start_date=2025-10-01&test_date=2025-10-15&priorities=1A&availability=Mon&fl_weekday=Mon"
```

## 🔧 Troubleshooting

### Common Issues

1. **API Not Running**
   ```
   ❌ API is not running at http://localhost:3000
   ```
   **Solution**: Start the server with `npm run dev`

2. **Request Timeout**
   ```
   ❌ Request timeout
   ```
   **Solution**: Check server performance, increase timeout in test script

3. **Invalid JSON Response**
   ```
   ❌ Invalid JSON response
   ```
   **Solution**: Check server logs for errors, verify API endpoint

4. **Validation Failures**
   ```
   ❌ fullLengths: 2 errors
   ```
   **Solution**: Review validation criteria, check algorithm logic

### Debug Mode
Add debug logging to test script:
```javascript
// In test-diverse-inputs.js, add:
console.log('Debug: Response data:', JSON.stringify(response, null, 2));
```

## 📝 Customizing Tests

### Add New Test Configuration
Edit `TEST_CONFIGS` array in `test-diverse-inputs.js`:
```javascript
{
    name: 'custom_test',
    params: {
        start_date: '2025-01-01',
        test_date: '2025-03-01',
        priorities: '1A,1B,3A,3B',
        availability: 'Mon,Wed,Fri',
        fl_weekday: 'Fri'
    },
    expected_days: 60,
    expected_study_days: 26,
    description: 'Custom test configuration'
}
```

### Modify Validation Criteria
Update `validators` object in `test-diverse-inputs.js`:
```javascript
validators: {
    customValidation(schedule, params) {
        // Custom validation logic
        return { valid: true, errors: [] };
    }
}
```

## 📋 Best Practices

1. **Run tests regularly** after code changes
2. **Review comparison reports** to identify regressions
3. **Monitor trends** across multiple test runs
4. **Validate edge cases** with extreme configurations
5. **Document failures** for debugging and improvement

## 🎯 Expected Results

A well-functioning system should achieve:
- **Overall Score**: 90%+ (Grade A)
- **Full Length Validation**: 100% pass rate
- **Never-Repeat Rule**: 100% compliance
- **Time Budget**: 100% compliance (no overages)
- **Phase Structure**: 90%+ pass rate
- **Phase Distribution**: 90%+ accuracy

---

**Happy Testing! 🚀**
