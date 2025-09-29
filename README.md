# MCAT Study Schedule Planner

A Node.js/TypeScript HTTP service that generates personalized MCAT study schedules from start date to exam day, honoring user availability and priority categories.

## Features

- **Personalized Scheduling**: Creates study plans based on your availability and content priorities
- **Phase-Based Learning**: Divides study time into three phases with different focus areas
- **Resource Management**: Tracks used resources to prevent repetition across phases
- **Full Length Integration**: Schedules 6 AAMC full-length exams evenly throughout the study period
- **Database Persistence**: Uses PostgreSQL to store resources and track usage
- **High-Yield Prioritization**: Focuses on high-yield content first, with low-yield as fallback

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

## Database Schema

The application uses PostgreSQL with the following main tables:

- `topics`: MCAT topic hierarchy with high-yield flags
- `khan_academy_resources`: Khan Academy videos, articles, and practice materials
- `kaplan_resources`: Kaplan science sections
- `jack_westin_resources`: Jack Westin CARS passages and discretes
- `uworld_resources`: UWorld question sets
- `aamc_resources`: AAMC question packs and full-length exams
- `used_resources`: Tracks resources used in each schedule

## Development

### Project Structure
```
src/
├── controllers/          # HTTP request handlers
├── database/            # Database connection and schema
├── models/              # TypeScript interfaces
├── services/            # Business logic
├── utils/               # Utility functions
└── app.ts              # Main application entry point
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
