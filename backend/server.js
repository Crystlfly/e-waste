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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (val) => typeof val === 'string' && UUID_REGEX.test(val);

// 1. GET: Fetch available component catalog for buyers
app.get('/api/components', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id, 
                c.component_category, 
                c.specifications, 
                c.status, 
                p.brand, 
                p.model, 
                p.device_type,
                p.condition
            FROM salvaged_components c
            JOIN parent_devices p ON c.parent_device_id = p.id
            WHERE c.status = 'available'
            ORDER BY c.extracted_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /api/components error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. POST: Claim component (Protected with Transaction Locks to stop race conditions)
app.post('/api/claim', async (req, res) => {
    const { componentId, buyerId } = req.body;

    if (!isValidUUID(componentId) || !isValidUUID(buyerId)) {
        return res.status(400).json({ error: 'Valid componentId and buyerId UUIDs are required.' });
    }

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
            return res.status(409).json({ error: 'Component has already been claimed by another user.' });
        }

        // Update component state
        await client.query(
            `UPDATE salvaged_components SET status = 'claimed' WHERE id = $1`,
            [componentId]
        );

        // Record the transaction in the claims ledger
        const claimRes = await client.query(
            `INSERT INTO component_claims (buyer_id, component_id, claim_status) 
             VALUES ($1, $2, 'pending_pickup') RETURNING id, claimed_at`,
            [buyerId, componentId]
        );

        await client.query('COMMIT');
        res.json({
            success: true,
            claimId: claimRes.rows[0].id,
            claimedAt: claimRes.rows[0].claimed_at,
            message: 'Component successfully claimed!'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /api/claim error:', err);
        res.status(500).json({ error: 'Transaction failed during claim processing.' });
    } finally {
        client.release();
    }
});

// 3. POST: Recycler logs a broken parent device and its extracted child parts
app.post('/api/inventory', async (req, res) => {
    const { recyclerId, deviceType, brand, model, condition, components } = req.body;

    if (!isValidUUID(recyclerId)) {
        return res.status(400).json({ error: 'Invalid or missing recyclerId UUID.' });
    }
    if (!deviceType?.trim() || !brand?.trim() || !model?.trim()) {
        return res.status(400).json({ error: 'Device type, brand, and model are required.' });
    }
    if (!Array.isArray(components) || components.length === 0) {
        return res.status(400).json({ error: 'At least one extracted component is required.' });
    }

    const validComponents = components.filter((c) => c && typeof c.category === 'string' && c.category.trim());
    if (validComponents.length === 0) {
        return res.status(400).json({ error: 'At least one component with a valid category is required.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const deviceRes = await client.query(
            `INSERT INTO parent_devices (recycler_id, device_type, brand, model, condition) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [recyclerId, deviceType.trim(), brand.trim(), model.trim(), (condition || '').trim()]
        );
        const parentDeviceId = deviceRes.rows[0].id;

        for (const comp of validComponents) {
            await client.query(
                `INSERT INTO salvaged_components (parent_device_id, component_category, specifications, status) 
                 VALUES ($1, $2, $3, 'available')`,
                [parentDeviceId, comp.category.trim(), JSON.stringify(comp.specs || {})]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, parentDeviceId, insertedCount: validComponents.length });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /api/inventory error:', err);
        res.status(500).json({ error: 'Failed to record device inventory.' });
    } finally {
        client.release();
    }
});

// 4. GET: Fetch all components claimed by a specific buyer
app.get('/api/claims/:buyerId', async (req, res) => {
    const { buyerId } = req.params;

    if (!isValidUUID(buyerId)) {
        return res.status(400).json({ error: 'Invalid buyerId UUID.' });
    }

    try {
        const result = await pool.query(`
            SELECT 
                cl.id AS claim_id,
                cl.claim_status,
                cl.claimed_at,
                c.id AS component_id,
                c.component_category,
                c.specifications,
                p.brand,
                p.model,
                p.device_type
            FROM component_claims cl
            JOIN salvaged_components c ON cl.component_id = c.id
            JOIN parent_devices p ON c.parent_device_id = p.id
            WHERE cl.buyer_id = $1
            ORDER BY cl.claimed_at DESC
        `, [buyerId]);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /api/claims error:', err);
        res.status(500).json({ error: 'Failed to fetch buyer claim history.' });
    }
});

// 5. POST: Complete pickup handover (pending_pickup -> completed)
app.post('/api/claims/:claimId/complete', async (req, res) => {
    const { claimId } = req.params;

    if (!isValidUUID(claimId)) {
        return res.status(400).json({ error: 'Invalid claimId UUID.' });
    }

    try {
        const result = await pool.query(
            `UPDATE component_claims 
             SET claim_status = 'completed' 
             WHERE id = $1 AND claim_status = 'pending_pickup' 
             RETURNING *`,
            [claimId]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Claim not found or already finalized.' });
        }
        res.json({ success: true, claim: result.rows[0] });
    } catch (err) {
        console.error('POST /complete error:', err);
        res.status(500).json({ error: 'Failed to mark pickup as completed.' });
    }
});

// 6. POST: Cancel reservation & atomically release component back to available pool
app.post('/api/claims/:claimId/cancel', async (req, res) => {
    const { claimId } = req.params;

    if (!isValidUUID(claimId)) {
        return res.status(400).json({ error: 'Invalid claimId UUID.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const claimRes = await client.query(
            `SELECT component_id, claim_status FROM component_claims WHERE id = $1 FOR UPDATE`,
            [claimId]
        );

        if (claimRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Reservation ticket not found.' });
        }

        if (claimRes.rows[0].claim_status !== 'pending_pickup') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Only pending pickups can be cancelled.' });
        }

        const { component_id } = claimRes.rows[0];

        // Remove active claim lock so unique_active_claim allows future reservations
        await client.query(`DELETE FROM component_claims WHERE id = $1`, [claimId]);

        // Return salvaged component to available inventory
        await client.query(
            `UPDATE salvaged_components SET status = 'available' WHERE id = $1`,
            [component_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Reservation cancelled and part returned to pool.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /cancel error:', err);
        res.status(500).json({ error: 'Transaction failed during cancellation.' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running live on port ${PORT}`));