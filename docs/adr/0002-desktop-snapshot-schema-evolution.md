# ADR 0002: Desktop snapshot schema evolution

## Status

Accepted.

## Decision

`DesktopDomainSnapshot` is a versioned persistent contract. Version 1 is strict:
unknown persistent fields are rejected at the client and Supabase boundaries.
They must never be silently dropped and re-saved by an older application.

A persistent change includes adding, removing, renaming, or changing the type,
meaning, required status, collection, relation, or integrity semantics of a
stored field. Every incompatible persistent change requires all of the
following:

1. Increment `DESKTOP_DOMAIN_SCHEMA_VERSION`.
2. Add a versioned parser and explicit migration from every supported old version.
3. Cover IndexedDB and production snapshot migration paths with tests.
4. Consider backup, rollback, and production-shaped migration verification.
5. Add compatibility fixtures before deployment.

Adding a field without a schema-version bump is forbidden unless it is proven
non-persistent. Unsupported versions are neither downgraded nor automatically
rewritten.

## Data ownership

Local mode uses IndexedDB as an isolated development/test source of truth.
Cloud mode uses the Supabase workspace snapshot as the production source of
truth. Local IndexedDB data is not automatically synchronized or uploaded to
production. The reducer, serializer, and snapshot schema are shared; data is
not.

## Deployment protocol

Before deploying a new persistent schema: export or back up the production
snapshot, verify the migration against a production-shaped copy, deploy code
capable of the required old-version reads, perform the controlled migration,
verify cloud reload/save, and retain rollback instructions. This ADR does not
introduce a v2 migration.
