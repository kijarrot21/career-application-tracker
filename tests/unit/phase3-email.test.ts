import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generatePkcePair,
  signOAuthState,
  verifyOAuthState,
} from "@/lib/crypto";
import {
  classifyRecruitmentEmail,
  matchEmailToApplication,
} from "@/lib/domain/email-classifier";

describe("Phase 3: AES-256-GCM token encryption & OAuth PKCE state", () => {
  it("encrypts and decrypts OAuth refresh tokens with unique IVs", () => {
    const token = "1//0g_sample_oauth_refresh_token_secret_value";
    const c1 = encryptSecret(token);
    const c2 = encryptSecret(token);
    expect(c1).not.toBe(c2);
    expect(decryptSecret(c1)).toBe(token);
    expect(decryptSecret(c2)).toBe(token);
  });

  it("generates PKCE pairs and signs/verifies OAuth state tokens", () => {
    const pkce = generatePkcePair();
    expect(pkce.codeVerifier.length).toBeGreaterThan(20);
    expect(pkce.codeChallenge.length).toBeGreaterThan(20);

    const signed = signOAuthState({
      userId: "user_1",
      provider: "gmail",
      codeVerifier: pkce.codeVerifier,
    });
    expect(verifyOAuthState(signed)).toEqual({
      userId: "user_1",
      provider: "gmail",
      codeVerifier: pkce.codeVerifier,
    });
    expect(verifyOAuthState(`${signed}tampered`)).toBeNull();
  });
});

describe("Phase 3: Recruitment Email Classifier & Application Matcher", () => {
  it("classifies all 8 recruitment categories across English and Bahasa Indonesia", () => {
    const confirmation = classifyRecruitmentEmail({
      sender: "no-reply@greenhouse.io",
      subject: "Thank you for applying to Traveloka",
      snippet: "We have received your application for Product Engineer at Traveloka.",
    });
    expect(confirmation.classification).toBe("application_confirmation");
    expect(confirmation.detectedCompany).toBe("Traveloka");
    expect(confirmation.suggestedStageType).toBe("applied");

    const screening = classifyRecruitmentEmail({
      sender: "hr@jago.com",
      subject: "Update Lamaran di Bank Jago",
      snippet: "Lamaran Anda sedang ditinjau oleh tim Talent Acquisition kami.",
    });
    expect(screening.classification).toBe("cv_screening");
    expect(screening.suggestedStageType).toBe("screening");

    const interview = classifyRecruitmentEmail({
      sender: "Nadia <nadia@gotocompany.com>",
      subject: "Interview Invitation for Senior Frontend Engineer at GoTo",
      snippet: "We would like to invite you to an HR interview this Thursday.",
    });
    expect(interview.classification).toBe("interview_invitation");
    expect(interview.detectedCompany).toBe("GoTo");
    expect(interview.detectedPosition).toBe("Senior Frontend Engineer");
    expect(interview.suggestedStageType).toBe("interview");

    const assessment = classifyRecruitmentEmail({
      sender: "assessments@hackerrank.com",
      subject: "[Xendit] Online Technical Assessment Invitation",
      snippet: "Please complete the coding challenge within 72 hours.",
    });
    expect(assessment.classification).toBe("assessment_invitation");
    expect(assessment.detectedCompany).toBe("Xendit");
    expect(assessment.suggestedStageType).toBe("assessment");

    const followUp = classifyRecruitmentEmail({
      sender: "ta@mekari.com",
      subject: "Thank you for speaking with us at Mekari",
      snippet: "Following up on our interview yesterday, we will share next steps soon.",
    });
    expect(followUp.classification).toBe("interview_follow_up");

    const rejection = classifyRecruitmentEmail({
      sender: "careers@company.com",
      subject: "Update regarding your application at Acme Corp",
      snippet:
        "Unfortunately, we have decided not to proceed with your candidacy at this time.",
    });
    expect(rejection.classification).toBe("rejection");
    expect(rejection.suggestedStageType).toBe("rejected");

    const offer = classifyRecruitmentEmail({
      sender: "hr@traveloka.com",
      subject: "Surat Penawaran Kerja / Offer of Employment at Traveloka",
      snippet: "We are pleased to offer you the position of Senior Engineer.",
    });
    expect(offer.classification).toBe("job_offer");
    expect(offer.suggestedStageType).toBe("offer");

    const nonRecruitment = classifyRecruitmentEmail({
      sender: "newsletter@shopping.example",
      subject: "Weekend flash sale 50% off shoes",
      snippet: "Buy two pairs and get free shipping today.",
    });
    expect(nonRecruitment.classification).toBe("not_recruitment");
  });

  it("matches recruitment emails to existing applications by recruiter, company, and position", () => {
    const candidates = [
      {
        id: "app_1",
        code: "APP-0001",
        companyName: "PT GoTo Gojek Tokopedia Tbk",
        jobTitle: "Senior Frontend Engineer",
        recruiterEmail: "nadia@gotocompany.com",
      },
      {
        id: "app_2",
        code: "APP-0002",
        companyName: "Bank Jago",
        jobTitle: "Backend Engineer",
        recruiterEmail: "rina@jago.com",
      },
    ];

    const match = matchEmailToApplication(
      {
        sender: "Nadia Putri <nadia@gotocompany.com>",
        subject: "Interview Invitation for Senior Frontend Engineer at GoTo",
        detectedCompany: "GoTo",
        detectedPosition: "Senior Frontend Engineer",
      },
      candidates,
    );

    expect(match.applicationId).toBe("app_1");
    expect(match.matchScore).toBeGreaterThanOrEqual(80);
  });
});
