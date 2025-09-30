# MCAT Study Schedule Planner

A Node.js/TypeScript HTTP service that generates personalized MCAT study schedules from start date to exam day, honoring user availability and priority categories.

## Features

- **Personalized Scheduling**: Creates study plans based on your availability and content priorities
- **Phase-Based Learning**: Divides study time into three phases with different focus areas
- **Advanced Resource Management**: Sophisticated tracking system prevents resource repetition across phases
- **High-Yield Prioritization**: Focuses on high-yield content first, with intelligent fallback to low-yield
- **Complex Selection Algorithm**: Multi-criteria resource selection with specificity matching and time optimization
- **Full Length Integration**: Schedules 6 AAMC full-length exams evenly throughout the study period
- **Database Persistence**: Uses PostgreSQL to store resources and track usage across schedules
- **Deterministic Output**: Same inputs always produce identical schedules

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MCAT_Genie
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb mcat_scheduler
   
   # Or using psql
   psql -U postgres
   CREATE DATABASE mcat_scheduler;
   \q
   ```

4. **Configure environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mcat_scheduler
   DB_USER=postgres
   DB_PASSWORD=your_password
   PORT=3000
   NODE_ENV=development
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Build and start the application**
   ```bash
   npm run build
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

7. **Access Swagger Documentation**
   Once the server is running, visit:
   - **Swagger UI**: http://localhost:3000/api-docs
   - **Health Check**: http://localhost:3000/health

## API Endpoints

### GET /full-plan

Generates a personalized MCAT study schedule.

**Parameters:**
- `start_date` (required): First study day in YYYY-MM-DD format
- `test_date` (required): MCAT exam date in YYYY-MM-DD format
- `priorities` (required): Comma-separated list of content categories (e.g., "1A,1B,1D,3A,3B")
- `availability` (required): Comma-separated list of study days (e.g., "Mon,Tue,Thu,Fri,Sat")
- `fl_weekday` (required): Day of week for full-length exams (e.g., "Sat")

**Response:**
```json
{
  "schedule": [
    {
      "date": "2025-10-06",
      "kind": "break"
    },
    {
      "date": "2025-10-07",
      "kind": "study",
      "phase": 1,
      "blocks": {
        "science_content": ["Kaplan Section Title", "KA Video Title"],
        "science_discretes": ["KA Discrete Set"],
        "cars": ["JW Passage 1", "JW Passage 2"],
        "written_review_minutes": 60,
        "total_resource_minutes": 240
      }
    }
  ],
  "metadata": {
    "total_days": 70,
    "study_days": 50,
    "break_days": 20,
    "phase_1_days": 17,
    "phase_2_days": 17,
    "phase_3_days": 16,
    "full_length_days": 6
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "service": "MCAT Study Schedule Planner"
}
```

## Sample API Calls

### Example 1: 10-week study plan
```bash
curl "http://localhost:3000/full-plan?start_date=2025-10-06&test_date=2025-12-15&priorities=1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B&availability=Mon,Tue,Thu,Fri,Sat&fl_weekday=Sat"
```

### Example 2: 8-week intensive plan
```bash
curl "http://localhost:3000/full-plan?start_date=2025-11-01&test_date=2025-12-27&priorities=1A,1B,3A,3B,4A,4B,5A,5D&availability=Mon,Tue,Wed,Thu,Fri,Sat,Sun&fl_weekday=Sun"
```

### Example 3: Part-time study plan
```bash
curl "http://localhost:3000/full-plan?start_date=2025-09-01&test_date=2026-01-15&priorities=1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B&availability=Mon,Wed,Fri,Sat&fl_weekday=Sat"
```

## Study Schedule Structure

### Phase 1 (First 1/3 of study days)
- **Science Content**: 1 Kaplan section + matching Khan Academy content
- **Science Discretes**: 1 Khan Academy or Jack Westin discrete set
- **CARS**: 2 Jack Westin passages
- **Written Review**: 60 minutes

### Phase 2 (Second 1/3 of study days)
- **Science Passages**: 2 third-party passages
- **UWorld**: 1 set (10 questions)
- **Extra Discretes**: 1-2 discrete sets (not used in Phase 1)
- **CARS**: 2 Jack Westin passages
- **Written Review**: 60 minutes

### Phase 3 (Final 1/3 of study days)
- **AAMC Sets**: 2 question packs from different volumes
- **AAMC CARS**: 2 AAMC CARS passages
- **Written Review**: 60 minutes

### Full Length Exams
- 6 AAMC full-length exams
- Scheduled on specified weekday
- Evenly distributed throughout study period
- None in the last 7 days before exam

## System Architecture & Logical Flow

### **Resource Tracking System**

The system uses a sophisticated multi-level resource tracking system to prevent repetition and ensure optimal resource utilization:

#### **1. Resource Identification**
Each resource gets a unique identifier (UID):
- **Primary**: Uses `stable_id` if available from Excel data
- **Fallback**: `lower(trim(title)) + key` for unique identification

#### **2. Multi-Level Tracking**
- **Global Tracking**: `used_resources` table tracks resources across entire schedule
- **Same-Day Tracking**: Prevents duplicate resources within a single day
- **Phase-Specific Tracking**: Different rules for each phase (P1, P2, P3)

#### **3. Resource Selection Algorithm**
The system uses a complex multi-criteria selection process:

```typescript
// Selection Criteria (in order of priority):
1. Specificity Match: Concept → Subtopic → Category
2. High-Yield Priority: HY first, LY fallback for Phases 1-2
3. Never-Repeat Constraint: Avoids previously used resources
4. Time-Fit Optimization: Prefers resources within target time bands
5. Numeric Key Ordering: Proper ordering within specificity levels
6. Provider Ranking: Consistent provider priority
7. Title Alphabetical: A-Z sorting for deterministic output
8. Stable ID: Final tie-breaker
```

#### **4. Exhaustion Handling**
The system intelligently handles resource exhaustion:
- **High-Yield Exhaustion**: Falls back to low-yield content
- **Specificity Exhaustion**: Broadens from Concept → Subtopic → Category
- **Time Budget Exhaustion**: Skips items that exceed remaining time
- **Provider Exhaustion**: Uses alternative providers when needed

### **Phase-Specific Logic**

#### **Phase 1: Content Review (First 1/3 of study days)**
- **Goal**: Always pair Kaplan with matching Khan Academy content
- **Resources**: 1 Kaplan section + matching KA videos/articles + 1 discrete set + 2 Jack Westin CARS passages
- **Tracking**: All resources marked as used globally
- **Fallback**: If time short, prioritizes Kaplan + ≥1 KA content → KA 10Q → 3rd-party 10Q → CARS

#### **Phase 2: Passage Practice (Second 1/3 of study days)**
- **Goal**: Practice with passages and question sets
- **Resources**: 2 science passages + 1 UWorld set + 1-2 extra discretes (NOT used in Phase 1) + 2 Jack Westin CARS passages
- **Tracking**: Ensures discretes weren't used in Phase 1
- **Fallback**: 2 science passages + UWorld 10Q → 1 new discrete → CARS

#### **Phase 3: AAMC Only (Final 1/3 of study days)**
- **Goal**: Official AAMC materials only
- **Resources**: 2 AAMC sets from different packs + 2 AAMC CARS passages
- **Tracking**: Ensures different AAMC packs per day
- **Constraint**: Must use different packs unless nothing else available

### **CARS Provider Rules**
- **Phases 1 & 2**: Jack Westin only
- **Phase 3**: AAMC only

## Database Schema

The application uses PostgreSQL with the following main tables:

- `topics`: MCAT topic hierarchy with high-yield flags (1,026 entries)
- `khan_academy_resources`: Khan Academy videos, articles, and practice materials (1,584 entries)
- `kaplan_resources`: Kaplan science sections (280 entries)
- `jack_westin_resources`: Jack Westin CARS passages and discretes (996 entries)
- `uworld_resources`: UWorld question sets (31 entries)
- `aamc_resources`: AAMC question packs and full-length exams (30 entries)
- `used_resources`: Tracks resources used in each schedule (prevents repetition)

### **Resource Key Mapping**
Resources use hierarchical keys for matching:
- **Concept Level**: `1A.1.1` (most specific)
- **Subtopic Level**: `1A.1.x` (medium specificity)
- **Category Level**: `1A.x.x` (least specific)

The system automatically falls back through these levels when exact matches aren't available.

## Technical Implementation Details

### **Core Components**

#### **1. DataLoader (`src/services/dataLoader.ts`)**
- **Purpose**: Loads Excel data into PostgreSQL database
- **Key Features**:
  - Handles Excel formula objects for key fields
  - Maps 6 different Excel sheets to database tables
  - Provides default timing for resources without specified times
  - Validates data integrity during loading

#### **2. ResourceManager (`src/services/resourceManager.ts`)**
- **Purpose**: Manages resource queries and usage tracking
- **Key Features**:
  - Database queries for resources by topic and type
  - Tracks used resources across schedules
  - Implements never-repeat constraint
  - Handles resource UID generation

#### **3. ResourceSelectionUtils (`src/utils/resourceSelectionUtils.ts`)**
- **Purpose**: Implements complex resource selection algorithm
- **Key Features**:
  - Specificity-based matching with fallback hierarchy
  - Time-fit optimization for resource selection
  - High-yield priority filtering
  - Multi-criteria sorting (specificity → numeric → time-fit → provider → title → stable ID)
  - Same-day deduplication
  - Phase-specific filtering logic

#### **4. PhasePlanner (`src/services/phasePlanner.ts`)**
- **Purpose**: Implements phase-specific scheduling logic
- **Key Features**:
  - Phase 1: Kaplan + KA content pairing
  - Phase 2: Passage practice with UWorld integration
  - Phase 3: AAMC-only materials with pack management
  - CARS provider rules (Jack Westin for P1-2, AAMC for P3)
  - Time budget management (240 minutes + 60 review)

#### **5. ScheduleGenerator (`src/services/scheduleGenerator.ts`)**
- **Purpose**: Orchestrates the entire schedule generation process
- **Key Features**:
  - Calendar generation and study/break day classification
  - Phase division (equal thirds of study days)
  - Full-length exam distribution
  - High-yield anchor selection with priority ordering
  - Metadata calculation

### **Resource Exhaustion Detection**

The system detects and handles resource exhaustion at multiple levels:

#### **1. High-Yield Exhaustion**
```typescript
// Phase 1-2: Try high-yield first, fallback to low-yield
const highYieldCandidates = filterHighYield(candidates, topics);
if (highYieldCandidates.length > 0) {
  candidates = highYieldCandidates;
}
// Falls back to low-yield if no high-yield available
```

#### **2. Specificity Exhaustion**
```typescript
// Try exact match first, then broader matches
const matchingKeys = getMatchingKeys(anchor.key);
// 1A.1.1 → [1A.1.1, 1A.1.x, 1A.x.x]
```

#### **3. Time Budget Exhaustion**
```typescript
// Skip items that would exceed remaining time
candidates = candidates.filter(c => c.time_minutes <= timeBudget);
```

#### **4. Provider Exhaustion**
```typescript
// Use alternative providers when primary exhausted
// CARS: Jack Westin (P1-2) → AAMC (P3)
// Discretes: KA → Jack Westin
```

### **Deterministic Output Guarantee**

The system ensures deterministic output through:
1. **Consistent Sorting**: Always sorts by the same criteria in the same order
2. **Stable Resource UIDs**: Uses consistent UID generation
3. **Priority-Based Selection**: Always selects from highest priority category first
4. **Numeric Ordering**: Consistent ordering within specificity levels

## Development

### Project Structure
```
src/
├── controllers/          # HTTP request handlers
│   └── scheduleController.ts
├── database/            # Database connection and schema
│   ├── connection.ts
│   ├── migrate.ts
│   └── schema.sql
├── models/              # TypeScript interfaces
│   └── types.ts
├── services/            # Business logic
│   ├── dataLoader.ts    # Excel data loading
│   ├── resourceManager.ts # Resource queries & tracking
│   ├── phasePlanner.ts  # Phase-specific logic
│   └── scheduleGenerator.ts # Main orchestration
├── utils/               # Utility functions
│   ├── dateUtils.ts     # Date calculations
│   └── resourceSelectionUtils.ts # Complex selection algorithm
└── app.ts              # Main application entry point
```

### **System Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Excel Data    │───▶│   DataLoader     │───▶│   PostgreSQL    │
│  (6 sheets)     │    │  (Load & Parse)  │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  API Request    │───▶│ ScheduleController│───▶│ScheduleGenerator│
│ (start, test,   │    │  (Validation)    │    │ (Orchestration) │
│ priorities, etc)│    └──────────────────┘    └─────────────────┘
└─────────────────┘                                        │
                                                           ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  JSON Response  │◀───│  PhasePlanner    │◀───│ ResourceManager │
│ (Schedule +     │    │ (Phase Logic)    │    │ (Queries +      │
│  Metadata)      │    └──────────────────┘    │  Tracking)      │
└─────────────────┘                             └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │ResourceSelection│
                                                │Utils (Complex   │
                                                │ Algorithm)      │
                                                └─────────────────┘
```

### **Resource Tracking Flow**

```
Resource Selection Process:
1. Get anchor topic from priority list
2. Generate matching keys (Concept → Subtopic → Category)
3. Query database for matching resources
4. Filter by high-yield (Phases 1-2)
5. Filter by never-repeat constraint
6. Filter by same-day deduplication
7. Filter by phase-specific rules
8. Sort by multi-criteria algorithm
9. Select best resource within time budget
10. Mark as used in database
11. Add to same-day used set
12. Continue until time budget filled
```

### Available Scripts
- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Start the production server
- `npm run dev`: Start development server with hot reload
- `npm run migrate`: Run database migrations

### Adding New Resources
1. Update the Excel file with new resources
2. Restart the application to reload data
3. Resources will be automatically available for scheduling

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid parameters or missing required fields
- `500 Internal Server Error`: Server-side errors

Example error response:
```json
{
  "error": "Missing required parameters",
  "required": ["start_date", "test_date", "priorities", "availability", "fl_weekday"]
}
```

## Performance Considerations

- Database queries are optimized with proper indexing
- Resource selection uses efficient sorting algorithms
- Large datasets (3,917+ resources) are handled with pagination
- Memory usage is optimized for production deployment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions, please create an issue in the repository or contact the development team.
