// Vercel entry point. Vercel treats any file under /api as a serverless
// function; we just hand it the existing Express app (server.js), which
// exports its routes without calling app.listen() here.
const { app } = require('../server');

module.exports = app;
