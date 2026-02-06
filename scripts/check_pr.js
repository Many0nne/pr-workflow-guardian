import { Octokit } from "@octokit/rest";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import crypto from "crypto";

const COMMENT_MARKER = "guardian-comment";

const token = process.env.GITHUB_TOKEN;
if (!token) {
    console.error("GITHUB_TOKEN missing");
    process.exit(1);
}

// Load guardian.yml configuration
const guardianPath = path.join(process.cwd(), "guardian.yml");
let config = {};
try {
    const content = fs.readFileSync(guardianPath, "utf8");
    config = yaml.load(content);
} catch (err) {
    console.error("Failed to load guardian.yml:", err.message);
    process.exit(1);
}

const octokit = new Octokit({ auth: token });

// --- Determine PR info ---
let owner, repo, prNumber;
const eventPath = process.env.GITHUB_EVENT_PATH;
let eventPayload = null;
if (eventPath) {
    try {
        eventPayload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
        owner = eventPayload.repository?.owner?.login;
        repo = eventPayload.repository?.name;
        prNumber = eventPayload.pull_request?.number || eventPayload.issue?.number || eventPayload.number;
    } catch {}
}
if (!owner || !repo) {
    [owner, repo] = process.env.GITHUB_REPOSITORY?.split('/') || [];
}
if (!prNumber && process.env.GITHUB_REF) {
    const refParts = process.env.GITHUB_REF.split('/');
    if (refParts[1] === 'pull') prNumber = parseInt(refParts[2], 10);
}
if (!owner || !repo || !prNumber) {
    console.error("Cannot determine PR or repo");
    process.exit(1);
}

// --- Helper functions ---
function generateChecksum(data) {
    const sorted = [...data].sort();
    return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 8);
}

function extractChecksum(commentBody) {
    const match = commentBody.match(/<!-- guardian-comment:([a-f0-9]{8}) -->/);
    return match ? match[1] : null;
}

async function findGuardianComment() {
    const { data: comments } = await octokit.issues.listComments({ owner, repo, issue_number: prNumber });
    return comments.find(c => c.body?.includes(COMMENT_MARKER));
}

async function postComment(message, checksum) {
    const existing = await findGuardianComment();
    if (existing && extractChecksum(existing.body) === checksum) return;
    const body = `<!-- ${COMMENT_MARKER}:${checksum} -->\n${message}`;
    if (existing) {
        await octokit.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    } else {
        await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
    }
}

async function deleteComment() {
    const existing = await findGuardianComment();
    if (existing) await octokit.issues.deleteComment({ owner, repo, comment_id: existing.id });
}

async function getLinkedGitHubIssues() {
    // PR timeline events to detect linked issues
    try {
        const { data: events } = await octokit.issues.listEventsForTimeline({ owner, repo, issue_number: prNumber });
        return events.filter(e => e.event === 'connected');
    } catch {
        return [];
    }
}

async function main() {
    try {
        const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
        const violations = [];
        const softViolations = [];

        // --- PR Description / Sections ---
        const minSections = config.min_md_sections ?? 3;
        const minChars = config.min_section_chars ?? 20;
        const headingLevel = config.md_heading_level ?? 2;
        const prefix = '#'.repeat(headingLevel);

        if (!pr.body?.trim()) {
            violations.push("Description absente");
        } else {
            const regex = new RegExp(`^${prefix}\s*.*$`, 'gm');
            const headings = [...pr.body.matchAll(regex)];
            if (headings.length < minSections) {
                violations.push(`Au moins ${minSections} sections de niveau ${prefix} attendues`);
            } else {
                for (let i = 0; i < headings.length; i++) {
                    const start = headings[i].index + headings[i][0].length;
                    const end = i + 1 < headings.length ? headings[i + 1].index : pr.body.length;
                    const content = pr.body.slice(start, end).trim();
                    if (content.length < minChars) {
                        violations.push(`Section "${headings[i][0].replace(/^#+\s*/, '')}" trop courte (<${minChars})`);
                    }
                }
            }
        }

        // --- Reviews / Approvals ---
        const { data: reviews } = await octokit.pulls.listReviews({ owner, repo, pull_number: prNumber });
        const approvalsRequired = config.approvals_required ?? 1;
        const latestByReviewer = new Map();
        for (const r of reviews) {
            if (!r.user?.login) continue;
            const sub = new Date(r.submitted_at);
            const existing = latestByReviewer.get(r.user.login);
            if (!existing || sub > existing.submitted) latestByReviewer.set(r.user.login, { review: r, submitted: sub });
        }
        let approvalCount = 0, changesRequested = false;
        for (const { review } of latestByReviewer.values()) {
            if (review.state === 'APPROVED') approvalCount++;
            else if (review.state === 'CHANGES_REQUESTED') changesRequested = true;
        }
        if (changesRequested) violations.push("Des demandes de changements sont actives");
        if (approvalCount < approvalsRequired) violations.push(`Au moins ${approvalsRequired} approbation(s) requise(s)`);

        // --- Labels ---
        const typeLabels = config.required_type_labels ?? ["type: enhancement","type: fix","type: refactor","type: docs"];
        const acceptedTypes = typeLabels.map(l => l.replace(/^type: /, ''));
        if (!pr.labels.some(l => acceptedTypes.includes(l.name.replace(/^type: /,'')))) violations.push(`Aucun label de type valide. Acceptés: ${acceptedTypes.join(", ")}`);

        // --- Assignees ---
        const minAssignees = config.min_assignees ?? 1;
        if (!pr.assignees || pr.assignees.length < minAssignees) violations.push(`Au moins ${minAssignees} assignee(s) requis`);

        // --- CI Checks ---
        if (config.require_ci_pass) {
            try {
                const { data: checkRuns } = await octokit.checks.listForRef({ owner, repo, ref: pr.head.sha });
                const currentJob = process.env.GITHUB_JOB || 'check-pr';
                const filtered = checkRuns.check_runs.filter(c => c.name !== currentJob);
                const failed = filtered.filter(c => c.status === 'completed' && c.conclusion !== 'success');
                const pending = filtered.filter(c => c.status !== 'completed');
                if (pending.length) softViolations.push(`Checks en attente: ${pending.map(c => c.name).join(", ")}`);
                if (failed.length) violations.push(`Checks échoués: ${failed.map(c => `${c.name} (${c.conclusion})`).join(", ")}`);
            } catch {}
        }

        // --- Ticket / Issue validation ---
        if (config.require_ticket_reference ?? true) {
            const patterns = config.ticket_patterns ?? ["PROJ-\\d+","LINEAR-\\w+","JIRA-\\d+","CU-\\d+"];
            let hasTicket = patterns.some(p => new RegExp(p).test(pr.body ?? ''));
            if (!hasTicket) {
                const linkedIssues = await getLinkedGitHubIssues();
                if (!linkedIssues.length) violations.push(`Aucun ticket externe ni GitHub issue lié détecté (ex: ${patterns.slice(0,2).join(', ')})`);
            }
        }

        // --- Publish ---
        const allViolations = [...violations, ...softViolations];
        const checksum = generateChecksum(allViolations);
        if (allViolations.length) {
            const message = `❌ Merge bloqué par guardian\n\nRègles non respectées:\n${allViolations.map(v => `- ${v}`).join("\n")}`;
            await postComment(message, checksum);
            if (violations.length) {
                console.error("Merge bloqué :", violations.join(' | '));
                process.exit(1);
            }
        } else {
            await deleteComment();
            console.log("PR conforme au guardian ✅");
        }

    } catch (err) {
        console.error("Guardian error:", err.message);
        process.exit(1);
    }
}

main();
