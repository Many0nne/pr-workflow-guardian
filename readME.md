# Guardian PR – Enforce Clarity & Intentionality

**Guardian PR** is a GitHub Action that blocks PR merges enforcing **not just compliance, but understanding**.

Rather than simple binary checks (✅/❌), Guardian provides:
- **Explicit feedback** on *why* a rule matters
- **Specific guidance** on *how* to fix violations  
- **Content validation** beyond just syntax
- **Override mechanism** for justified exceptions

**Goal:** Teams spend less time arguing about form, more time on substance.

---

## What Guardian Checks

### Core Validations

| Rule | Type | Why It Matters |
|------|------|---|
| **Title Quality** | Block | Enables scannable PR lists; prevents vague titles |
| **Description Structure** | Block | Ensures What/Why/How clarity for reviewers |
| **Test Instructions** | Block | Prevents untestable PRs; forces concrete steps |
| **Type Labels** | Block | Makes PR history searchable & filterable |
| **Coherence** | Warn | Aligns title, labels, and content |
| **Approvals** | Block | Enforces peer review |
| **Assignees** | Warn | Clarifies ownership |
| **CI Checks** | Block | Prevents failing code from merging |
| **Ticket References** | Block | Links code to requirements/issues |
| **Review Status** | Block | Ensures feedback is resolved |

### Advanced Content Checks

- **Placeholder Detection** – Rejects TODO, N/A, "same as before"
- **Action Verb Validation** – Test instructions must use verbs like run, click, verify
- **Generic Title Rejection** – Prevents "fix", "update", "stuff"
- **Minimum Content Length** – Enforces substantive sections, not filler

---

## How It Works

### 1. **Developer creates PR**
```markdown
Title: fix: prevent null pointer in payment processor
Labels: type: fix
Description: [structured with What/Why/How to Test]
```

### 2. **Guardian checks the PR**
Validates against all configured rules with specific feedback:
```
✓ Title is descriptive
✓ Description has 3 sections with 30+ chars each
✓ Test instructions include 5 numbered steps with action verbs
✓ Type label present
✓ CI checks passing
→ Ready for review ✅
```

### 3. **If violations found**
Guardian posts a detailed comment:
```
❌ **Guardian: Merge Blocked**

**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)

**What to do:** Provide detailed, numbered steps for testing
```

### 4. **Developer fixes and re-checks**
Guardian automatically validates the updated PR.

---

## Configuration

Guardian is configured via `guardian.yml` at the repository root:

```yaml
rules:
  title_quality:
    enabled: true
    severity: block
    config:
      min_length: 10
      reject_generic: true
  
  test_instructions:
    enabled: true
    severity: block
    config:
      min_length: 50
      must_have_action_verbs: true
      reject_placeholders: true
  
  approvals:
    enabled: true
    severity: block
    required: 1
```

Each rule includes:
- **description** – Why this rule exists
- **examples** – Good vs bad cases
- **config** – Specific thresholds

See [guardian.yml](guardian.yml) for full configuration and explanations.

## Feedback & Violations

Guardian provides structured, educational feedback:

```markdown
❌ **Guardian: Merge Blocked**

### 🚫 Blocking Issues

**Title Quality**
> Title is too generic: "update". Use specific language.

**What to do:** 
Describe the actual change: "fix: prevent division by zero" instead of just "fix"

---

**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)

**What to do:** 
Provide detailed, numbered steps for testing
```

Each violation includes:
1. **What's wrong** – Specific, concrete description
2. **Why it matters** – Context for the rule
3. **How to fix** – Actionable guidance

---

## Emergency Override

If Guardian is blocking a legitimate PR:

1. Add the label: `guardian:override`
2. Post a comment with justification:
   ```
   reason: Production hotfix for payment processor outage
   accept_risk: Reduced testing window for 30 minutes
   ```

The override is **visible in history** → full accountability.

---

## Installation

### Step 1: Add the workflow

Copy `.github/workflows/guardian.yml`:

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

### Step 2: Copy the script

Save `scripts/check_pr.js` (provided in this repo)

### Step 3: Configure rules

Create `guardian.yml` at repository root:

```yaml
rules:
  title_quality:
    enabled: true
    severity: block
    description: "Titles must be descriptive and specific"
    config:
      min_length: 10
      reject_generic: true

  description_structure:
    enabled: true
    severity: block
    description: "PR descriptions must have structured sections"
    config:
      min_sections: 3
      min_chars_per_section: 30
      heading_level: 2

  test_instructions:
    enabled: true
    severity: block
    description: "Test section must have concrete, actionable steps"
    config:
      min_length: 50
      must_have_action_verbs: true
      reject_placeholders: true

  type_labels:
    enabled: true
    severity: block
    description: "At least one type label must be present"
    required_labels:
      - "type: enhancement"
      - "type: fix"
      - "type: refactor"
      - "type: docs"

  approvals:
    enabled: true
    severity: block
    required: 1

  ci_checks:
    enabled: true
    severity: block

  ticket_reference:
    enabled: true
    severity: block
    patterns:
      - "#\\d+"
      - "PROJ-\\d+"
      - "[A-Z]+-\\d+"
```

### Step 4: Create PR template (optional but recommended)

`.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What
Describe what is being modified or added.

## Why
Explain the reason for the change. What problem does this solve?

## How to Test
Step-by-step instructions:
1. Start the dev server
2. Navigate to the feature
3. Verify the expected behavior

## Related
Closes #[issue number]
```

---

## Examples

### ✅ PR that passes
```
Title: fix: prevent race condition in cache invalidation
Labels: type: fix
Description: [3 sections with 30+ chars each]
Test Instructions: [numbered steps with action verbs]
Ticket: Closes #456
```

### ❌ PR that gets blocked
```
Title: update
Labels: [missing]
Description: "Fixed stuff"
Test Instructions: "Test it"
→ Multiple violations, detailed feedback provided
```

See [EXAMPLES.md](EXAMPLES.md) for full, realistic examples.

---

## Rules Explained

### Description Structure
- Must have minimum number of sections (e.g., `##` headings)
- Each section must have substantial content (minimum 30 characters)
- Sections are validated to be specific, not generic

**Example:**
```markdown
## What
Fixed race condition where concurrent login requests from same user 
could create duplicate sessions in Redis.

## Why
Users reported logout on one device affecting all devices. 
Impact: 50+ tickets/month, 3% of daily logins affected.

## How to Test
1. Start dev server: npm run dev
2. Open two browser windows (simulate different devices)
3. Login simultaneously with same credentials in both
4. Verify both sessions remain active
5. Logout in one window; verify other remains logged in
```

### Test Instructions Validation
Guardian checks that instructions:
- ✓ Include **action verbs** (run, click, verify, navigate)
- ✓ Are **numbered and specific**
- ✗ Don't contain placeholders (TODO, N/A, same as before)
- ✗ Aren't too generic ("just test it")

### Title Quality
Titles must be:
- ✓ At least 10 characters
- ✓ Descriptive and specific
- ✗ Not generic words ("fix", "update", "stuff")

---

## Customization

All rules can be configured or disabled:

```yaml
rules:
  approvals:
    required: 0  # Solo developers can set to 0
  
  assignees:
    enabled: false  # Optional for some teams
```

---

## For Solo Developers

If working alone, set:

```yaml
approvals:
  required: 0
```

All other rules remain, enforcing quality and clarity without external approval.

---

## Limitations & Philosophy

### What Guardian Does
✅ Enforce structural consistency  
✅ Prevent obviously incomplete PRs  
✅ Make PR intent clear and scannable  
✅ Create friction that encourages reflection

### What Guardian Doesn't Do
❌ Validate code quality  
❌ Check business logic correctness  
❌ Teach you how to write tests  
❌ Prevent well-formatted recklessness

**Guardian's philosophy:** Force **intentionality**, not perfection.

---

## Documentation

- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** – Deep dive into changes and rationale
- **[CHANGELOG.md](CHANGELOG.md)** – What changed in v2.0
- **[EXAMPLES.md](EXAMPLES.md)** – Real-world scenarios and solutions

---

## FAQ

**Q: Does Guardian improve code quality?**  
A: Indirectly. Guardian forces developers to write clear, detailed PRs, which correlates with higher quality. But it validates *form*, not substance.

**Q: Can I bypass Guardian?**  
A: Yes, via `guardian:override` label + justification. That override is visible and auditable.

**Q: What if a PR is genuinely urgent?**  
A: Use override. Guardian's job is to *encourage* clarity, not block emergencies. The override mechanism provides accountability.

**Q: Can I disable rules?**  
A: Yes, set `enabled: false` in `guardian.yml` for any rule you don't need.

**Q: How do I know if Guardian is working?**  
A: Check the workflow run in Actions tab. Guardian will post comments on PRs (visible to all) when violations are found.

---

## Changelog

**v2.0 (Current)**
- Qualification of violations with severity levels
- Explicit educational feedback for each violation
- Content validation (placeholders, verbs, generic text detection)
- Coherence checks between title/labels/content
- Override mechanism with justification
- Full documentation of rules in configuration

**v1.0**
- Basic validation: structure, labels, approvals, CI checks

---

## Contributing

Have ideas to improve Guardian? Issues and PRs welcome!

---

## License

MIT