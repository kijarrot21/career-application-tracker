# 02. User Journeys

## J1. First Run
1. Sign up with name, email, password (min 10 characters).
2. The system creates default settings and the 13 default pipeline stages.
3. The empty dashboard offers: **Add your first job**, **Log an application**, **Complete your profile** (improves suitability suggestions), and **Load sample data** (clearly labelled demo records).

## J2. Discover, Evaluate, Shortlist
1. Find Jobs > **Add job**. Optionally paste the job URL first.
2. The app detects the platform from the domain (for example `linkedin.com/jobs/view/123` gives LinkedIn, external ID `123`) and warns if the URL or the company + title combination already exists.
3. The user fills in company, title, location, salary, skills, description, and deadline.
4. On the job detail page, the **Suitability** panel suggests scores for Skills, Experience, Education, Salary, and Location from the user profile, with reasons. Career Growth is manual. The user adjusts and saves. The overall score is calculated.
5. The user sets triage: Interested, Shortlisted, Not Interested, or Archived.

## J3. Apply
1. From a job (or from the Kanban by dragging a vacancy card into **Applied**), choose **Record submission**.
2. Enter submission date, platform, method, application URL, external reference, confirmation reference, CV / cover letter version label, expected salary, recruiter.
3. The system creates `APP-000N`, writes history (Sourced, Interested, Applied using real timestamps), and schedules the first follow-up 5 business days later (configurable).
4. If the user never added the vacancy, **Log application** creates both in one step.

## J4. Progress Through Selection
1. The recruiter replies. The user logs the communication (manual in Phase 2) and moves the card to **CV Screening** or directly to **HR Interview** (skip allowed).
2. The user schedules the interview from Application Detail. It appears on the dashboard under Upcoming Interviews.
3. After each step the user records feedback and moves the stage. Each move writes one history row, with an optional backdated effective date and note.

## J5. Outcome
- **Offer**: move to Offer, then Hired (successful) or Withdrawn (offer declined, reason recorded).
- **Rejected**: move to Rejected with a reason. Open follow-ups are cancelled.
- **Withdrawn**: the candidate withdraws with a reason.
- **No Response**: after the configured threshold (default 30 days without activity), the app shows a suggestion. Only user confirmation sets No Response. Silence is never treated as rejection.
- Closed applications can be **reopened** with a recorded reason.

## J6. Re-application
Applying again to a vacancy that already has a closed application requires ticking "This is an intentional re-application" and a reason. The new record gets `attempt_number + 1`. A second *active* application on the same vacancy is blocked.

## J7. Follow-up
The dashboard lists open follow-ups sorted by due date. Overdue ones are highlighted. The user marks them done (recording that they followed up), snoozes them, or adds a custom task. The app never sends an email.

## J8. Data Rights
Settings > Data and Privacy: **Export all data (JSON)**, **Export applications (CSV)**, **Remove sample data**, **Delete account** (password re-entry, permanent cascade delete).
