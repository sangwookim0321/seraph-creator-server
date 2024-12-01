const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const youtubeRoutes = require('./src/routes/youtube');

// 환경변수 로드
dotenv.config();

const app = express();

// 미들웨어 설정
app.use(helmet());
app.use(cors());
app.use(express.json());

// 라우트 설정
app.use('/api/youtube', youtubeRoutes);

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '서버 에러가 발생했습니다.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행중입니다.`);
});
