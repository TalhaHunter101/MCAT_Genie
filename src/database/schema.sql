-- MCAT Scheduler Database Schema

-- Topics table (from Organized_MCAT_Topics sheet)
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    content_category_number VARCHAR(10) NOT NULL,
    content_category_title VARCHAR(255) NOT NULL,
    subtopic_number INTEGER NOT NULL,
    subtopic_title VARCHAR(255) NOT NULL,
    concept_number INTEGER NOT NULL,
    concept_title VARCHAR(255) NOT NULL,
    high_yield BOOLEAN NOT NULL DEFAULT FALSE,
    key VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Khan Academy Resources table
CREATE TABLE IF NOT EXISTS khan_academy_resources (
    id SERIAL PRIMARY KEY,
    stable_id VARCHAR(100),
    title VARCHAR(1000) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    key VARCHAR(20) NOT NULL,
    time_minutes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kaplan Resources table
CREATE TABLE IF NOT EXISTS kaplan_resources (
    id SERIAL PRIMARY KEY,
    stable_id VARCHAR(100),
    title VARCHAR(1000) NOT NULL,
    key VARCHAR(20) NOT NULL,
    time_minutes INTEGER DEFAULT 30,
    high_yield BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jack Westin Resources table
CREATE TABLE IF NOT EXISTS jack_westin_resources (
    id SERIAL PRIMARY KEY,
    stable_id VARCHAR(100),
    title VARCHAR(1000) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    key VARCHAR(20) NOT NULL,
    time_minutes INTEGER,
    cars_resource BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UWorld Resources table
CREATE TABLE IF NOT EXISTS uworld_resources (
    id SERIAL PRIMARY KEY,
    stable_id VARCHAR(100),
    title VARCHAR(1000) NOT NULL,
    key VARCHAR(20) NOT NULL,
    time_minutes INTEGER DEFAULT 30,
    question_count INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AAMC Resources table
CREATE TABLE IF NOT EXISTS aamc_resources (
    id SERIAL PRIMARY KEY,
    stable_id VARCHAR(100),
    title VARCHAR(1000) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    key VARCHAR(20) NOT NULL,
    time_minutes INTEGER,
    pack_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Used Resources tracking table
CREATE TABLE IF NOT EXISTS used_resources (
    id SERIAL PRIMARY KEY,
    schedule_id VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    resource_id INTEGER NOT NULL,
    resource_uid VARCHAR(1000) NOT NULL,
    used_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, resource_uid)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_topics_key ON topics(key);
CREATE INDEX IF NOT EXISTS idx_topics_high_yield ON topics(high_yield);
CREATE INDEX IF NOT EXISTS idx_ka_key ON khan_academy_resources(key);
CREATE INDEX IF NOT EXISTS idx_ka_type ON khan_academy_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_kaplan_key ON kaplan_resources(key);
CREATE INDEX IF NOT EXISTS idx_kaplan_hy ON kaplan_resources(high_yield);
CREATE INDEX IF NOT EXISTS idx_jw_key ON jack_westin_resources(key);
CREATE INDEX IF NOT EXISTS idx_jw_type ON jack_westin_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_uworld_key ON uworld_resources(key);
CREATE INDEX IF NOT EXISTS idx_aamc_key ON aamc_resources(key);
CREATE INDEX IF NOT EXISTS idx_aamc_type ON aamc_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_used_resources_schedule ON used_resources(schedule_id);
CREATE INDEX IF NOT EXISTS idx_used_resources_uid ON used_resources(resource_uid);
