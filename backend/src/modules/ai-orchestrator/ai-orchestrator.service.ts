import { prisma } from "@/config/prisma";
import {
  detectInventoryAnomalies,
  forecastBedOccupancy,
  getRevenueAnalytics,
  suggestReorders,
} from "@/modules/ai-predictions/ai-predictions.service";

// Spec §34 — Multi-Agent AI Architecture. Deliberately thin: each "agent"
// is just a named group of the read-only functions ai-predictions.service.ts
// already exposes. Agents never touch the database directly — they only
// call functions that are already built, tested and RBAC-gated elsewhere.
// That's what "AI agents must never bypass backend authorization" means in
// practice: this router itself is the one and only permission checkpoint.
type AgentName = "operations" | "finance" | "inventory";

const AGENT_KEYWORDS: Record<AgentName, string[]> = {
  operations: ["bed", "occupancy", "ward", "capacity", "patient volume"],
  finance: ["revenue", "billing", "payment", "money", "income", "anomaly"],
  inventory: ["stock", "medicine", "reorder", "inventory", "supply", "expir"],
};

function routeToAgents(question: string): AgentName[] {
  const lowered = question.toLowerCase();
  const matched = (Object.keys(AGENT_KEYWORDS) as AgentName[]).filter((agent) =>
    AGENT_KEYWORDS[agent].some((kw) => lowered.includes(kw))
  );
  return matched.length > 0 ? matched : ["operations", "finance", "inventory"]; // unrouted → ask everyone
}

async function runAgent(agent: AgentName, hospitalId: string) {
  switch (agent) {
    case "operations":
      return { agent, data: await forecastBedOccupancy(hospitalId) };
    case "finance":
      return { agent, data: await getRevenueAnalytics(hospitalId) };
    case "inventory":
      return {
        agent,
        data: { reorders: await suggestReorders(hospitalId), anomalies: await detectInventoryAnomalies(hospitalId) },
      };
  }
}

export async function orchestrate(hospitalId: string, userId: string, question: string) {
  const agents = routeToAgents(question);

  const aiRequest = await prisma.aIRequest.create({
    data: { hospitalId, userId, feature: "orchestrator", inputSummary: question, dataScope: { agentsInvoked: agents } },
  });

  const results = await Promise.all(agents.map((a) => runAgent(a, hospitalId)));

  await prisma.aIOutput.create({
    data: { aiRequestId: aiRequest.id, output: { question, results } as never, requiresApproval: true },
  });

  return {
    question,
    agentsInvoked: agents,
    results,
    requiresApproval: true,
    disclaimer:
      "Multi-agent read-only report — each agent only reads existing, already permission-gated data. No agent can create, update, or delete anything; a human reviews before acting on this.",
  };
}