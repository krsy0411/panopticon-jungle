const express = require("express");
const morgan = require("morgan");

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Log collection endpoint - POST
app.post("/logs", (req, res) => {
  console.log("=== Received Log ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Headers:", req.headers);
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("==================\n");

  // res.status(200).json({
  //   message: 'Log received',
  //   timestamp: new Date().toISOString()
  // });
});

// Catch all for any other logs
app.all("/logs/*", (req, res) => {
  console.log("=== Received Log (Wildcard) ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("Headers:", req.headers);
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("==============================\n");

  res.status(200).json({
    message: "Log received",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Log Collection Server is running on port ${PORT}`);
  console.log(`📝 Send logs to: http://localhost:${PORT}/logs`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
});
