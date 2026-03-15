"use client";
import { useRef, useEffect } from "react";
import { sankey, sankeyLinkHorizontal, sankeyCenter } from "d3-sankey";

const STATUS_COLORS = {
  "Applied": "#B5DCF2",
  "Interviewed": "#93C5FD",
  "Pending": "#FDE68A",
  "Offered": "#86EFAC",
  "Rejected": "#FCA5A5",
  "Withdrew": "#D8B4FE",
};

export default function SankeyDiagram({ applications, statusHistory }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || applications.length === 0) return;

    // Build flow data from status history
    // Track transitions: status A → status B
    const transitionCounts = {};
    const appHistoryMap = {};

    statusHistory.forEach((h) => {
      if (!appHistoryMap[h.application_id]) appHistoryMap[h.application_id] = [];
      appHistoryMap[h.application_id].push(h);
    });

    Object.values(appHistoryMap).forEach((history) => {
      const sorted = history.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i].status;
        const to = sorted[i + 1].status;
        if (from === to) continue;
        const key = `${from}→${to}`;
        transitionCounts[key] = (transitionCounts[key] || 0) + 1;
      }
    });

    // Also count current status for apps with no transitions (single status)
    const currentStatusCounts = {};
    applications.forEach((app) => {
      currentStatusCounts[app.status] = (currentStatusCounts[app.status] || 0) + 1;
    });

    // Build nodes and links
    const nodeNames = ["Applied", "Interviewed", "Pending", "Offered", "Rejected", "Withdrew"];
    const activeNodes = new Set();

    // Add nodes that have applications
    Object.keys(currentStatusCounts).forEach((s) => activeNodes.add(s));
    Object.keys(transitionCounts).forEach((key) => {
      const [from, to] = key.split("→");
      activeNodes.add(from);
      activeNodes.add(to);
    });

    const nodes = nodeNames
      .filter((n) => activeNodes.has(n))
      .map((name) => ({ name }));

    const nodeIndex = {};
    nodes.forEach((n, i) => { nodeIndex[n.name] = i; });

    const links = [];

    if (Object.keys(transitionCounts).length > 0) {
      // Use actual transition data
      Object.entries(transitionCounts).forEach(([key, value]) => {
        const [from, to] = key.split("→");
        if (nodeIndex[from] !== undefined && nodeIndex[to] !== undefined && nodeIndex[from] !== nodeIndex[to]) {
          links.push({ source: nodeIndex[from], target: nodeIndex[to], value });
        }
      });
    } else {
      // No transitions yet — show applied → current status
      Object.entries(currentStatusCounts).forEach(([status, count]) => {
        if (status !== "Applied" && nodeIndex["Applied"] !== undefined && nodeIndex[status] !== undefined) {
          links.push({ source: nodeIndex["Applied"], target: nodeIndex[status], value: count });
        }
      });
    }

    // If no links at all, nothing to render
    if (links.length === 0) return;

    const width = 500;
    const height = 250;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    const sankeyGen = sankey()
      .nodeWidth(20)
      .nodePadding(15)
      .nodeAlign(sankeyCenter)
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ]);

    const { nodes: sNodes, links: sLinks } = sankeyGen({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    const svg = svgRef.current;
    svg.innerHTML = "";

    // Draw links
    sLinks.forEach((link) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", sankeyLinkHorizontal()(link));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", STATUS_COLORS[link.source.name] || "#ccc");
      path.setAttribute("stroke-opacity", "0.4");
      path.setAttribute("stroke-width", Math.max(1, link.width));
      svg.appendChild(path);
    });

    // Draw nodes
    sNodes.forEach((node) => {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", node.x0);
      rect.setAttribute("y", node.y0);
      rect.setAttribute("width", node.x1 - node.x0);
      rect.setAttribute("height", Math.max(1, node.y1 - node.y0));
      rect.setAttribute("fill", STATUS_COLORS[node.name] || "#ccc");
      rect.setAttribute("rx", "3");
      svg.appendChild(rect);

      // Label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      const isLeft = node.x0 < width / 2;
      text.setAttribute("x", isLeft ? node.x1 + 6 : node.x0 - 6);
      text.setAttribute("y", (node.y0 + node.y1) / 2);
      text.setAttribute("dy", "0.35em");
      text.setAttribute("text-anchor", isLeft ? "start" : "end");
      text.setAttribute("font-size", "11");
      text.setAttribute("fill", "#555");
      text.textContent = `${node.name} (${node.value})`;
      svg.appendChild(text);
    });
  }, [applications, statusHistory]);

  if (applications.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">No applications yet</p>;
  }

  return (
    <svg ref={svgRef} width={500} height={250} className="mx-auto" />
  );
}
