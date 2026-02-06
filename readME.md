# Guardian PR

Guardian PR is a GitHub Action tool designed to block merges of PRs that don't conform to the rules defined by the repository. It acts as a strict "guardian": no human judgment, just factual checks.

## What Guardian Checks

- PR is not in draft status
- Description is present and conforms to the template
- At least X approvals (configurable)
- At least one valid type label present

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
approvals_required: 1
required_type_labels:
  - "type: enhancement"
  - "type: fix"
  - "type: refactor"
  - "type: docs"
  - "type: chore"
description_template: ".github/PULL_REQUEST_TEMPLATE.md"
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

- **Draft Check** – The PR must not be in draft
- **Description Check** – The PR must include the defined template
- **Approval Check** – At least `approvals_required` approvals must exist
- **Type Label Check** – At least one valid type label must be present

⚠️ The rules are factual, no quality checks or content verification is performed.

## Notes for Solo Repositories

If you're working alone on the repo, you can set:

```yaml
approvals_required: 0
```

This allows you to merge your PRs without external approval, while maintaining the other rules.

## Customization

- **approvals_required** – minimum number of approvals
- **required_type_labels** – list of allowed type labels
- **description_template** – path to the template to respect

## Limitations

- Self-approved PRs are not supported (GitHub prohibits self-approval)
- The rules are strict and binary: either all respected or the merge is blocked
- No quality judgment or recommendations are made by the bot