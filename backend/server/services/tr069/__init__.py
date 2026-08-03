"""TR-069 / CWMP Auto Configuration Server.

Manages *customer premises equipment* — GPON ONTs and vendor routers that speak
CWMP. This is a separate fleet from `mikrotik_devices`: RouterOS has no TR-069
client, so the two never overlap.

Layout:
    soap.py      SOAP 1.1 envelope parsing and construction for CWMP RPCs
    profiles.py  vendor parameter maps (semantic field -> concrete path)
    session.py   session state machine, device registration, task queue

The device-facing endpoint is routes/tr069.py; the operator API is routes/cpe.py.
"""
