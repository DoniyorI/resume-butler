"use client";

import { useMemo } from "react";
import { sankey, sankeyCenter, sankeyLinkHorizontal } from "d3-sankey";
import { STATUS_COLORS } from "@/lib/constants";

const WIDTH = 500;
const HEIGHT = 250;
const MARGIN = 10;
const FALLBACK_COLOR = "#ccc";

// Draws precomputed status flow ({ nodes: [{ name }], links: [{ source, target, value }] })
export default function SankeyDiagram({ nodes, links }) {
  const layout = useMemo(() => {
    if (links.length === 0) return null;
    return sankey()
      .nodeWidth(20)
      .nodePadding(15)
      .nodeAlign(sankeyCenter)
      .extent([
        [MARGIN, MARGIN],
        [WIDTH - MARGIN, HEIGHT - MARGIN],
      ])({
      nodes: nodes.map((node) => ({ ...node })),
      links: links.map((link) => ({ ...link })),
    });
  }, [nodes, links]);

  const linkPath = sankeyLinkHorizontal();

  return (
    <svg width={WIDTH} height={HEIGHT} className="mx-auto">
      {layout?.links.map((link) => (
        <path
          key={`${link.source.name}-${link.target.name}`}
          d={linkPath(link)}
          fill="none"
          stroke={STATUS_COLORS[link.source.name] || FALLBACK_COLOR}
          strokeOpacity={0.4}
          strokeWidth={Math.max(1, link.width)}
        />
      ))}
      {layout?.nodes.map((node) => {
        const isLeft = node.x0 < WIDTH / 2;
        return (
          <g key={node.name}>
            <rect
              x={node.x0}
              y={node.y0}
              width={node.x1 - node.x0}
              height={Math.max(1, node.y1 - node.y0)}
              fill={STATUS_COLORS[node.name] || FALLBACK_COLOR}
              rx={3}
            />
            <text
              x={isLeft ? node.x1 + 6 : node.x0 - 6}
              y={(node.y0 + node.y1) / 2}
              dy="0.35em"
              textAnchor={isLeft ? "start" : "end"}
              fontSize={11}
              fill="#555"
            >
              {`${node.name} (${node.value})`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
