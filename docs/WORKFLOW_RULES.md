# Workflow Dependency and Rules Engine (Stage 2)

The workflow is **advisory**. It never hides or disables a module the user can
already open. It reads a Stage 1 `ProgressSnapshot` and derives recommendations
and a small set of genuinely blocked actions. No new progress state is stored.

## Modules

| File | Responsibility |
| --- | --- |
| `src/lib/domain/workflow.ts` | Typed rules, conditions, dependency classification, graph validation, pure evaluation |
| `src/server/services/workflow.ts` | Thin wrapper: `detectProgress` (Stage 1) → `evaluateWorkflow` |
| `tests/unit/workflow.test.ts` | Rules, classification, cycles, recommendations, determinism |
| `tests/integration/workflow.test.ts` | Data-driven scenarios on in-memory PGlite |

## Dependency classification

| Type | Meaning | Effect |
| --- | --- | --- |
| `required_prerequisite` | Enforced by an existing FK or service check | Blocks only the specific actions listed on the rule |
| `recommended_prerequisite` | Advisory order from the recommended workflow | Drives "recommended next stages" |
| `optional_prerequisite` | Improves the outcome but is not required | Adds explanation; never blocks |
| `independent_action` | Module usable at any time | Always available |
| `unavailable_functionality` | Module missing from this installation | Stage reported unavailable; its actions omitted |

Dependencies were assigned from actual business logic, not assumed:

- Suitability evaluations and shortlisting require a saved vacancy
  (`suitability_evaluations.vacancy_id`, `setVacancyTriageService`).
- Interviews and assessments require an application
  (`interviews.application_id`, `assessments.application_id`, service checks).
- Offers and closure outcomes require an application (`job_offers.application_id`,
  `applicationClosureRecords.application_id`).
- Follow-up tasks and email communications may be unlinked, so tracking as a
  whole is **not** blocked without an application.
- Applications can create a vacancy inline (`recordSubmissionService`), so job
  discovery is not a hard prerequisite for applying.
- A profile and CV are not required to record an application; suitability
  scoring falls back to `user_settings`.

## Rules

Required (blocking) rules: `RQ-001` vacancy → evaluation, `RQ-002` vacancy →
shortlist, `RQ-003` application → interview/assessment, `RQ-004` application →
offer/closure.

Recommended rules `RC-001` … `RC-007` encode the advisory sequence:
profile → CV → discovery → (evaluation / shortlist) → application → tracking →
outcomes.

Optional rules `RO-001` … `RO-003` describe helpful but non-blocking inputs
(profile improves evaluation accuracy, evaluations inform shortlist, saved
vacancies can be applied to directly). Independent rules `RI-001` … `RI-004`
mark modules with no prerequisite. Unavailable rules `RU-*` are generated at
evaluation time for each unavailable stage.

Each rule declares a rule ID, source stage, target stage, dependency type, an
activation condition, an availability condition, and an explanation. Conditions
are declarative (`stage_complete`, `stage_not_complete`, `stage_status`,
`stage_available`, `stage_unavailable`, `any_complete`, `all_complete`, `all`,
`any`, `always`) and are evaluated deterministically against the progress
snapshot.

## Recommendation rules

A stage is recommended when all of the following hold:

1. Its module is available and the stage is not complete.
2. Every incoming `recommended_prerequisite` rule is active (its source is
   complete). A stage with no incoming recommended rules is a root.
3. If the stage is optional, no later stage in the advisory order is already
   complete. This prevents nagging about evaluation/shortlist after the user
   has applied, while required stages stay recommended until completed.

Incomplete stages remain available. Skipping optional stages never blocks an
action and never removes access to a module.

## Cycle prevention

`findCircularDependencies(rules)` performs a directed DFS over prerequisite
edges; `assertAcyclicWorkflowRules()` throws on any cycle and is called on every
evaluation. Self-referencing independent and unavailable rules are ignored.
The shipped rule set is acyclic; a unit test injects a two-node cycle to verify
rejection.

## Output

`WorkflowPlan` contains:

- `progress` — the Stage 1 snapshot that was interpreted (by reference).
- `availableActions` / `blockedActions` — concrete actions with IDs, labels,
  stage, status, reason, and blocking rule IDs.
- `recommendedNextStages` — ordered stage keys.
- `optionalStages` — all available optional stages.
- `unavailableStages` — stage keys whose module is missing.
- `dependencyExplanations` — every rule with an `isActive` flag.
- `evaluatedAt` — ISO-8601 evaluation timestamp.

Blocked actions are limited to `evaluate_job`, `shortlist_vacancy`,
`schedule_interview`, `add_assessment`, `record_offer`, and `close_application`
when their genuine prerequisite is missing.

## Edge cases covered

Existing populated users · applications without onboarding history · skipped
evaluation/shortlist · independent module access · optional stages · missing
modules (unavailable rules) · circular dependency rejection · deleted CV
recommendation returns · archived/restore outcomes · user isolation.
