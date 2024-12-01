const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');

router.post('/calculate', youtubeController.calculateIncome);
router.get('/rankings', youtubeController.getChannelRankings);

module.exports = router; 