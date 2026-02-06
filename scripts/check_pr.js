import { Octokit } from "@octokit/rest";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import crypto from "crypto";

const COMMENT_MARKER = "guardian-check";
const OVERRIDE_LABEL = "guardian:override";

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
    const match = commentBody.match(/<!-- guardian-check:([a-f0-9]{8}) -->/);
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

function extractLinkedIssuesFromBody(body) {
    const regex = /#(\d+)/g;
    const matches = [...(body?.matchAll(regex) || [])];
    return matches.map(m => parseInt(m[1], 10));
}

// --- Violation structure ---
class Violation {
    constructor(rule, message, severity, fix) {
        this.rule = rule;
        this.message = message;
        this.severity = severity; // 'block' or 'warn'
        this.fix = fix;
    }
}

// --- Content validation helpers ---
function containsPlaceholders(text) {
    const placeholders = ['TODO', 'N/A', 'todo', 'n/a', 'TBD', 'tbd', 'same as before', '...', '(empty)', 'FIXME'];
    return placeholders.some(ph => text?.includes(ph));
}

function hasActionVerbs(text) {
    const verbs = ['run', 'start', 'click', 'open', 'navigate', 'visit', 'execute', 'install', 'build', 'test', 'verify', 'check', 'confirm', 'select', 'enter', 'submit'];
    const lowerText = text?.toLowerCase() || '';
    return verbs.some(v => lowerText.includes(v));
}

function isGenericTitle(title) {
    const generic = ['fix', 'update', 'stuff', 'thing', 'bug', 'issue', 'change', 'fix bug', 'update code', 'refactor code', 'add feature'];
    const lower = title?.toLowerCase() || '';
    return generic.includes(lower);
}

function extractSectionContent(body, heading) {
    // Extract content after a heading until the next heading or end
    const regex = new RegExp(`^##\\s+(${heading})\\s*$([\\s\\S]*?)(?=^##|\\Z)`, 'im');
    const match = body?.match(regex);
    return match?.[2]?.trim() || '';
}

function formatViolationMessage(violations, softViolations) {
    let message = '❌ **Guardian: Merge Blocked**\n\n';
    
    if (violations.length > 0) {
        message += '### 🚫 Blocking Issues\n\n';
        violations.forEach(v => {
            message += `**${v.rule}**\n`;
            message += `> ${v.message}\n\n`;
            message += `**What to do:** ${v.fix}\n\n`;
        });
    }
    
    if (softViolations.length > 0) {
        message += '\n### ⚠️ Warnings (Non-blocking)\n\n';
        softViolations.forEach(v => {
            message += `**${v.rule}**\n`;
            message += `> ${v.message}\n\n`;
        });
    }
    
    message += '\n---\n';
    message += '_Guardian enforces team standards to ensure clarity and traceability. ';
    message += 'If this check is blocking your merge incorrectly, add the `guardian:override` label with a justification comment._\n';
    
    return message;
}

async function main() {
    try {
        const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
        const violations = [];
        const softViolations = [];

        // Check for override label
        const hasOverride = pr.labels?.some(l => l.name === OVERRIDE_LABEL);
        if (hasOverride) {
            const { data: comments } = await octokit.issues.listComments({ owner, repo, issue_number: prNumber });
            const overrideComment = comments.find(c => 
                c.user?.type !== 'Bot' && 
                c.body?.toLowerCase().includes('reason')
            );
            if (overrideComment) {
                console.log("Guardian override applied. Justification found. Allowing merge.");
                await deleteComment();
                process.exit(0);
            }
        }

        // --- 1. Title Quality Check ---
        const titleConfig = config.rules?.title_quality;
        if (titleConfig?.enabled) {
            if (!pr.title || pr.title.length < (titleConfig.config?.min_length || 10)) {
                violations.push(new Violation(
                    'Title Quality',
                    `Title is too short (${pr.title?.length || 0} chars, minimum: ${titleConfig.config?.min_length || 10})`,
                    titleConfig.severity,
                    `Use a descriptive title: "fix: race condition in cache" or "feat: add OAuth2 support"`
                ));
            } else if (titleConfig.config?.reject_generic && isGenericTitle(pr.title)) {
                violations.push(new Violation(
                    'Title Quality',
                    `Title is too generic: "${pr.title}". Use specific language.`,
                    titleConfig.severity,
                    `Describe the actual change: "fix: prevent division by zero" instead of just "fix"`
                ));
            }
        }

        // --- 2. Description Structure Check ---
        const descConfig = config.rules?.description_structure;
        if (descConfig?.enabled) {
            if (!pr.body?.trim()) {
                violations.push(new Violation(
                    'Description Structure',
                    'PR description is empty',
                    descConfig.severity,
                    'Add a detailed description with sections: What, Why, How to test'
                ));
            } else {
                const minSections = descConfig.config?.min_sections ?? 3;
                const minChars = descConfig.config?.min_chars_per_section ?? 30;
                const headingLevel = descConfig.config?.heading_level ?? 2;
                const prefix = '#'.repeat(headingLevel);

                const regex = new RegExp(`^${prefix}\\s+.*$`, 'gm');
                const headings = [...pr.body.matchAll(regex)];

                if (headings.length < minSections) {
                    violations.push(new Violation(
                        'Description Structure',
                        `Only ${headings.length} section(s) found, ${minSections} required at level ${prefix}`,
                        descConfig.severity,
                        `Add sections like "## What", "## Why", "## How to test"`
                    ));
                } else {
                    for (let i = 0; i < headings.length; i++) {
                        const start = headings[i].index + headings[i][0].length;
                        const end = i + 1 < headings.length ? headings[i + 1].index : pr.body.length;
                        const content = pr.body.slice(start, end).trim();
                        const headingName = headings[i][0].replace(/^#+\s*/, '');

                        if (content.length < minChars) {
                            violations.push(new Violation(
                                'Description Structure',
                                `Section "${headingName}" has only ${content.length} chars (minimum: ${minChars})`,
                                descConfig.severity,
                                `Expand the "${headingName}" section with more details`
                            ));
                        }

                        if (descConfig.config?.validation?.reject_placeholders && containsPlaceholders(content)) {
                            violations.push(new Violation(
                                'Description Structure',
                                `Section "${headingName}" contains placeholders (TODO, N/A, etc.)`,
                                descConfig.severity,
                                `Replace placeholders with actual content`
                            ));
                        }
                    }
                }
            }
        }

        // --- 3. How to Test Section Specific Checks ---
        const testConfig = config.rules?.test_instructions;
        if (testConfig?.enabled) {
            const testContent = extractSectionContent(pr.body, 'How to test|How to Test|Testing|Test');
            
            if (!testContent || testContent.length === 0) {
                violations.push(new Violation(
                    'Test Instructions',
                    'No "How to Test" section found',
                    testConfig.severity,
                    'Add a "## How to Test" section with step-by-step instructions'
                ));
            } else {
                if (testContent.length < (testConfig.config?.min_length || 50)) {
                    violations.push(new Violation(
                        'Test Instructions',
                        `Instructions too brief (${testContent.length} chars, minimum: ${testConfig.config?.min_length || 50})`,
                        testConfig.severity,
                        'Provide detailed, numbered steps for testing'
                    ));
                }

                if (testConfig.config?.must_have_action_verbs && !hasActionVerbs(testContent)) {
                    violations.push(new Violation(
                        'Test Instructions',
                        'Instructions lack action verbs (run, click, verify, etc.)',
                        testConfig.severity,
                        'Use imperative verbs: "Run the tests", "Click the button", "Verify the output"'
                    ));
                }

                if (testConfig.config?.reject_placeholders && containsPlaceholders(testContent)) {
                    violations.push(new Violation(
                        'Test Instructions',
                        'Instructions contain placeholders (TODO, N/A, same as before)',
                        testConfig.severity,
                        'Provide concrete steps instead of placeholders'
                    ));
                }

                if (testConfig.config?.reject_generic && ['test it', 'just test', 'test the changes'].includes(testContent.toLowerCase())) {
                    violations.push(new Violation(
                        'Test Instructions',
                        'Instructions are too vague',
                        testConfig.severity,
                        'Provide specific, numbered steps'
                    ));
                }
            }
        }

        // --- 4. Type Labels Check ---
        const labelsConfig = config.rules?.type_labels;
        if (labelsConfig?.enabled) {
            const requiredLabels = labelsConfig.required_labels || [];
            const prLabels = pr.labels?.map(l => l.name) || [];
            const requiredLabelValues = requiredLabels.map(l => l.replace('type: ', '').trim());
            const hasTypeLabel = requiredLabelValues.some(req => prLabels.includes(req));

            if (!hasTypeLabel) {
                violations.push(new Violation(
                    'Type Labels',
                    `No valid type label found. PR has: ${prLabels.length === 0 ? 'none' : prLabels.join(', ')}`,
                    labelsConfig.severity,
                    `Add one of: ${requiredLabelValues.join(', ')}`
                ));
            }
        }

        // --- 5. Coherence Check (Title-Label-Content) ---
        const coherenceConfig = config.rules?.coherence_check;
        if (coherenceConfig?.enabled) {
            const prLabels = pr.labels?.map(l => l.name) || [];
            const typeLabel = prLabels.find(l => l.startsWith('type:'));

            if (typeLabel && coherenceConfig.config?.title_must_reflect_type) {
                const typeValue = typeLabel.replace('type:', '').trim().toLowerCase();
                const titleLower = pr.title?.toLowerCase() || '';

                // Check if title contains type indicator
                if (typeValue === 'fix' && !titleLower.startsWith('fix:')) {
                    softViolations.push(new Violation(
                        'Coherence',
                        `Title doesn't reflect "type: fix" label`,
                        'warn',
                        `Consider starting with "fix: " in the title`
                    ));
                } else if (typeValue === 'feat' && !titleLower.startsWith('feat:')) {
                    softViolations.push(new Violation(
                        'Coherence',
                        `Title doesn't reflect "type: enhancement" label`,
                        'warn',
                        `Consider starting with "feat: " in the title`
                    ));
                } else if (typeValue === 'refactor' && !titleLower.startsWith('refactor:')) {
                    softViolations.push(new Violation(
                        'Coherence',
                        `Title doesn't reflect "type: refactor" label`,
                        'warn',
                        `Consider starting with "refactor: " in the title`
                    ));
                }
            }
        }

        // --- 6. Assignees Check ---
        const assigneeConfig = config.rules?.assignees;
        if (assigneeConfig?.enabled) {
            const minAssignees = assigneeConfig.minimum ?? 1;
            const actualAssignees = pr.assignees?.length || 0;

            if (actualAssignees < minAssignees) {
                const violation = new Violation(
                    'Assignees',
                    `${actualAssignees} assignee(s), ${minAssignees} required`,
                    assigneeConfig.severity,
                    `Assign this PR to at least one person`
                );
                if (assigneeConfig.severity === 'block') {
                    violations.push(violation);
                } else {
                    softViolations.push(violation);
                }
            }
        }

        // --- 7. Reviews & Approvals Check ---
        const approvalsConfig = config.rules?.approvals;
        if (approvalsConfig?.enabled) {
            const { data: reviews } = await octokit.pulls.listReviews({ owner, repo, pull_number: prNumber });
            const requiredApprovals = approvalsConfig.required ?? 1;
            const latestByReviewer = new Map();

            for (const r of reviews) {
                if (!r.user?.login) continue;
                const sub = new Date(r.submitted_at);
                const existing = latestByReviewer.get(r.user.login);
                if (!existing || sub > existing.submitted) {
                    latestByReviewer.set(r.user.login, { review: r, submitted: sub });
                }
            }

            let approvalCount = 0, changesRequested = false;
            for (const { review } of latestByReviewer.values()) {
                if (review.state === 'APPROVED') approvalCount++;
                else if (review.state === 'CHANGES_REQUESTED') changesRequested = true;
            }

            if (changesRequested) {
                violations.push(new Violation(
                    'Review Status',
                    'Active "Changes Requested" reviews found',
                    approvalsConfig.severity,
                    'Resolve all feedback and re-request reviews'
                ));
            }

            if (approvalCount < requiredApprovals) {
                violations.push(new Violation(
                    'Approvals',
                    `${approvalCount} approval(s), ${requiredApprovals} required`,
                    approvalsConfig.severity,
                    `Request approval from at least one reviewer`
                ));
            }
        }

        // --- 8. Ticket Reference Check ---
        const ticketConfig = config.rules?.ticket_reference;
        if (ticketConfig?.enabled) {
            const patterns = ticketConfig.patterns || [];
            let hasTicket = patterns.some(p => new RegExp(p).test(pr.body ?? ''));
            const linkedIssues = extractLinkedIssuesFromBody(pr.body);

            if (!hasTicket && linkedIssues.length === 0) {
                violations.push(new Violation(
                    'Ticket Reference',
                    'No ticket or GitHub issue reference found',
                    ticketConfig.severity,
                    `Reference a ticket in the PR body: "Closes #123" or "PROJ-456" or "LINEAR-xyz"`
                ));
            }
        }

        // --- 9. CI Checks ---
        const ciConfig = config.rules?.ci_checks;
        if (ciConfig?.enabled) {
            try {
                const { data: checkRuns } = await octokit.checks.listForRef({ owner, repo, ref: pr.head.sha });
                const currentJob = process.env.GITHUB_JOB || 'check-pr';
                const filtered = checkRuns.check_runs.filter(c => c.name !== currentJob);
                const failed = filtered.filter(c => c.status === 'completed' && c.conclusion !== 'success');
                const pending = filtered.filter(c => c.status !== 'completed');

                if (pending.length && ciConfig.config?.soft_warnings) {
                    softViolations.push(new Violation(
                        'CI Checks',
                        `${pending.length} check(s) still running: ${pending.map(c => c.name).join(', ')}`,
                        'warn',
                        'Wait for all checks to complete'
                    ));
                }

                if (failed.length) {
                    violations.push(new Violation(
                        'CI Checks',
                        `${failed.length} check(s) failed: ${failed.map(c => `${c.name} (${c.conclusion})`).join(', ')}`,
                        ciConfig.severity,
                        'Fix the failing checks before merging'
                    ));
                }
            } catch (err) {
                console.warn("Could not fetch CI checks:", err.message);
            }
        }

        // --- Publish results ---
        const checksum = generateChecksum(violations.map(v => v.message));

        if (violations.length) {
            const message = formatViolationMessage(violations, softViolations);
            await postComment(message, checksum);
            console.error("Guardian blocked merge:");
            violations.forEach(v => console.error(`  - ${v.rule}: ${v.message}`));
            process.exit(1);
        } else if (softViolations.length) {
            console.warn("Guardian warnings (non-blocking):");
            softViolations.forEach(v => console.warn(`  - ${v.rule}: ${v.message}`));
            await deleteComment();
            console.log("PR ready to merge ✅");
        } else {
            await deleteComment();
            console.log("PR passes all guardian checks ✅");
        }

    } catch (err) {
        console.error("Guardian error:", err.message);
        process.exit(1);
    }
}

main();
