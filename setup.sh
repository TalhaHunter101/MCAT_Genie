#!/bin/bash

echo "🚀 MCAT Study Schedule Planner - Setup Script"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL v12 or higher."
    exit 1
fi

echo "✅ Node.js and PostgreSQL are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your database credentials"
    echo "   Default values:"
    echo "   DB_HOST=localhost"
    echo "   DB_PORT=5432"
    echo "   DB_NAME=mcat_scheduler"
    echo "   DB_USER=postgres"
    echo "   DB_PASSWORD=your_password"
    echo ""
fi

# Build the application
echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Application built successfully"

# Check if database exists
echo "🗄️  Checking database connection..."
DB_NAME=${DB_NAME:-mcat_scheduler}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Try to connect to database
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
    echo "✅ Database connection successful"
else
    echo "⚠️  Database connection failed. Please ensure:"
    echo "   1. PostgreSQL is running"
    echo "   2. Database '$DB_NAME' exists"
    echo "   3. User '$DB_USER' has access to the database"
    echo "   4. Credentials in .env file are correct"
    echo ""
    echo "To create the database, run:"
    echo "   createdb -U $DB_USER $DB_NAME"
    echo ""
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database credentials"
echo "2. Create the database: createdb -U postgres mcat_scheduler"
echo "3. Run migrations: npm run migrate"
echo "4. Start the server: npm run dev"
echo "5. Test the API: npm test"
echo ""
echo "For Docker setup:"
echo "   docker-compose up -d"
echo ""
echo "API Documentation:"
echo "   Health check: http://localhost:3000/health"
echo "   Full plan: http://localhost:3000/full-plan?start_date=2025-10-06&test_date=2025-12-15&priorities=1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B&availability=Mon,Tue,Thu,Fri,Sat&fl_weekday=Sat"
