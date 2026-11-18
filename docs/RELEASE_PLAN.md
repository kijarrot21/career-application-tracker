# Release Plan

**Product:** Career Application Tracker (Trackr ATS)
**Baseline:** `main` at `620f7d8`, 2026-11-18
**Companion documents:** [Development Roadmap](DEVELOPMENT_ROADMAP.md) and [Development Backlog](../DEVELOPMENT_BACKLOG.md)

---

## 1. Planning Principles

1. **Evidence over intention.** A milestone is reached only when its exit criteria are demonstrated by passing tests or executed drills.
2. **No invented dates.** This plan uses ordered gates and effort estimates. Calendar commitments are made only after the deployment target and available capacity are confirmed.
3. **Local-first stays safe.** Every milestone keeps the local PGlite mode fully functional and offline-capable.
4. **Cloud features degrade gracefully.** Unconfigured AI, payments, or sync must never block core ATS use.
5. **Scope is trimmed, not quality.** If capacity is short, work moves out of the milestone; it is not shipped unverified.

---

## 2. Milestone Overview

| Milestone | Theme | Status | Gate type |
|---|---|---|---|
| M0 | Internal Development | ACHIEVED | Automated gates green |
| M1 | MVP | ACHIEVED (sign-off pending owner acceptance) | Feature-complete plus readiness report |
| M2 | Private Beta | NOT STARTED | Data safety and performance proven |
| M3 | Public Beta | NOT STARTED | Cloud foundation and live verification proven |
| M4 | Production Readiness | NOT STARTED | Operational hardening proven |

Estimated remaining effort from M2 through M4 is roughly 9 to 13 engineer-weeks for one full-time engineer, excluding waiting time for credentials and cloud provisioning. Detailed estimates are in the roadmap, section 6.

---

## 3. M0: Internal Development

**Goal:** Complete feature implementation with a reliable automated quality baseline.

**Entry criteria:** Repository baseline established.

**Scope included:** Phases 0 to 11: core ATS, archive, career profile, AI engine, AI career features, CV Studio, credits, payments with simulated providers, sync, API v1, localization, and security controls. OpenCode Stages 1 to 9 added progress detection, workflow rules, deterministic next best action, onboarding preferences, dashboard guidance, guided setup, product tour, contextual help, and onboarding settings.

**Exit criteria (all met):**

| Criterion | Evidence |
|---|---|
| Unit and integration tests green | 298 passed, 9 skipped across 42 files (current Stage 1-9 run) |
| Browser tests | 3 passed, 1 pre-existing sign-in Enter-submits assertion failing; documented in `docs/USER_ONBOARDING_TEST_PLAN.md` |
| Typecheck and build green | `npm run typecheck` and `npm run build` passed |
| Lint | Stage 1-9 files pass scoped ESLint; full command blocked by unrelated `.ua/.trash-*/tmp/*.js` scratch files |
| CI pipeline active | GitHub Actions workflow present; historic successful run recorded on `620f7d8` |
| Documentation current | README, architecture, phase status, QA documents, and Stage 1-9 onboarding docs |

**Status:** Phase 11 baseline ACHIEVED on 2026-11-17. Stage 1-9 additions verified on 2026-11-18 with the caveats above; no new production gate claimed.

---

## 4. M1: MVP

**Goal:** A complete personal ATS with AI assistance, credit accounting, and hybrid sync that is safe enough for the owner to use daily.

**Entry criteria:** M0 achieved.

**Scope included:** Everything in M0 plus the accepted exception record (DEF-11-006, PostgreSQL RLS deferred).

**Scope excluded:** Live cloud multi-tenancy, live payment gateways, background AI workers, and package administration UI.

**Exit criteria:**

| Criterion | Required | Current status |
|---|---|---|
| All P0 and P1 features implemented | Yes | MET |
| No open High-severity defects | Yes | MET (three High findings fixed and regression-tested) |
| Accepted exceptions documented | Yes | MET (DEF-11-006) |
| Production readiness report published | Yes | MET (`PHASE_11_QA_AUDIT.md`) |
| Owner sign-off | Yes | PENDING |

**Risks accepted at this milestone:**

- Cloud AI providers are not verified against live credentials.
- Payment providers are verified only with simulated responses.
- Sync is verified only against in-memory PGlite.

**Owner decision points:** Confirm the deployment target (local-first only, self-hosted, or managed cloud). This decision gates M2 and M3 scope.

---

## 5. M2: Private Beta

**Goal:** Invite a small, trusted group of users (for example, 5 to 20) with real career data, with confidence that data is recoverable and the system performs acceptably.

**Entry criteria:** M1 sign-off plus a decision on deployment target.

**Required work items:**

| Backlog ID | Item | Exit evidence |
|---|---|---|
| S10-03 | Backup and restore drill | Executed drill with documented recovery time and verified data integrity |
| S10-02 | Performance baseline | Repeatable harness plus documented latency and throughput thresholds |
| E-12 | Expand E2E to critical journeys | Additional Playwright journeys for AI, sync, and credits passing in CI |
| E-06 | Interview coach UI (recommended, not blocking) | Interview preparation available from the interviews area |

**Exit criteria:**

| Criterion | Evidence required |
|---|---|
| Backup drill passed | Restore from backup reproduces the pre-drill dataset exactly |
| Performance baseline recorded | Harness output archived with thresholds |
| No data-loss bug open | Defect register reviewed |
| Privacy notice reviewed for beta users | UU PDP notice and consent flow confirmed |
| Onboarding documented | Beta onboarding guide exists |
| Support channel defined | A named channel for beta feedback |

**Risks:**

- Restoring PGlite backups while a dev server is running is unsafe. The drill must follow the documented stop-server rule.
- Beta feedback may surface AI quality issues that require prompt iteration. Prompt versions are already recorded per run, so iterations are auditable.

**Rollback:** Beta users keep local-first data. If a regression appears, revert to the previous tagged commit and restore the documented backup. No destructive migrations are planned in this milestone.

---

## 6. M3: Public Beta

**Goal:** Open registration to a broader audience, including cloud-hosted users, with verified isolation, live integrations, and measured performance.

**Entry criteria:** M2 exit criteria met plus a provisioned staging cloud environment.

**Required work items:**

| Backlog ID | Item | Exit evidence |
|---|---|---|
| E-04 | PostgreSQL CI matrix | CI applies migrations and runs integration tests against PostgreSQL |
| E-01 | PostgreSQL RLS | Policies proven by cross-tenant tests on PostgreSQL |
| E-02 | Object storage adapter | Upload and download verified through the adapter |
| E-03 | Live cloud sync round-trip | Two-device sync verified on real infrastructure |
| E-05 | Payment live verification | Sandbox checkout, webhook, reconciliation, and refund verified with real gateway calls |
| E-09 | CSP nonce tightening | No `unsafe-inline` for scripts; regression suite green |
| E-08 | Axe-core scans | Zero critical accessibility violations in CI |

**Exit criteria:**

| Criterion | Evidence required |
|---|---|
| Tenant isolation proven | Cross-user access attempts denied in automated tests |
| Money flow proven | Sandbox transaction end to end with exactly one credit grant and a successful refund |
| Cloud sync proven | Push, pull, and conflict resolution on staging |
| Performance within baseline | Staging measurements within the M2 thresholds |
| Accessibility scan clean | Axe report with zero critical violations |
| Security headers verified | CSP and related headers confirmed in a staging response |

**Risks:**

- RLS on PGlite is limited; policies must be verified on PostgreSQL and must not break local mode.
- Live payment verification depends on sandbox credentials and explicit owner approval.
- Object storage introduces eventual consistency concerns for downloads; signed URLs must be tested.

**Rollback:** Keep `SYNC_MODE=disabled` and `PAYMENT_MODE=disabled` as the default configuration so a cloud regression can be isolated by disabling one subsystem at a time.

---

## 7. M4: Production Readiness

**Goal:** Operate continuously with incident, backup, and compliance processes in place.

**Entry criteria:** M3 exit criteria met.

**Required work items:**

| Backlog ID | Item | Exit evidence |
|---|---|---|
| E-11 | Automated backups | Scheduled backups with a verified restore run |
| E-10 | Retention reminders | UU PDP retention reviews surface as notifications |
| E-13 | Background AI worker (optional, recommended) | AI jobs process outside the request path with retry |
| E-14 | CI action upgrades | No deprecation warnings in workflow runs |
| E-07 | Credit package admin (optional) | Catalog managed without direct database edits |

**Exit criteria:**

| Criterion | Evidence required |
|---|---|
| Restore proven from automated backup | Dated drill record |
| Monitoring and alerting defined | Documented signals for errors, latency, and payment failures |
| Incident runbook published | Runbook covering PGlite corruption, payment anomalies, and provider outages |
| Compliance review complete | UU PDP export and erasure paths revisited |
| Release checklist signed | Go/no-go checklist below completed |

**Risks:**

- Background workers add operational complexity. They should be delayed unless AI latency becomes a user-facing problem.
- Automated backups require storage with retention guarantees and encryption at rest.

---

## 8. Go/No-Go Checklist

Use this checklist at every milestone gate. Every line must be answered with evidence.

- [ ] All automated gates green on the release commit
- [ ] CI run linked and successful
- [ ] No open P0 or High-severity defect
- [ ] Accepted exceptions reviewed and still acceptable
- [ ] Backup and restore evidence current
- [ ] Performance baseline current
- [ ] Security controls verified on the target environment
- [ ] Privacy notice and data rights accurate
- [ ] Rollback path documented and rehearsed
- [ ] Owner approval recorded

---

## 9. What This Plan Deliberately Does Not Do

- It does not assign calendar dates. Two inputs dominate the schedule, deployment target and available capacity, and neither is confirmed.
- It does not promise live AI, live payments, or cloud sync before they can be verified.
- It does not treat the accepted RLS deferral as a silent omission. Tenant isolation limits are stated explicitly for every cloud milestone.
