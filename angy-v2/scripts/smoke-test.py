#!/usr/bin/env python3
"""Smoke test for backend endpoints."""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:3000/api/v1"
PASS = 0
FAIL = 0

def post(path, body=None, token=None):
    headers = {}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def put(path, body=None, token=None):
    headers = {}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method="PUT")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def get(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", headers=headers)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def check(name, condition):
    global PASS, FAIL
    if condition:
        print(f"  PASS: {name}")
        PASS += 1
    else:
        print(f"  FAIL: {name}")
        FAIL += 1

suffix = str(int(time.time()))

# 1) Register
print("\n--- Step 1: Register ---")
status, body = post("/auth/register", {
    "tenant_name": "Smoke Corp",
    "tenant_slug": f"smoke-{suffix}",
    "email": f"smoke-{suffix}@test.dev",
    "password": "TestPass123!",
    "first_name": "Test",
    "last_name": "User",
})
print(f"HTTP {status}")
assert status == 201 and body["success"], f"Registration failed: {body}"
token = body["data"]["access_token"]
print(f"Got token: {token[:20]}...")

# 2) POST /vehicles
print("\n--- Step 2: POST /vehicles ---")
status, body = post("/vehicles", {
    "registration": f"SMK-{suffix}",
    "vin": f"WBA{suffix}1234567890"[:17],  # Must be exactly 17 chars
    "make": "Mercedes",
    "model": "Sprinter",
    "year": 2023,
    "type": "van",
    "capacity_kg": 1500,
    "capacity_m3": 12,
}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("POST /vehicles returned 201", status == 201)
vehicle_id = body.get("data", {}).get("id")
print(f"Vehicle ID: {vehicle_id}")


# 3) POST /shipments
print("\n--- Step 3: POST /shipments ---")
status, body = post("/shipments", {
    "customer_name": "Acme Corp",
    "origin_address": "123 Main St",
    "origin_lat": 48.8566,
    "origin_lng": 2.3522,
    "dest_address": "456 Oak Ave",
    "dest_lat": 45.764,
    "dest_lng": 4.8357,
    "cargo_description": "Electronics",
    "cargo_weight_kg": 500,
    "cargo_volume_m3": 2,
    "cargo_type": "general",
    "priority": "normal",
    "scheduled_pickup_at": "2026-03-15T10:00:00Z",
}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("POST /shipments returned 201", status == 201)
shipment_data = body.get("data", {})
check("Shipment status is 'draft'", shipment_data.get("status") == "draft")
check("Shipment reference_code is null", shipment_data.get("reference_code") is None)
shipment_id = shipment_data.get("id")
print(f"Shipment ID: {shipment_id}")

# 4) Confirm shipment
print("\n--- Step 4: Confirm shipment ---")
status, body = post(f"/shipments/{shipment_id}/transition", {
    "action": "confirm",
    "data": {},
}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("Confirm transition returned 200", status == 200)
confirmed_data = body.get("data", {})
check("Shipment status is 'confirmed'", confirmed_data.get("status") == "confirmed")
ref_code = confirmed_data.get("reference_code", "")
import re
check(f"Reference code matches SHP-YYYYMMDD-NNNNN: {ref_code}",
      bool(re.match(r'^SHP-\d{8}-\d{5}$', ref_code or "")))

# 5) Create driver
print("\n--- Step 5: Create driver ---")
status, body = post("/drivers", {
    "employee_id": f"EMP-{suffix}",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+33612345678",
    "license_number": f"LIC-{suffix}",
    "license_expiry": "2028-12-31",
    "license_classes": ["B", "C"],
    "max_driving_hours_day": 9,
}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("POST /drivers returned 201", status == 201)
driver_id = body.get("data", {}).get("id")
print(f"Driver ID: {driver_id}")

# 5a2) Set driver to available
print("\n--- Step 5a2: Set driver status to available ---")
status, body = put(f"/drivers/{driver_id}", {"status": "available"}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("Driver updated to available", status == 200 and body.get("data", {}).get("status") == "available")

# 5b) Assign shipment
print("\n--- Step 5b: Assign shipment ---")
status, body = post(f"/shipments/{shipment_id}/transition", {
    "action": "assign",
    "data": {
        "vehicle_id": vehicle_id,
        "driver_id": driver_id,
    },
}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("Assign transition returned 200", status == 200)

# 5c) Pickup (auto-chain to in_transit)
print("\n--- Step 5c: Pickup (auto-chain to in_transit) ---")
status, body = post(f"/shipments/{shipment_id}/transition", {
    "action": "pickup",
    "data": {},
}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("Pickup transition returned 200", status == 200)
pickup_status = body.get("data", {}).get("status")
check(f"Pickup auto-chained: status is 'in_transit' (got '{pickup_status}')",
      pickup_status == "in_transit")

# 6) GET shipment events
print("\n--- Step 6: GET shipment events ---")
status, body = get(f"/shipments/{shipment_id}/events", token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
events = body.get("data", [])
pickup_events = [
    e for e in events
    if (e.get("from_status") == "assigned" and e.get("to_status") == "picked_up")
    or (e.get("from_status") == "picked_up" and e.get("to_status") == "in_transit")
]
check(f"Found 2 pickup-related events (got {len(pickup_events)})",
      len(pickup_events) == 2)

# 7) Create route + optimize
print("\n--- Step 7: Create route ---")
status, body = post("/routes", {
    "name": "Test Route",
    "planned_date": "2026-03-15",
    "vehicle_id": vehicle_id,
    "driver_id": driver_id,
    "stops": [
        {"stop_type": "pickup", "lat": 48.8566, "lng": 2.3522, "address": "Paris", "sequence_order": 1},
        {"stop_type": "delivery", "lat": 45.764, "lng": 4.8357, "address": "Lyon", "sequence_order": 2},
    ],
}, token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
route_id = body.get("data", {}).get("id")
print(f"Route ID: {route_id}")

print("\n--- Step 7b: Optimize route ---")
status, body = post(f"/routes/{route_id}/optimize", body=None, token=token)
print(f"HTTP {status}")
print(json.dumps(body, indent=2))
check("POST /routes/:id/optimize returned 202", status == 202)
job_id = body.get("data", {}).get("job_id")
check(f"Optimize response includes job_id: {job_id}", job_id is not None and len(str(job_id)) > 0)

# Summary
print(f"\n=== RESULTS ===")
print(f"PASSED: {PASS}")
print(f"FAILED: {FAIL}")

sys.exit(1 if FAIL > 0 else 0)
