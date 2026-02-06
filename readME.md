# Guardian PR

Guardian PR is a GitHub Action tool designed to block merges of PRs that don't conform to the rules defined by the repository. It acts as a strict "guardian": no human judgment, just factual checks.

## What Guardian Checks

- **Description Structure** – PR must include markdown sections with minimum content per section
- **Approvals** – At least X approvals (configurable, defaults to 1)
- **Type Labels** – At least one valid type label must be present
- **Assignees** – Minimum number of assignees required (configurable)
- **CI Checks** – All CI checks must pass (optional, configurable)
- **Ticket References** – PR must reference a ticket/issue (optional, supports multiple patterns)
- **No Active Changes Requested** – All review feedback must be resolved

## Consequences of Non-Compliance

If a PR doesn't respect these rules:

- The merge is blocked
- A comment is automatically posted or updated in the PR

## Installation

### Copy the workflow into your repo:

`.github/workflows/guardian.yml`

**Minimal example:**

```yaml
name: Guardian PR check

on:
  pull_request:
    types: [opened, ready_for_review, edited, reopened, synchronize]

jobs:
  guardian:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Run Guardian
        run: node scripts/check_pr.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Copy the script into:

`scripts/check_pr.js`

### Create a guardian.yml configuration file at the root:

```yaml
# Approval requirements
approvals_required: 1

# Type labels
required_type_labels:
  - "type: enhancement"
  - "type: fix"
  - "type: refactor"
  - "type: docs"
  - "type: chore"

# PR template path
description_template: ".github/PULL_REQUEST_TEMPLATE.md"

# Markdown section checks
min_md_sections: 3                # Minimum number of ## headings required
min_section_chars: 20             # Minimum characters per section content
md_heading_level: 2               # Heading level to check (2 = ##, 3 = ###, etc.)

# Assignee requirements
min_assignees: 1                  # Minimum number of assignees required

# CI checks validation
require_ci_pass: true             # Block merge if CI fails (optional)

# Ticket/Issue reference validation
require_ticket_reference: true    # Require ticket reference in PR body (optional)
ticket_patterns:                  # Patterns to match for ticket references
  - "PROJ-\\d+"
  - "LINEAR-\\w+"
  - "JIRA-\\d+"
  - "CU-\\d+"
```

### Create the mandatory PR template:

`.github/PULL_REQUEST_TEMPLATE.md`

**Minimal example:**

```markdown
## What
Describe what is being modified or added.

## Why
Explain the reason for the change.

## How to test
Instructions for testing the PR.
```

## How It Works

When a PR is created or updated, the guardian checks the configured rules.

If violations are detected, it:

- Posts or updates a visible comment in the PR
- Blocks the merge by failing the workflow

If all rules are respected:

- Removes the existing guardian comment
- Displays "PR conform to guardian ✅" in the logs

## Rules Controlled by Guardian

- **Description Check** – The PR must include markdown sections (headings) with minimum content length per section
- **Approval Check** – At least `approvals_required` approvals must exist
- **Type Label Check** – At least one valid type label must be present
- **Assignee Check** – At least `min_assignees` assignees must be assigned
- **Review Status Check** – No active "Changes Requested" reviews allowed
- **CI Checks** (optional) – All CI/CD checks must pass (if `require_ci_pass: true`)
- **Ticket Reference Check** (optional) – PR description must contain a ticket reference matching configured patterns, or be linked to a GitHub issue (if `require_ticket_reference: true`)

⚠️ Soft warnings (non-blocking):
- CI checks pending/in-progress (warning only, doesn't block)

⚠️ The rules are factual, no quality checks or content verification is performed.

## Markdown Section Validation

Guardian validates the structure and content of PR descriptions:

- **Checks for markdown headings** – Ensures minimum number of sections (e.g., `##` headings)
- **Minimum content per section** – Each section must have a minimum number of characters
- **Customizable heading level** – You can require `#`, `##`, `###`, etc.

Example: With `min_md_sections: 3`, `min_section_chars: 20`, and `md_heading_level: 2`, a PR description must have at least 3 `##` sections, each with at least 20 non-whitespace characters.

## Notes for Solo Repositories

If you're working alone on the repo, you can set:

```yaml
approvals_required: 0
```

This allows you to merge your PRs without external approval, while maintaining the other rules.

## Customization

All rules can be customized in `guardian.yml`:

- **approvals_required** – Minimum number of approvals (default: 1)
- **required_type_labels** – List of allowed type labels
- **description_template** – Path to the template to validate against
- **min_md_sections** – Minimum number of markdown sections required (default: 3)
- **min_section_chars** – Minimum characters per section (default: 20)
- **md_heading_level** – Markdown heading level to validate (default: 2 for `##`)
- **min_assignees** – Minimum number of assignees (default: 1)
- **require_ci_pass** – Whether to require all CI checks to pass (default: false, optional)
- **require_ticket_reference** – Whether to require ticket/issue reference (default: true, optional)
- **ticket_patterns** – Regex patterns for valid ticket references

## Limitations

- **Self-approved PRs are not supported** – GitHub prohibits self-approval
- **Binary enforcement** – All rules are strict: either all respected or the merge is blocked
- **No quality judgment** – Only factual checks, no recommendations are made
- **Pending CI checks** – Soft warning only; doesn't block if in progress
- **PR draft status** – Checks still run on draft PRs (set workflow trigger types to filter if needed)