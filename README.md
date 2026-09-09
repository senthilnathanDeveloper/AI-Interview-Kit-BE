# Full-Stack AI Interview Prep Kit

A full-stack web application and CLI batch evaluator that transforms job descriptions and company URLs into personalized, multi-pass interview preparation kits.

---

## 🚀 Quick Start & Setup Instructions

### Prerequisites
- **Node.js**: v20+
- **MongoDB**: Local instance running at `mongodb://127.0.0.1:27017/ai-interview-kit` (or MongoDB Atlas)

### 1. Backend Setup
```bash
cd ai-iterview-kit-be
npm install
npm start
```
The backend API runs on **`http://localhost:5000`**.

### 2. Frontend Setup
```bash
cd ai-interview-kit-fe
npm install
npm run dev
```
The frontend application opens on **`http://localhost:3000`**.

---

## ⚡ Batch Entry Point (Mandatory CLI)

Run the multi-pass research pipeline over a batch file of job descriptions without using the web interface:

```bash
cd ai-iterview-kit-be
npm run evaluate -- --input input-cases.json --output output-kits.json
```

### Input Format (`cases.json`)
```json
[
  {
    "id": "case-01",
    "jd": "Senior Backend Engineer\n\nRequirements:\n- 5+ years Node.js and Express...",
    "company_url": "https://example.com",
    "days": 5
  }
]
```

### Output Format (`kits.json` - Appendix B Compliant)
```json
{
  "version": "1.0",
  "generated_at": "2026-09-09T17:02:53.551Z",
  "kits": [
    {
      "id": "case-01",
      "status": "ok",
      "kit": { /* Appendix A Kit Structure */ },
      "error": null
    }
  ]
}
```

---

## 🧪 Running Automated Tests

Run the backend test suite verifying schedule allocation, coverage checking, and Appendix A schema validation:

```bash
cd ai-iterview-kit-be
npm test
```

---

## 🏗 Architecture & Design Decisions

### Tech Stack & Justifications
- **Frontend**: Next.js 15 (App Router, React 19) + Tailwind CSS v4. Selected for server/client component optimization, fast page rendering, and modern glassmorphism design.
- **Backend**: Node.js + Express. Provides high-performance asynchronous HTTP handling for multi-step scraping and LLM pipeline execution.
- **Database**: MongoDB (Mongoose). Document model perfectly matches the nested JSON structure of Appendix A prep kits.
- **LLM Provider**: Google Gemini API (`gemini-2.5-flash`) with exponential backoff retry. Paired with a local heuristic NLP engine to ensure 100% reliable output generation during network failures or API rate-limiting.

---

## 🔄 Multi-Step Pipeline Sequencing

The prep kit is generated through a sequence of deliberate steps rather than a single prompt:

1. **Web Crawling**: Crawls company URL, discovers `/careers`, `/about`, `/handbook` links using text ranking, and cleans HTML content.
2. **Public Search**: Searches public engineering discussions for interview process insights.
3. **Requirement Extraction**: Parses JD text into structured requirements with stable IDs (`r1`, `r2`...), priority (`must` vs `nice`), and kind (`technical`, `behavioural`, `domain`).
4. **Initial Kit Draft**: Generates company brief, categorized question bank (`q1`, `q2`...), and flashcards (`f1`, `f2`...).
5. **Deterministic Coverage Check**: Code evaluates whether every `must` requirement has at least one associated question ID.
6. **Second Pass Loop**: Automatically generates targeted missing questions for any uncovered `must` requirement and increments pass count.
7. **Arithmetic Schedule Allocation**: Distributes questions across `days_available` placing higher-priority and harder topics earlier in integer minute increments.
8. **Schema Validation**: Validates the output against Appendix A Zod schema constraints.

---

## 🛡 Reshapeable Builder & Edit Preservation

- **Hand-Edited & Pinned State**: Hand-edited questions, custom user cards, or pinned sections are recorded in `pinnedState`.
- **Section Regeneration**: When regenerating a section (e.g. Question Category), the system filters out pinned/edited question IDs so user modifications survive intact.

---

## 🎨 Creative Feature: Interactive Mock Interview Simulator

Includes an interactive AI Mock Interviewer simulator where candidates select questions from their kit, record/type their response, and receive instant AI evaluation scores (1-10), strengths, improvement suggestions, and key takeaways.
