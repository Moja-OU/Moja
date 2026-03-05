'use client';

import React, { useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Node {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    subtitle?: string;
    lines: string[];
    color: string;       // hex accent
    glyph: string;       // emoji / unicode glyph
}

interface Edge {
    id: string;
    from: [number, number];
    to: [number, number];
    via?: [number, number][];  // optional waypoints
    color: string;
    label?: string;
    thick?: boolean;
    dashed?: boolean;
}

interface Particle {
    id: number;
    edgeId: string;
    t: number;          // 0–1 progress along path
    speed: number;
}

// ─── Layout constants ────────────────────────────────────────────────────────

const W = 1400;
const H = 820;

// ─── Node definitions ────────────────────────────────────────────────────────

const NODES: Node[] = [
    {
        id: 'phone',
        x: 48, y: 320, w: 168, h: 130,
        title: 'End User',
        subtitle: 'Basic Feature Phone',
        lines: ['No app required', 'No Wi-Fi needed', 'Any cellular signal'],
        color: '#38bdf8',
        glyph: '📱',
    },
    {
        id: 'twilio',
        x: 290, y: 310, w: 185, h: 140,
        title: 'Twilio Gateway',
        subtitle: 'Telephony Layer',
        lines: ['Webhook routing', 'Media Streams (WSS)', 'DTMF / Speech input'],
        color: '#f87171',
        glyph: '🔴',
    },
    {
        id: 'auth',
        x: 558, y: 200, w: 185, h: 110,
        title: 'Auth Service',
        subtitle: 'Identity Verification',
        lines: ['Phone number lookup', 'PIN authentication', 'Session bootstrap'],
        color: '#fb923c',
        glyph: '🛡',
    },
    {
        id: 'core',
        x: 558, y: 365, w: 195, h: 150,
        title: 'Moja Core API',
        subtitle: 'Node.js · Express',
        lines: ['WebSocket bridge', '8 kHz ↔ 24 kHz transcode', 'Intent orchestration', 'Action executor'],
        color: '#60a5fa',
        glyph: '⚙',
    },
    {
        id: 'gemini',
        x: 848, y: 310, w: 205, h: 170,
        title: 'Gemini 2.5 Live',
        subtitle: 'Google AI · Realtime',
        lines: ['Bidirectional audio WSS', 'Multilingual NLU', 'Function calling', 'Sub-second latency'],
        color: '#a78bfa',
        glyph: '✨',
    },
    {
        id: 'tavily',
        x: 848, y: 120, w: 185, h: 105,
        title: 'Tavily Search',
        subtitle: 'Live Web Search',
        lines: ['Weather · Hours · Places', 'Live news & events'],
        color: '#fbbf24',
        glyph: '🔍',
    },
    {
        id: 'services',
        x: 1130, y: 200, w: 200, h: 130,
        title: 'Action Services',
        subtitle: 'Internal Business Logic',
        lines: ['Booking engine', 'Budget tracker', 'Goal planner', 'Reminder scheduler'],
        color: '#f472b6',
        glyph: '🛠',
    },
    {
        id: 'db',
        x: 848, y: 565, w: 185, h: 120,
        title: 'Prisma + SQLite',
        subtitle: 'Data Persistence',
        lines: ['User profiles', 'Session transcripts', 'Goals / Budgets'],
        color: '#34d399',
        glyph: '🗄',
    },
    {
        id: 'web',
        x: 558, y: 585, w: 195, h: 115,
        title: 'Next.js Dashboard',
        subtitle: 'Web Interface',
        lines: ['Call history & transcripts', 'Budgets / Goals UI', 'Profile management'],
        color: '#e2e8f0',
        glyph: '🖥',
    },
];

// ─── Edge definitions ────────────────────────────────────────────────────────

const EDGES: Edge[] = [
    // User → Twilio
    {
        id: 'e1',
        from: [216, 385],
        to: [290, 380],
        color: '#38bdf8',
        label: 'Call / SMS',
    },
    // Twilio → Auth
    {
        id: 'e2',
        from: [475, 340],
        to: [558, 255],
        color: '#fb923c',
        label: 'Verify',
    },
    // Twilio → Core
    {
        id: 'e3',
        from: [475, 400],
        to: [558, 430],
        color: '#60a5fa',
        label: 'Audio stream',
        thick: true,
    },
    // Auth → Core
    {
        id: 'e4',
        from: [645, 310],
        to: [645, 365],
        color: '#fb923c',
        label: '',
        dashed: true,
    },
    // Core ↔ Gemini (thick bidirectional)
    {
        id: 'e5',
        from: [753, 445],
        to: [848, 445],
        color: '#a78bfa',
        label: 'Bi-dir WSS · PCM 24k',
        thick: true,
    },
    // Gemini → Tavily
    {
        id: 'e6',
        from: [950, 310],
        to: [950, 225],
        color: '#fbbf24',
        label: 'Web search',
        dashed: true,
    },
    // Gemini → Services
    {
        id: 'e7',
        from: [1053, 395],
        to: [1130, 320],
        color: '#f472b6',
        label: 'fn call',
        dashed: true,
    },
    // Core → DB
    {
        id: 'e8',
        from: [655, 515],
        to: [848, 605],
        color: '#34d399',
        label: 'Persist',
        dashed: true,
    },
    // DB → Web
    {
        id: 'e9',
        from: [848, 620],
        to: [753, 638],
        color: '#34d399',
        label: 'Sync',
        dashed: true,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

/** Interpolate a multi-segment polyline at t ∈ [0,1] */
function interpolatePath(pts: [number, number][], t: number): [number, number] {
    if (pts.length < 2) return pts[0];
    const totalSegs = pts.length - 1;
    const scaled = t * totalSegs;
    const seg = Math.min(Math.floor(scaled), totalSegs - 1);
    const localT = scaled - seg;
    const [ax, ay] = pts[seg];
    const [bx, by] = pts[seg + 1];
    return [lerp(ax, bx, localT), lerp(ay, by, localT)];
}

function edgeToPoints(e: Edge): [number, number][] {
    const pts: [number, number][] = [e.from];
    if (e.via) pts.push(...e.via);
    pts.push(e.to);
    return pts;
}

function polylineD(pts: [number, number][]) {
    return pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
}

function midpoint(pts: [number, number][]): [number, number] {
    return interpolatePath(pts, 0.5);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NodeBox({ node }: { node: Node }) {
    const { x, y, w, lines, color, glyph, title, subtitle } = node;
    const r = 10;
    const pad = 14;

    // Auto-size height: header block + lines + bottom padding
    const headerH = subtitle ? 54 : 44;
    const h = headerH + lines.length * 18 + 14;

    return (
        <g>
            {/* Glow */}
            <rect
                x={x - 6} y={y - 6} width={w + 12} height={h + 12}
                rx={r + 4}
                fill={color} fillOpacity={0.08}
                filter="url(#softGlow)"
            />
            {/* Background */}
            <rect
                x={x} y={y} width={w} height={h}
                rx={r}
                fill="#0d1424"
                stroke={color}
                strokeWidth={1.2}
                strokeOpacity={0.55}
            />
            {/* Top accent bar */}
            <rect
                x={x} y={y} width={w} height={4}
                rx={r}
                fill={color}
                fillOpacity={0.7}
            />

            {/* Glyph */}
            <text
                x={x + pad} y={y + 28}
                fontSize={18}
                dominantBaseline="central"
            >
                {glyph}
            </text>

            {/* Title */}
            <text
                x={x + pad + 28} y={y + 22}
                fontSize={12.5}
                fontWeight="700"
                fontFamily="'JetBrains Mono', 'Courier New', monospace"
                fill="#f1f5f9"
                letterSpacing="0.03em"
            >
                {title}
            </text>

            {/* Subtitle */}
            {subtitle && (
                <text
                    x={x + pad + 28} y={y + 36}
                    fontSize={9}
                    fontFamily="'JetBrains Mono', 'Courier New', monospace"
                    fill={color}
                    fillOpacity={0.85}
                    letterSpacing="0.06em"
                >
                    {subtitle.toUpperCase()}
                </text>
            )}

            {/* Divider */}
            <line
                x1={x + pad} y1={y + headerH - 4}
                x2={x + w - pad} y2={y + headerH - 4}
                stroke={color} strokeOpacity={0.2} strokeWidth={1}
            />

            {/* Detail lines */}
            {lines.map((line, i) => (
                <g key={i}>
                    <circle
                        cx={x + pad + 4} cy={y + headerH + 6 + i * 18}
                        r={2}
                        fill={color} fillOpacity={0.6}
                    />
                    <text
                        x={x + pad + 12} y={y + headerH + 7 + i * 18}
                        fontSize={9.5}
                        fontFamily="Inter, sans-serif"
                        fill="#94a3b8"
                        dominantBaseline="middle"
                    >
                        {line}
                    </text>
                </g>
            ))}
        </g>
    );
}

function EdgePath({ edge }: { edge: Edge }) {
    const pts = edgeToPoints(edge);
    const d = polylineD(pts);

    return (
        <g>
            {/* Glow trail */}
            <path
                d={d} fill="none"
                stroke={edge.color}
                strokeWidth={edge.thick ? 8 : 4}
                strokeOpacity={0.08}
                filter="url(#softGlow)"
            />
            {/* Main line */}
            <path
                d={d} fill="none"
                stroke={edge.color}
                strokeWidth={edge.thick ? 2.5 : 1.5}
                strokeDasharray={edge.dashed ? '6 5' : undefined}
                strokeOpacity={0.65}
            />

        </g>
    );
}

/** Edge labels rendered separately so they always sit above particles */
function EdgeLabel({ edge }: { edge: Edge }) {
    if (!edge.label) return null;
    const pts = edgeToPoints(edge);
    const [mx, my] = midpoint(pts);
    const labelW = Math.max(edge.label.length * 6.5 + 16, 60);

    // Compute the angle of the edge at its midpoint segment
    const half = Math.floor((pts.length - 1) / 2);
    const [ax, ay] = pts[half];
    const [bx, by] = pts[Math.min(half + 1, pts.length - 1)];
    let angleDeg = Math.atan2(by - ay, bx - ax) * (180 / Math.PI);
    // Clamp so text never appears upside-down
    if (angleDeg > 90) angleDeg -= 180;
    if (angleDeg < -90) angleDeg += 180;

    // Offset the label slightly above the line (perpendicular offset)
    const rad = Math.atan2(by - ay, bx - ax);
    const offsetX = -Math.sin(rad) * 14;
    const offsetY = Math.cos(rad) * 14;

    return (
        <g transform={`translate(${mx + offsetX}, ${my + offsetY}) rotate(${angleDeg})`}>
            {/* Solid backdrop */}
            <rect
                x={-labelW / 2} y={-10}
                width={labelW} height={19}
                rx={4}
                fill="#060d1c"
                stroke={edge.color}
                strokeOpacity={0.55}
                strokeWidth={1}
            />
            <text
                x={0} y={1}
                fontSize={9}
                fontFamily="'JetBrains Mono', 'Courier New', monospace"
                fill={edge.color}
                fillOpacity={1}
                textAnchor="middle"
                dominantBaseline="middle"
                letterSpacing="0.04em"
                fontWeight="600"
            >
                {edge.label}
            </text>
        </g>
    );
}

function ArrowHead({ to, color, pts }: { to: [number, number]; color: string; pts: [number, number][] }) {
    // Direction from second-to-last to last point
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dx = last[0] - prev[0];
    const dy = last[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const size = 8;
    const px = to[0] - ux * size;
    const py = to[1] - uy * size;
    const lx = px - uy * (size * 0.5);
    const ly = py + ux * (size * 0.5);
    const rx = px + uy * (size * 0.5);
    const ry = py - ux * (size * 0.5);

    return (
        <polygon
            points={`${to[0]},${to[1]} ${lx},${ly} ${rx},${ry}`}
            fill={color}
            fillOpacity={0.8}
        />
    );
}

function DataParticle({ edge, t }: { edge: Edge; t: number }) {
    const pts = edgeToPoints(edge);
    const [cx, cy] = interpolatePath(pts, t);
    return (
        <circle
            cx={cx} cy={cy} r={3.5}
            fill={edge.color}
            filter="url(#particleGlow)"
        />
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

let _pid = 0;

export default function MojaArchitecture() {
    const [particles, setParticles] = useState<Particle[]>([]);
    const frameRef = useRef<number>(0);
    const lastRef = useRef<number>(0);

    useEffect(() => {
        const SPAWN_INTERVAL = 900; // ms between spawns per edge
        const lastSpawn: Record<string, number> = {};

        function tick(now: number) {
            const dt = (now - (lastRef.current || now)) / 1000;
            lastRef.current = now;

            setParticles(prev => {
                // Move existing
                let next = prev
                    .map(p => ({ ...p, t: p.t + p.speed * dt }))
                    .filter(p => p.t < 1);

                // Spawn new
                for (const edge of EDGES) {
                    const last = lastSpawn[edge.id] || 0;
                    if (now - last > SPAWN_INTERVAL + Math.random() * 600) {
                        lastSpawn[edge.id] = now;
                        next.push({
                            id: ++_pid,
                            edgeId: edge.id,
                            t: 0,
                            speed: edge.thick ? 0.22 : 0.18 + Math.random() * 0.08,
                        });
                    }
                }

                return next;
            });

            frameRef.current = requestAnimationFrame(tick);
        }

        frameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameRef.current);
    }, []);

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                background: '#040810',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'Inter, sans-serif',
                overflow: 'hidden',
            }}
        >
            {/* Google Fonts */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

            {/* ── Title header bar ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 40px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                flexShrink: 0,
            }}>
                <div style={{ color: '#f8fafc' }}>
                    <div style={{
                        fontSize: 10, letterSpacing: '0.32em', color: '#38bdf8',
                        fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase',
                        marginBottom: 4,
                    }}>
                        System Architecture · Moja AI
                    </div>
                    <div style={{
                        fontSize: 24, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                        lineHeight: 1,
                    }}>
                        Moja&nbsp;
                        <span style={{ color: '#60a5fa' }}>Core Infrastructure</span>
                    </div>
                </div>

                {/* Status badges — right side */}
                <div style={{ display: 'flex', gap: 20 }}>
                    {[
                        { color: '#22c55e', label: 'LIVE' },
                        { color: '#a78bfa', label: 'GEMINI 2.5' },
                        { color: '#38bdf8', label: 'REALTIME VOICE' },
                    ].map(b => (
                        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: b.color,
                                boxShadow: `0 0 6px ${b.color}`,
                                animation: b.label === 'LIVE' ? 'pulse 1.5s infinite' : undefined,
                            }} />
                            <span style={{
                                fontSize: 9, letterSpacing: '0.2em',
                                color: '#64748b', fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                {b.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Diagram ── */}
            <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{ flex: 1, width: '100%' }}
                aria-label="Moja System Architecture Diagram"
            >
                <defs>
                    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="particleGlow" x="-200%" y="-200%" width="500%" height="500%">
                        <feGaussianBlur stdDeviation="3.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Grid pattern */}
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e293b" strokeWidth="0.6" />
                    </pattern>
                </defs>

                {/* Grid background */}
                <rect width={W} height={H} fill="url(#grid)" opacity={0.6} />

                {/* Vignette */}
                <defs>
                    <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                        <stop offset="0%" stopColor="#040810" stopOpacity="0" />
                        <stop offset="100%" stopColor="#040810" stopOpacity="0.7" />
                    </radialGradient>
                </defs>
                <rect width={W} height={H} fill="url(#vignette)" />

                {/* ── Layer header bands ── */}
                {[
                    { x: 48, w: 170, label: 'USER', color: '#38bdf8' },
                    { x: 290, w: 185, label: 'GATEWAY', color: '#f87171' },
                    { x: 558, w: 195, label: 'CORE', color: '#60a5fa' },
                    { x: 848, w: 200, label: 'AI · DATA', color: '#a78bfa' },
                    { x: 1130, w: 200, label: 'SERVICES', color: '#f472b6' },
                ].map(l => (
                    <g key={l.label}>
                        {/* Column band background */}
                        <rect
                            x={l.x} y={30}
                            width={l.w} height={26}
                            rx={6}
                            fill={l.color}
                            fillOpacity={0.08}
                            stroke={l.color}
                            strokeOpacity={0.18}
                            strokeWidth={1}
                        />
                        {/* Left accent tick */}
                        <rect
                            x={l.x} y={30}
                            width={3} height={26}
                            rx={2}
                            fill={l.color}
                            fillOpacity={0.8}
                        />
                        {/* Label */}
                        <text
                            x={l.x + l.w / 2 + 2} y={43}
                            fontSize={9}
                            fontFamily="'JetBrains Mono', 'Courier New', monospace"
                            fill={l.color}
                            fillOpacity={0.9}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            letterSpacing="0.22em"
                            fontWeight="700"
                        >
                            {l.label}
                        </text>
                    </g>
                ))}

                {/* ── Edges ── */}
                {EDGES.map(e => <EdgePath key={e.id} edge={e} />)}

                {/* ── Nodes — solid backgrounds render above edges and backgrounds ── */}
                {NODES.map(n => <NodeBox key={n.id} node={n} />)}

            </svg>

            {/* Legend */}
            <div style={{
                position: 'absolute', bottom: 28, right: 36,
                background: 'rgba(13,20,36,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', flexDirection: 'column', gap: 10,
                minWidth: 230,
            }}>
                <div style={{ fontSize: 8, letterSpacing: '0.22em', color: '#475569', fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                    CONNECTION TYPES
                </div>
                {[
                    { color: '#a78bfa', thick: true, dashed: false, label: 'Realtime audio stream', sub: 'High-bandwidth · bidirectional · always-on' },
                    { color: '#60a5fa', thick: false, dashed: false, label: 'Synchronous call', sub: 'Blocking request / response' },
                    { color: '#fbbf24', thick: false, dashed: true, label: 'Async / background op', sub: 'Non-blocking · fire and continue' },
                ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <svg width="34" height="14" style={{ marginTop: 2, flexShrink: 0 }}>
                            <line
                                x1="2" y1="7" x2="32" y2="7"
                                stroke={l.color}
                                strokeWidth={l.thick ? 3 : 1.5}
                                strokeDasharray={l.dashed ? '4 3' : undefined}
                                strokeOpacity={0.85}
                            />
                        </svg>
                        <div>
                            <div style={{ fontSize: 9, color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                                {l.label}
                            </div>
                            <div style={{ fontSize: 8, color: '#475569', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>
                                {l.sub}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer stamp */}
            <div style={{
                position: 'absolute', bottom: 12, left: 40,
                fontSize: 8.5, color: '#334155',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.15em',
            }}>
                MOJA · HACKLAHOMA 2026 · TECHNICAL DOCUMENTATION
            </div>

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
        </div>
    );
}