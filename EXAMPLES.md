# 📚 Exemples concrets Guardian PR 2.0

## Scénario 1 : PR basique acceptée ✅

### PR
```
Title: fix: prevent null pointer exception in payment validator

Labels: type: fix

Description:
## What
Addresses a null pointer exception that occurs when processing refunds 
without a transaction ID. Prevents 5-10 failed refund attempts daily.

## Why
Users attempting refunds encounter a 500 error. Root cause: transaction ID 
validation doesn't handle async updates properly. Impact: 3% of refund requests fail.

## How to test
1. Start the dev server: `npm run dev`
2. Navigate to Admin > Payments > Refunds
3. Attempt to refund a transaction without transaction_id in the payload
4. Verify error is caught and returns 400 (Bad Request) instead of 500
5. Check server logs show descriptive error: "transaction_id is required"

Closes #456
```

### Guardian Response
```
✅ PR passes all guardian checks

- Title ✓ (29 chars, specific)
- Description ✓ (3 sections, all >30 chars)
- Test Instructions ✓ (numbered, action verbs, specific)
- Type Label ✓ (type: fix)
- Assignees ✓ (assigned to @dev)
- Approvals: Pending (0/1)
- CI Checks: ✓ All passing
- Ticket Reference ✓ (Closes #456)
```

**Result:** Merge succeeds once approvals collected.

---

## Scénario 2 : PR rejetée pour plusieurs raisons ❌

### PR (Initial)
```
Title: update

Labels: None

Description:
Update the codebase.

## How to test
Test it

References: N/A
```

### Guardian Response

```
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Title Quality**
> Title is too generic: "update". Use specific language.

**What to do:** Describe the actual change: 
"fix: prevent division by zero" instead of just "fix"

---

**Description Structure**
> Section "What" has only 20 chars (minimum: 30)

**What to do:** Expand the "What" section with more details

---

**Type Labels**
> No valid type label found. PR has: none

**What to do:** Add one of: type: enhancement, type: fix, type: refactor, type: docs, type: chore

---

**Test Instructions**
> Instructions are too vague

> Instructions too brief (7 chars, minimum: 50)

**What to do:** Provide specific, numbered steps

---

**Ticket Reference**
> Instructions contain placeholders (TODO, N/A, same as before)

**What to do:** Reference a ticket in the PR body: "Closes #123" or "PROJ-456" or "LINEAR-xyz"

---

### ⚠️ Warnings (Non-blocking)

**Assignees**
> 0 assignee(s), 1 required

---

Guardian enforces team standards to ensure clarity and traceability.
```

### Developer fixes PR to:

```
Title: refactor: split payment validator into smaller functions

Labels: type: refactor

Description:
## What
Splits the monolithic PaymentValidator class into 5 specialized validators.
Reduces cyclomatic complexity from 28 to 6 per function. Improves maintainability.

## Why
The single validator function is 400+ lines, making it hard to test individual 
validation rules. This refactor allows us to test currency validation, 
amount validation, and fraud checks independently.

## How to test
1. Run `npm run test -- tests/validators`
2. All 145 validator tests should pass (was 98, added 47 new ones)
3. Run `npm run lint` and verify no complexity warnings
4. Build and verify no breaking changes: `npm run build`
5. Check bundle size: `npm run analyze` (should be same or smaller)

Resolves #789
```

### Guardian Response (Second Check)
```
✅ PR passes all guardian checks

- Title ✓ (specific, follows convention)
- Description ✓ (3 sections, all >30 chars)
- Test Instructions ✓ (numbered, action verbs)
- Type Label ✓ (type: refactor)
- Assignees ✓ (assigned to @dev)
- Approvals: Pending (0/1)
- CI Checks: ✓ All passing
- Ticket Reference ✓ (Resolves #789)
```

**Result:** Ready for review.

---

## Scénario 3 : Emergency override 🆘

### Initial PR (Blocked)
```
Title: hotfix: payment processor down

Description:
Payment processor API timing out. Users cannot complete purchases.

How to test
Manual testing in staging

Labels: type: fix
```

### Guardian blocks
```
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Description Structure**
> Only 1 section(s) found, 3 required

**What to do:** Add sections like "## What", "## Why", "## How to test"

---

**Test Instructions**
> Section present but not actionable

**What to do:** Use imperative verbs: "Run the tests", "Click the button"
```

### Developer adds override
```
Label added: guardian:override

Comment posted:
reason: Production incident - payment processor down, 0 transactions in last 15min
accept_risk: Reduced testing due to time-critical nature. 
Deploying hotfix to restart processor connection pool.
Will run full regression tests in 2 hours post-fix.
escalation: Approved by @tech-lead for emergency deployment
```

### Guardian Response
```
✅ **OVERRIDE APPLIED**

guardian:override label detected with justification:

"reason: Production incident - payment processor down, 0 transactions in last 15min
accept_risk: Reduced testing due to time-critical nature."

Merge authorized despite blocking violations.
Exception logged for post-incident review.
```

**Result:** Merge succeeds immediately.

---

## Scénario 4 : Weak test instructions caught ⚠️

### PR (Initial)
```
Title: fix: handle null user in profile page

Description:
## What
Prevents crash when user profile is null after logout.

## Why
Users see 500 error on fast logout-to-profile navigation. Null reference.

## How to test
Test the profile page with null user
Verify it doesn't crash
Check localStorage is cleared

References: Closes #234
```

### Guardian Response
```
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Test Instructions**
> Instructions lack action verbs (run, click, verify, etc.)
> Instructions too brief (51 chars, but generic phrasing)

**What to do:** Use specific, numbered steps with imperative verbs.
Example: "1. Open DevTools, set localStorage=null"
         "2. Navigate to /profile"
         "3. Verify component renders fallback UI"
```

### Developer improves to:

```
## How to test
1. Open browser DevTools (F12)
2. Clear localStorage: `localStorage.clear()`
3. Navigate to `/profile` page
4. Verify fallback UI renders: "Please log in to view profile"
5. Verify no JavaScript console errors
6. Click "Go to Login" button and verify navigation works
7. Run `npm test -- profile` - all 23 tests pass
```

### Guardian Response (Second Check)
```
✅ Test instructions now pass all checks
```

---

## Scénario 5 : Content validation catches copy-paste ❌

### PR
```
Title: feat: add email notifications

Description:
## What
Add email notification support

## Why
Users asked for it

## How to test
Test the email feature

References: #500
```

### Guardian Response
```
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Description Structure**
> Section "What" has only 22 chars (minimum: 30)
> Section "Why" contains placeholders or is too generic
> Section "How to test" contains placeholders or is too generic

**What to do:** 

For "What": Expand with specific details about the feature.
Example: "Add support for transactional emails: password reset, order confirmation..."

For "Why": Provide concrete impact.
Example: "Current workaround requires manual emails. 47% of support tickets are 'Where's my receipt?'"

For "How to test": Provide step-by-step instructions with action verbs.
Example: "1. Run migrations: npm run migrate
          2. Start dev server: npm run dev
          3. Click 'Forgot password'
          4. Check inbox for reset email"
```

---

## Scénario 6 : Coherence warning 🔗

### PR
```
Title: update axios dependency

Labels: type: enhancement

Description:
## What
Updated axios from 0.21.0 to 1.4.0

## Why
Needed for security patches and bug fixes

## How to test
1. Run npm install
2. Run tests: npm test
3. Verify API calls work

References: #100
```

### Guardian Response

```
✅ PR ready to merge (all blocking rules pass)

### ⚠️ Warnings (Non-blocking)

**Coherence**
> Title doesn't reflect "type: enhancement" label
> Consider starting with "feat: " or "chore: " in the title

**Suggestion:** "chore: upgrade axios to 1.4.0 for security patches"
```

**Result:** Merge allowed, but with note to developer about best practice.

---

## Scénario 7 : Full example of excellent PR ✨

```
Title: fix: prevent race condition in user session cache

Labels: type: fix, priority: high

Description:
## What
Fixes a race condition where concurrent login requests from the same user 
could create multiple session entries in Redis, causing logout on one device 
to affect all devices. Solution: use Redis atomic operations (SETNX).

## Why
- Impact: 2-3 reports daily from users losing sessions across devices
- Root cause: Non-atomic read-modify-write in session creation
- Affected users: ~50/day globally
- Current cost: ~50 support tickets/month

## How to test
1. Start dev server: `npm run dev`
2. Open browser with DevTools Console active
3. Open two incognito windows (simulate different devices)
4. In window 1: navigate to /login, enter test@example.com / password
5. In window 2: simultaneously navigate to /login with same credentials
6. Verify both sessions remain active after login
7. In window 1: click logout and verify window 2 remains logged in
8. Run test suite: `npm test -- session` (all 156 tests pass)
9. Run load test: `npm run load-test -- --duration=5m --concurrent=50`
10. Verify no session leaks in Redis monitoring dashboard

## Testing checklist
- [x] Unit tests added (8 new tests)
- [x] Integration tests updated (3 failing tests now pass)
- [x] Load test passed
- [x] Redis atomic operations verified
- [x] No sessions leaked after 10K concurrent logins

Fixes #8234
Tested on: ubuntu-latest, node 20

## Related
- Similar fix applied in: #8230 (different cache layer)
- Depends on: #8235 (Redis dependency update)
```

### Guardian Response

```
✅ **All Guardian checks passed** ✨

✓ Title: Specific, describes actual fix (51 chars)
✓ Description: 3 sections, all >30 chars
✓ Test Instructions: Detailed, numbered, action verbs, specific
✓ Labels: type: fix present
✓ Content Coherence: Title & label aligned
✓ Assignees: Assigned to 1 reviewer
✓ Approvals: Pending (0/1)
✓ CI Checks: All passing
✓ Ticket Reference: Fixes #8234

Ready for review and merge.
```

---

## Key Takeaways

| Scenario | Guardian Output | Developer Behavior |
|----------|-----------------|-------------------|
| Copy-paste minimal PR | Multiple specific violations | Must think through each issue |
| Generic instructions | Action verb check fails | Must write concrete steps |
| Missing details | Soft warnings on coherence | Must align title/labels/content |
| Emergency fix | Override mechanism available | Exception is transparent & documented |
| Excellent PR | All checks pass | Gets immediate green light |

Guardian doesn't prevent merging—it **forces intentionality** at every step.
