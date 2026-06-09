# Plan: Stats / streak widget

A motivation widget attached to the composer: a 30-day contribution graph (GitHub-style squares) plus a streak counter and an all-time post total. Goal: make daily writing a habit. Shown by default, hideable in settings.

## What it looks like

```
[▢▢▣▣▣▢▣▣▣▣▣▢▣...▣]   🔥 7   ✎ 142
   30 day squares        streak   total
```

- **30 squares**, one per day (oldest → today, today rightmost). Rounded corners. Each square's fill = that day's progress toward the daily goal: empty at 0 posts, **pale at the first post, fully saturated once the goal is met**. Intensity = `min(count / goal, 1)` mapped to accent-color opacity. Today's square gets a subtle outline.
- **Streak** (🔥 fire icon) — consecutive days the goal was met, ending today, **with backfill** (see below).
- **Total** (✎ or similar) — all-time number of posts in this folder.

Stats are **per folder** (computed from the timeline's own posts), like everything else.

## Key decisions

### Graph vs. streak use different numbers (important)
- **Squares show the *raw* count for that calendar day** (`count/goal` intensity). A huge day never lights up past empty days — the graph stays an honest record of when you actually posted.
- **Backfill is a streak-only concept.** It affects the streak number, not the squares.

### Streak with backfill — the algorithm
Surplus posts (beyond the daily goal) flow **backward in time** to fill earlier unmet days, repairing recent skips. Walk from today backward, carrying a surplus "pool":

```
pool = 0
for d = 0 (today), 1, 2, … days ago:
  count     = posts created that day
  available = count + pool        // pool = surplus carried from more-recent days
  if available >= goal:  satisfied[d] = true;  pool = available - goal
  else:                  satisfied[d] = false; pool = 0   // can't carry a deficit
```

Then the streak = consecutive `satisfied` days from the active end:
- If **today** is satisfied → count today + backward while satisfied.
- If today is **not yet** satisfied (in progress) → **grace**: start at yesterday and count backward (today doesn't break it until the day is over). If yesterday also unsatisfied → streak 0.

Worked example (goal 3): two days ago 0 posts, yesterday 3, today 6.
`d0: 6→sat, pool 3` → `d1: 3+3=6→sat, pool 3` → `d2: 0+3=3→sat`. Streak = 3. Today's surplus flowed back through yesterday to repair the skip. ✅

### OPEN — backfill bound (needs your call)
The carry model is unbounded: one giant day (e.g. 90 posts at goal 3) would back-satisfy ~30 prior days → an instant 30-day streak. Options:
- **(a) Unbounded** — simplest, but exploitable. Fine for a personal honor-system tool?
- **(b) Cap the look-back** — surplus only backfills the last N days (e.g. 14).
- **(c) Cap per-day contribution** — a single day can contribute at most `goal` to *one* prior day (so you can't repair a month at once).

Recommend **(b)** with N≈14: forgives a bad week, blocks the cheese. Easy to change later.

### Other decisions (recommended defaults — flag if you disagree)
- **Position:** directly under the composer (so with composer-at-top it sits near the top as a dashboard; with composer-at-bottom it sits at the very bottom). "Under the post box."
- **Replies count** toward the daily goal and total (they're posts). 
- **Total** = all-time count of posts in the folder.
- **"Day" boundary** = local midnight; day key = local `YYYY-MM-DD` from each post's `created`.
- **Data source:** `usePosts` already loads the *entire* folder, so we can compute true (long) streaks, not just the visible 30 days. Pure transform — no new I/O or events.
- **Settings:** `dailyGoal` (number, default **3**) and `showStats` (toggle, default **true**). Both reactive (already supported).
- **Icons:** streak = `faFire`; total = `faPenNib` (or `faNoteSticky`) — pick your favorite.

### Responsive
30 squares + 2 stats in one row is tight on a phone. Plan: squares in a flex row that shrinks to fit (small min size); if still cramped, the streak/total wrap below the graph. Verify on the iPad.

## Files

- `src/lib/stats.ts` — pure functions: `countsByDay(posts)`, `last30Days(countsByDay, goal)` → `{date, count, ratio}[]`, `computeStreak(countsByDay, goal, today)`, `totalPosts(posts)`. Pure and unit-testable; this is where the algorithm lives.
- `src/components/StatsWidget.tsx` — renders the graph + streak + total from `posts` + `settings`. (Square = a `<div>` with inline accent opacity + `title` tooltip “Jun 7: 2 posts”.)
- `src/settings.ts` — add `dailyGoal`, `showStats` + their UI.
- `src/components/Timeline.tsx` — render `<StatsWidget>` under the composer when `settings.showStats`.
- `styles.css` — the squares + stats row.
- Docs: add the feature to `spec.md`; note the widget in `architecture.md`.

## TODO

- [ ] Confirm the open decisions above (esp. backfill bound, widget position).
- [ ] `lib/stats.ts` with the algorithm.
- [ ] `settings.ts` — `dailyGoal` + `showStats` + UI.
- [ ] `StatsWidget.tsx` — graph + streak + total.
- [ ] Wire into `Timeline` under the composer (gated on `showStats`).
- [ ] `styles.css` — squares (rounded, opacity fill, today outline) + stats row + responsive.
- [ ] Build + lint clean; check on desktop + iPad.
- [ ] Update `spec.md` + `architecture.md`; delete this plan.

## DONE

(planning)
