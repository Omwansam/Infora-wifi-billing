"""Router-scan import and live-system takeover.

See ROUTER_SCAN_IMPORT_AND_TAKEOVER.md for the design this implements.

Layered so the interesting part is testable without a router:

    commands.py   the read-only command catalogue + its structural allowlist
    parser.py     RouterOS output -> records (pure)
    profiles.py   rate-limits and profile -> package drafts (pure)
    comments.py   mining names/phones/expiry out of /ppp secret comments (pure)
    fingerprint.py  which kind of router is this, which import path applies (pure)
    inventory.py  records -> subscriber candidates + package drafts (pure)
    scan.py       transports and ImportRun lifecycle (I/O)
    commit.py     candidates -> customers, via services.customer_import (I/O)
    adoption_script.py  the separate, additive-only cutover script

Nothing here modifies services.provisioning_scripts or the "link a MikroTik"
onboarding flow — a takeover needs an additive script, not that one.
"""
from .adoption_script import (  # noqa: F401
    build_adoption_script,
    build_canary_script,
    build_retire_secrets_script,
    build_rollback_script,
)
from .commands import (  # noqa: F401
    UnsafeCommand,
    build_agent_script,
    build_scan_commands,
)
from .commit import (  # noqa: F401
    ANCHOR_MINED,
    ANCHOR_NONE,
    ANCHOR_UNIFORM,
    commit_run,
    expiry_preview,
    revert_run,
)
# Re-exported under a distinct name on purpose: binding the function as
# `fingerprint` here would shadow the `fingerprint` submodule on the package, so
# `from services.router_scan import fingerprint` would silently hand back a
# function instead of the module.
from .fingerprint import fingerprint as build_fingerprint  # noqa: F401
from .inventory import build_inventory  # noqa: F401
from .parser import export_to_sections, parse_export, parse_records  # noqa: F401
from .profiles import parse_rate_limit  # noqa: F401
from .scan import (  # noqa: F401
    finalise_agent_run,
    ingest_agent_chunk,
    issue_ingest_token,
    rebuild_inventory,
    resolve_ingest_run,
    run_counts,
    run_fingerprint,
    run_options,
    scan_device,
    scan_from_export,
    store_options,
)
