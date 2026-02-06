# 🔄 Migration Guide: v1 → v2

Guardian PR v2.0 is a **major upgrade** focused on educational feedback, not just enforcement.

---

## What Changed

### The Philosophy
- **Before:** Binary checks (pass/fail) with minimal feedback
- **After:** Educational checks with explicit *why* and *how-to-fix*

### Breaking Changes
**None!** The old configuration format still works, but you'll miss new features.

---

## What You Should Update

### 1. Configuration Format (Recommended)

#### Old format (still works):
```yaml
approvals_required: 1
required_type_labels: ["type: fix", "type: feature"]
min_md_sections: 3
min_section_chars: 20
```

#### New format (recommended):
```yaml
rules:
  approvals:
    enabled: true
    severity: block
    required: 1
    description: "Ensures peer review before merge"
  
  type_labels:
    enabled: true
    severity: block
    required_labels: ["type: fix", "type: enhancement"]
    description: "Makes PR history searchable"
  
  description_structure:
    enabled: true
    severity: block
    config:
      min_sections: 3
      min_chars_per_section: 30
    description: "Ensures What/Why/How clarity"
```

**Benefits:**
- Each rule is self-documenting
- Can enable/disable rules individually
- Easier to customize per rule

---

## New Features You Get

### 1. Severity Levels
```yaml
rules:
  title_quality:
    severity: block      # Prevents merge
  
  assignees:
    severity: warn       # Just a warning
```

### 2. Content Validation
Guardian now checks content quality, not just presence:

```yaml
test_instructions:
  config:
    must_have_action_verbs: true   # Checks for: run, click, verify
    reject_placeholders: true       # Rejects: TODO, N/A, FIXME
    min_length: 50                  # Minimum 50 characters
```

### 3. Title Quality Checks
```yaml
title_quality:
  config:
    min_length: 10
    reject_generic: true  # Rejects: "fix", "update", "stuff"
```

### 4. Coherence Validation
```yaml
coherence_check:
  config:
    title_must_reflect_type: true  # "fix:" in title if type: fix
```

### 5. Override Mechanism
Apply label `guardian:override` with justification comment to bypass rules.

---

## Migration Steps

### Step 1: Update your `guardian.yml`

**Minimal migration (old config still works):**
```yaml
# Keep existing config as-is
approvals_required: 0
required_type_labels: ["type: fix", "type: feature"]
min_md_sections: 3
```

**Recommended migration (adopt new format):**
```yaml
rules:
  approvals:
    enabled: true
    severity: block
    required: 0  # Change from approvals_required

  type_labels:
    enabled: true
    severity: block
    required_labels: ["type: fix", "type: feature"]

  description_structure:
    enabled: true
    severity: block
    config:
      min_sections: 3
      min_chars_per_section: 30

  test_instructions:
    enabled: true
    severity: block
    config:
      min_length: 50
      must_have_action_verbs: true
      reject_placeholders: true

  ci_checks:
    enabled: true
    severity: block
```

### Step 2: Update your workflow (optional, backwards compatible)

Your `.github/workflows/guardian.yml` **doesn't need changes**. It works as-is.

But update Node.js version if you haven't:
```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '24'  # Update from 18
```

### Step 3: Test on a PR

Create a test PR with deliberately incomplete info:
- Title: "update"
- Description: "Fixed stuff"
- Test: "Test it"

**Expected:** Multiple specific violations with guidance (not just "merge blocked")

### Step 4: Update team guidelines

Communicate the new feedback format:
- Violations now explain *why* and *how to fix*
- Override mechanism available for emergencies
- Rules are now self-documented in `guardian.yml`

---

## Comparison: Old vs New Feedback

### Example 1: Bad title

**Before:**
```
❌ Aucun label de type valide
```

**After:**
```
❌ **Guardian: Merge Blocked**

**Title Quality**
> Title is too generic: "fix". Use specific language.

**What to do:** Describe the actual change: 
"fix: race condition in cache" instead of just "fix"
```

### Example 2: Weak test instructions

**Before:**
```
Section "How to test" trop courte (<20)
```

**After:**
```
**Test Instructions**
> Instructions too brief (12 chars, minimum: 50)
> Instructions lack action verbs (run, click, verify, etc.)

**What to do:** 
Use specific, numbered steps: 
"1. Run npm run dev"
"2. Click the Save button"
"3. Verify the change persists"
```

---

## FAQ During Migration

### Q: Do I need to rewrite my entire config?

No. The old format still works. But migrate gradually:
1. Keep old format working first
2. Add new features one rule at a time
3. Eventually adopt full new format

### Q: Will old PRs break?

No. Existing PRs will simply start showing more detailed feedback.

### Q: What if a team member dislikes the stricter checks?

Use `guardian:override` label. The override is visible and auditable—it creates accountability without blocking work.

### Q: Can I run both versions?

Not recommended. Use one version consistently. v2.0 is drop-in compatible though.

### Q: How do I report issues in v2.0?

Same as v1 → GitHub issues in the repository.

---

## Performance

v2.0 has slightly more logic, but runs in similar time:
- v1.0: ~2-3 seconds
- v2.0: ~2-3 seconds (maybe +0.1s for additional checks)

No measurable difference.

---

## Rollback Plan

If v2.0 causes issues:

1. Switch back to v1 by reverting `scripts/check_pr.js` and `guardian.yml`
2. Your workflow file is compatible with both
3. v1.0 tag available: use `actions/checkout@v3` with specific commit

---

## What We Recommend

✅ **Immediate:**
- Update `scripts/check_pr.js` and `guardian.yml` to v2.0
- Test on a non-critical PR
- Update team about new feedback format

✅ **Within 1 week:**
- Migrate to new config format (if using old format)
- Enable new features like `must_have_action_verbs`
- Adjust severity levels if needed

✅ **Ongoing:**
- Monitor for false positives
- Adjust thresholds based on team feedback
- Use `guardian:override` for legitimate exceptions

---

## Support

For issues:
1. Check [EXAMPLES.md](EXAMPLES.md) for similar scenarios
2. Check [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for detailed explanations
3. Post an issue with your `guardian.yml` and PR details
