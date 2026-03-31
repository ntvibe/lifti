# Lifti (PWA) — AGENTS.md

You are an engineering agent working on “Lifti”, a calm, minimal, snappy strength-training planner + workout tracker.

## Goal
Build an offline-first PWA that makes plan editing and workout execution fast and reliable, with thoughtful history/progress. Prioritize “crafted feel” (smooth UX, zero jank) over feature count.

## Product Scope (V1)
### Core flows
1) Plans list
- List workout plans
- Each plan card shows a mini muscle heatmap (SVG) based on plan volume
- Actions: open plan, start workout

2) Plan editor (plan detail)
- Top: combined muscle heatmap (SVG) for all exercises in plan
- Editable plan title centered
- Exercise list rows show: exercise name + small “X sets”
- No muscle tags text in the list
- Right side 3-dots menu: delete
- Press/hold on 3-dots initiates drag reorder for exercise order
- Tapping a row opens Exercise Set Editor (full screen, not modal)
- Back navigation saves

3) Exercise Set Editor (full screen)
- Top: SVG highlighting the exercise’s targeted muscles (no text tags)
- Exercise name centered
- Sets table with columns depending on mode:
  - set #, reps OR durationMin OR distanceKm, weightKg (if applicable), restSec (always)
- Delete set (x) per row
- Add set duplicates last row
- Floating FAB confirms + goes back
- Back gesture/button also saves

4) Workout mode (focused)
- Start workout from a plan creates a WorkoutSession
- Show current exercise + current set + complete button
- Auto rest timer after completing a set (restSec), runs in background
- Haptics for timer end and key actions where possible
- User can scroll overview of plan during workout to adjust upcoming sets
- Editing during workout:
  - user edits SessionSet values
  - checkbox “Save for next time” applies changes back to matching PlanSet via planSetId
- Dark mode: system + manual override

5) History / progress (minimal)
- 7-day row showing days with workouts
- Total volume timeline with filters week/month/quarter/year

### Exercise library + custom
- Built-in library with muscles/equipment metadata
- User can duplicate and customize, or create new
- Custom can leave musclesPrimary/equipment empty
- “Import from AI”: paste JSON for exercise or plan → validate → save
- No videos, images only (pose images)

## Domain Model (LOCKED)
Use strict TypeScript discriminated unions and keep in sync with docs.

ExerciseMode:
- strength_reps (reps, weightKg, restSec required)
- bodyweight_reps (reps, restSec required; weightKg optional)
- timed_hold (durationSec, restSec required; weightKg optional)
- cardio_duration (durationMin, restSec required)
- cardio_distance (distanceKm, restSec required)
Global: restSec always required, default 60.

MuscleId list:
Biceps, Triceps, Forearms, Deltoids, RotatorCuff, Pectorals, UpperBack, Trapezius, Paravertebrals, Abdominals, LowerBack, Oblique, AbdomenTransverse, Diaphragm, Adductors, Gluteus, Hamstrings, Calves, Quadriceps, Ileopsoas

Exercise media:
- images: usually 2, can be more
- loop: forward (1,2,3 loop) or pingpong (1,2,3,2,1 loop)
- optional explicit sequence and frameMs

Sets:
- PlanSet: template rows stored in a plan
- SessionSet: copied from PlanSet, recorded during workout
- saveToPlan: when true, apply edited fields back to the matching PlanSet (by planSetId)

## Storage / Performance
- IndexedDB is the source of truth (offline-first).
- UI must not block on network.
- Optional Google Drive sync as backup (last write wins). Show “out of sync” indicator.
- Fast startup: render shell immediately, then hydrate.

## UI / Quality Bar
- Calm, minimal layout. Avoid clutter.
- No janky modals: exercise set editor is full screen.
- Scrolling must work on mobile and desktop.
- Prefer stable libraries for:
  - drag reorder
  - timers/background behavior
- Avoid overengineering. Simple architecture, clean boundaries.

## Repo Structure (preferred)
- src/types (domain types/helpers)
- src/db (indexeddb schema + repositories)
- src/sync (drive sync)
- src/ui (screens/components)
- src/state (stores)
- docs (specs like exercise_data_model.md)

## How to work
- Implement in small, shippable steps.
- When changing data structures: update docs + types + migrations.
- Keep PRs focused. Avoid adding features not in scope.

## First Milestone
Foundation:
- Create docs/exercise_data_model.md (no TS block)
- Create src/types/domain.ts (strict unions)
- Set up IndexedDB schema + repositories
- Create route shell: Plans, Plan Editor, Workout, History

## Definition of Done for a task
- Works on mobile + desktop
- No scroll traps
- Data persists across refresh
- TypeScript types enforce correctness
- Minimal UI but polished interactions
