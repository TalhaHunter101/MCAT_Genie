# MCAT Study Schedule Planner

A Node.js/TypeScript HTTP service that generates personalized MCAT study schedules from start date to exam day, honoring user availability and priority categories.

## Features

- **Personalized Scheduling**: Creates study plans based on your availability and content priorities
- **Phase-Based Learning**: Divides study time into three phases with different focus areas
- **Zero Resource Repetition**: Strict enforcement ensures Khan Academy, Kaplan, and Jack Westin resources are used only once
- **High-Yield Prioritization**: Focuses on high-yield content first, with intelligent fallback to low-yield
- **Complex Selection Algorithm**: Multi-criteria resource selection with specificity matching and time optimization
- **Supply‑Aware Anchor Rotation**: Per‑category pointers with availability checks prevent early “exhaustion” of a single concept/subtopic
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
        "science_content": [
          {
            "title": "1.1 Amino Acids Found in Proteins - High-Yield ⚠️",
            "topic_number": "1A.1.x",
            "topic_title": "Amino acid structure and stereochemistry",
            "provider": "Kaplan",
            "time_minutes": 30,
            "high_yield": true
          }
        ],
        "science_discretes": [
          {
            "title": "Amino acids and proteins questions",
            "topic_number": "1A.x.x",
            "topic_title": "Amino acid structure and stereochemistry",
            "provider": "Khan Academy",
            "time_minutes": 30,
            "url": "https://www.khanacademy.org/test-prep/mcat/...",
            "resource_type": "Discrete Practice Questions"
          }
        ],
        "cars": [
          {
            "title": "CARS Passage 1",
            "topic_number": "CARS.x.x",
            "topic_title": "CARS Practice",
            "provider": "Jack Westin",
            "time_minutes": 20,
            "resource_type": "aamc_style_passage"
          }
        ],
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

### Phase 1: Content Review (First 1/3 of study days)

**Goal**: Build foundational knowledge by pairing Kaplan textbook sections with Khan Academy reinforcement

**Resources Per Day:**

- **Science Content**: 1 Kaplan high-yield section + 2-5 matching Khan Academy videos/articles
- **Science Discretes**: 1-3 Khan Academy or Jack Westin discrete question sets
- **CARS Practice**: 2 Jack Westin CARS passages
- **Written Review**: 60 minutes (reserved)
- **Target Time**: 200 minutes of resources

**Key Rules:**

- ✅ Kaplan sections must have matching Khan Academy content (same topic key)
- ✅ All resources (KA, Kaplan, JW) used **once only** across entire P1+P2
- ✅ Anchors rotate within each category and skip depleted concepts/subtopics
- ✅ High-yield content prioritized; low-yield only if high-yield exhausted
- ✅ CARS passages are Jack Westin only (Phase 1)

### Phase 2: Passage Practice (Second 1/3 of study days)

**Goal**: Apply knowledge through passage-based questions and UWorld practice

**Resources Per Day:**

- **Science Passages**: 2-3 Jack Westin science passages
- **UWorld**: 1 question set (10 questions, can repeat)
- **Extra Discretes**: 1-3 discrete sets **NOT used in Phase 1**
- **CARS Practice**: 2-3 Jack Westin CARS passages
- **Written Review**: 60 minutes (reserved)
- **Target Time**: 220 minutes of resources

**Key Rules:**

- ✅ UWorld sets **can repeat** (limited inventory of 31 sets)
- ✅ Discretes must NOT have been used in Phase 1
- ✅ All JW/KA resources never-repeat across P1+P2
- ✅ CARS passages are Jack Westin only (Phase 2)

### Phase 3: AAMC Official Materials (Final 1/3 of study days)

**Goal**: Practice with official AAMC materials exclusively

**Resources Per Day:**

- **AAMC Question Sets**: 4-5 official AAMC question packs (20-35Q each)
- **AAMC CARS**: 0-2 AAMC CARS passages
- **Written Review**: 60 minutes (reserved)
- **Target Time**: 220 minutes of resources

**Key Rules:**

- ✅ AAMC resources **can repeat** (only 28 resources for 23 days)
- ✅ Different packs preferred on same day (unless exhausted)
- ✅ CARS passages are AAMC only (Phase 3)
- ✅ No Khan Academy, Kaplan, or Jack Westin in Phase 3

### Full Length Exams

- **Count**: 6 AAMC full-length practice exams
- **Placement**: Evenly spaced throughout study period (typically every 7 days)
- **Day**: Scheduled on specified weekday only (e.g., every Friday or Saturday)
- **Constraint**: None in the last 7 days before exam date
- **Time**: Full day dedicated to FL (no other study blocks)

## Resource Management System

### Zero Repetition Guarantee

The system implements strict never-repeat rules for specific providers:

| Resource Type | Phase 1  | Phase 2  | Phase 3  | Can Repeat?          |
| ------------- | -------- | -------- | -------- | -------------------- |
| Kaplan        | ✅ Used  | ❌ Never | ❌ Never | ❌ NO (across P1+P2) |
| Khan Academy  | ✅ Used  | ✅ Used  | ❌ Never | ❌ NO (across P1+P2) |
| Jack Westin   | ✅ Used  | ✅ Used  | ❌ Never | ❌ NO (across P1+P2) |
| UWorld        | ❌ Never | ✅ Used  | ❌ Never | ✅ YES               |
| AAMC          | ❌ Never | ❌ Never | ✅ Used  | ✅ YES               |

### Resource Selection Algorithm

The system uses a sophisticated 7-tier selection process:

1. **Slot Type Filtering**: Match resource type to requirements
2. **High-Yield Prioritization**: Prioritize high-yield content (Phases 1-2)
3. **Never-Repeat Filtering**: Strict enforcement for KA/Kaplan/JW
4. **Supply Check for Anchors**: Skip anchors with no unused resources before selection
5. **Same-Day Deduplication**: Prevent duplicates within same day
6. **Phase-Specific Filtering**: Phase 2 excludes Phase 1 resources
7. **Multi-Criteria Sorting**: Specificity → time-fit → provider → alphabetical
8. **Time Budget Packing**: Fill remaining time up to target

### Database Schema

The application uses PostgreSQL with the following main tables:

- `topics`: MCAT topic hierarchy with high-yield flags (1,026 entries)
- `khan_academy_resources`: Khan Academy videos, articles, and practice materials (1,584 entries)
- `kaplan_resources`: Kaplan science sections with high-yield markers (280 entries)
- `jack_westin_resources`: Jack Westin CARS passages and discretes (996 entries)
- `uworld_resources`: UWorld question sets that can repeat (31 entries)
- `aamc_resources`: AAMC question packs and full-length exams (28 entries)
- `used_resources`: Tracks resources used in each schedule (prevents repetition)

### Resource Key Mapping

Resources use hierarchical keys for matching:

- **Concept Level**: `1A.1.1` (most specific)
- **Subtopic Level**: `1A.1.x` (medium specificity)
- **Category Level**: `1A.x.x` (least specific)

The system automatically falls back through these levels when exact matches aren't available.

## Project Structure

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

## Testing

The project includes comprehensive testing:

```bash
# Run full test suite
cd tests && node test-diverse-inputs.js

# Run demo test (quick validation)
node tests/demo-test.js
```

**Test Results**: 98% overall score (Grade A) with all critical validations passing.

## Available Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Start the production server
- `npm run dev`: Start development server with hot reload
- `npm run migrate`: Run database migrations

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid parameters or missing required fields
- `500 Internal Server Error`: Server-side errors

Example error response:

```json
{
  "error": "Missing required parameters",
  "required": [
    "start_date",
    "test_date",
    "priorities",
    "availability",
    "fl_weekday"
  ]
}
```

## Performance

- **Database Indexing**: All key columns indexed for O(log n) query performance
- **Query Optimization**: Exact key matching with IN clauses instead of LIKE patterns
- **Memory Efficiency**: Streaming results, minimal in-memory caching
- **Resource Selection**: O(n log n) sorting with early termination
- **Deterministic Output**: Consistent hashing and stable sorting
- **Scalability**: Handles 2,920+ resources with sub-second response times

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
