const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const PORT = process.env.PORT || 8080;

// In-memory active connections
// { channel: Set of { userId, res } }
const activeConnections = new Map();

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});