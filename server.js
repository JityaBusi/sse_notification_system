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

app.post("/api/events/publish", async (req, res) => {
  const { channel, eventType, payload } = req.body;

  if (!channel || !eventType || !payload) {
    return res.status(400).json({ error: "Invalid body" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (channel, event_type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [channel, eventType, payload]
    );

    const event = result.rows[0];

    // Push to active clients
    const listeners = activeConnections.get(channel);
    if (listeners) {
      listeners.forEach(client => {
        client.res.write(
          `id: ${event.id}\n` +
          `event: ${event.event_type}\n` +
          `data: ${JSON.stringify(event.payload)}\n\n`
        );
      });
    }

    res.status(202).send();
  } catch (err) {
    console.error(err);
    res.status(500).send();
  }
});

app.post("/api/events/channels/subscribe", async (req, res) => {
  const { userId, channel } = req.body;

  await pool.query(
    `INSERT INTO user_subscriptions (user_id, channel)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, channel]
  );

  res.status(201).json({
    status: "subscribed",
    userId,
    channel
  });
});

app.post("/api/events/channels/unsubscribe", async (req, res) => {
  const { userId, channel } = req.body;

  await pool.query(
    `DELETE FROM user_subscriptions
     WHERE user_id=$1 AND channel=$2`,
    [userId, channel]
  );

  res.status(200).json({
    status: "unsubscribed",
    userId,
    channel
  });
});

app.get("/api/events/stream", async (req, res) => {
  const userId = parseInt(req.query.userId);
  const channels = req.query.channels?.split(",") || [];
  const lastEventId = req.header("Last-Event-ID");

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  res.flushHeaders();

  // Validate subscription
  const subResult = await pool.query(
    `SELECT channel FROM user_subscriptions
     WHERE user_id=$1 AND channel = ANY($2::varchar[])`,
    [userId, channels]
  );

  const validChannels = subResult.rows.map(r => r.channel);

  // Replay logic
  if (lastEventId) {
    const replay = await pool.query(
      `SELECT * FROM events
       WHERE channel = ANY($1::varchar[])
       AND id > $2
       ORDER BY id ASC`,
      [validChannels, lastEventId]
    );

    replay.rows.forEach(event => {
      res.write(
        `id: ${event.id}\n` +
        `event: ${event.event_type}\n` +
        `data: ${JSON.stringify(event.payload)}\n\n`
      );
    });
  }

  // Register connection
  validChannels.forEach(channel => {
    if (!activeConnections.has(channel)) {
      activeConnections.set(channel, new Set());
    }
    activeConnections.get(channel).add({ userId, res });
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    validChannels.forEach(channel => {
      const listeners = activeConnections.get(channel);
      if (listeners) {
        listeners.forEach(client => {
          if (client.res === res) {
            listeners.delete(client);
          }
        });
      }
    });
  });
});

// app.get("/api/events/history", async (req, res) => {
//   const { channel, afterId, limit = 50 } = req.query;

//   const result = await pool.query(
//     `SELECT * FROM events
//      WHERE channel=$1
//      AND ($2::bigint IS NULL OR id > $2)
//      ORDER BY id ASC
//      LIMIT $3`,
//     [channel, afterId || null, limit]
//   );

//   res.json({ events: result.rows });
// });


app.get("/api/events/history", async (req, res) => {
  const { channel, afterId, limit = 50 } = req.query;

  const result = await pool.query(
    `SELECT * FROM events
     WHERE channel=$1
     AND ($2::bigint IS NULL OR id > $2)
     ORDER BY id ASC
     LIMIT $3`,
    [channel, afterId || null, limit]
  );

  const formattedEvents = result.rows.map(event => ({
    id: Number(event.id),
    channel: event.channel,
    eventType: event.event_type,
    payload: event.payload,
    createdAt: event.created_at
  }));

  res.json({ events: formattedEvents });
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});