import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../db';

const router = Router();

// GET /api/health/vaccinations/:dogId - Fetch vaccination records for a dog
router.get('/vaccinations/:dogId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { dogId } = req.params;
    const result = await query(
      `SELECT * FROM vaccinations WHERE dog_id = $1 ORDER BY next_due_date ASC`,
      [dogId]
    );
    res.json({ success: true, vaccinations: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/health/vaccinations - Add vaccination entry
router.post('/vaccinations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { dogId, vaccineType, administeredDate, nextDueDate, vetClinicName, batchNumber, notes } = req.body;
    if (!dogId || !vaccineType || !administeredDate || !nextDueDate) {
      return res.status(400).json({ success: false, error: 'Missing required vaccination fields.' });
    }

    const result = await query(
      `INSERT INTO vaccinations (dog_id, vaccine_type, administered_date, next_due_date, vet_clinic_name, batch_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [dogId, vaccineType, administeredDate, nextDueDate, vetClinicName || null, batchNumber || null, notes || null]
    );

    res.status(201).json({ success: true, vaccination: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/health/deworming/:dogId - Fetch vermifuge entries
router.get('/deworming/:dogId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { dogId } = req.params;
    const result = await query(
      `SELECT * FROM deworming WHERE dog_id = $1 ORDER BY next_due_date ASC`,
      [dogId]
    );
    res.json({ success: true, deworming: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/health/deworming - Add vermifuge entry
router.post('/deworming', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { dogId, productName, administeredDate, nextDueDate, weightAtTimeKg, notes } = req.body;
    if (!dogId || !administeredDate || !nextDueDate) {
      return res.status(400).json({ success: false, error: 'Missing required deworming fields.' });
    }

    const result = await query(
      `INSERT INTO deworming (dog_id, product_name, administered_date, next_due_date, weight_at_time_kg, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [dogId, productName || 'Milbemax', administeredDate, nextDueDate, weightAtTimeKg || null, notes || null]
    );

    res.status(201).json({ success: true, deworming: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
