# AI Resume Analyzer

- An AI-powered resume analysis platform that evaluates how well a resume matches a specific job description, explains the scoring logic, and provided actionable & AI-generated improvements suggestions.Built with Next.js, AWS bedrock(Claude 3 Haiku), and a transparent scoring system with explainable AI outputs(just open for company).

# Goals

- 1.Help candidates understand why their resume matches or does not match a role
- 2.Provide recruiters with transparent and auditable scoring
- 3.Avoid black-box AI by combining:
  - A.Rule-based scoring
  - B. Heuristic evidence scoring
  - C. LLM-generated insights(Bedrock)
- Demonstrate a real-world AI product architecture rather than a demo-only project

# Live Demo

# Features

- Resume upload & Text extraction(PDF)
- Skill extraction with alias normalization(e.g. React/ React.js / ReactJS)
- LLM-based resume analysis(AWS bedrock - Claude 3 Haiku)
- AI Showing scores (Job Match score + Resume Strength score)
- AI-generated insights & resume improvements suggestions(AWS bedrock)
- Product-style PDF report export
- Transparent scoring breakdown (auditable for recruiters)

# Tech Stack

- Frontend: Next.js(App router), Tailwind CSS
- Backend: Next.js API routes(Node runtime)
- AI: AWS Bedrock (Claude 3 Haiku)
- Cloud: AWS bedrock Runtime SDK
- Data: JSON-based scoring + explainable breakdown
- Tools: AWS SDK, Pdfkit(PDF report generation),customer Inter fonts for PDF rendering

# Project Phases

## Phase 1- Resume Upload & Text Extraction

- Goal: Allow users to upload a resume(PDF) and extract raw text for AI analyzing.
- what's implemented:
  - 1.File upload UI
  - 2.Server-side PDF text extraction
  - 3.Basic validation + JDinput(empty file, unsupported format)
  - 4.Store extracted text in session for later analysis

## Phase 2 - Text Normalization Pipeline

- Goal: Clean and normalize resume & JD text for reliable matching.
- Techniques:
  - 1.Normalize line breaks
  - 2.Collapse multiple spaces
  - 3.Trim extra whitespaces

- why important:
  - Ensure consistent matching and reduced noise for downstream AI & Scoring logic.

## Phase 3 - Skill Bank(Canonical Skills)

- Goal: Create a standardized skill vocabulary used across scoring and AI prompts.

## Phase 4 - Skill Extraction & Matching Engine

- Goal: Detect skills in resume & job description text and compute overlap
- Features:
  - Regex-safe matching(C++. C#, .Net, CI/CD)
  - Deduplication
  - outputs:
    - `matchedSkills`
    - `missingSkills`
    - `coverage = matchedJD / totalJD`
- Why this matters:
  - This layer forms the quantitative foundation for scoring and explainability.

## Phase 5- Explainable Scoring Engine

### Job Match Score(0 - 100)

```
coverage = matched_jd_skills / total_jd_skills
jobMatchScore = round(50+ coverage * 50)
```

### Resume Strength Score(0-100)

```
Resume Strength = base + breadth + relevance + evidence(cap at 100)
base = 40
breadth(0-40) = min(unique_resume_skills,20) *2
relevance(0-20) = min(matched_jd_skills,10) *2
evidence(0-20) = heuristics from resume bullets
```

- Evidence Heuristics:
  - Action verbs (built, implemented, optimized)
  - Metrics(%, ms,users, performance)
  - Project signals(API, full-stack, AWS, Next.js)

## Phase 6 - Product-Style PDF Report Export

- Goal: Transform analysis into a shareable product artifact.
- Implemented:
  - `/api/report/pdf` endpoint
  - pdfkit rendering
  - Customer Inter fonts
  - Structured layout:
    - Header (AI model + region metadata)
    - Score cards
    - Skills overview
    - AI insights
    - Improvements recommendations
    - JD snippet
- Value:
  - Turn analysis into something users can submit to recruiters or mentors.

## Phase 7 - Skill Ontology & Synonym Normalization

- Goal: Improve recall and accuracy of skill extraction using a Skill Ontology.
- what was added:
  - `SKILL_ALIAS` map:

```
"AWS": [
    "amazon web services",
    "amazon aws",
    "aws cloud",
    "aws services",
    "aws platform",
  ]
```

- Ontology Behavior:
  - Any alias match to canonical skill
  - Canonical skills are used in:
    - Matching
    - Scoring
    - AI prompts
    - Score breakdown

- Why this matters:
  - This is a real NLP engineering step, moving from string matching to structured knowledge representation.

## Phase 8 - Score Breakdown (Explainable AI layer)

- Goal: Explain why a score is given and how to improve it faster.
- User-Facing View:
  - Job Match Score
  - Resume Strength Score
  - Skill Coverage %
  - Top Matched Skills
  - Top Missing Skills
  - Improvements Suggestions
- Recruiter/ Enterprise View:
  - Inputs used:
    - matched skill count
    - JD skill count
    - resume skill breadth
  - Formula breakdown
    -Component scores:
    - Breadth
    - Relevance
    - Evidence
  - Heuristic explanation
- Impact: this converts the system from a "resume score" into an explainable decision-support tool.

## Phase 9 - AI Depth Enhancements (Planned / In progress)

- Goal: Move from a demo-level Ai resume analyzer to a **production-grade, enterprise-ready AI platform** with user identity, personalization, explainable AI, and monetization capabilities.

### 1. User System & Productization

**Objective:**

- Introduce a real product user model to support both individual job seekers and enterprise recruiters.

**Planned Features:**

- user authentication & registration (Individual & Enterprise accounts)
- Role-based access control(RBAC)
- User profile management and history tracking
- Usage quota & credit system (limit AI calls for free users)
- Subscription tires:
  - Free (Limited monthly analyses)
  - Pro (advanced features for individuals)
  - Enterprise (unlimited usage, batch processing, recruiter tools)

**Product Rationale:**

- Controls AI inference cost
- Enables personalization of AI insights
- Establishes a foundation for monetization and real-world deployment

### 2. Explainable & Evidence- Grounded AI

**Objective:**

- Make AI outputs transparent, auditable, and trustworthy for both users and recruiters.

**Planned Enhancements:**

- Evidence-Grounded insights:
  - Each AI recommendation is linked to specific resume snippets and job description requirements.
- Traceable reasoning:
  - Show which skills, phrases, or experiences triggered each insights
- AI confidence scoring:
  - Attach a confidence score to each AI-generated insights to mitigate hallucinations
- Recruiter explain mode:
  - Expose scoring logic and reasoning for enterprise users.

**Value:**

- Improves trust in AI recommendations
- Supports explainable AI and auditability
- Reduces black-box decision making

### 3. Resume Improvement & AI Writing Assistant

**Objective:**

- Transform the system from a passive analyzer into an **active resume optimization tool**

**Planned Enhancements:**

- AI-powered resume bullet rewriting:
  - Convert raw resume bullets into structured, impact-driven statements(Action + Tool + Result)
- Quantification suggestions:
  - Encourage metrics such as performance gains, user impact or efficiency improvements
- Skill gap remediation:
  - AI-generated suggestions on how to rewrite existing experience to better match job requirements

**Value:**

- Provides immediate, actionable value to user
- Help bridge the gap between analysis ans real resume improvements
- Improve user outcomes and engagement

### 4. Skill Ontology 2.0 & Skill Graph Reasoning

**Objective:**

- Enhance the existing skill ontology into a **structured skill graph** that enable high-level reasoning

**Planned Enhancements:**

- Hierarchical skill relationships:
  - example: AWS - (S3, Lambda, IAM, CloudFront)
- Transferable skill reasoning:
  - Identify adjacent skills (like Node.js - Express.Js - API Design)
- Dynamic Skill expansion:
  - Continuously evolve skill ontology based on new job market trends

**Value:**

- Improve matching accuracy
- Enables more intelligent AI reasoning
- Makes the system more future-proof

### 5. Role Benchmarking & Industry Baselines

**Objective:**

- Provide industry-aware benchmarking rather than isolated JD comparison.

**Planned Enhancements:**

- Hierarchical skill relationships:
  - example: AWS - (S3, Lambda, IAM, CloudFront)
- Transferable skill reasoning:
  - Identify adjacent skills (like Node.js - Express.Js - API Design)
- Dynamic Skill expansion:
  - Continuously evolve skill ontology based on new job market trends

**Value:**

- Improve matching accuracy
- Enables more intelligent AI reasoning
- Makes the system more future-proof
