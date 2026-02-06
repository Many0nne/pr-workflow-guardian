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

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
// GITHUB_REF format for PR: refs/pull/NUMBER/merge
const prNumber = parseInt(process.env.GITHUB_REF.split('/')[2]);

if (isNaN(prNumber)) {
    console.error("Invalid GITHUB_REF format or PR number could not be parsed");
    process.exit(1);
}

async function findGuardianComment() {
    try {
        const { data: comments } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
        });
        return comments.find(c => c.body?.includes(COMMENT_MARKER));
    } catch (err) {
        console.error("[Guardian] Error fetching comments:", err.message);
        throw err;
    }
}

async function postComment(message) {
    try {
        const existingComment = await findGuardianComment();
        if (existingComment) {
        console.log(`[Guardian] Mise à jour du commentaire ${existingComment.id}...`);
        await octokit.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body: message,
        });
        // Supprimer et recréer pour faire remonter le commentaire au top
        console.log(`[Guardian] Suppression du commentaire pour le remonter...`);
        await octokit.issues.deleteComment({
            owner,
            repo,
            comment_id: existingComment.id,
        });
        }
        console.log("[Guardian] Création d'un nouveau commentaire...");
        await octokit.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body: message,
        });
        console.log("[Guardian] ✓ Commentaire créé");
    } catch (err) {
        console.error("[Guardian] Error posting/updating comment:", err.message);
        throw err;
    }
}

async function deleteGuardianComment() {
    try {
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
    } catch (err) {
        console.error("[Guardian] Error deleting comment:", err.message);
        throw err;
    }
}

async function main() {
    try {
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        const violations = [];

        // R2 — Description check
        if (!pr.body || !pr.body.includes("## What") || !pr.body.includes("## Why") || !pr.body.includes("## How to test")) {
            violations.push("Description absente ou template non respecté");
        }

        // R4 — Approval check
        const { data: reviews } = await octokit.pulls.listReviews({
            owner,
            repo,
            pull_number: prNumber,
        });

        const approvalsRequired = config.approvals_required !== undefined ? config.approvals_required : 1;
        const approvalCount = reviews.filter(r => r.state === "APPROVED").length;
        if (approvalCount < approvalsRequired) {
            violations.push(`Au moins ${approvalsRequired} approbation(s) requise(s)`);
        }

        // R5 — Label type check
        const typeLabels = config.required_type_labels || ["type: enhancement", "type: fix", "type: refactor", "type: docs", "type: chore"];
        const acceptedTypes = typeLabels.map(t => t.replace(/^type: /, ''));
        if (!pr.labels.some(l => acceptedTypes.includes(l.name.replace(/^type: /, '')))) {
            violations.push(`Aucun label de type valide présent. Labels acceptés : ${acceptedTypes.join(", ")}`);
        }

        // Publish result - post comment and fail CI if violations
        if (violations.length > 0) {
            const message = `${COMMENT_MARKER}
❌ Merge bloqué par guardian

Règles non respectées :
${violations.map(v => `- ${v}`).join("\n")}

Action requise : corriger les points ci-dessus avant de merger`;
        
            await postComment(message);
            console.error("Merge bloqué par guardian\nRègles non respectées :\n- " + violations.join("\n- ") + "\nAction requise : corriger les points ci-dessus avant de merger");
            process.exit(1);
        } else {
            await deleteGuardianComment();
            console.log("PR conforme au guardian ✅");
        }
    } catch (err) {
        console.error("[Guardian] Unexpected error:", err.message);
        if (err.status === 401) {
            console.error("[Guardian] Authentication failed. Check GITHUB_TOKEN.");
        } else if (err.status === 403) {
            console.error("[Guardian] Access denied. Check repository permissions and rate limits.");
        } else if (err.status === 404) {
            console.error("[Guardian] PR not found. Check GITHUB_REPOSITORY and PR number.");
        }
        process.exit(1);
    }
}

main();
