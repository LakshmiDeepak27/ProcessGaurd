import { Router } from 'express';
import {
  getHealth,
  getSystem,
  getProcesses,
  getTopProcesses,
  getAlerts,
  getHistory,
  triggerMonitor,
} from '../controllers/monitorController.js';

const router = Router();

router.get('/health', getHealth);
router.get('/system', getSystem);
router.get('/processes', getProcesses);
router.get('/processes/top', getTopProcesses);
router.get('/alerts', getAlerts);
router.get('/history', getHistory);
router.post('/monitor', triggerMonitor);

export default router;
