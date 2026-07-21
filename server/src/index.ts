import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup allowing local and vercel URLs
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Base Health Check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'PupPace SaaS API', timestamp: new Date() });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`🚀 PupPace SaaS Backend listening on port ${PORT}`);
});
export default app;
