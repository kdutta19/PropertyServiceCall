# Architecture and security

## Layers

```
screens (src/app)  →  feature hooks/components  →  Repository interface  →  Supabase | Demo
                                  ↓
                          src/domain (pure rules, no React, no network)
```

- **Screens** are thin: they read route params and render a feature component.
- **Domain** (`src/domain`) holds the rules that must not drift: the status graph and per-role permissions (`transitions.ts`), form validation (`validation.ts`), queue search/sort (`filters.ts`). It has no dependencies on React or Supabase, so it is unit tested directly. The SQL function `psc_can_transition` mirrors `transitions.ts`; change them together.
- **Data** (`src/data`): screens never import Supabase. They use hooks that call a `Repository`. `createRepository()` picks `SupabaseRepository` when both env vars are set, otherwise `DemoRepository`. Errors are mapped once (`errors.ts`) into `AppError` with messages that are safe to show; raw Postgres text never reaches the UI.
- **State**: server data is TanStack Query (cache, refetch, `dataUpdatedAt` for "Last refreshed"). Zustand holds only local UI state: connectivity, search filters, and the persisted draft list. Query keys include the user id and the cache is cleared on sign-out so one person's data is never shown to the next.

The demo repository enforces the same visibility and write rules as the SQL, and the tests in `tests/demo-access.test.ts` document those rules. **It is a stand-in, not a proof the SQL is right**: the policies themselves can only be verified against a real Postgres (see "Verifying RLS" below).

## Security model

Everything is enforced in Postgres. The app is untrusted.

| Rule | Where |
|---|---|
| Tenants see only units they are members of and those units' requests | RLS: `read units`, `read requests` via `is_tenant_of_unit` |
| Technicians see only requests assigned to them | RLS: `assignee_id = auth.uid()` and org-technician check |
| Managers manage their organization | RLS read + RPCs check `is_org_manager(org_id)` |
| Clients cannot write tables directly | `revoke insert, update, delete` from `anon`/`authenticated`; no write policies |
| Activity records cannot be forged | Only `psc_log` inserts events; it sets `actor_id = auth.uid()` and the actor's role as computed by the server. Clients cannot supply either |
| Status changes follow the state machine | `change_status` / `assign_request` check `psc_can_transition` for the caller's server-derived role; completion and "waiting" require a note |
| Tenants edit/withdraw only unpicked requests | `update_request` / `withdraw_request` check `status = 'new'` and no assignee |
| Photos are private and scoped | Private bucket; storage policies parse `{org}/{request}/{file}` and require `can_view_request`; the org segment must match the request; `add_photo` re-validates the path. Display uses 30-minute signed URLs |
| Identity cannot be self-assigned | Roles come only from `memberships`, which clients cannot write. Sign-up metadata is never trusted for roles |

Design choices worth knowing:

- **Writes go through `SECURITY DEFINER` RPCs** rather than UPDATE policies. Column-level rules ("a technician may change status but not priority", "this transition needs a note") are awkward to express in policies and easy to get wrong; a function can check the transition and write the audit event atomically. Each function takes the actor from `auth.uid()`, never from a parameter, and sets `search_path`.
- **Existence is not leaked**: a request you cannot see returns "not found" in both the SQL path and the demo repository.
- **Helper functions** (`is_org_manager`, …) are `SECURITY DEFINER` so policies can consult `memberships` without recursive policy evaluation. They accept no user id parameter and are revoked from `anon`.
- **`people` view** exposes only names and roles of people connected to requests the caller can see, so the app can show "Marcus Webb" in a feed without opening up `profiles`.
- **Idempotent submit**: `unique (created_by, client_request_id)` plus an early return in `submit_request` makes retries after timeouts safe.

### Assumptions and known limits

- The anon key is public by design; the security boundary is RLS. Never ship the service-role key.
- Email confirmation and password policy are configured in the Supabase dashboard, not in this repo. Enable email confirmation for real deployments.
- A user holding only a staff membership who also has a tenant membership in the same org is out of scope; the app uses the first membership as the active role.
- Photos can only be added, not removed, by clients. Removal is a dashboard action. File type/size limits are set on the bucket (8 MB; JPEG, PNG, WebP, HEIC); there is no malware scanning.
- Signed URLs are valid for 30 minutes; a screen left open longer will show broken thumbnails until refreshed.
- There are no push notifications. "The tenant sees status changes" means they see them on next refresh (pull to refresh, or reopening the screen). Realtime subscriptions would be the next step.
- Rate limiting and abuse controls (e.g. a tenant spamming requests) are not implemented.
- Drafts are stored unencrypted in AsyncStorage on the device.

### Verifying RLS

The SQL has not been executed against a live database in this repository's test run (no Postgres available). Before relying on it, run `0001`–`0004` and `seed.sql` in a scratch Supabase project, sign in as each demo user (the `anon` key plus their JWT), and try the forbidden things: read another unit's request, update `maintenance_requests` directly, insert an `activity_events` row, upload to another request's folder. Each should fail. Turning those checks into pgTAP tests is recommended.

## Request lifecycle

```
New ──assign──▶ Assigned ──start──▶ In Progress ◀──reply──▶ Waiting on Tenant
 ▲                 │                     │
 └───unassign──────┘                     └──complete──▶ Completed ──reopen (manager)──▶ In Progress
```

| Role | May do |
|---|---|
| Tenant | Submit; edit/withdraw while New and unassigned; reply and add photos |
| Manager | Assign, reassign, unassign; set priority; any valid transition incl. reopen |
| Technician | Start work; move In Progress ⇄ Waiting on Tenant; complete (note required) |

Urgency is the tenant's description of the problem (Routine / Soon / Emergency). Priority is the manager's decision about the queue (Low / Normal / High / Urgent). An emergency starts at Urgent priority.
