# 19. License and Intellectual Property Basics

This page is written for the project owner: a plain-language explanation of how licensing works for a digital product like this website, what is already in place, and what is optional. It is **not legal advice** — it is a map so you know what to ask a lawyer when the time comes.

Read it once, then forget about it until something actually happens. Nothing here blocks you from publishing.

## 1. The three layers

People usually mix these up. They are separate:

| Layer | What it is | Where it comes from | Status here |
|---|---|---|---|
| **Copyright** | Ownership of the code you wrote | Exists automatically when you write it. No form, no fee. | ✅ Already yours |
| **License** | The permission slip you give others | You write it and put it in the repo | ✅ [`LICENSE`](../LICENSE) |
| **Enforcement** | What you can do when someone breaks the rules | Courts, platforms, lawyers | ⚪ Optional, only needed if it happens |

You cannot lose copyright by publishing on a public repository. "Public" is not "public domain". What changes is only what you *allow* people to do — and that is exactly what the license states.

## 2. What is already done (free, nothing more to pay)

- **`LICENSE` exists** and is linked from the README and from the top of the repo. Anyone who clones the code receives a copy of the terms.
- **The grant is conditional.** Section 2.4 says use outside the licence is use without permission. That is the sentence that turns "you broke my rules" into "you infringed my copyright".
- **@author is declared** in `package.json` and the copyright line in `LICENSE`. Dated `git` commits and release tags prove when each part was written.
- **The word "open source" is avoided** in favour of "source-available". This is deliberate — see §6.

That is genuinely enough to publish. The rest of this page is optional depth.

## 3. What is optional

| Action | What it buys you | Effort / cost | Needed now? |
|---|---|---|---|
| A lawyer reads `LICENSE` once | Confidence it holds up in court | One consultation | Not yet — do it before you ever sue |
| Record the work at **DJKI** (*pencatatan ciptaan*) | Official dated proof of authorship | Modest official fee, paperwork | No — nice-to-have |
| **GitHub DMCA takedown** | Fast, free removal of a copied repo | A form | Only when it happens |
| Registered trademark | Protection of the *name*, not the code | Months, real money | Only if you build a brand |
| Company (PT / CV) | Limits personal liability once money moves | Legal setup | Only if you start selling |

Two rules of thumb:

- **Copyright protects the code. A trademark protects the name.** You have the first for free; you do not need the second to stop someone reselling your code.
- **Recordation is evidence, not permission.** You own the code either way. DJKI just makes proving it faster.

## 4. If someone resells it

Do these in order. Do not skip step 1 — it is the one thing that cannot be recreated later.

1. **Capture evidence first.** Screenshots with visible dates, the live URL, an `archive.org` snapshot, their pricing page, and a copy of any invoice or receipt of sale. Save them somewhere outside the browser (a dated folder, or email them to yourself).
2. **Check which clause applies.** Resale or paid hosting → Section 4.1 to 4.4. Business/internal use → Section 4.5. Removing your notices → Section 4.7.
3. **Send a written demand** (a *cease and desist*). It names the infringing conduct, the clause breached, and a deadline. Most resellers stop here. Have a lawyer draft the first one; afterwards you can reuse it.
4. **Choose the escalation that fits:**
   - **GitHub / hosting provider takedown** — cheapest and often fastest. A public repo full of your code is easy to report.
   - **Civil claim in Indonesia** — compensation and injunctions, per `LICENSE` Section 8 and UU Hak Cipta.
   - **Criminal report** — available for commercial-scale infringement; usually a pressure tactic rather than a first move.
   - **Sell them a licence** — sometimes the realistic outcome. Section 5 exists so that this is a legitimate option, not a defeat.

Why this works at all: because commercial use was never granted, they were never a licensee. They had no right to copy or distribute the code, so they cannot rely on any defence that a licence would have given them.

## 5. Mistakes to avoid

- **Calling it "open source".** It is not, and a reseller could use your own words to argue they reasonably believed selling was allowed.
- **Contradictory wording.** If the README ever says "free to use for anything", it fights the LICENSE. When in doubt, point at the LICENSE.
- **Relying on a verbal "yes".** Section 5.4 already closes this door. Keep approvals in writing.
- **Deleting the repo to "stop" someone.** It does not revoke their obligations, and it destroys your own evidence.
- **Assuming GitHub is the law.** GitHub enforces its own terms and DMCA; it cannot award you damages. That is what courts are for.
- **Waiting too long.** Evidence disappears. Screenshots do not.

## 6. A website has three different legal documents

This is the part most people learn late. For a website, they are not interchangeable:

| Document | Governs | Do you have it? |
|---|---|---|
| **Source code licence** (`LICENSE`) | What people may do with the *code* | ✅ Yes |
| **Terms of Service** | What *users* may do inside your running site | ⚪ Only needed if you host it publicly |
| **Privacy Policy** | How user data is handled | ✅ Covered by [`06-privacy-and-security.md`](06-privacy-and-security.md) for UU PDP |

A licence is for developers. Terms of Service are for visitors. Someone can respect your licence completely and still misuse your hosted service — only a ToS covers that. You do not need one while the app runs only on your own machine.

## 7. How long it lasts

Indonesian copyright for computer programs runs for **50 years from first publication** (*UU No. 28/2014*, Art. 59), and your **moral rights** — to be named as author, and to object to distortion of the work — have no time limit and cannot be signed away.

Practically: for the rest of your life, no one can take this code from you or claim they wrote it.

## 8. When to actually hire a lawyer

Not now. Hire one when one of these becomes true:

- Someone is genuinely reselling or monetising the app.
- You start charging real money and taking payments at scale.
- You form a company, hire someone, or take investment.
- A contributor sends code and you want the paperwork airtight.
- You want the licence reviewed before it is ever tested in court.

A single review consultation is usually a few hours of a lawyer's time, not a retainer. Ask specifically for: *"review this non-commercial licence for enforceability under Indonesian copyright law, and confirm the remedies section."*

## 9. Publish checklist

- [x] `LICENSE` file at the repository root
- [x] Copyright holder named with legal name and GitHub handle
- [x] Notice in the README, linked from the top
- [x] `license` field in `package.json`
- [x] "Source-available", never "open source"
- [ ] Optional: one lawyer review
- [ ] Optional: DJKI recordation
- [ ] Optional: Terms of Service, if a public instance is ever hosted

You are through the required column. The unchecked items are things to do *when they matter*, not before.
