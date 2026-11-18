# Progress Detection Service (Stage 1)

Progress is derived **only from existing business records**. There is no
onboarding table, tutorial step, click counter, checklist flag, or persisted
progress row. The service is read-only with respect to domain data; each call
recalculates from source records, so underlying changes are reflected
immediately without caching or invalidation logic.

## Modules

| File | Responsibility |
| --- | --- |
| `src/lib/domain/progress.ts` | Stage registry, typed result model, pure aggregation and percentage rules |
| `src/server/queries/progress.ts` | User-scoped retrieval of the minimal facts needed for detection |
| `src/server/services/progress.ts` | Completion criteria per stage and orchestration (`detectProgress`, `getProgressForCurrentUser`) |
| `tests/unit/progress.test.ts` | Pure domain tests |
| `tests/integration/progress.test.ts` | Data-driven scenarios on in-memory PGlite |

## Stage completion rules

| Stage | Required? | Completion criteria |
| --- | --- | --- |
| 1. Career Profile | Required | Existing `computeProfileCompletion(...).isReadyForAi`: professional info, at least one work experience, and three user-verified skills |
| 2. CV Upload | Required | At least one non-sample `document_versions` row with a non-null `storage_key` whose document category is `master_cv` or `custom_cv` |
| 3. Job Discovery | Required | At least one non-sample `job_vacancies` row |
| 4. Suitability Evaluation | Optional | At least one `suitability_evaluations` row with `overall_score` on a non-sample vacancy |
| 5. Shortlist | Optional | At least one non-sample vacancy with `triage_status` of `shortlisted` or `interested` (matches the existing shortlist query) |
| 6. Job Application | Required | At least one non-sample `applications` row |
| 7. Recruitment Tracking | Optional | On a non-sample application: a status-history row with a source other than `submission`/`sample`, or an interview, assessment, done follow-up, or linked non-recruitment-excluded email |
| 8. Offers and Outcomes | Optional | A `job_offers` row on a real application, a non-sample application with a non-`active` outcome or a `closed_at` date, or an `application_closure_records` row with `status = 'archived'` |

### Exclusions and integrity

- Sample data (`is_sample = true`, or history `source = 'sample'`) never counts
  as real progress. It is demo data, not user achievement.
- Archived applications count as an outcome only while their closure record
  is `archived`. A `restored` record reverses the closure (the application is
  reset to `active`) and is excluded.
- A CV version whose file key is missing or whose row was deleted does not
  complete the CV stage. CV validity is database-level; physical file
  existence and local/cloud synchronisation are not assumed.
- Skills count only when `is_user_verified = true` and
  `verification_status = 'verified'`, reusing the existing profile rule.
- `suitability_evaluations` and `application_status_history` have no
  `is_sample` column. Sample exclusion is applied through the parent vacancy /
  application, or through the history `source`.
- Every query is scoped by `user_id`, including join predicates. Supporting
  record IDs exposed in the result belong only to the requested user.
- A stage whose backing module is unavailable is reported as `unavailable`,
  never as incomplete, and is excluded from the percentage. All modules exist
  today.

## Percentage calculation

```
percentage = completedStages
             / (requiredApplicableStages + completedOptionalStages)
             * 100
```

- Rounded to one decimal place; clamped to the 0–100 range.
- **Optional stages never reduce the score.** Incomplete optional stages are
  omitted from the denominator; completing one adds to both numerator and
  denominator.
- **Unavailable stages are excluded entirely** from numerator and denominator.
- If the denominator is zero (for example, an account where no stage module is
  available), the percentage is `0`.
- Example: four required stages applicable, four optional stages applicable,
  two required and two optional complete → `(2 + 2) / (4 + 2) * 100 = 66.7%`.

The formula is also embedded in the service output as `overall.formula` so
consumers cannot misinterpret the number. No other arbitrary weighting is used;
the profile's own weighted percentage remains the existing
`computeProfileCompletion` result and is surfaced only as profile evidence.

## Output shape

`ProgressSnapshot` contains:

- `overall`: counts (completed, applicable, required/optional, completed
  required/optional), percentage, and formula.
- `stages`: one entry per stage in registry order, with `key`, `label`,
  `isOptional`, `isApplicable`, `status`
  (`complete | incomplete | optional | unavailable`), `isComplete`, `reason`,
  and `evidence` (`recordIds`, `summary`).
- `completedStages`, `incompleteStages`, `optionalStages`, `unavailableStages`:
  stage-key buckets.
- `calculatedAt`: ISO-8601 timestamp of the calculation.

"Optional" as a status means the stage is applicable but not complete and not
required; a completed optional stage has status `complete`.

## Known limitations

- Progress is exposed through the dashboard guidance widget, guided setup wizard, and onboarding settings; those UIs consume Stage 1 output without recalculating it.
- CV validity checks the stored file key in the database, not the bytes on
  disk. Local/cloud file synchronisation is not verified.
- The percentage reflects stage completion, not the depth of activity inside a
  stage (for example, one application completes stage 6 regardless of count).
- `getProgressForCurrentUser()` calls `requireUser()`, which lazily ensures the
  user's settings and default stages exist. `detectProgress(userId)` itself
  performs no writes.
