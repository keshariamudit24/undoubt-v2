import React, { useRef, useEffect, useState } from "react";

type Node = { x: number; y: number; vx: number; vy: number };

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export default function NodesBg({
  nodeCount,
  className = "",
  style = {},
}: {
  nodeCount?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<Node[]>([]);
  const [size, setSize] = useState({ width: 1920, height: 600 });
  const [dynamicNodeCount, setDynamicNodeCount] = useState(nodeCount ?? 90);

  // Responsive: track parent size and adjust node count
  useEffect(() => {
    function updateSizeAndNodes() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });

        // Responsive node count based on width
        let count = 90;
        if (rect.width < 500) count = 28; // mobile
        else if (rect.width < 800) count = 40; // small tablet
        else if (rect.width < 1200) count = 60; // tablet/laptop
        else if (rect.width < 1600) count = 75; // desktop
        setDynamicNodeCount(nodeCount ?? count);
      }
    }
    updateSizeAndNodes();
    const ro = new (window as any).ResizeObserver(updateSizeAndNodes);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateSizeAndNodes);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSizeAndNodes);
    };
  }, [nodeCount]);

  useEffect(() => {
    // Initialize nodes to fill the area
    nodes.current = Array.from({ length: dynamicNodeCount }, () => ({
      x: randomBetween(0, size.width),
      y: randomBetween(0, size.height),
      vx: randomBetween(-1, 1),
      vy: randomBetween(-1, 1),
    }));

    let frame: number;
    const animate = () => {
      for (const node of nodes.current) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > size.width) node.vx *= -1;
        if (node.y < 0 || node.y > size.height) node.vy *= -1;
      }

      const svg = ref.current;
      if (svg) {
        while (svg.lastChild) svg.removeChild(svg.lastChild);

        // ✅ Add defs FIRST (glow filter)
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        filter.setAttribute("id", "glowNeon");
        filter.innerHTML = `
          <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#06b6d4" flood-opacity="1"/>
          <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#06b6d4" flood-opacity="0.9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="#06b6d4" flood-opacity="0.7"/>
          <feDropShadow dx="0" dy="0" stdDeviation="32" flood-color="#06b6d4" flood-opacity="0.5"/>
        `;
        defs.appendChild(filter);
        svg.appendChild(defs);

        // Draw lines
        for (let i = 0; i < nodes.current.length; i++) {
          for (let j = i + 1; j < nodes.current.length; j++) {
            const a = nodes.current[i];
            const b = nodes.current[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (dist < 140) {
              const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line.setAttribute("x1", a.x.toString());
              line.setAttribute("y1", a.y.toString());
              line.setAttribute("x2", b.x.toString());
              line.setAttribute("y2", b.y.toString());
              line.setAttribute("stroke", "#22d3ee"); // cyan-400
              line.setAttribute("stroke-opacity", (0.13 + 0.22 * (1 - dist / 140)).toString());
              line.setAttribute("stroke-width", "2");
              svg.appendChild(line);
            }
          }
        }

        // Draw glowing nodes
        for (const node of nodes.current) {
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("cx", node.x.toString());
          circle.setAttribute("cy", node.y.toString());
          circle.setAttribute("r", "7");
          circle.setAttribute("fill", "#06b6d4"); // cyan-500
          circle.setAttribute("filter", "url(#glowNeon)");
          svg.appendChild(circle);
        }
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line
  }, [dynamicNodeCount, size.width, size.height]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    >
      <svg
        ref={ref}
        width={size.width}
        height={size.height}
        className={className}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          ...style,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
