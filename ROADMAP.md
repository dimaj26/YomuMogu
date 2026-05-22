# YomuMogu Roadmap

This document outlines the high-level roadmap, features, and conceptual improvements for the YomuMogu application.

---

## 2. Gamification: Experience, Tracks, and Learning Roadmap
**Goal**: Increase user engagement and retention by designing a structured learning roadmap.

### Proposed Concepts:
- **Visual Learning Tracks (Duolingo style)**: Interactive paths/nodes representing sessions or stages of learning.
- **XP Progression & Rewards**: Meaningful milestones and levels linked directly to the Japanification system.
- **Progress Visualization**: A map or progress bar that shows where the user stands in their vocab/grammar journey.

---

## 3. Intelligent Interface Japanification
**Goal**: Replace manual Japanification speed selection with an adaptive, offline heuristic that responds to user comprehension.

### Proposed Heuristic/Mechanism:
- **Removal of Static Speed Options**: Eliminate "slow", "normal", "fast" controls.
- **Implicit & Explicit Feedback Loops**:
  - The system automatically triggers transition of interface items to Japanese based on user's progress.
  - When an interface element changes (e.g., button "Новое" becomes "新しい"), the user has a quick feedback action (e.g., "I understand this" vs. "This is too early, revert back").
  - The module learns from this feedback to adjust the rate of future element translation.
- **Offline Algorithm**: Implement this logic as a local, deterministic rule engine/heuristic script instead of querying Gemini for every state transition to keep it lightweight and fast.

---

## 4. Adaptive Chat Difficulty Scaling
**Goal**: Implement a smart module that automatically adjusts the chat difficulty level.

### Proposed Concepts:
- **Temporary State**: Keep the manual 1-5 level selector for now.
- **Automatic Heuristic**:
  - A background evaluation script assesses the user's conversational performance (grammar correctness ratio, speed of answers, use of target/bonus words).
  - Suggests or automatically triggers progression to the next level (or soft downgrade if the user is struggling with corrections).
  - Runs locally and deterministically.

---

## 5. Decoupling from Anki (Independent Decks)
**Goal**: Make YomuMogu fully functional without requiring an Anki installation.

### Proposed Concepts:
- **Anki as an Option**: Keep Anki as a supported integration for users who prefer it.
- **Native Vocabulary Decks**: Develop built-in decks/word packs directly within YomuMogu.
- **Level-Based Word Packs**: Design curated vocabulary packs tailored to be most effective at each learning/Japanification stage.

---

## 6. Direct Anki Database & Cloud Integration
**Goal**: Transition away from the desktop AnkiConnect dependency (which requires the Anki desktop app to be active).

### Proposed Concepts:
- **AnkiWeb Cloud API**: Access Anki decks and synchronization directly via AnkiWeb cloud services (requiring user authorization/credentials).
- **Direct DB Syncing**: Connect directly to the local/synced SQLite collection files or AnkiWeb database storage for seamless operation without desktop app execution.

---

## 7. AI-Driven Active Learning & Speaking (Gemini Live Potential)
**Goal**: Elevate learning efficiency far beyond traditional apps (like Duolingo) by focusing on active, contextual production and preparing the user for real-life conversations.

### Proposed Concepts:
- **Conversational Grammar & Kanji Practice**:
  - Live, AI-generated interactive grammar quizzes and real-time sentence construction drills.
  - Context-aware Kanji learning where characters are introduced and practiced directly within conversational scenarios.
- **Active Usage Over Test Prep (Anti-Rote/Anti-JLPT)**:
  - Focus strictly on immediate communication, writing, and vocabulary retrieval in context, rather than preparing for passive multiple-choice tests.
- **Gemini Live Audio Integration**:
  - Future implementation of real-time voice conversations via Gemini Live API to practice speaking and listening naturally.
  - The primary objective is to make the user comfortable conversing on any topic derived from their target words, leading directly to fluent text and voice communication.

