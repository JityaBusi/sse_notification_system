# sse_notification_system
# SSE Notification System
Build a Real-Time SSE Notification System with Event Persistence and Replay

# SSE Notification System

## Overview

This project is a **Server-Sent Events (SSE) based notification system** built with:

* Node.js (Express)
* PostgreSQL
* Docker & Docker Compose

It supports:

* Publishing events to channels
* Subscribing/unsubscribing users to channels
* Real-time event streaming via SSE
* Automatic heartbeat to keep connections alive
* Event replay using `Last-Event-ID`
* Event history with pagination

This system ensures that users only receive events for channels they are subscribed to.

---

# How To Run

## Prerequisites

* Docker
* Docker Compose

No manual PostgreSQL setup is required.

---

## Start the Application

```bash
docker-compose up --build
```

This will:

* Start PostgreSQL
* Run database initialization (`init.sql`)
* Start the Node.js server
* Connect automatically to the database

Server will run at:

```
http://localhost:8080
```

---

## Stop the Application

```bash
docker-compose down
```

To reset everything (including database data):

```bash
docker-compose down -v
```

---

# How To Test With curl

## 1️⃣ Subscribe User to Channel

```bash
curl -X POST http://localhost:8080/api/subscriptions/subscribe \
-H "Content-Type: application/json" \
-d "{\"userId\":1,\"channel\":\"test-channel\"}"
```

Expected response:

```json
{
  "status": "subscribed",
  "userId": 1,
  "channel": "test-channel"
}
```

---

## 2️⃣ Publish an Event

```bash
curl -X POST http://localhost:8080/api/events/publish \
-H "Content-Type: application/json" \
-d "{\"channel\":\"test-channel\",\"eventType\":\"ALERT\",\"payload\":{\"message\":\"hello world\"}}"
```

Expected:

* HTTP 202 Accepted
* Empty body

---

## 3️⃣ Start SSE Stream

```bash
curl -N "http://localhost:8080/api/events/stream?userId=1&channels=test-channel"
```

You should see:

```
: heartbeat

id: 1
event: ALERT
data: {"message":"hello world"}
```

---

## 4️⃣ Replay Events Using Last-Event-ID

```bash
curl -N -H "Last-Event-ID: 2" \
"http://localhost:8080/api/events/stream?userId=1&channels=test-channel"
```

Server will send:

* All events with `id > 2`
* In ascending order
* Then resume live streaming

---

## 5️⃣ Get Event History

```bash
curl "http://localhost:8080/api/events/history?channel=test-channel&limit=2"
```

Example response:

```json
{
  "events": [
    {
      "id": 1,
      "channel": "test-channel",
      "eventType": "ALERT",
      "payload": { "message": "hello world" },
      "createdAt": "2026-03-04T17:36:56.721Z"
    }
  ]
}
```

---

# Architecture Overview

## High-Level Flow

1. Client subscribes to channel
2. Client opens SSE connection
3. Server validates subscription
4. Server streams:

   * Replay events (if `Last-Event-ID` provided)
   * Live events
   * Heartbeats
5. Events are persisted in PostgreSQL

---

## Components

### 1️⃣ Express Server

Handles:

* REST APIs
* SSE connections
* Subscription validation

---

### 2️⃣ PostgreSQL

Stores:

**events**

* id (BIGSERIAL)
* channel
* event_type
* payload (JSONB)
* created_at

**user_subscriptions**

* user_id
* channel
* composite primary key

---

### 3️⃣ SSE Layer

* Uses `text/event-stream`
* Maintains open HTTP connection
* Sends heartbeat every few seconds
* Supports event replay

---

## Data Flow

**Publish Flow**

1. Insert event into DB
2. Fetch active connections
3. Push event to matching subscribers

**Replay Flow**

1. Read `Last-Event-ID` header
2. Query DB for `id > lastEventId`
3. Send ordered results
4. Resume live streaming

---

# Design Decisions

## 1️⃣ PostgreSQL with JSONB

* Flexible payload structure
* Efficient querying
* Production-ready reliability
* Strong indexing support

---

## 2️⃣ BIGSERIAL for Event IDs

* Guarantees monotonic increasing IDs
* Simplifies replay logic
* Efficient for ordered queries

---

## 3️⃣ Composite Index (channel, id)

Used for:

```sql
WHERE channel = ?
AND id > ?
ORDER BY id ASC
```

This makes replay queries fast.

---

## 4️⃣ SSE Instead of WebSockets

Reasons:

* One-way communication (server → client)
* Simpler implementation
* Automatic reconnection support
* Lower overhead

Perfect fit for notification systems.

---

## 5️⃣ Heartbeat Implementation

```
: heartbeat
```

Prevents:

* Idle connection timeouts
* Proxy buffering
* Unexpected disconnections

---

## 6️⃣ Strict Channel Authorization

User receives events only for channels they are subscribed to.

Validation is done before:

* Opening SSE stream
* Sending events

Prevents data leakage.

---

## 7️⃣ Response Formatting Layer

Database uses `snake_case`.
API responses use `camelCase`.

This ensures:

* Clean API contract
* Database abstraction
* Future-proofing

---

# Scalability Considerations (Future Improvements)

Current implementation uses in-memory connection tracking.

To scale horizontally:

* Use Redis Pub/Sub
* Deploy multiple server instances
* Use load balancer
* Move event distribution to message broker (Kafka)
* Implement connection sharding

---

# Conclusion

This system demonstrates:

* Real-time streaming
* Event persistence
* Replay support
* Channel-based authorization
* Dockerized deployment
* Clean API contract

Fully containerized and production-ready at assignment scale.

---

To run everything:

```bash
docker-compose up --build
```

That’s it.
