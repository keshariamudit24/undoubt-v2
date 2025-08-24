import React, { useRef, useEffect, useState, useCallback } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Add spatial grid properties for optimization
  gridX: number;
  gridY: number;
};

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// Spatial grid for optimized neighbor finding
class SpatialGrid {
  private grid: Map<string, Node[]> = new Map();
  private cellSize: number;

  constructor(_width: number, _height: number, cellSize: number = 150) {
    this.cellSize = cellSize;
  }

  clear() {
    this.grid.clear();
  }

  addNode(node: Node) {
    const gridX = Math.floor(node.x / this.cellSize);
    const gridY = Math.floor(node.y / this.cellSize);
    node.gridX = gridX;
    node.gridY = gridY;

    const key = `${gridX},${gridY}`;
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(node);
  }

  getNearbyNodes(node: Node): Node[] {
    const nearby: Node[] = [];
    const { gridX, gridY } = node;

    // Check current cell and 8 surrounding cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${gridX + dx},${gridY + dy}`;
        const cellNodes = this.grid.get(key);
        if (cellNodes) {
          nearby.push(...cellNodes);
        }
      }
    }
    return nearby;
  }
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useRef<Node[]>([]);
  const spatialGrid = useRef<SpatialGrid | null>(null);
  const animationRef = useRef<number>();
  const lastFrameTime = useRef<number>(0);

  const [size, setSize] = useState({ width: 1920, height: 600 });
  const [dynamicNodeCount, setDynamicNodeCount] = useState(nodeCount ?? 60); // Reduced default

  // Optimized resize handler with debouncing
  const updateSizeAndNodes = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });

      // Reduced node counts for better performance
      let count = 90;
      if (rect.width < 500) count = 20; // mobile
      else if (rect.width < 800) count = 30; // small tablet
      else if (rect.width < 1200) count = 40; // tablet/laptop
      else if (rect.width < 1600) count = 50; // desktop
      setDynamicNodeCount(nodeCount ?? count);
    }
  }, [nodeCount]);

  // Responsive: track parent size and adjust node count
  useEffect(() => {
    updateSizeAndNodes();

    let timeoutId: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateSizeAndNodes, 100);
    };

    const ro = new ResizeObserver(debouncedUpdate);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", debouncedUpdate);

    return () => {
      clearTimeout(timeoutId);
      ro.disconnect();
      window.removeEventListener("resize", debouncedUpdate);
    };
  }, [updateSizeAndNodes]);

  // Initialize canvas and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    ctx.scale(dpr, dpr);

    // Initialize spatial grid
    spatialGrid.current = new SpatialGrid(size.width, size.height);

    // Initialize nodes
    nodes.current = Array.from({ length: dynamicNodeCount }, () => ({
      x: randomBetween(20, size.width - 20),
      y: randomBetween(20, size.height - 20),
      vx: randomBetween(-0.8, 0.8), // Slightly slower for smoother animation
      vy: randomBetween(-0.8, 0.8),
      gridX: 0,
      gridY: 0,
    }));

    // Animation loop with frame rate limiting
    const animate = (currentTime: number) => {
      // Limit to ~60fps
      if (currentTime - lastFrameTime.current < 16) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime.current = currentTime;

      // Update node positions
      for (const node of nodes.current) {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls with padding
        if (node.x < 10 || node.x > size.width - 10) node.vx *= -1;
        if (node.y < 10 || node.y > size.height - 10) node.vy *= -1;

        // Keep nodes in bounds
        node.x = Math.max(10, Math.min(size.width - 10, node.x));
        node.y = Math.max(10, Math.min(size.height - 10, node.y));
      }

      // Clear canvas
      ctx.clearRect(0, 0, size.width, size.height);

      // Update spatial grid
      spatialGrid.current!.clear();
      for (const node of nodes.current) {
        spatialGrid.current!.addNode(node);
      }

      // Draw connections using spatial grid optimization
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;

      const drawnConnections = new Set<string>();

      for (const node of nodes.current) {
        const nearbyNodes = spatialGrid.current!.getNearbyNodes(node);

        for (const other of nearbyNodes) {
          if (node === other) continue;

          // Create unique connection ID to avoid drawing twice
          const connectionId = node.x < other.x || (node.x === other.x && node.y < other.y)
            ? `${node.x},${node.y}-${other.x},${other.y}`
            : `${other.x},${other.y}-${node.x},${node.y}`;

          if (drawnConnections.has(connectionId)) continue;
          drawnConnections.add(connectionId);

          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          if (dist < 120) { // Reduced connection distance
            const opacity = 0.1 + 0.3 * (1 - dist / 120);
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes with simple glow effect
      ctx.globalAlpha = 1;
      for (const node of nodes.current) {
        // Simple glow effect using multiple circles
        ctx.fillStyle = '#06b6d4';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dynamicNodeCount, size.width, size.height]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    >
      <canvas
        ref={canvasRef}
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
