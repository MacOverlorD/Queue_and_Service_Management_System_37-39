## Issue and contract

Closes #

- Feature ID: F-
- Requirements: FR- / BR- / NFR-
- Acceptance criteria covered: AC-
- Contract: `docs/sprints/sprint-1/...`

## What changed

<!-- Short description of behavior, API, data and UI changes. Say "no change" for a layer that is untouched. -->

## TDD evidence

Failing test (before implementation), commit `.......`:

```
paste test output showing the failure
```

Passing test (after implementation), commit `.......`:

```
paste test output showing the pass, with passed/failed/skipped counts
```

Command used:

```
npm test ...
```

## Reviewer checklist

- [ ] Behavior matches the contract and AC
- [ ] Negative and boundary cases are tested (role, ownership, invalid transition, duplicate)
- [ ] Authorization is enforced on the backend, not only hidden in the UI
- [ ] No real secrets, no password hashes or private data returned
- [ ] Docs updated (contract revision noted if the spec changed)

## Review note

<!-- Reviewer: write a specific check, question, finding or reason for approval. Authors do not approve their own PR. -->
