import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import {
  applications,
  applicationStages,
  applicationStatusHistory,
  assessments,
  companies,
  documents,
  documentVersions,
  emailCommunications,
  followUpTasks,
  interviews,
  jobOffers,
  jobSources,
  jobVacancies,
  recruiterContacts,
  suitabilityEvaluations,
  userSettings,
} from "@/db/schema";
import { normalizeCompanyName, normalizeUrl } from "@/lib/domain/duplicates";
import { DEFAULT_WEIGHTS, overallScore } from "@/lib/domain/suitability";
import { formatCode } from "@/lib/format";
import { ensureUserInitialized, seedSystemSources } from "./system";

/**
 * Load realistic Indonesian tech & corporate recruitment sample records.
 * Every record created here has `isSample = true` so it is clearly badged in
 * the UI and can be removed in one click without touching user records.
 */
export async function loadSampleDataForUser(db: AppDb, userId: string): Promise<void> {
  await seedSystemSources(db);
  await ensureUserInitialized(db, userId);

  // Check if sample data is already loaded
  const existingSample = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.isSample, true)))
    .limit(1);
  if (existingSample.length > 0) return;

  const sources = await db
    .select()
    .from(jobSources)
    .where(isNull(jobSources.userId));
  const sourceByKey = new Map(sources.map((s) => [s.key, s.id]));

  const stages = await db
    .select()
    .from(applicationStages)
    .where(eq(applicationStages.userId, userId));
  const stageByKey = new Map(stages.map((s) => [s.key, s]));

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  let jobSeq = settings?.nextJobSeq ?? 1;
  let appSeq = settings?.nextApplicationSeq ?? 1;

  // Update profile skills if empty so suitability suggestions work out of the box
  if (!settings?.skills || settings.skills.length === 0) {
    await db
      .update(userSettings)
      .set({
        headline: "Full-Stack Software Engineer",
        skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Tailwind CSS", "REST API", "Git"],
        yearsExperience: 4,
        educationLevel: "bachelor",
        expectedSalaryMin: 22_000_000,
        expectedSalaryMax: 32_000_000,
        preferredLocations: ["Jakarta", "Bandung", "Remote"],
        preferredArrangements: ["hybrid", "remote"],
      })
      .where(eq(userSettings.userId, userId));
  }

  const companySeed = [
    { name: "PT GoTo Gojek Tokopedia Tbk", industry: "Technology / SuperApp", location: "Jakarta", website: "https://www.gotocompany.com", size: "5000+" },
    { name: "Traveloka", industry: "Travel Tech", location: "Tangerang / BSD", website: "https://www.traveloka.com", size: "1000-5000" },
    { name: "Bank Jago", industry: "Digital Banking / Fintech", location: "Jakarta", website: "https://www.jago.com", size: "1000-5000" },
    { name: "Mekari", industry: "B2B SaaS / HR & Accounting", location: "Jakarta", website: "https://mekari.com", size: "500-1000" },
    { name: "Xendit", industry: "Fintech / Payments", location: "Jakarta", website: "https://www.xendit.co", size: "500-1000" },
    { name: "Stockbit & Bibit", industry: "WealthTech", location: "Jakarta", website: "https://stockbit.com", size: "200-500" },
  ];

  const companyIds = new Map<string, string>();
  for (const c of companySeed) {
    const norm = normalizeCompanyName(c.name);
    const [inserted] = await db
      .insert(companies)
      .values({
        userId,
        name: c.name,
        normalizedName: `${norm} sample`,
        industry: c.industry,
        location: c.location,
        website: c.website,
        size: c.size,
        isSample: true,
      })
      .returning({ id: companies.id });
    companyIds.set(c.name, inserted.id);
  }

  const vacancySeed = [
    {
      company: "PT GoTo Gojek Tokopedia Tbk",
      title: "Senior Frontend Engineer",
      department: "Consumer Platform",
      industry: "Technology",
      location: "Jakarta",
      employmentType: "full_time" as const,
      workArrangement: "hybrid" as const,
      salaryMin: 25_000_000,
      salaryMax: 35_000_000,
      requiredExperienceYears: 4,
      requiredEducation: "bachelor" as const,
      skills: ["TypeScript", "React", "Next.js", "GraphQL", "Performance"],
      sourceKey: "linkedin",
      url: "https://www.linkedin.com/jobs/view/9900112233",
      deadline: "2026-12-15",
      discoveredOn: "2026-10-20",
      priority: "high" as const,
      triageStatus: "shortlisted" as const,
      scores: { skills: 88, experience: 100, education: 100, salary: 100, location: 100, growth: 90 },
      application: {
        submittedOn: "2026-10-22",
        stageKey: "user_interview",
        method: "platform" as const,
        cvVersionLabel: "CV_FullStack_v3.pdf",
        recruiterName: "Nadia Putri",
        recruiterEmail: "nadia.putri@gotocompany.example",
        expectedSalary: 28_000_000,
        history: [
          { to: "sourced", on: "2026-10-20", source: "sample" as const },
          { to: "interested", on: "2026-10-21", source: "sample" as const },
          { to: "applied", on: "2026-10-22", source: "sample" as const },
          { to: "cv_screening", on: "2026-10-26", source: "sample" as const },
          { to: "hr_interview", on: "2026-11-02", source: "sample" as const },
          { to: "user_interview", on: "2026-11-11", source: "sample" as const },
        ],
      },
    },
    {
      company: "Traveloka",
      title: "Full-Stack Product Engineer",
      department: "Accommodation",
      industry: "Travel Tech",
      location: "BSD, Tangerang",
      employmentType: "full_time" as const,
      workArrangement: "hybrid" as const,
      salaryMin: 22_000_000,
      salaryMax: 30_000_000,
      requiredExperienceYears: 3,
      requiredEducation: "bachelor" as const,
      skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
      sourceKey: "jobstreet",
      url: "https://id.jobstreet.com/job/77889900",
      deadline: "2026-12-10",
      discoveredOn: "2026-10-25",
      priority: "high" as const,
      triageStatus: "shortlisted" as const,
      scores: { skills: 100, experience: 100, education: 100, salary: 95, location: 85, growth: 85 },
      application: {
        submittedOn: "2026-10-28",
        stageKey: "offer",
        method: "company_portal" as const,
        cvVersionLabel: "CV_ProductEng_v2.pdf",
        recruiterName: "Budi Santoso",
        recruiterEmail: "budi.santoso@traveloka.example",
        expectedSalary: 27_000_000,
        history: [
          { to: "sourced", on: "2026-10-25", source: "sample" as const },
          { to: "interested", on: "2026-10-26", source: "sample" as const },
          { to: "applied", on: "2026-10-28", source: "sample" as const },
          { to: "hr_interview", on: "2026-11-03", source: "sample" as const },
          { to: "assessment", on: "2026-11-07", source: "sample" as const },
          { to: "final_interview", on: "2026-11-12", source: "sample" as const },
          { to: "offer", on: "2026-11-15", source: "sample" as const },
        ],
      },
    },
    {
      company: "Bank Jago",
      title: "Software Engineer - Digital Banking",
      department: "Core Engineering",
      industry: "Fintech",
      location: "Jakarta",
      employmentType: "full_time" as const,
      workArrangement: "hybrid" as const,
      salaryMin: 20_000_000,
      salaryMax: 28_000_000,
      requiredExperienceYears: 3,
      requiredEducation: "bachelor" as const,
      skills: ["TypeScript", "Node.js", "PostgreSQL", "Microservices"],
      sourceKey: "glints",
      url: "https://glints.com/id/opportunities/jobs/software-engineer/11111111-2222-3333-4444-555555555555",
      deadline: "2026-11-30",
      discoveredOn: "2026-11-01",
      priority: "medium" as const,
      triageStatus: "interested" as const,
      scores: { skills: 75, experience: 100, education: 100, salary: 90, location: 100, growth: 80 },
      application: {
        submittedOn: "2026-11-04",
        stageKey: "applied",
        method: "platform" as const,
        cvVersionLabel: "CV_FullStack_v3.pdf",
        recruiterName: "Rina Wijaya",
        recruiterEmail: "rina.wijaya@jago.example",
        expectedSalary: 25_000_000,
        history: [
          { to: "sourced", on: "2026-11-01", source: "sample" as const },
          { to: "applied", on: "2026-11-04", source: "sample" as const },
        ],
      },
    },
    {
      company: "Mekari",
      title: "Staff Frontend Engineer (SaaS HRIS)",
      department: "Talenta HR",
      industry: "B2B SaaS",
      location: "Jakarta",
      employmentType: "full_time" as const,
      workArrangement: "hybrid" as const,
      salaryMin: 24_000_000,
      salaryMax: 32_000_000,
      requiredExperienceYears: 5,
      requiredEducation: "bachelor" as const,
      skills: ["TypeScript", "React", "Next.js", "Design Systems"],
      sourceKey: "kalibrr",
      url: "https://www.kalibrr.id/c/mekari/jobs/246810",
      deadline: "2026-11-28",
      discoveredOn: "2026-10-15",
      priority: "medium" as const,
      triageStatus: "interested" as const,
      scores: { skills: 80, experience: 80, education: 100, salary: 100, location: 100, growth: 85 },
      application: {
        submittedOn: "2026-10-18",
        stageKey: "rejected",
        closedAt: "2026-11-05",
        method: "platform" as const,
        cvVersionLabel: "CV_FullStack_v2.pdf",
        recruiterName: "Dimas Pratama",
        recruiterEmail: "dimas@mekari.example",
        expectedSalary: 28_000_000,
        history: [
          { to: "sourced", on: "2026-10-15", source: "sample" as const },
          { to: "applied", on: "2026-10-18", source: "sample" as const },
          { to: "cv_screening", on: "2026-10-24", source: "sample" as const },
          { to: "rejected", on: "2026-11-05", source: "sample" as const, reason: "Employer selected candidate with 6+ years of B2B SaaS experience." },
        ],
      },
    },
    {
      company: "Xendit",
      title: "Product Engineer - Checkout",
      department: "Payments",
      industry: "Fintech",
      location: "Remote",
      employmentType: "full_time" as const,
      workArrangement: "remote" as const,
      salaryMin: 28_000_000,
      salaryMax: 38_000_000,
      requiredExperienceYears: 4,
      requiredEducation: "bachelor" as const,
      skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Tailwind CSS"],
      sourceKey: "company_career",
      url: "https://careers.xendit.co/jobs/product-engineer-checkout-sample",
      deadline: "2026-12-05",
      discoveredOn: "2026-11-12",
      priority: "high" as const,
      triageStatus: "shortlisted" as const,
      scores: { skills: 100, experience: 100, education: 100, salary: 100, location: 100, growth: 95 },
      application: null,
    },
    {
      company: "Stockbit & Bibit",
      title: "Web Platform Engineer",
      department: "Web Trading",
      industry: "WealthTech",
      location: "Jakarta",
      employmentType: "full_time" as const,
      workArrangement: "onsite" as const,
      salaryMin: 22_000_000,
      salaryMax: 30_000_000,
      requiredExperienceYears: 3,
      requiredEducation: "bachelor" as const,
      skills: ["TypeScript", "React", "Next.js", "WebSockets"],
      sourceKey: "linkedin",
      url: "https://www.linkedin.com/jobs/view/8877665544",
      deadline: "2026-11-29",
      discoveredOn: "2026-11-14",
      priority: "medium" as const,
      triageStatus: "interested" as const,
      scores: { skills: 78, experience: 100, education: 100, salary: 95, location: 70, growth: 85 },
      application: null,
    },
  ];

  for (const v of vacancySeed) {
    const companyId = companyIds.get(v.company)!;
    const code = formatCode("JOB", jobSeq++);
    const overall = overallScore(v.scores, DEFAULT_WEIGHTS);

    const [vac] = await db
      .insert(jobVacancies)
      .values({
        userId,
        code,
        companyId,
        sourceId: sourceByKey.get(v.sourceKey) ?? null,
        title: v.title,
        department: v.department,
        industry: v.industry,
        location: v.location,
        employmentType: v.employmentType,
        workArrangement: v.workArrangement,
        salaryMin: v.salaryMin,
        salaryMax: v.salaryMax,
        currency: "IDR",
        salaryPeriod: "month",
        requiredExperienceYears: v.requiredExperienceYears,
        requiredEducation: v.requiredEducation,
        skills: v.skills,
        description: `Sample vacancy at ${v.company} for ${v.title}. Key stack: ${v.skills.join(", ")}.`,
        qualifications: `Minimum ${v.requiredExperienceYears} years of software engineering experience with modern web technologies.`,
        url: v.url,
        normalizedUrl: `${normalizeUrl(v.url) ?? v.url}#sample`,
        deadline: v.deadline,
        discoveredOn: v.discoveredOn,
        priority: v.priority,
        triageStatus: v.triageStatus,
        triagedAt: new Date(),
        suitabilityScore: overall,
        isSample: true,
      })
      .returning();

    await db.insert(suitabilityEvaluations).values({
      userId,
      vacancyId: vac.id,
      skillsScore: v.scores.skills,
      experienceScore: v.scores.experience,
      educationScore: v.scores.education,
      salaryScore: v.scores.salary,
      locationScore: v.scores.location,
      growthScore: v.scores.growth,
      weights: DEFAULT_WEIGHTS,
      overallScore: overall,
    });

    if (v.application) {
      const appCode = formatCode("APP", appSeq++);
      const stage = stageByKey.get(v.application.stageKey)!;
      const outcome =
        v.application.stageKey === "rejected"
          ? ("unsuccessful" as const)
          : ("active" as const);

      const [recruiter] = await db
        .insert(recruiterContacts)
        .values({
          userId,
          companyId,
          name: v.application.recruiterName,
          title: "Talent Acquisition Partner",
          email: v.application.recruiterEmail,
          isSample: true,
        })
        .returning();

      const [app] = await db
        .insert(applications)
        .values({
          userId,
          code: appCode,
          vacancyId: vac.id,
          currentStageId: stage.id,
          outcome,
          submittedOn: v.application.submittedOn,
          platformSourceId: sourceByKey.get(v.sourceKey) ?? null,
          submissionMethod: v.application.method,
          applicationUrl: v.url,
          cvVersionLabel: v.application.cvVersionLabel,
          primaryRecruiterId: recruiter.id,
          recruiterName: v.application.recruiterName,
          recruiterEmail: v.application.recruiterEmail,
          expectedSalary: v.application.expectedSalary,
          currency: "IDR",
          jobCategory: v.department,
          closedAt: v.application.closedAt ?? null,
          nextFollowUpOn: outcome === "active" ? "2026-11-18" : null,
          isSample: true,
        })
        .returning();

      let prevStageId: string | null = null;
      for (const h of v.application.history) {
        const toStage = stageByKey.get(h.to);
        if (!toStage) continue;
        await db.insert(applicationStatusHistory).values({
          userId,
          applicationId: app.id,
          fromStageId: prevStageId,
          toStageId: toStage.id,
          effectiveOn: h.on,
          source: h.source,
          reason: "reason" in h ? h.reason : null,
        });
        prevStageId = toStage.id;
      }

      if (v.application.stageKey === "user_interview") {
        await db.insert(interviews).values({
          userId,
          applicationId: app.id,
          stageId: stage.id,
          interviewType: "user",
          startsAt: new Date("2026-11-19T03:00:00Z"), // 10:00 WIB
          durationMinutes: 60,
          timezone: "Asia/Jakarta",
          meetingUrl: "https://meet.google.com/sample-goto-interview",
          interviewerName: "Andi Prasetyo",
          interviewerPosition: "Engineering Manager",
          preparationNotes: "Review system design for high-concurrency order checkout and React rendering optimization.",
          status: "scheduled",
          result: "pending",
          isSample: true,
        });

        await db.insert(emailCommunications).values({
          userId,
          applicationId: app.id,
          source: "manual",
          channel: "email",
          direction: "inbound",
          sender: v.application.recruiterEmail,
          subject: "Invitation: User Interview for Senior Frontend Engineer at GoTo",
          snippet: "Hi! Following your positive HR interview, we would like to invite you to the User Interview with our Engineering Manager.",
          occurredAt: new Date("2026-11-11T04:00:00Z"),
          classification: "interview_invitation",
          linkStatus: "confirmed",
          isSample: true,
        });

        await db.insert(assessments).values({
          userId,
          applicationId: app.id,
          assessmentType: "technical",
          title: "Frontend Performance & State Architecture Case Study",
          dueAt: new Date("2026-11-22T10:00:00Z"),
          score: "92",
          maxScore: "100",
          result: "passed",
          notes: "Implemented virtualized list and optimistic Kanban state transitions.",
        });
      }

      if (v.application.stageKey === "applied") {
        await db.insert(followUpTasks).values({
          userId,
          applicationId: app.id,
          type: "follow_up",
          title: `First follow-up with ${v.company} (${v.title})`,
          sequenceNo: 1,
          dueOn: "2026-11-11", // Overdue relative to 2026-11-16
          status: "open",
          autoGenerated: true,
          note: "Send a polite follow-up note referencing application ID.",
          isSample: true,
        });

        await db.insert(emailCommunications).values({
          userId,
          applicationId: app.id,
          source: "manual",
          channel: "email",
          direction: "inbound",
          sender: v.application.recruiterEmail,
          subject: "Update: Your application for Software Engineer at Bank Jago is under review",
          snippet:
            "Thank you for applying to Bank Jago. Your resume is currently under review by our Talent Acquisition team (CV Screening).",
          occurredAt: new Date("2026-11-14T02:30:00Z"),
          classification: "cv_screening",
          confidence: 88,
          classifierReasons: [
            "CV screening or profile review phrase detected",
            "Matched to Bank Jago application",
          ],
          detectedCompany: "Bank Jago",
          detectedPosition: "Software Engineer",
          linkStatus: "suggested",
          isSample: true,
        });
      }

      if (v.application.stageKey === "offer") {
        await db.insert(emailCommunications).values({
          userId,
          applicationId: app.id,
          source: "manual",
          channel: "email",
          direction: "inbound",
          sender: v.application.recruiterEmail,
          subject: "Offer of Employment: Full-Stack Product Engineer at Traveloka",
          snippet:
            "We are pleased to offer you the position of Full-Stack Product Engineer at Traveloka. Please review the attached offer details.",
          occurredAt: new Date("2026-11-15T08:00:00Z"),
          classification: "job_offer",
          confidence: 95,
          classifierReasons: ["Job offer phrase detected"],
          detectedCompany: "Traveloka",
          detectedPosition: "Full-Stack Product Engineer",
          linkStatus: "confirmed",
          isSample: true,
        });

        await db.insert(jobOffers).values({
          userId,
          applicationId: app.id,
          positionTitle: "Full-Stack Product Engineer",
          baseSalary: 28_500_000,
          currency: "IDR",
          salaryPeriod: "month",
          benefits: "13th month THR, comprehensive family health insurance, hybrid work allowance, annual performance bonus.",
          joiningDate: "2026-12-15",
          offerReceivedOn: "2026-11-15",
          responseDeadline: "2026-11-25",
          decision: "pending",
          notes: "Strong base package and product engineering scope.",
        });
      }
    }
  }

  // Seed sample documents & versions in the repository
  const [sampleMasterCv] = await db
    .insert(documents)
    .values({
      userId,
      category: "master_cv",
      title: "Master CV - Full-Stack Software Engineer",
      description: "Comprehensive master resume covering TypeScript, React, Next.js, and PostgreSQL experience.",
      isSample: true,
    })
    .returning();

  await db.insert(documentVersions).values([
    {
      userId,
      documentId: sampleMasterCv.id,
      versionNo: 1,
      label: "v1.0 (2026 Q3 Baseline)",
      filename: "CV_FullStack_v1.pdf",
      mimeType: "application/pdf",
      sizeBytes: 184320,
      notes: "Initial 2026 baseline resume.",
    },
    {
      userId,
      documentId: sampleMasterCv.id,
      versionNo: 2,
      label: "v2.0 (2026 Q4 ATS Optimized)",
      filename: "CV_FullStack_v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: 196608,
      notes: "Added quantified impact metrics and system design highlights.",
    },
  ]);

  const [samplePrepDoc] = await db
    .insert(documents)
    .values({
      userId,
      category: "interview_prep",
      title: "System Design & Behavioral Interview Notes",
      description: "STAR stories, distributed systems checklists, and questions for hiring managers.",
      isSample: true,
    })
    .returning();

  await db.insert(documentVersions).values({
    userId,
    documentId: samplePrepDoc.id,
    versionNo: 1,
    label: "v1.0",
    filename: "Interview_Prep_Notes.md",
    mimeType: "text/markdown",
    sizeBytes: 12288,
    notes: "Prepared for GoTo and Traveloka final rounds.",
  });

  await db
    .update(userSettings)
    .set({
      nextJobSeq: jobSeq,
      nextApplicationSeq: appSeq,
    })
    .where(eq(userSettings.userId, userId));
}

/** Delete all records marked `isSample = true` for this user without touching real records. */
export async function removeSampleDataForUser(db: AppDb, userId: string): Promise<void> {
  await db
    .delete(documents)
    .where(and(eq(documents.userId, userId), eq(documents.isSample, true)));
  await db
    .delete(emailCommunications)
    .where(and(eq(emailCommunications.userId, userId), eq(emailCommunications.isSample, true)));
  await db
    .delete(interviews)
    .where(and(eq(interviews.userId, userId), eq(interviews.isSample, true)));
  await db
    .delete(followUpTasks)
    .where(and(eq(followUpTasks.userId, userId), eq(followUpTasks.isSample, true)));
  await db
    .delete(applications)
    .where(and(eq(applications.userId, userId), eq(applications.isSample, true)));
  await db
    .delete(jobVacancies)
    .where(and(eq(jobVacancies.userId, userId), eq(jobVacancies.isSample, true)));
  await db
    .delete(recruiterContacts)
    .where(and(eq(recruiterContacts.userId, userId), eq(recruiterContacts.isSample, true)));
  await db
    .delete(companies)
    .where(and(eq(companies.userId, userId), eq(companies.isSample, true)));
  // Reset sequences if the user has no remaining records
  const [{ jobCount }] = await db
    .select({ jobCount: sql<number>`count(*)::int` })
    .from(jobVacancies)
    .where(eq(jobVacancies.userId, userId));
  const [{ appCount }] = await db
    .select({ appCount: sql<number>`count(*)::int` })
    .from(applications)
    .where(eq(applications.userId, userId));
  if (jobCount === 0 && appCount === 0) {
    await db
      .update(userSettings)
      .set({ nextJobSeq: 1, nextApplicationSeq: 1 })
      .where(eq(userSettings.userId, userId));
  }
}
