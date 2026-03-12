#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000/api/v1"
PASS=0
FAIL=0

log_pass() { echo "  PASS: $1"; ((PASS++)); }
log_fail() { echo "  FAIL: $1"; ((FAIL++)); }

echo "=== SMOKE TEST ==="

# 1) Register a user
echo ""
echo "--- Step 1: Register user ---"
REGISTER_RESP=$(curl -sf -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"tenant_name":"Smoke Corp","tenant_slug":"smoke-test-'"$RANDOM"'","email":"smoke'"$RANDOM"'@test.dev","password":"TestPass123!","first_name":"Test","last_name":"User"}')

echo "$REGISTER_RESP" | python3 -m json.tool

ACCESS_TOKEN=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")
echo "Got access token: ${ACCESS_TOKEN:0:20}..."

# 2) POST /api/v1/vehicles — should return 201
echo ""
echo "--- Step 2: POST /api/v1/vehicles ---"
VEHICLE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/vehicles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"registration":"AB-123-CD","vin":"12345678901234567","make":"Mercedes","model":"Sprinter","year":2023,"type":"van","capacity_kg":1500,"capacity_m3":12}')

VEHICLE_BODY=$(echo "$VEHICLE_RESP" | sed '$d')
VEHICLE_STATUS=$(echo "$VEHICLE_RESP" | tail -1)

echo "Status: $VEHICLE_STATUS"
echo "$VEHICLE_BODY" | python3 -m json.tool

if [ "$VEHICLE_STATUS" = "201" ]; then
  log_pass "POST /vehicles returned 201"
else
  log_fail "POST /vehicles returned $VEHICLE_STATUS (expected 201)"
fi

VEHICLE_ID=$(echo "$VEHICLE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 3) POST /api/v1/shipments — should return 201 with status=draft and reference_code=null
echo ""
echo "--- Step 3: POST /api/v1/shipments ---"
SHIPMENT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"customer_name":"Acme Corp","origin_address":"123 Main St","origin_lat":48.8566,"origin_lng":2.3522,"dest_address":"456 Oak Ave","dest_lat":45.764,"dest_lng":4.8357,"cargo_description":"Electronics","cargo_weight_kg":500,"cargo_volume_m3":2,"cargo_type":"general","priority":"normal","scheduled_pickup_at":"2026-03-15T10:00:00Z"}')

SHIPMENT_BODY=$(echo "$SHIPMENT_RESP" | sed '$d')
SHIPMENT_STATUS=$(echo "$SHIPMENT_RESP" | tail -1)

echo "Status: $SHIPMENT_STATUS"
echo "$SHIPMENT_BODY" | python3 -m json.tool

if [ "$SHIPMENT_STATUS" = "201" ]; then
  log_pass "POST /shipments returned 201"
else
  log_fail "POST /shipments returned $SHIPMENT_STATUS (expected 201)"
fi

SHIPMENT_DATA_STATUS=$(echo "$SHIPMENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
SHIPMENT_REF=$(echo "$SHIPMENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['reference_code'])")

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

SHIPMENT_ID=$(echo "$SHIPMENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 4) POST /api/v1/shipments/:id/transition action=confirm
echo ""
echo "--- Step 4: Confirm shipment ---"
CONFIRM_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments/$SHIPMENT_ID/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"action":"confirm","data":{}}')

CONFIRM_BODY=$(echo "$CONFIRM_RESP" | sed '$d')
CONFIRM_STATUS=$(echo "$CONFIRM_RESP" | tail -1)

echo "Status: $CONFIRM_STATUS"
echo "$CONFIRM_BODY" | python3 -m json.tool

if [ "$CONFIRM_STATUS" = "200" ]; then
  log_pass "Confirm transition returned 200"
else
  log_fail "Confirm transition returned $CONFIRM_STATUS (expected 200)"
fi

CONFIRMED_STATUS=$(echo "$CONFIRM_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
CONFIRMED_REF=$(echo "$CONFIRM_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['reference_code'])")

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

# 5) Create a driver, assign vehicle+driver to shipment, then pickup
echo ""
echo "--- Step 5: Create driver ---"
DRIVER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/drivers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"employee_id":"EMP-001","first_name":"John","last_name":"Doe","phone":"+33612345678","license_number":"LIC12345","license_expiry":"2028-12-31","license_classes":["B","C"],"max_driving_hours_day":9}')

DRIVER_BODY=$(echo "$DRIVER_RESP" | sed '$d')
DRIVER_STATUS=$(echo "$DRIVER_RESP" | tail -1)

echo "Status: $DRIVER_STATUS"
echo "$DRIVER_BODY" | python3 -m json.tool

DRIVER_ID=$(echo "$DRIVER_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 5b) Assign shipment (confirm → assigned)
echo ""
echo "--- Step 5b: Assign shipment ---"
ASSIGN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments/$SHIPMENT_ID/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"action\":\"assign\",\"data\":{\"vehicle_id\":\"$VEHICLE_ID\",\"driver_id\":\"$DRIVER_ID\"}}")

ASSIGN_BODY=$(echo "$ASSIGN_RESP" | sed '$d')
ASSIGN_STATUS=$(echo "$ASSIGN_RESP" | tail -1)

echo "Status: $ASSIGN_STATUS"
echo "$ASSIGN_BODY" | python3 -m json.tool

if [ "$ASSIGN_STATUS" = "200" ]; then
  log_pass "Assign transition returned 200"
else
  log_fail "Assign transition returned $ASSIGN_STATUS (expected 200)"
fi

# 5c) Pickup (assigned → picked_up → in_transit auto-chain)
echo ""
echo "--- Step 5c: Pickup shipment (should auto-chain to in_transit) ---"
PICKUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/shipments/$SHIPMENT_ID/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"action":"pickup","data":{}}')

PICKUP_BODY=$(echo "$PICKUP_RESP" | sed '$d')
PICKUP_STATUS=$(echo "$PICKUP_RESP" | tail -1)

echo "Status: $PICKUP_STATUS"
echo "$PICKUP_BODY" | python3 -m json.tool

if [ "$PICKUP_STATUS" = "200" ]; then
  log_pass "Pickup transition returned 200"
else
  log_fail "Pickup transition returned $PICKUP_STATUS (expected 200)"
fi

PICKUP_DATA_STATUS=$(echo "$PICKUP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")

if [ "$PICKUP_DATA_STATUS" = "in_transit" ]; then
  log_pass "Pickup auto-chained: status is 'in_transit'"
else
  log_fail "Pickup status is '$PICKUP_DATA_STATUS' (expected 'in_transit')"
fi

# 6) GET /api/v1/shipments/:id/events — should have 2 events for pickup
echo ""
echo "--- Step 6: GET shipment events ---"
EVENTS_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/shipments/$SHIPMENT_ID/events" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

EVENTS_BODY=$(echo "$EVENTS_RESP" | sed '$d')
EVENTS_STATUS=$(echo "$EVENTS_RESP" | tail -1)

echo "Status: $EVENTS_STATUS"
echo "$EVENTS_BODY" | python3 -m json.tool

EVENT_COUNT=$(echo "$EVENTS_BODY" | python3 -c "
import sys, json
events = json.load(sys.stdin)['data']
pickup_events = [e for e in events if e.get('from_status') in ('assigned','picked_up') and e.get('to_status') in ('picked_up','in_transit')]
print(len(pickup_events))
")

if [ "$EVENT_COUNT" = "2" ]; then
  log_pass "Found 2 pickup-related events (assigned→picked_up, picked_up→in_transit)"
else
  log_fail "Found $EVENT_COUNT pickup-related events (expected 2)"
fi

# 7) POST /api/v1/routes + optimize
echo ""
echo "--- Step 7: Create route and optimize ---"
ROUTE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"name\":\"Test Route\",\"planned_date\":\"2026-03-15\",\"vehicle_id\":\"$VEHICLE_ID\",\"driver_id\":\"$DRIVER_ID\",\"stops\":[{\"stop_type\":\"pickup\",\"lat\":48.8566,\"lng\":2.3522,\"address\":\"Paris\",\"sequence_order\":1},{\"stop_type\":\"delivery\",\"lat\":45.764,\"lng\":4.8357,\"address\":\"Lyon\",\"sequence_order\":2}]}")

ROUTE_BODY=$(echo "$ROUTE_RESP" | sed '$d')
ROUTE_STATUS=$(echo "$ROUTE_RESP" | tail -1)

echo "Status: $ROUTE_STATUS"
echo "$ROUTE_BODY" | python3 -m json.tool

ROUTE_ID=$(echo "$ROUTE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo ""
echo "--- Step 7b: Optimize route ---"
OPTIMIZE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/routes/$ROUTE_ID/optimize" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

OPTIMIZE_BODY=$(echo "$OPTIMIZE_RESP" | sed '$d')
OPTIMIZE_STATUS=$(echo "$OPTIMIZE_RESP" | tail -1)

echo "Status: $OPTIMIZE_STATUS"
echo "$OPTIMIZE_BODY" | python3 -m json.tool

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

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
