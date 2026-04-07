const express = require('express');
const router = express.Router();
const {
    initHeijunkaDb,
    getPlanByWeek,
    upsertPlan,
    deletePlanByWeek
} = require('../lib/heijunkaDb');

function getCurrentWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    return monday.toISOString().split('T')[0];
}

// Ensure DB is initialized before handling routes
router.use(async (_req, _res, next) => {
    try {
        await initHeijunkaDb();
        next();
    } catch (error) {
        console.error('Error initializing Heijunka DB:', error);
        next(error);
    }
});

// GET: Load Heijunka configuration
router.get('/config', async (req, res) => {
    try {
        const weekStart = req.query.weekStart || getCurrentWeekStart();
        const config = await getPlanByWeek(weekStart);
        res.json(config);
    } catch (error) {
        console.error('Error loading Heijunka config:', error);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

// POST: Save Heijunka configuration
router.post('/config', async (req, res) => {
    try {
        const { batches, maintenanceBlocks, setupBlocks, plannedStopBlocks, programmedStopBlocks, weekStart } = req.body;
        
        if (!Array.isArray(batches) || !Array.isArray(maintenanceBlocks) || !Array.isArray(setupBlocks) || !weekStart) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const plan = {
            batches,
            maintenanceBlocks,
            setupBlocks,
            programmedStopBlocks: Array.isArray(programmedStopBlocks) ? programmedStopBlocks : [],
            plannedStopBlocks: Array.isArray(plannedStopBlocks) ? plannedStopBlocks : [],
            weekStart,
            lastUpdated: new Date().toISOString()
        };

        const saved = await upsertPlan(plan);
        res.json({ message: 'Configuration saved successfully', config: saved });
    } catch (error) {
        console.error('Error saving Heijunka config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// DELETE: Clear Heijunka configuration
router.delete('/config', async (req, res) => {
    try {
        const weekStart = req.query.weekStart;
        if (!weekStart) {
            return res.status(400).json({ error: 'weekStart query param is required' });
        }

        await deletePlanByWeek(weekStart);
        res.json({ message: 'Configuration cleared successfully', weekStart });
    } catch (error) {
        console.error('Error clearing Heijunka config:', error);
        res.status(500).json({ error: 'Failed to clear configuration' });
    }
});

module.exports = router;
