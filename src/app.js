const express = require('express');
const cors = require('cors');
// const bodyParser = require('body-parser'); // Deprecated, use express.json
const multer = require('multer');
const userRoutes = require('./routes/userRoutes');

const app = express();
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json()); // Built-in middleware for json
app.use(express.urlencoded({ extended: true })); // Built-in middleware for urlencoded
app.use(upload.any()); // Parse multipart/form-data (for all routes)

// Debug Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers['content-type']);
  console.log('Body:', req.body);
  next();
});

// Routes
app.use('/api/users', userRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;
