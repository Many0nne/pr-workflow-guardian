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

// Determine repository owner/repo and PR number from the event payload when possible.
// Prefer `GITHUB_EVENT_PATH` (reliable across event types, forks and runners).
let owner;
let repo;
let prNumber;
let eventPayload = null;
const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath) {
    try {
        eventPayload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
        if (eventPayload && eventPayload.repository) {
            owner = eventPayload.repository.owner && eventPayload.repository.owner.login;
            repo = eventPayload.repository.name;
        }
        if (eventPayload && eventPayload.pull_request && typeof eventPayload.pull_request.number === 'number') {
            prNumber = eventPayload.pull_request.number;
        } else if (eventPayload && eventPayload.issue && typeof eventPayload.issue.number === 'number') {
            prNumber = eventPayload.issue.number;
        } else if (typeof eventPayload.number === 'number') {
            prNumber = eventPayload.number;
        }
    } catch (err) {
        console.warn("[Guardian] Could not read/parse GITHUB_EVENT_PATH:", err.message);
    }
}

// If owner/repo not available from event, fallback to GITHUB_REPOSITORY
if (!owner || !repo) {
    if (process.env.GITHUB_REPOSITORY) {
        const parts = process.env.GITHUB_REPOSITORY.split('/');
        owner = parts[0];
        repo = parts[1];
    }
}

// Fallback: try to extract PR number from GITHUB_REF (less reliable)
if (!prNumber && process.env.GITHUB_REF) {
    const refParts = process.env.GITHUB_REF.split('/');
    if (refParts.length >= 3 && refParts[1] === 'pull') {
        prNumber = parseInt(refParts[2], 10);
    }
}

if (!prNumber || isNaN(prNumber) || !owner || !repo) {
    console.error("PR number or repository could not be determined from GITHUB_EVENT_PATH or environment variables");
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
        // Add timestamp to message
        const timestamp = new Date().toISOString();
        const messageWithTimestamp = `${message}\n\n_Dernière vérification: ${timestamp}_`;
        
        const existingComment = await findGuardianComment();
        if (existingComment) {
            console.log(`[Guardian] Mise à jour du commentaire ${existingComment.id}...`);
            await octokit.issues.updateComment({
                owner,
                repo,
                comment_id: existingComment.id,
                body: messageWithTimestamp,
            });
            console.log("[Guardian] ✓ Commentaire mis à jour");
        } else {
            console.log("[Guardian] Création d'un nouveau commentaire...");
            await octokit.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: messageWithTimestamp,
            });
            console.log("[Guardian] ✓ Commentaire créé");
        }
    } catch (err) {
        console.error("[Guardian] Error posting/updating comment:", err.message);
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

        // R2 — Description check (intention-based, configurable)
        // Configuration (defaults)
        const minSections = config.min_md_sections !== undefined ? config.min_md_sections : 3;
        const minSectionChars = config.min_section_chars !== undefined ? config.min_section_chars : 20;
        const headingLevel = config.md_heading_level !== undefined ? config.md_heading_level : 2;
        const headingPrefix = '#'.repeat(headingLevel);

        if (!pr.body || !pr.body.trim()) {
            violations.push("Description absente");
        } else {
            // accept headings with or without a space after the hashes ("##Title" or "## Title")
            const headingRegex = new RegExp(`^${headingPrefix}\\s*.*$`, 'gm');
            const headings = [];
            let match;
            while ((match = headingRegex.exec(pr.body)) !== null) {
                headings.push({ index: match.index, text: match[0] });
            }

            if (headings.length < minSections) {
                violations.push(`La description doit contenir au moins ${minSections} sections de niveau ${headingPrefix}`);
            } else {
                for (let i = 0; i < headings.length; i++) {
                    const start = headings[i].index + headings[i].text.length;
                    const end = i + 1 < headings.length ? headings[i + 1].index : pr.body.length;
                    const sectionContent = pr.body.slice(start, end).replace(/\r/g, '').trim();
                    if (sectionContent.length < minSectionChars) {
                        const title = headings[i].text.replace(/^#+\s*/, '').trim();
                        violations.push(`La section "${title || 'non titrée'}" contient moins de ${minSectionChars} caractères`);
                    }
                }
            }
        }

        // R4 — Approval check
        const { data: reviews } = await octokit.pulls.listReviews({
            owner,
            repo,
            pull_number: prNumber,
        });
            const approvalsRequired = config.approvals_required !== undefined ? config.approvals_required : 1;

            // Build a map of reviewer -> their latest review (by `submitted_at`).
            // This ensures we count only the last state from each reviewer and ignore earlier approvals
            // that were later superseded by a 'CHANGES_REQUESTED' or 'DISMISSED'.
            const latestByReviewer = new Map();
            for (const r of reviews) {
                const login = r.user && r.user.login ? r.user.login : null;
                if (!login) continue;
                const submitted = r.submitted_at ? new Date(r.submitted_at) : null;
                const existing = latestByReviewer.get(login);
                if (!existing) {
                    latestByReviewer.set(login, { review: r, submitted });
                } else {
                    const existingSubmitted = existing.submitted;
                    if (!existingSubmitted || (submitted && submitted > existingSubmitted)) {
                        latestByReviewer.set(login, { review: r, submitted });
                    }
                }
            }

            // Count reviewers whose latest review state is APPROVED
            let approvalCount = 0;
            for (const { review } of latestByReviewer.values()) {
                if (review.state === "APPROVED") approvalCount++;
            }
        if (approvalCount < approvalsRequired) {
            violations.push(`Au moins ${approvalsRequired} approbation(s) requise(s)`);
        }

        // R5 — Label type check
        const typeLabels = config.required_type_labels || ["type: enhancement", "type: fix", "type: refactor", "type: docs"];
        const acceptedTypes = typeLabels.map(t => t.replace(/^type: /, ''));
        if (!pr.labels.some(l => acceptedTypes.includes(l.name.replace(/^type: /, '')))) {
            violations.push(`Aucun label de type valide présent. Labels acceptés : ${acceptedTypes.join(", ")}`);
        }

        // R6 — Assignment check (PR must be assigned to at least N people, configurable)
        const minAssignees = config.min_assignees !== undefined ? config.min_assignees : 1;
        if (!pr.assignees || pr.assignees.length < minAssignees) {
            violations.push(`La PR doit être assignée à au moins ${minAssignees} personne(s)`);
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
