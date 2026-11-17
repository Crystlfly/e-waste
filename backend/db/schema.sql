-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Core User Table (Handles RBAC)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('recycler', 'buyer')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Parent Device Table (The scrapped electronics)
CREATE TABLE parent_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recycler_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    device_type VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    condition VARCHAR(50),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Child Component Table (The extracted parts for the exchange)
CREATE TABLE salvaged_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_device_id UUID REFERENCES parent_devices(id) ON DELETE CASCADE,
    component_category VARCHAR(100) NOT NULL,
    specifications JSONB NOT NULL,
    status VARCHAR(50) CHECK (status IN ('available', 'claimed', 'recycled')) DEFAULT 'available',
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Claims & Transactions Table (Handles checkout & concurrency locking)
CREATE TABLE component_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    component_id UUID REFERENCES salvaged_components(id) ON DELETE RESTRICT,
    claim_status VARCHAR(50) CHECK (claim_status IN ('pending_pickup', 'completed', 'cancelled')) DEFAULT 'pending_pickup',
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_active_claim UNIQUE (component_id) 
);

-- Insert a default Recycler and Buyer for testing your MVP demo
INSERT INTO users (id, email, password_hash, role) 
VALUES 
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a00', 'recycler@municipal.gov', 'hashed_pass', 'recycler'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'student@bennett.edu.in', 'hashed_pass', 'buyer')
ON CONFLICT DO NOTHING;