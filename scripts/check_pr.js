import { Octokit } from "@octokit/rest";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";

const COMMENT_MARKER = "<!-- guardian-comment -->";

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
// GITHUB_REF format for PR: refs/pull/NUMBER/merge
const prNumber = parseInt(process.env.GITHUB_REF.split('/')[2]);

async function findGuardianComment() {
  const { data: comments } = await octokit.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });
  return comments.find(c => c.body.includes(COMMENT_MARKER));
}

async function postOrUpdateComment(message) {
  // Supprimer l'ancien commentaire s'il existe
  await deleteGuardianComment();
  
  // Créer un nouveau commentaire pour qu'il apparaisse en bas du feed
  console.log("[Guardian] Création d'un nouveau commentaire...");
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: message,
  });
  console.log("[Guardian] ✓ Commentaire créé");
}

async function deleteGuardianComment() {
  const existingComment = await findGuardianComment();
  if (existingComment) {
    console.log(`[Guardian] Suppression du commentaire ${existingComment.id}...`);
    await octokit.issues.deleteComment({
      owner,
      repo,
      comment_id: existingComment.id,
    });
    console.log("[Guardian] ✓ Commentaire supprimé");
  }
}

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

  // Publish result - post comment and fail CI if violations
  if (violations.length > 0) {
    const message = `${COMMENT_MARKER}
❌ **Merge bloqué par guardian**

Règles non respectées :
${violations.map(v => `- ${v}`).join("\n")}

Action requise : corriger les points ci-dessus avant de merger`;
    
    await postOrUpdateComment(message);
    console.error("Merge bloqué par guardian\nRègles non respectées :\n- " + violations.join("\n- ") + "\nAction requise : corriger les points ci-dessus avant de merger");
    process.exit(1);
  } else {
    await deleteGuardianComment();
    console.log("PR conforme au guardian ✅");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
