import { runPipeline } from "../pipeline/index.js";
import { writeFileSync } from "fs";

const TEST_PROMPTS = [
  // ── 10 Real product prompts ──────────────────────────────────
  {
    id: "P01",
    category: "real",
    label: "CRM with RBAC and payments",
    prompt: "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics."
  },
  {
    id: "P02",
    category: "real",
    label: "E-commerce platform",
    prompt: "Build an e-commerce platform with product listings, shopping cart, checkout with Stripe, order tracking, and admin dashboard for inventory management."
  },
  {
    id: "P03",
    category: "real",
    label: "Project management SaaS",
    prompt: "Build a project management tool like Jira. Users can create projects, tasks with assignees, sprints, and boards. Admins manage billing and team members."
  },
  {
    id: "P04",
    category: "real",
    label: "Healthcare patient portal",
    prompt: "Build a patient portal where patients can book appointments, view medical records, message doctors, and pay bills. Doctors can manage schedules and prescriptions."
  },
  {
    id: "P05",
    category: "real",
    label: "LMS platform",
    prompt: "Build a learning management system where instructors create courses with video lessons and quizzes. Students enroll, track progress, and get certificates. Support subscriptions."
  },
  {
    id: "P06",
    category: "real",
    label: "HR management system",
    prompt: "Build an HR system with employee directory, leave management, payroll overview, performance reviews, and recruitment pipeline. HR managers have full access, employees see their own data."
  },
  {
    id: "P07",
    category: "real",
    label: "Real estate listing platform",
    prompt: "Build a real estate platform where agents list properties with photos, buyers search and save favorites, and schedule viewings. Admins approve listings and manage agents."
  },
  {
    id: "P08",
    category: "real",
    label: "Restaurant ordering system",
    prompt: "Build a restaurant ordering system with menu management, table QR ordering, kitchen display, payment processing, and owner analytics dashboard."
  },
  {
    id: "P09",
    category: "real",
    label: "Freelance marketplace",
    prompt: "Build a freelance marketplace where clients post jobs, freelancers bid, and work is managed through milestones. Payments held in escrow released on milestone completion."
  },
  {
    id: "P10",
    category: "real",
    label: "Analytics SaaS",
    prompt: "Build an analytics SaaS where users integrate their apps via API key, view event dashboards, create funnels, set up alerts, and export reports. Tiered pricing plans."
  },

  // ── 10 Edge cases ───────────────────────────────────────────
  {
    id: "E01",
    category: "edge-vague",
    label: "Extremely vague",
    prompt: "Build me an app for my business."
  },
  {
    id: "E02",
    category: "edge-vague",
    label: "Partial idea",
    prompt: "I want users to be able to log in and see stuff."
  },
  {
    id: "E03",
    category: "edge-conflicting",
    label: "Conflicting roles",
    prompt: "Build an app where everyone is an admin and no one needs to log in, but all data should be private per user."
  },
  {
    id: "E04",
    category: "edge-conflicting",
    label: "Conflicting tech requirements",
    prompt: "Build a real-time chat app but everything must be synchronous and there should be no database."
  },
  {
    id: "E05",
    category: "edge-incomplete",
    label: "Missing key info",
    prompt: "Build a booking system with calendar integration."
  },
  {
    id: "E06",
    category: "edge-incomplete",
    label: "No entities mentioned",
    prompt: "Build something that helps teams collaborate better with good UI."
  },
  {
    id: "E07",
    category: "edge-vague",
    label: "Buzzword heavy",
    prompt: "Build a blockchain-powered AI-driven Web3 social platform with NFT avatars, DAOs, and DeFi payments."
  },
  {
    id: "E08",
    category: "edge-conflicting",
    label: "Impossible scale requirements",
    prompt: "Build a Twitter clone that must handle 1 billion users with zero latency, free hosting, and no backend."
  },
  {
    id: "E09",
    category: "edge-incomplete",
    label: "Single word",
    prompt: "CRM"
  },
  {
    id: "E10",
    category: "edge-conflicting",
    label: "Contradictory access control",
    prompt: "Build an app where free users have access to everything premium users do, but premium costs $99/month and has exclusive features that free users cannot see."
  }
];

interface EvalResult {
  id: string;
  category: string;
  label: string;
  prompt: string;
  success: boolean;
  durationMs: number;
  repairAttempts: number;
  validationErrorCount: number;
  validationWarningCount: number;
  assumptionCount: number;
  clarificationsNeeded: number;
  stagesCompleted: number;
  estimatedUSD: number;
  error?: string;
}

async function runEvaluation() {
  console.log("🧪 Starting evaluation framework...\n");
  const results: EvalResult[] = [];
  const startTime = Date.now();

  for (const test of TEST_PROMPTS) {
    console.log(`[${test.id}] ${test.label}...`);
    const t0 = Date.now();

    try {
      const result = await runPipeline(test.prompt);
      const issues = result.validationIssues as Array<{ severity: string }>;

      results.push({
        id: test.id,
        category: test.category,
        label: test.label,
        prompt: test.prompt,
        success: result.success,
        durationMs: result.totalDurationMs,
        repairAttempts: result.repairAttempts,
        validationErrorCount: issues.filter(i => i.severity === "error").length,
        validationWarningCount: issues.filter(i => i.severity === "warning").length,
        assumptionCount: result.intent?.assumptions?.length ?? 0,
        clarificationsNeeded: result.intent?.clarificationsNeeded?.length ?? 0,
        stagesCompleted: result.events.filter(e => e.status === "done").length,
        estimatedUSD: result.cost.estimatedUSD
      });

      const status = result.success ? "✅" : "❌";
      console.log(`  ${status} ${result.totalDurationMs}ms | repairs: ${result.repairAttempts} | $${result.cost.estimatedUSD}`);
    } catch (err) {
      results.push({
        id: test.id,
        category: test.category,
        label: test.label,
        prompt: test.prompt,
        success: false,
        durationMs: Date.now() - t0,
        repairAttempts: 0,
        validationErrorCount: 0,
        validationWarningCount: 0,
        assumptionCount: 0,
        clarificationsNeeded: 0,
        stagesCompleted: 0,
        estimatedUSD: 0,
        error: String(err)
      });
      console.log(`  ❌ THREW: ${err}`);
    }

    // Rate limit buffer
    await new Promise(r => setTimeout(r, 1000));
  }

  // ── Metrics Summary ─────────────────────────────────────
  const totalDuration = Date.now() - startTime;
  const realPrompts = results.filter(r => r.category === "real");
  const edgePrompts = results.filter(r => r.category !== "real");

  const metrics = {
    summary: {
      totalTests: results.length,
      totalSuccesses: results.filter(r => r.success).length,
      successRate: `${Math.round((results.filter(r => r.success).length / results.length) * 100)}%`,
      totalDurationMs: totalDuration,
      avgDurationMs: Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length),
      totalEstimatedUSD: Math.round(results.reduce((s, r) => s + r.estimatedUSD, 0) * 1000) / 1000,
      avgRepairAttempts: Math.round((results.reduce((s, r) => s + r.repairAttempts, 0) / results.length) * 100) / 100
    },
    realPrompts: {
      count: realPrompts.length,
      successRate: `${Math.round((realPrompts.filter(r => r.success).length / realPrompts.length) * 100)}%`,
      avgDurationMs: Math.round(realPrompts.reduce((s, r) => s + r.durationMs, 0) / realPrompts.length)
    },
    edgeCases: {
      count: edgePrompts.length,
      successRate: `${Math.round((edgePrompts.filter(r => r.success).length / edgePrompts.length) * 100)}%`,
      avgDurationMs: Math.round(edgePrompts.reduce((s, r) => s + r.durationMs, 0) / edgePrompts.length),
      avgAssumptionsMade: Math.round((edgePrompts.reduce((s, r) => s + r.assumptionCount, 0) / edgePrompts.length) * 10) / 10
    },
    failureBreakdown: results
      .filter(r => !r.success)
      .map(r => ({ id: r.id, label: r.label, error: r.error })),
    perResult: results
  };

  // Write results
  const outPath = "./eval-results.json";
  writeFileSync(outPath, JSON.stringify(metrics, null, 2));

  console.log("\n📊 Evaluation Complete:");
  console.log(`  Total: ${metrics.summary.totalTests} tests`);
  console.log(`  Success rate: ${metrics.summary.successRate}`);
  console.log(`  Real prompts: ${metrics.realPrompts.successRate}`);
  console.log(`  Edge cases: ${metrics.edgeCases.successRate}`);
  console.log(`  Avg duration: ${metrics.summary.avgDurationMs}ms`);
  console.log(`  Avg repairs: ${metrics.summary.avgRepairAttempts}`);
  console.log(`  Total cost: $${metrics.summary.totalEstimatedUSD}`);
  console.log(`\n  Results written to ${outPath}`);
}

runEvaluation().catch(console.error);
