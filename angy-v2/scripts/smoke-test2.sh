#!/usr/bin/env bash
set -uo pipefail

BASE_URL="http://localhost:3000/api/v1"
PASS=0
FAIL=0
TMPDIR=$(mktemp -d)

log_pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
log_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "=== SMOKE TEST ==="

# Generate unique suffix
SUFFIX=$(date +%s%N | tail -c 8)

# 1) Register
echo ""
echo "--- Step 1: Register user ---"
cat > "$TMPDIR/register.json" << EOF
{"tenant_name":"Smoke Corp","tenant_slug":"smoke-$SUFFIX","email":"smoke-$SUFFIX@test.dev","password":"TestPass123!","first_name":"Test","last_name":"User"}
EOF

REG_RESP=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d @"$TMPDIR/register.json")

echo "$REG_RESP" | python3 -m json.tool 2>/dev/null || echo "$REG_RESP"

TOKEN=$(echo "$REG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "FATAL: Could not get auth token"
  exit 1
fi
echo "Got token: ${TOKEN:0:20}..."

# 2) POST /api/v1/vehicles
echo ""
echo "--- Step 2: POST /api/v1/vehicles ---"
cat > "$TMPDIR/vehicle.json" << 'EOF'
{"registration":"SMK-001","vin":"SMOKE12345678901A","make":"Mercedes","model":"Sprinter","year":2023,"type":"van","capacity_kg":1500,"capacity_m3":12}
EOF

VEHICLE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/vehicles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @"$TMPDIR/vehicle.json")

VEHICLE_BODY=$(echo "$VEHICLE_RESP" | head -n -1)
VEHICLE_STATUS=$(echo "$VEHICLE_RESP" | tail -1)

echo "HTTP $VEHICLE_STATUS"
echo "$VEHICLE_BODY" | python3 -m json.tool 2>/dev/null || echo "$VEHICLE_BODY"

if [ "$VEHICLE_STATUS" = "201" ]; then
  log_pass "POST /vehicles returned 201"
else
  log_fail "POST /vehicles returned $VEHICLE_STATUS (expected 201)"
fi

VEHICLE_ID=$(echo "$VEHICLE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "Vehicle ID: $VEHICLE_ID"

# 3) POST /api/v1/shipments
echo ""
echo "--- Step 3: POST /api/v1/shipments ---"
cat > "$TMPDIR/shipment.json" << 'EOF'
{"customer_name":"Acme Corp","origin_address":"123 Main St","origin_lat":48.8566,"origin_lng":2.3522,"dest_address":"456 Oak Ave","dest_lat":45.764,"dest_lng":4.8357,"cargo_description":"Electronics","cargo_weight_kg":500,"cargo_volume_m3":2,"cargo_type":"general","priority":"normal","scheduled_pickup_at":"2026-03-15T10:00:00Z"}
EOF

SHIPMENT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @"$TMPDIR/shipment.json")

SHIPMENT_BODY=$(echo "$SHIPMENT_RESP" | head -n -1)
SHIPMENT_STATUS=$(echo "$SHIPMENT_RESP" | tail -1)

echo "HTTP $SHIPMENT_STATUS"
echo "$SHIPMENT_BODY" | python3 -m json.tool 2>/dev/null || echo "$SHIPMENT_BODY"

if [ "$SHIPMENT_STATUS" = "201" ]; then
  log_pass "POST /shipments returned 201"
else
  log_fail "POST /shipments returned $SHIPMENT_STATUS (expected 201)"
fi

SHIPMENT_DATA_STATUS=$(echo "$SHIPMENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null || echo "UNKNOWN")
SHIPMENT_REF=$(echo "$SHIPMENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['reference_code'])" 2>/dev/null || echo "UNKNOWN")

if [ "$SHIPMENT_DATA_STATUS" = "draft" ]; then
  log_pass "Shipment status is 'draft'"
else
  log_fail "Shipment status is '$SHIPMENT_DATA_STATUS' (expected 'draft')"
fi

if [ "$SHIPMENT_REF" = "None" ] || [ "$SHIPMENT_REF" = "null" ]; then
  log_pass "Shipment reference_code is null"
else
  log_fail "Shipment reference_code is '$SHIPMENT_REF' (expected null)"
fi

SHIPMENT_ID=$(echo "$SHIPMENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "Shipment ID: $SHIPMENT_ID"

# 4) Confirm shipment
echo ""
echo "--- Step 4: Confirm shipment ---"
cat > "$TMPDIR/confirm.json" << 'EOF'
{"action":"confirm","data":{}}
EOF

CONFIRM_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments/$SHIPMENT_ID/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @"$TMPDIR/confirm.json")

CONFIRM_BODY=$(echo "$CONFIRM_RESP" | head -n -1)
CONFIRM_STATUS=$(echo "$CONFIRM_RESP" | tail -1)

echo "HTTP $CONFIRM_STATUS"
echo "$CONFIRM_BODY" | python3 -m json.tool 2>/dev/null || echo "$CONFIRM_BODY"

if [ "$CONFIRM_STATUS" = "200" ]; then
  log_pass "Confirm transition returned 200"
else
  log_fail "Confirm transition returned $CONFIRM_STATUS (expected 200)"
fi

CONFIRMED_STATUS=$(echo "$CONFIRM_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null || echo "UNKNOWN")
CONFIRMED_REF=$(echo "$CONFIRM_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['reference_code'])" 2>/dev/null || echo "UNKNOWN")

if [ "$CONFIRMED_STATUS" = "confirmed" ]; then
  log_pass "Shipment status is 'confirmed'"
else
  log_fail "Shipment status is '$CONFIRMED_STATUS' (expected 'confirmed')"
fi

if echo "$CONFIRMED_REF" | grep -qE '^SHP-[0-9]{8}-[0-9]{5}$'; then
  log_pass "Reference code matches SHP-YYYYMMDD-NNNNN: $CONFIRMED_REF"
else
  log_fail "Reference code '$CONFIRMED_REF' does not match SHP-YYYYMMDD-NNNNN"
fi

# 5) Create driver
echo ""
echo "--- Step 5: Create driver ---"
cat > "$TMPDIR/driver.json" << 'EOF'
{"employee_id":"EMP-001","first_name":"John","last_name":"Doe","phone":"+33612345678","license_number":"LIC12345","license_expiry":"2028-12-31","license_classes":["B","C"],"max_driving_hours_day":9}
EOF

DRIVER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/drivers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @"$TMPDIR/driver.json")

DRIVER_BODY=$(echo "$DRIVER_RESP" | head -n -1)
DRIVER_STATUS_CODE=$(echo "$DRIVER_RESP" | tail -1)

echo "HTTP $DRIVER_STATUS_CODE"
echo "$DRIVER_BODY" | python3 -m json.tool 2>/dev/null || echo "$DRIVER_BODY"

DRIVER_ID=$(echo "$DRIVER_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "Driver ID: $DRIVER_ID"

# 5b) Assign shipment
echo ""
echo "--- Step 5b: Assign shipment ---"
cat > "$TMPDIR/assign.json" << EOF
{"action":"assign","data":{"vehicle_id":"$VEHICLE_ID","driver_id":"$DRIVER_ID"}}
EOF

ASSIGN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments/$SHIPMENT_ID/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @"$TMPDIR/assign.json")

ASSIGN_BODY=$(echo "$ASSIGN_RESP" | head -n -1)
ASSIGN_STATUS=$(echo "$ASSIGN_RESP" | tail -1)

echo "HTTP $ASSIGN_STATUS"
echo "$ASSIGN_BODY" | python3 -m json.tool 2>/dev/null || echo "$ASSIGN_BODY"

if [ "$ASSIGN_STATUS" = "200" ]; then
  log_pass "Assign transition returned 200"
else
  log_fail "Assign transition returned $ASSIGN_STATUS (expected 200)"
fi

# 5c) Pickup (should auto-chain to in_transit)
echo ""
echo "--- Step 5c: Pickup (auto-chain to in_transit) ---"
cat > "$TMPDIR/pickup.json" << 'EOF'
{"action":"pickup","data":{}}
EOF

PICKUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments/$SHIPMENT_ID/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @"$TMPDIR/pickup.json")

PICKUP_BODY=$(echo "$PICKUP_RESP" | head -n -1)
PICKUP_STATUS=$(echo "$PICKUP_RESP" | tail -1)

echo "HTTP $PICKUP_STATUS"
echo "$PICKUP_BODY" | python3 -m json.tool 2>/dev/null || echo "$PICKUP_BODY"

if [ "$PICKUP_STATUS" = "200" ]; then
  log_pass "Pickup transition returned 200"
else
  log_fail "Pickup transition returned $PICKUP_STATUS (expected 200)"
fi

PICKUP_DATA_STATUS=$(echo "$PICKUP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null || echo "UNKNOWN")

if [ "$PICKUP_DATA_STATUS" = "in_transit" ]; then
  log_pass "Pickup auto-chained: status is 'in_transit'"
else
  log_fail "Pickup status is '$PICKUP_DATA_STATUS' (expected 'in_transit')"
fi

# 6) GET shipment events
echo ""
echo "--- Step 6: GET shipment events ---"
EVENTS_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/shipments/$SHIPMENT_ID/events" \
  -H "Authorization: Bearer $TOKEN")

EVENTS_BODY=$(echo "$EVENTS_RESP" | head -n -1)
EVENTS_STATUS=$(echo "$EVENTS_RESP" | tail -1)

echo "HTTP $EVENTS_STATUS"
echo "$EVENTS_BODY" | python3 -m json.tool 2>/dev/null || echo "$EVENTS_BODY"

EVENT_COUNT=$(echo "$EVENTS_BODY" | python3 -c "
import sys, json
events = json.load(sys.stdin)['data']
pickup_events = [e for e in events if (e.get('from_status') == 'assigned' and e.get('to_status') == 'picked_up') or (e.get('from_status') == 'picked_up' and e.get('to_status') == 'in_transit')]
print(len(pickup_events))
" 2>/dev/null || echo "0")

if [ "$EVENT_COUNT" = "2" ]; then
  log_pass "Found 2 pickup-related events (assigned->picked_up, picked_up->in_transit)"
else
  log_fail "Found $EVENT_COUNT pickup-related events (expected 2)"
fi

# 7) Create route and optimize
echo ""
echo "--- Step 7: Create route ---"
cat > "$TMPDIR/route.json" << EOF
{"name":"Test Route","planned_date":"2026-03-15","vehicle_id":"$VEHICLE_ID","driver_id":"$DRIVER_ID","stops":[{"stop_type":"pickup","lat":48.8566,"lng":2.3522,"address":"Paris","sequence_order":1},{"stop_type":"delivery","lat":45.764,"lng":4.8357,"address":"Lyon","sequence_order":2}]}
EOF

ROUTE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @"$TMPDIR/route.json")

ROUTE_BODY=$(echo "$ROUTE_RESP" | head -n -1)
ROUTE_STATUS=$(echo "$ROUTE_RESP" | tail -1)

echo "HTTP $ROUTE_STATUS"
echo "$ROUTE_BODY" | python3 -m json.tool 2>/dev/null || echo "$ROUTE_BODY"

ROUTE_ID=$(echo "$ROUTE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "Route ID: $ROUTE_ID"

echo ""
echo "--- Step 7b: Optimize route ---"
OPTIMIZE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/routes/$ROUTE_ID/optimize" \
  -H "Authorization: Bearer $TOKEN")

OPTIMIZE_BODY=$(echo "$OPTIMIZE_RESP" | head -n -1)
OPTIMIZE_STATUS=$(echo "$OPTIMIZE_RESP" | tail -1)

echo "HTTP $OPTIMIZE_STATUS"
echo "$OPTIMIZE_BODY" | python3 -m json.tool 2>/dev/null || echo "$OPTIMIZE_BODY"

if [ "$OPTIMIZE_STATUS" = "202" ]; then
  log_pass "POST /routes/:id/optimize returned 202"
else
  log_fail "POST /routes/:id/optimize returned $OPTIMIZE_STATUS (expected 202)"
fi

JOB_ID=$(echo "$OPTIMIZE_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d.get('job_id','MISSING'))" 2>/dev/null || echo "MISSING")
if [ "$JOB_ID" != "MISSING" ] && [ -n "$JOB_ID" ]; then
  log_pass "Optimize response includes job_id: $JOB_ID"
else
  log_fail "Optimize response missing job_id"
fi

# Summary
echo ""
echo "=== RESULTS ==="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"

rm -rf "$TMPDIR"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
