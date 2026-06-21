# Saath-i

A hackathon prototype for an inclusive education platform designed around students with learning difficulties. The goal is to give children in Class 1-5 the support they need through adapted activities, while giving their teachers useful tools to manage and respond to those needs in a real classroom.

**Live Demo:**
- Student side: https://saath-i-prototype.vercel.app
- Teacher side: https://saath-i-prototype.vercel.app/teacher

---

## The Problem

Students with learning difficulties like dyslexia, dyscalculia, or dysgraphia often go unidentified in Indian government schools for years. Teachers know something is wrong but don't have tools to pinpoint what, and specialist educators are scarce. Saath-i tries to close that gap by putting a lightweight screening and support system in the hands of both students and teachers.

---

## Student Features

### Onboarding and Screening
Students join using a class code their teacher gives them. The onboarding flow is designed for young children, with audio instructions and large tap targets throughout. After setting up a profile, students complete a short screening that uses three game-style tasks (sound matching, number sense, motor tracing) to identify which area they need support in. This happens in the background and the student is never shown a label or a diagnosis.

### Daily Activity Zones
From the home screen, students pick from four adapted activity zones each day:

- **Focus Zone:** Short warm-up exercises for attention and working memory. Includes visual tracking, pattern matching, and sequence recall. Audio instructions are read aloud so students who struggle with text can still follow along.
- **Reading Room:** Story-based activities with phonics support, vocabulary building, and read-aloud options for students with reading difficulties.
- **Number World:** Math activities broken into small steps with visual supports, useful for students who struggle with abstract number sense.
- **Expression Studio:** Drawing, speaking, and word-building tasks that give students an alternative way to express themselves when writing is hard.

### Catch-Up Courses
A structured five-level remediation path (Foundations to Mastery) that is automatically tailored to each student's support area from their screening results. Each level has three different game mechanics so students don't get stuck doing the same thing repeatedly. Progress is saved to Firebase so it carries over between sessions.

### Achievement Wall
Tracks streaks and completed activities. Intentionally focused on effort and completion rather than accuracy, so students are not penalised for needing more time.

---

## Teacher Features

### Class Dashboard
The main view after login. Shows all students in a class at a glance, with colour-coded status indicators (on track, watch, needs support) and a breakdown by support area. Teachers can filter by students who need attention, sort by last activity, and click through to a detailed profile for any student.

### Teacher Observation
For each student, teachers can complete a structured 12-item observation checklist covering reading, writing, numeracy, attention, memory, and organisation. This runs alongside the student's own screening games. Both signals are combined using a confirm-before-flag rule: a support area is only shown as a priority when both the student's activity results and the teacher's observations point the same direction. Single signals are shown as worth keeping an eye on rather than flagged urgently.

### Progress Analytics
A class-level overview with weekly sparklines for each student, SLD type distribution, and tier breakdowns. No external chart library, all drawn in SVG.

### IEP Generator
Generates an Individualized Education Program draft for a selected student using their screening results, activity history, mastery map, and any specialist notes. Teachers can edit and download it.

### AI Teacher Assistant
A chat interface backed by the Gemini API. Teachers can describe a classroom situation or ask for specific strategies, and the assistant responds with practical, classroom-appropriate suggestions. It has context about the student population built in so responses stay relevant.

### Special Educator Queue
When a teacher decides a student needs a specialist review, they submit a referral from the dashboard. The queue page shows all pending referrals, allows the specialist to add notes and select from practical recommendation templates, and marks the review as complete. Completed referrals feed into the IEP generator automatically.

### Resource Library
A collection of teaching materials and strategy guides organised by support area.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite |
| Styling | Tailwind CSS |
| Database | Firebase Firestore |
| Auth | Custom class-code and PIN system built on Firestore |
| AI | Google Gemini API (via `/api/gemini` Vercel function) |

---

## Running Locally

```bash
npm install
npm run dev
```

You will need a `.env.local` file with your Firebase config and Gemini API key. The app runs fully without the AI features if those are missing.

## Demo Credentials

No setup needed to try the demo:
- **Student class code:** `SCH001`
- **Teacher login:** Code `SCH001`, PIN `1234`
