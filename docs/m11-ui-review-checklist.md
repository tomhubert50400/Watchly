# M11 UI review checklist

Use this checklist to review everything currently visible to a normal Watchly user before UI polish work starts.

## Preconditions

- Android emulator dev client is installed and opened.
- API is running on `http://localhost:3000`.
- Metro is running on port `8081`.
- Android port forwarding is active for `3000` and `8081`.
- You are signed in as the main review user.
- The M11 review dataset has been prepared with:

```powershell
pnpm --filter api dev:prepare-ui-review
```

Prepared review data:

- Main user: existing signed-in Google user.
- Second user: `Test profile`.
- Feed content: public Matrix review from `Test profile`.
- Film states: Matrix watched and favorite, Avatar watchlisted.
- Series states: Game of Thrones watching and favorite, The Boys dropped.
- Ratings: Matrix movie rating, Game of Thrones S1 episode ratings.
- Progress: Game of Thrones S1 episodes 1 to 5 watched.
- Reviews: Matrix movie review, Game of Thrones S1 E1 episode review.
- Lists: `M11 Personal Queue`, `M11 Shared Night`.
- Voting: `Tonight` voting session with multiple votes.
- Release alerts: enabled detail-screen alerts for The Matrix and Game of Thrones.

## Global app shell

- Bottom tabs: Feed, Explore, My TV, Profile.
- Swipe between main tabs.
- Back navigation from every detail screen.
- Long screens scroll without cutting bottom actions behind the tab bar.
- Loading states are readable and not layout-breaking.
- Empty states are useful and not visually over-heavy.
- Error states show retry paths where expected.
- Signed-out states explain the required action without exposing private content.

## Feed

- Signed-in Feed does not show release alerts.
- Feed shows followed public written reviews.
- Feed review card shows author, title, artwork or placeholder, date, and review text.
- Tap movie review card, it opens the film detail screen.
- Pull-to-refresh keeps the current layout stable.
- Empty Feed state after unfollowing `Test profile`.
- Feed refills after following `Test profile` again.

## Explore

- Initial empty search state.
- Short query validation.
- Search `matrix` with Movies.
- Open The Matrix film detail.
- Search `game of thrones` with Series.
- Open Game of Thrones series detail.
- No-result state with a nonsense query.
- Loading state while results fetch.
- TMDB attribution is visible.

## Film detail

Review at least:

- The Matrix, TMDB 603.
- Avatar, TMDB 19995.

Check:

- Poster or image placeholder.
- Title, year, runtime, overview, genres, and metadata hierarchy.
- Streaming availability panel.
- Release alert bell icon inside the header, enable and disable state.
- Tracking controls: Watchlist, Watching, Watched, Dropped.
- Favorite toggle.
- Movie rating panel, including half-star selection and clear.
- Movie written review editor, save, reload, delete.
- Personal watchlist controls.
- Shared watchlist controls.
- Signed-out state for tracking, rating, review, and lists.

## Series detail

Review Game of Thrones, TMDB 1399.

Check:

- Poster or image placeholder.
- Series metadata and overview.
- Streaming availability panel.
- Release alert bell icon inside the header, enable and disable state.
- Tracking controls and favorite toggle.
- Computed series rating from episode ratings.
- Continue watching resume card.
- Season list and season rows.
- Open Season 1.
- Personal and shared watchlist controls.

## Season detail

Review Game of Thrones Season 1.

Check:

- Season metadata and overview.
- Computed season rating.
- Watched progress summary.
- Episode list.
- Watched labels on episodes 1 to 5.
- Episode 6 appears as the next useful resume target.
- Open S1 E1 and S1 E6.

## Episode detail

Review:

- Game of Thrones S1 E1.
- Game of Thrones S1 E6.

Check:

- Episode metadata and overview.
- Watched or unwatched state.
- Mark watched.
- Clear watched progress.
- Episode rating panel, including clear.
- Episode written review editor, save, reload, delete.
- Signed-out state for progress, rating, and review.

## My TV

Check:

- Tracked films and series appear with hydrated titles.
- Status labels for watched, watchlisted, watching, and dropped.
- Favorite state appears where available.
- Matrix rating appears.
- Game of Thrones progress appears, including current episode context.
- Opening a tracked movie returns to film detail.
- Opening a tracked series returns to series detail.
- Personal watchlists section shows `M11 Personal Queue`.
- Open `M11 Personal Queue`.
- Open a film or series from inside the personal list.
- Create a personal watchlist with an empty name, validation should appear.
- Create a personal watchlist with a valid name.
- Delete a newly created personal watchlist.
- Shared watchlists section shows `M11 Shared Night`.
- Create a shared watchlist with an empty name, validation should appear.
- Create a shared watchlist with a valid name.
- Open a shared watchlist.
- Delete a newly created shared watchlist.

## Shared watchlist

Review `M11 Shared Night`.

Check:

- Member-only access state.
- Shared items hydrate titles and content type.
- Existing voting session `Tonight`.
- Candidates show vote counts.
- Current user's selected vote is visually clear.
- Toggle vote on and off.
- Create a new voting session.
- Empty-state behavior if a newly created shared list has no items.

## Profile

Check:

- Signed-in account card.
- Display name and account state.
- Sign out.
- Signed-out public shelf state.
- Google sign-in returns to the app.
- Preview own public profile.
- Open `Test profile`.
- Follow and unfollow `Test profile`.
- Block and unblock `Test profile`.
- Blocked profile state.
- Private profile state by setting profile visibility to private, then opening public preview.

## Settings

Check:

- Display name input loads and saves.
- Profile visibility public/private.
- Viewing history visibility public/private.
- Episode progress visibility public/private.
- Ratings visibility public/private.
- Written reviews copy correctly follows profile visibility.
- Shared watchlist visibility members/private/public if available in UI.
- Save success state.
- Save error state if API is unavailable.
- Signed-out Settings state.

## Onboarding

This requires resetting the current review user to incomplete onboarding before opening the app.

Check:

- Profile basics screen.
- Display name edit.
- Privacy defaults screen.
- Starter interests search.
- Select and unselect starter films or series.
- Skip optional interests.
- Finish onboarding.
- Returning user does not see onboarding again.

## API-off and degraded states

Use only after normal screenshots are captured.

- Stop the API and reload Feed.
- Reload Explore search with API down.
- Open My TV with API down.
- Open Profile or Settings with API down.
- Restore API and confirm refresh recovers.

## Screenshot set for M11.0

Capture at minimum:

- Feed with a followed review card and no release alerts.
- Film detail with release-alert bell.
- Series detail with release-alert bell.
- Explore search results.
- Film detail with controls visible.
- Series detail with continue watching.
- Season detail with watched labels.
- Episode detail with rating and progress controls.
- My TV with tracked content and watchlists.
- Shared watchlist with voting.
- Profile signed-in state.
- Public profile for `Test profile`.
- Settings privacy controls.
- Onboarding each step.
- One empty state.
- One error state.

## Notes during review

For each UI issue, record:

- Screen.
- What is visually or ergonomically wrong.
- Severity: blocker, high, medium, low.
- Whether it is layout, copy, hierarchy, contrast, spacing, state, navigation, or missing feedback.
- Screenshot name.
