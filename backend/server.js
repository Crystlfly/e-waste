require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configure your PostgreSQL connection string
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 1. GET: Fetch available component catalog for buyers
app.get('/api/components', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.component_category, c.specifications, c.status, p.brand, p.model, p.device_type
            FROM salvaged_components c
            JOIN parent_devices p ON c.parent_device_id = p.id
            WHERE c.status = 'available'
            ORDER BY c.extracted_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. POST: Claim component (Protected with Transaction Locks to stop race conditions)
app.post('/api/claim', async (req, res) => {
    const { componentId, buyerId } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Lock the specific database row so concurrent requests must wait
        const checkRes = await client.query(
            `SELECT status FROM salvaged_components WHERE id = $1 FOR UPDATE`,
            [componentId]
        );

        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Component not found.' });
        }

        if (checkRes.rows[0].status !== 'available') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Component has already been claimed by another user.' });
        }

        // Update component state
        await client.query(
            `UPDATE salvaged_components SET status = 'claimed' WHERE id = $1`,
            [componentId]
        );

        // Record the transaction in the claims ledger
        await client.query(
            `INSERT INTO component_claims (buyer_id, component_id, claim_status) VALUES ($1, $2, 'pending_pickup')`,
            [buyerId, componentId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Component successfully claimed!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Transaction failed during claim processing.' });
    } finally {
        client.release();
    }
});

// 3. POST: Recycler logs a broken parent device and its extracted child parts
app.post('/api/inventory', async (req, res) => {
    const { recyclerId, deviceType, brand, model, condition, components } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const deviceRes = await client.query(
            `INSERT INTO parent_devices (recycler_id, device_type, brand, model, condition) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [recyclerId, deviceType, brand, model, condition]
        );
        const parentDeviceId = deviceRes.rows[0].id;

        for (const comp of components) {
            await client.query(
                `INSERT INTO salvaged_components (parent_device_id, component_category, specifications, status) 
                 VALUES ($1, $2, $3, 'available')`,
                [parentDeviceId, comp.category, JSON.stringify(comp.specs)]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, parentDeviceId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to record device inventory.' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running live on port ${PORT}`));