# ⚡ Guardian PR: Quick Start (5 minutes)

Get Guardian PR working in your repo in 5 minutes.

---

## Step 1: Create workflow file (1 min)

Create `.github/workflows/guardian.yml`:

```yaml
name: Guardian PR check

on:
  pull_request:
    types: [opened, reopened, ready_for_review, edited, synchronize, assigned, unassigned, labeled, unlabeled]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  check-pr:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '24'

      - name: Install dependencies
        run: npm install

      - name: Run PR Guardian
        run: node scripts/check_pr.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Step 2: Copy the script (1 min)

Copy [scripts/check_pr.js](scripts/check_pr.js) to your repo at `scripts/check_pr.js`

---

## Step 3: Create configuration (2 min)

Create `guardian.yml` at your repo root:

```yaml
# ============================================
# GUARDIAN PR - Quick Start Configuration
# ============================================

rules:
  # PR Title must be descriptive
  title_quality:
    enabled: true
    severity: block
    config:
      min_length: 10
      reject_generic: true

  # Description must have What/Why/How sections
  description_structure:
    enabled: true
    severity: block
    config:
      min_sections: 3
      min_chars_per_section: 30
      heading_level: 2

  # Test instructions must be concrete and detailed
  test_instructions:
    enabled: true
    severity: block
    config:
      min_length: 50
      must_have_action_verbs: true
      reject_placeholders: true

  # At least one type label required
  type_labels:
    enabled: true
    severity: block
    required_labels:
      - "type: enhancement"
      - "type: fix"
      - "type: refactor"
      - "type: docs"

  # At least one approver
  approvals:
    enabled: true
    severity: block
    required: 1

  # All CI checks must pass
  ci_checks:
    enabled: true
    severity: block

  # Must reference a ticket or issue
  ticket_reference:
    enabled: true
    severity: block
    patterns:
      - "#\\d+"              # GitHub: #123
      - "PROJ-\\d+"          # Jira-like: PROJ-456
      - "[A-Z]+-\\d+"        # Generic: ABC-789
```

---

## Step 4: Create PR template (1 min)

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What
Describe what is being modified or added.

## Why
Explain the reason for the change. What problem does this solve?

## How to Test
Step-by-step instructions:
1. Start the dev server: `npm run dev`
2. Navigate to [feature]
3. Verify [expected behavior]
4. Check [additional validation]

## Related
Closes #[issue number]
```

---

## ✅ You're done!

Push your changes and create a test PR. Guardian will now check:

✓ Title is descriptive (≥10 chars, not generic)  
✓ Description has 3+ sections  
✓ Test instructions are detailed with action verbs  
✓ Type label is present  
✓ At least 1 approval  
✓ All CI checks pass  
✓ Ticket reference included  

---

## Next: See it in action

### Create a test PR with good content:
```
Title: fix: prevent race condition in cache

Description:
## What
Fixes race condition where concurrent requests create duplicate cache entries.

## Why
Users report inconsistent data. Affects 5% of requests.

## How to Test
1. Start server: npm run dev
2. Send concurrent requests: artillery run test.yml
3. Verify no duplicate entries in Redis

Closes #789
```

**Result:** ✅ All checks pass

### Create a test PR with bad content:
```
Title: update

Description: Fixed stuff

Labels: [none]
```

**Result:** ❌ Multiple violations with specific guidance

---

## Customize for your team

Edit `guardian.yml` to adjust:

```yaml
# For solo developers (no approval required)
approvals:
  required: 0

# To disable a rule
assignees:
  enabled: false

# To make a rule just a warning
coherence_check:
  severity: warn
```

---

## Emergency: Bypass a check

If a PR is legitimately urgent:

1. Add label: `guardian:override`
2. Comment: `reason: Production hotfix for payment processor down`

Override is **visible and auditable**.

---

## Read more

- **[README.md](readME.md)** – Overview and detailed documentation
- **[EXAMPLES.md](EXAMPLES.md)** – Real-world scenarios
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** – Deep dive into features
- **[guardian.yml](guardian.yml)** – Full configuration reference

---

## Support

Having issues? Check:
1. `.github/workflows/guardian.yml` exists and is correct
2. `scripts/check_pr.js` is copied to your repo
3. `guardian.yml` is at repo root
4. GitHub Actions tab shows the workflow running

Still stuck? Open an issue with your config and PR details.
