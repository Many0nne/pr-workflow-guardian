import { Octokit } from "@octokit/rest";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN missing");
  process.exit(1);
}

// Load guardian.yml configuration
const guardianPath = path.join(process.cwd(), "guardian.yml");
let config = {};
try {
  const guardianContent = fs.readFileSync(guardianPath, "utf8");
  config = yaml.load(guardianContent);
} catch (err) {
  console.error("Failed to load guardian.yml:", err.message);
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

const [owner, repo] = process.env.GITHUB_REPOSITORY.split(':')[0].split('/');
const prNumber = process.env.GITHUB_REF.split('/').pop();

async function main() {
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const violations = [];

  // R1 — Draft check
  if (pr.draft) violations.push("PR en draft");

  // R2 — Description check
  if (!pr.body || !pr.body.includes("## What") || !pr.body.includes("## Why") || !pr.body.includes("## How to test")) {
    violations.push("Description absente ou template non respecté");
  }

  // R3 — Reviewer check
  const reviewersRequired = config.reviewers_required || 1;
  if (!pr.requested_reviewers || pr.requested_reviewers.length < reviewersRequired) {
    violations.push(`Au moins ${reviewersRequired} reviewer(s) requis`);
  }

  // R4 — Approval check
  const { data: reviews } = await octokit.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  });

  const approvalsRequired = config.approvals_required || 1;
  const approvalCount = reviews.filter(r => r.state === "APPROVED").length;
  if (approvalCount < approvalsRequired) {
    violations.push(`Au moins ${approvalsRequired} approbation(s) requise(s)`);
  }

  // R5 — Label type check
  const typeLabels = config.required_type_labels || ["type: feature", "type: fix", "type: refactor", "type: docs", "type: chore"];
  if (!pr.labels.some(l => typeLabels.includes(l.name))) {
    violations.push("Aucun label de type valide présent");
  }

  // Publish result
  if (violations.length > 0) {
    console.error("Merge bloqué par guardian\nRègles non respectées :\n- " + violations.join("\n- ") + "\nAction requise : corriger les points ci-dessus avant de merger");
    process.exit(1);
  } else {
    console.log("PR conforme au guardian ✅");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
