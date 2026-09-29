<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# StudioFlow development guide

StudioFlow is a focused multi-tenant Pilates studio booking product. Read these
before changing product behavior:

- `docs/PRODUCT.md` — product boundary, personas, and non-negotiable rules.
- `docs/BUSINESS_RULES.md` — authoritative operational business rules.
- `docs/ROLES_PERMISSIONS.md` — role scopes and multiple-role behaviour.
- `docs/FLOWS.md` — authoritative end-to-end flows.
- `docs/UI.md` — screen map and UX/accessibility requirements.
- `docs/DATA_MODEL.md` — conceptual entities and lifecycle states.
- `docs/ARCHITECTURE.md` — application boundaries, data ownership, and tenant safety.
- `docs/ROADMAP.md` — delivery order and completed work.
- `docs/DECISIONS.md` — assumptions that require product-owner approval.
- `docs/STATUS.md` — current implementation/specification status.

Work in small vertical slices: user-facing behavior, its accessible UI states,
validation, audit trail, and tests belong together. Keep customer mobile
experiences touch-friendly; keep staff tools dense but calm on desktop.

`BUSINESS_RULES.md` is the single rule authority. Do not duplicate a rule in a
flow, UI, schema, or ticket; cite its rule ID instead. Do not implement a rule
marked approval-required until the corresponding `DECISIONS.md` item is decided.

V1 login is login-only: never add a normal-user Create Studio path, studio
selector, switching, or multi-studio membership. Super Admin provisioning is a
separate platform authority in protected `/super-admin`; normal routes resolve
the user's one verified studio Membership and role or show access
denied/account configuration required. Use Firebase Authentication recovery,
not a custom password-reset system.

Do not add marketplace discovery, social features, workout content, hardware
integrations, or broad gym-management features unless the product scope changes.
Never trust a client-provided tenant ID; scope every future Firestore read,
write, query, and Cloud Function authorization check to a verified membership.

For Next.js work, consult the applicable guide under `node_modules/next/dist/docs/`
before editing code, as required above. Prefer Server Components by default and
use Client Components only for browser state or interaction. Run `npm run lint`
and `npm run build` for meaningful UI or route changes.
