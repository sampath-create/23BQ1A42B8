# Notification System Design

## Stage 1

### Endpoints

**POST /api/notifications**
Request:
```json
{
  "type": "Placement",
  "message": "Company X is hiring",
  "studentId": "23bq1a42b*"
}
```
Respnse (201):
```json
{
  "id": "uuid",
  "type": "Placement",
  "message": "Company X is hiring",
  "studentId": "S12345",
  "isRead": false,
  "createdAt": "2026-06-05T12:00:00Z"
}
```

**GET /api/notifications?studentId=S12345&isRead=false&limit=20&cursor=uuid**
Respnse (200):
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "Result",
      "message": "Mid-sem result published",
      "studentId": "S12345",
      "isRead": false,
      "createdAt": "2026-06-05T11:58:00Z"
    }
  ],
  "nextCursor": "uuid"
}
```

**GET /api/notifications/stream?studentId=S12345**
SSE event `notification` payload:
```json
{
  "id": "uuid",
  "type": "Event",
  "message": "Tech fest registration open",
  "studentId": "S12345",
  "isRead": false,
  "createdAt": "2026-06-05T12:01:00Z"
}
```

### JSON Schema

**Notification**
```json
{
  "schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Notification",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "type": { "type": "string", "enum": ["Placement", "Event", "Result"] },
    "message": { "type": "string", "minLength": 1, "maxLength": 500 },
    "studentId": { "type": "string", "minLength": 1 },
    "isRead": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "type", "message", "studentId", "isRead", "createdAt"],
  "additionalProperties": false
}
```

**CreateNotificationRequest**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CreateNotificationRequest",
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["Placement", "Event", "Result"] },
    "message": { "type": "string", "minLength": 1, "maxLength": 500 },
    "studentId": { "type": "string", "minLength": 1 }
  },
  "required": ["type", "message", "studentId"],
  "additionalProperties": false
}
```

## Stage 2



### Schema (SQL)
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  student_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Placement','Event','Result')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_student_read_time
  ON notifications (student_id, is_read, created_at DESC);
```

### How API uses it
- POST /api/notifications -> INSERT row.
- GET /api/notifications -> SELECT by student_id + is_read, order by created_at desc, limit + cursor.




## Stage 3


**Better query**
```sql
SELECT id, notificationType, message, createdAt
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC
LIMIT 50;
```

**Index**
```sql
CREATE INDEX idx_notifications_student_read_time
  ON notifications (studentID, isRead, createdAt DESC);
```

**Cost**
- Without index: scan all rows + sort (O(n) + O(n log n)).
- With index: O(log n + k) where k is notif count for that student.

**Placement in last 7 days**
```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

## Stage 4

### Problem
- Every page load hits DB for every student, so DB is hammered.

### Fix idea
- Add cache (Redis) for notif list + unread count, short TTL (30-60s).
- Use SSE to push new notif, so UI does not poll often.



## Stage 5

### Shortcomings in given code
- It sends and writes inside same loop (slow, not reliable).
- Email and DB are tied; if email fails, db may already wrote or vice versa.
- No batching, no retry, no queue.

### Better flow (use queue)
- Step1: write notif rows in batch, mark as PENDING.
- Step2: push job ids to queue .
- Worker sends email + in-app, then mark SENT/FAILED.




