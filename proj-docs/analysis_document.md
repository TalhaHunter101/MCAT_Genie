# MCAT Study Schedule Planner - Project Analysis

## 1. Project Overview

### Purpose
Build a Node.js/TypeScript HTTP service that generates a personalized MCAT study schedule from the start date to the day before the exam, honoring user availability and priority categories.

### Core Deliverable
- **HTTP GET**: `/full-plan`
- **Output**: JSON schedule for each calendar day from start to test-1

## 2. Detailed Requirements Analysis

### 2.1 Input Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `start_date` | Date | First calendar day to plan | `2025-10-06` |
| `test_date` | Date | MCAT exam day (exclusive) | `2025-12-15` |
| `priorities` | String | Content categories in priority order | `1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B` |
| `availability` | String | Study days (comma-separated) | `Mon,Tue,Thu,Fri,Sat` |
| `fl_weekday` | String | Day for Full Length exams | `Sat` |

### 2.2 Data Source Requirements
- **File**: `Organized_MCAT_Topics.xlsx` (multi-sheet Excel file)
- **Storage**: Supabase/PostgreSQL database (load Excel data into DB)
- **Content**: 6 sheets with MCAT topics, resources, and timing information:
  1. `Organized_MCAT_Topics` (1026 rows): Topic hierarchy with HY/LY flags
  2. `Khan Academy Resources` (1584 rows): Videos, articles, passages, discretes
  3. `Kaplan_Table__Only_Sciences` (280 rows): Science sections with HY flags
  4. `Jack Westin Resources` (996 rows): CARS passages and discrete sets
  5. `UWorld Question Sets` (31 rows): 10Q sets by topic
  6. `AAMC Materials` (30 rows): Official question packs and full lengths

### 2.3 Schedule Structure

#### 2.3.1 Timeline Logic
1. **Calendar Generation**: Create date sequence from start to test-1
2. **Study vs Break Classification**: Based on availability parameter
3. **Phase Division**: Split study days into three equal parts:
   - Phase 1: First third of study days
   - Phase 2: Second third of study days  
   - Phase 3: Final third of study days
4. **Full Length Scheduling**: 6 AAMC FLs on specified weekday, evenly spaced, none in last 7 days

#### 2.3.2 Daily Time Budget
- **Total Daily Time**: 5 hours (300 minutes)
- **Written Review**: 60 minutes (fixed)
- **Resource Time**: 240 minutes (remaining)
- **Default Timings** (if not specified in data):
  - KA video: 12 min
  - KA article: 10 min
  - Kaplan section: 30 min
  - Discrete: 30 min
  - Passage: 25 min
  - UWorld 10Q: 30 min

### 2.4 Content Selection Rules

#### 2.4.1 High-Yield Priority
- **Definition**: Concept is HY if any row has `high_yield = Yes`
- **Phases 1 & 2**: Use HY concepts only under priorities
- **Fallback**: Use LY only if HY cannot fill a slot that day

#### 2.4.2 Never Repeat Rule (Phases 1-2)
- **Scope**: Same resource from Khan Academy, Kaplan, or Jack Westin
- **Tracking**: Store in separate database table `used_resources`
- **Resource ID**: `stable_id` if present, else `lower(trim(title))+url`
- **Exception**: UWorld can repeat while sets remain
- **Phase 2 Constraint**: Discretes must not be used in Phase 1

#### 2.4.3 Specificity Priority
1. **Concept** (preferred) - specificity = 0
2. **Subtopic** - specificity = 1  
3. **Category** - specificity = 2

#### 2.4.4 Numeric Key Ordering
- **Concept rows**: `(subtopic_number ASC, concept_number ASC)`
- **Subtopic rows**: `(subtopic_number ASC)`
- **Example**: 1A.1.3 comes before 1A.2.1, before 1A.1.4

### 2.5 Time-Fit Optimization
Prefer items within target bands, then closest to target:

| Resource Type | Target | Band |
|---------------|--------|------|
| KA video | 15 min | 10-15 min |
| Kaplan | 30 min | 20-30 min |
| Discrete | 30 min | 25-35 min |
| Passage | 25 min | 20-25 min |
| UWorld 10Q | 30 min | 25-35 min |

### 2.6 CARS Provider Rules
- **Phases 1 & 2**: Jack Westin only
- **Phase 3**: AAMC only

### 2.7 Day Type Structures

#### 2.7.1 Break Day
```json
{
  "date": "2025-10-06",
  "kind": "break"
}
```

#### 2.7.2 Full Length Day
```json
{
  "date": "2025-10-11", 
  "kind": "full_length",
  "provider": "AAMC",
  "name": "FL #3"
}
```

#### 2.7.3 Study Day - Phase 1
```json
{
  "date": "2025-10-07",
  "kind": "study",
  "phase": 1,
  "blocks": {
    "science_content": ["KA video", "KA article", "Kaplan section"],
    "science_discretes": ["KA set", "ThirdParty set"],
    "cars": ["passage1", "passage2"],
    "written_review_minutes": 60,
    "total_resource_minutes": 240
  }
}
```

#### 2.7.4 Study Day - Phase 2
```json
{
  "date": "2025-10-08",
  "kind": "study", 
  "phase": 2,
  "blocks": {
    "science_passages": ["passage1", "passage2"],
    "uworld_set": ["10Q set"],
    "extra_discretes": ["unused discrete set"],
    "cars": ["passage1", "passage2"],
    "written_review_minutes": 60,
    "total_resource_minutes": 240
  }
}
```

#### 2.7.5 Study Day - Phase 3
```json
{
  "date": "2025-11-20",
  "kind": "study",
  "phase": 3, 
  "blocks": {
    "aamc_sets": ["20-30Q pack A", "20-30Q pack B"],
    "aamc_CARS_passages": ["passage1", "passage2"],
    "written_review_minutes": 60,
    "total_resource_minutes": 240
  }
}
```

### 2.8 Phase-Specific Scheduling Rules

#### 2.8.1 Phase 1 Requirements
**Goal**: Always pair Kaplan with matching KA content
**Order**: Science content → Science discretes → CARS → Review

1. **Science content**: 1 Kaplan section + matching KA content (videos + articles)
2. **Science discretes**: 1 KA or Jack Westin discrete set  
3. **CARS**: 2 Jack Westin passages
4. **Written Review**: 60 min

**Fallback priority** (if time short): Kaplan + ≥1 KA content → KA 10Q → 3rd-party 10Q → CARS

#### 2.8.2 Phase 2 Requirements
**Order**: Science passages → UWorld → Extra discretes → CARS → Review

1. **Science passages**: 2 third-party (same category/subtopic as anchor OK)
2. **UWorld**: 1 set (10Q)
3. **Extra discretes**: 1-2 discrete sets (KA or Jack Westin, not used in Phase 1)
4. **CARS**: 2 Jack Westin passages
5. **Written Review**: 60 min

**Fallback priority**: 2 science passages + UWorld 10Q → 1 new discrete → CARS (drop second discrete first if needed)

#### 2.8.3 Phase 3 Requirements
**Order**: AAMC sets → AAMC CARS → Review

1. **AAMC sets**: 2 × (20-30Q) from different packs
2. **AAMC CARS passages**: 2
3. **Written Review**: 60 min

### 2.9 Anchor & Candidate Selection (Phases 1-2)

#### 2.9.1 Anchor Selection
1. Pick HY concept from highest-priority category with HY remaining
2. **Phase 1**: Science picks must match same anchor; widen if needed: Concept → Subtopic → Category
3. **Phase 2**: Science may use anchor (same subtopic OK); CARS independent

#### 2.9.2 Candidate Pool Building
For each slot, build candidates from anchor via fallback, filter by:
1. Slot type
2. Never-repeat constraint
3. Supply availability

#### 2.9.3 Sorting Criteria
1. **Specificity** (0/1/2)
2. **Numeric key order**
3. **Time-fit** (band → closeness)
4. **Provider rank** (if applicable)
5. **Title A→Z**
6. **Stable ID**

### 2.10 Additional Constraints

#### 2.10.1 Same-Day Deduplication
- Do not place same resource twice on same day (across blocks)
- **Phase 3**: Two AAMC sets must be from different packs unless nothing else available

#### 2.10.2 Deterministic Output
- Same inputs must produce same plan
- Requires consistent sorting and selection algorithms

## 3. Critical Changes from Updated Requirements

### 3.1 Major Requirement Changes

**⚠️ CRITICAL: Database Requirement Changed**
- **Original**: In-memory data loading (no database)
- **Updated**: Supabase/PostgreSQL database required
- **Impact**: Complete architecture change - need database setup, migrations, and data persistence

**⚠️ CRITICAL: Endpoint Parameter Names Changed**
- **Original**: `start` and `test` parameters
- **Updated**: `start_date` and `test_date` parameters
- **Impact**: API contract change - must update all endpoint handling

**⚠️ CRITICAL: Resource Tracking Method Changed**
- **Original**: In-memory tracking with `used_resources(schedule_id, provider, resource_uid)`
- **Updated**: Separate database table for `used_resources`
- **Impact**: Need database schema design and persistent storage

### 3.2 Deliverables Updated
- **Original**: "Small Node/TypeScript service exposing /full-plan. In-memory XLSX/CSV read; no DB. Short README with run steps and one sample call."
- **Updated**: "GitHub repository containing: Small Node/TypeScript service exposing /full-plan. Supabase / Postgres DB using XLSX. Clear documentation and three sample calls."

### 3.3 Payment Information Added
- **Test Task**: $100 for successful completion
- **Production Development**: $3000 total budget for backend development
- **Co-founder Status**: Credited as co-founder of the software

### 3.4 Simplified Technical Requirements
The updated requirements removed many detailed technical specifications:
- Removed specific time-fit bands (e.g., KA video 15 (10–15))
- Removed detailed sorting criteria
- Simplified phase descriptions
- Removed specific numeric key ordering details

## 4. Questions for Client Clarification

### 4.1 Data Structure Analysis (RESOLVED)

**Excel File Structure Confirmed:**
- **File**: `Organized_MCAT_Topics.xlsx` with 6 sheets
- **Total Resources**: 3,917 items across all providers
- **Category Structure**: Uses key format (e.g., `1A.1.1`, `3B.x.x`) for content mapping

**Key Data Schema Insights:**
1. **Topic Hierarchy** (`Organized_MCAT_Topics` sheet):
   - `key` format: `{category}.{subtopic}.{concept}` (e.g., `1A.1.1`)
   - `high_yield`: Yes/No flags for prioritization
   - 1,026 total concept entries across all categories

2. **Resource Sheets**:
   - **Khan Academy**: 1,584 resources (Videos=995, Passages=342, Discretes=138, Articles=109)
   - **Kaplan**: 280 science sections (all 30min, 103 HY, 177 LY)
   - **Jack Westin**: 996 resources (CARS passages + science discretes)
   - **UWorld**: 31 sets (all 30min, 10Q format)
   - **AAMC**: 30 question packs and 6 full lengths

3. **Resource Mapping**:
   - Resources use `key` field to map to topic hierarchy
   - Time values: KA (10-30min), Kaplan (30min), JW (20-30min), UWorld (30min)
   - Keys use `.x.x` for broader topic coverage (e.g., `1A.x.x` covers all 1A subtopics)

### 3.1.1 Detailed Data Schema

**Topic Hierarchy Sheet** (`Organized_MCAT_Topics`):
```
content_category_# | content_category_title | subtopic_number | subtopic_title | concept_number | concept_title | high_yield | key
1A                 | Structure/Function...  | 1               | Amino Acids... | 1              | Amino acid... | Yes        | 1A.1.1
```

**Resource Type Mappings**:
- **Khan Academy**: Videos (995), Practice Passages (342), Discrete Practice Questions (138), Articles (109)
- **Kaplan**: Science sections only (280 total, all 30min timing)
- **Jack Westin**: AAMC-style passages/discretes + CARS passages (Literature, Art, History, etc.)
- **UWorld**: 10-question sets covering all major topics (31 sets, all 30min)
- **AAMC**: Question packs (Bio, Chem, Physics, CARS) + 6 Full Length exams

**Resource ID Strategy**:
- Use existing `stable_id` fields where available
- Fallback: `lower(trim(title)) + url` for unique identification
- Implement provider-specific tracking for never-repeat constraint

### 4.2 Business Logic Clarifications
1. **Full Length Scheduling**:
   - Should FLs be scheduled on the first occurrence of `fl_weekday` or can they be adjusted?
   - What happens if there aren't enough Saturdays (or specified day) for 6 FLs?
   - Should FLs be spaced by calendar days or study days?

2. **Phase Transitions**:
   - What happens if study days don't divide evenly into thirds?
   - Should the transition between phases occur mid-week or at natural break points?

3. **Resource Availability**:
   - Are all resources in the Excel file guaranteed to be available?
   - How should the system handle cases where required resources are exhausted?

4. **Priority Handling**:
   - What happens if a priority category has no high-yield content available?
   - Should lower-priority categories be used if higher-priority ones are exhausted?

### 4.3 Technical Implementation Questions
1. **Performance Requirements**:
   - What is the expected response time for the endpoint?
   - Are there any memory constraints for the in-memory data loading?

2. **Error Handling**:
   - How should the system handle invalid input parameters?
   - What error messages should be returned for various failure scenarios?

3. **Date Handling**:
   - What timezone should be used for date calculations?
   - Should the system handle daylight saving time transitions?

### 4.4 Database Implementation Questions
1. **Supabase Setup**:
   - Should we use Supabase hosted service or self-hosted PostgreSQL?
   - What are the database connection requirements and credentials?
   - Do we need to set up specific database schemas or tables?

2. **Data Migration**:
   - Should the Excel data be loaded once at startup or on-demand?
   - How should we handle data updates if the Excel file changes?
   - Do we need data validation and integrity checks?

3. **Resource Tracking**:
   - What should be the schema for the `used_resources` table?
   - How should we handle resource tracking across multiple schedule generations?
   - Do we need to persist schedule history or just current state?

### 4.5 Terminology & Acronym Clarifications (confirm where ambiguous)
1. AAMC: Confirm usage refers to Association of American Medical Colleges resources (FLs, question packs) and define "packs" precisely.
2. KA: Confirm this is Khan Academy; specify what counts as a video vs article.
3. JW: Confirm Jack Westin provider scope (CARS passages, discretes) and any access constraints.
4. UWorld: Confirm 10-question set definition and repetition policy across days.
5. FL: Define "Full Length" exam scope and numbering (e.g., AAMC FL #1–#6).
6. CARS: Confirm Critical Analysis and Reasoning Skills resources/providers per phase.
7. HY/LY: Confirm "High-Yield" vs "Low-Yield" flags and any edge cases.
8. Discretes vs Passages: Clarify definitions, expected timing, and providers.
9. Packs: Define how AAMC packs are labeled and how to prevent same-pack duplicates on a day.

## 5. Implementation Plan

### 5.1 Project Structure
```
mcat-scheduler/
├── src/
│   ├── controllers/
│   │   └── scheduleController.ts
│   ├── services/
│   │   ├── dataLoader.ts
│   │   ├── scheduleGenerator.ts
│   │   ├── phasePlanner.ts
│   │   ├── resourceManager.ts
│   │   └── databaseService.ts
│   ├── models/
│   │   ├── types.ts
│   │   ├── resource.ts
│   │   ├── schedule.ts
│   │   └── database.ts
│   ├── utils/
│   │   ├── dateUtils.ts
│   │   ├── sortingUtils.ts
│   │   └── timeUtils.ts
│   └── app.ts
├── data/
│   └── Organized_MCAT_Topics (3).xlsx
├── supabase/
│   ├── migrations/
│   └── config.toml
├── package.json
├── tsconfig.json
└── README.md
```

### 5.2 Core Components

#### 5.2.1 Data Layer
- **DataLoader**: Parse 6 Excel sheets and load into Supabase/PostgreSQL database
- **DatabaseService**: Handle database operations, migrations, and queries
- **ResourceManager**: Track used resources across providers, manage availability using database
- **Types**: Define interfaces for resources, schedule items, phases, and provider-specific data

#### 5.2.2 Business Logic Layer  
- **ScheduleGenerator**: Main orchestration logic
- **PhasePlanner**: Phase-specific scheduling algorithms
- **DateUtils**: Calendar generation and date calculations
- **SortingUtils**: Implement all sorting criteria (specificity, time-fit, etc.)

#### 5.2.3 API Layer
- **ScheduleController**: Handle HTTP requests and responses
- **App**: Express server setup and routing

### 5.3 Implementation Steps

#### Phase 1: Foundation Setup
1. **Project Initialization**
   - Set up Node.js/TypeScript project
   - Install dependencies (Express, xlsx parser, date utilities, Supabase client)
   - Configure TypeScript and build process

2. **Database Setup**
   - Set up Supabase project and PostgreSQL database
   - Create database schema and tables for resources and used_resources
   - Set up database migrations and connection configuration

3. **Data Models**
   - Define TypeScript interfaces for all data structures
   - Create resource, schedule, phase, and database models
   - Implement data validation schemas

4. **Data Loading**
   - Implement multi-sheet Excel parsing (6 sheets)
   - Load data into Supabase/PostgreSQL database
   - Add data validation and error handling for key matching

#### Phase 2: Core Scheduling Logic
5. **Calendar Generation**
   - Implement date range generation
   - Add study/break day classification
   - Create phase division logic

6. **Resource Management**
   - Implement database-based resource tracking system
   - Create availability checking using database queries
   - Add never-repeat constraint handling with database persistence

7. **Selection Algorithms**
   - Implement specificity-based sorting
   - Add time-fit optimization
   - Create provider ranking system

#### Phase 3: Phase-Specific Logic
8. **Phase 1 Implementation**
   - Kaplan-KA content matching
   - Science content + discrete scheduling
   - CARS passage selection

9. **Phase 2 Implementation**  
   - Science passage scheduling
   - UWorld set integration
   - Extra discrete management

10. **Phase 3 Implementation**
    - AAMC-only content selection
    - Pack-based set distribution
    - CARS passage scheduling

#### Phase 4: Full Length Integration
11. **FL Scheduling**
    - Even distribution algorithm
    - Weekday constraint handling
    - Last 7 days exclusion

#### Phase 5: API & Testing
12. **HTTP Endpoint**
    - Express route implementation with updated parameter names (`start_date`, `test_date`)
    - Input validation
    - JSON response formatting

13. **Testing & Validation**
    - Unit tests for core algorithms
    - Integration tests for full workflow with database
    - Edge case handling

#### Phase 6: Documentation & Deployment
14. **Documentation**
    - API documentation with three sample calls
    - README with setup instructions including database setup
    - GitHub repository setup

15. **Final Validation**
    - Verify all evaluation criteria
    - Performance optimization
    - Error handling refinement

### 5.4 Key Algorithms to Implement

#### 5.4.1 Resource Selection Algorithm
```
1. Filter by anchor concept/subtopic/category
2. Apply slot type filter (video, article, discrete, etc.)
3. Remove already used resources
4. Check availability/supply
5. Sort by specificity (0 → 1 → 2)
6. Sort by numeric key order
7. Sort by time-fit (band → closeness)
8. Sort by provider rank
9. Sort by title A→Z
10. Sort by stable ID
```

#### 5.4.2 Phase Division Algorithm
```
1. Count total study days from start to test-1
2. Divide by 3 to get phase size
3. Assign first third to Phase 1
4. Assign second third to Phase 2  
5. Assign final third to Phase 3
6. Handle remainder if not evenly divisible
```

#### 5.4.3 Full Length Distribution Algorithm
```
1. Calculate total days from start to test-7
2. Divide by 5 to get spacing (6 FLs need 5 intervals)
3. Place FLs at calculated intervals on fl_weekday
4. Adjust if fl_weekday not available on calculated dates
```

### 5.5 Testing Strategy

#### 5.5.1 Unit Tests
- Date calculation utilities
- Resource selection algorithms
- Sorting and filtering functions
- Time budget calculations

#### 5.5.2 Integration Tests
- Full schedule generation
- Phase transitions
- Resource exhaustion scenarios
- Edge cases (short schedules, limited availability)

#### 5.5.3 Validation Tests
- Verify all evaluation criteria
- Test deterministic output
- Validate time budget compliance
- Check resource constraint adherence

## 6. Implementation Considerations & Risk Assessment

### 6.1 Key Implementation Notes
1. **Resource Matching Strategy**: 
   - Use exact key matching first (e.g., `1A.1.1`), then fall back to broader keys (`1A.x.x`)
   - Handle both specific concept keys and wildcard subtopic/category keys
   - Implement efficient lookup maps for O(1) resource retrieval

2. **AAMC Pack Management**: 
   - Parse AAMC materials to identify pack groupings (Vol. 1, Vol. 2, etc.)
   - Ensure Phase 3 selects from different packs on same day
   - Track pack usage to avoid same-pack duplicates

3. **Provider-Specific Logic**:
   - Jack Westin CARS passages include subject categorization (Literature, Art, etc.)
   - Khan Academy has clear resource_type distinctions (Videos vs Articles vs Passages)
   - Kaplan sections have individual HY flags independent of topic HY status

### 6.2 Technical Risks
1. **Data Complexity**: Multi-sheet Excel with complex key mapping ✅ RESOLVED
   - *Status*: Data structure fully analyzed and documented

2. **Algorithm Complexity**: Resource selection logic is intricate
   - *Mitigation*: Implement incrementally with extensive testing

3. **Performance**: Large datasets (3,917 resources) may cause memory issues
   - *Mitigation*: Use efficient data structures, indexed lookups, lazy loading

### 6.3 Business Logic Risks
1. **Ambiguous Requirements**: Some rules may be open to interpretation
   - *Mitigation*: Document assumptions, seek clarifications early

2. **Edge Cases**: Unusual input combinations may break logic
   - *Mitigation*: Comprehensive test coverage, graceful error handling

3. **Resource Exhaustion**: May run out of available content
   - *Mitigation*: Implement fallback strategies, clear error messaging

## 7. Success Criteria

The implementation will be considered successful if it meets all evaluation criteria:
- ✅ Availability respected (correct break vs study days)
- ✅ Phases split by study-day count in order: P1 → P2 → P3
- ✅ Six AAMC FLs: on fl_weekday, evenly spaced, none in last 7 days
- ✅ Phase 1: Kaplan matched with relevant KA content; no repeats across P1+P2
- ✅ Phase 2: includes passages, UWorld set, and discretes not used in P1
- ✅ Phase 3: AAMC only; two sets from different packs per day
- ✅ Daily time budget honored: 240 min resources + 60 min review
- ✅ HY-first enforced (LY only if HY can't fill a slot that day)
- ✅ Tie-breaks followed: Concept, Subtopic, Category, numeric key order, time-fit, provider rank
- ✅ Deterministic: same inputs → same plan
- ✅ Clean JSON + README + Database
- ✅ Supabase/PostgreSQL database implementation
- ✅ Updated parameter names (start_date, test_date)
- ✅ Three sample API calls documented

## 8. Next Steps

1. **Client Discussion**: Schedule 15-minute call to clarify requirements and questions
2. **Database Setup**: Set up Supabase project and configure PostgreSQL database
3. **Data Review**: Obtain and analyze the Excel file structure
4. **Prototype**: Create minimal working version with database integration
5. **Full Implementation**: Execute the detailed implementation plan
6. **Testing & Validation**: Ensure all criteria are met including database functionality
7. **Documentation**: Complete README with database setup and three sample API calls
