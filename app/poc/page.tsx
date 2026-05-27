'use client'

import { useState } from 'react'
import {
  IconSun, IconCalendarWeek, IconFolders, IconUmbrella,
  IconLayoutDashboard, IconBriefcase, IconUsers, IconSettings,
  IconSearch, IconPlus, IconArrowLeft, IconArrowRight,
  IconRepeat, IconCalendar, IconBolt, IconClock, IconDots,
  IconChevronRight,
} from '@tabler/icons-react'

const FONT = "'DM Sans', var(--font-dm-sans), system-ui, sans-serif"

// ── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  // Page — outer bg (topbar + sidebar float on this)
  page:     '#F2F5FA',
  topBar:   '#F2F5FA',

  // Content shell — white panel
  shell:    '#FFFFFF',

  // Cards (inside the white shell)
  card:     '#FFFFFF',

  // Neutral surfaces — blue-tinted (chips, shortcut bg, block tray)
  surface:  '#EEF2FA',

  // Primary
  primary:  '#3C3C3C',
  onPrimary:'#FFFFFF',

  // Status chips — small only
  blueChip: '#DDE7F8', blueOn: '#1B5BC9',
  greenChip:'#DCEEDC', greenOn:'#1B6E1B',
  amberChip:'#FAEFD9', amberOn:'#8A5A18',

  // Text
  t1: '#111111',
  t2: '#555555',
  t3: '#9A9A9A',

  // Border
  bd: '#DDE1EC',

  // Shadow — cards on white shell need slightly more definition
  sh: '0 1px 4px rgba(100,120,180,0.08), 0 0 0 1px rgba(100,120,180,0.06)',
}

const PROJECT_DOT: Record<string, string> = {
  'Iberdrola UX':   T.blueOn,
  'Reunión equipo': '#5B3D9E',
  'BCS Research':   T.greenOn,
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <header style={{
      background: T.topBar,
      height: 60,
      display: 'flex', alignItems: 'center',
      paddingLeft: 20, paddingRight: 24,
      gap: 12, flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: T.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.onPrimary, letterSpacing: '-0.04em', fontFamily: FONT }}>H</span>
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, color: T.t1, letterSpacing: '-0.01em', fontFamily: FONT }}>Houra</span>

      <div style={{ flex: 1 }} />

      {/* Search pill */}
      <div style={{
        background: T.surface, borderRadius: 999, height: 36,
        display: 'flex', alignItems: 'center',
        paddingLeft: 14, paddingRight: 14, gap: 8,
        cursor: 'text', width: 240,
      }}>
        <IconSearch size={14} strokeWidth={1.5} color={T.t3} />
        <span style={{ flex: 1, fontSize: 13, color: T.t3, fontFamily: FONT }}>Buscar…</span>
        <span style={{
          background: T.page, borderRadius: 6,
          padding: '1px 6px', fontSize: 10, color: T.t2,
          fontFamily: 'monospace', fontWeight: 500,
        }}>⌘K</span>
      </div>

      {/* Buttons */}
      <button style={{
        height: 36, paddingLeft: 16, paddingRight: 16, borderRadius: 999,
        background: 'transparent', border: `1px solid ${T.bd}`,
        fontSize: 13, fontWeight: 500, color: T.t2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: FONT,
      }}>
        <IconCalendar size={14} strokeWidth={1.5} />
        Bulk
      </button>
      <button style={{
        height: 36, paddingLeft: 16, paddingRight: 16, borderRadius: 999,
        background: T.primary, border: 'none',
        fontSize: 13, fontWeight: 500, color: T.onPrimary, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: FONT,
      }}>
        <IconPlus size={14} strokeWidth={2} />
        Nuevo bloque
      </button>
    </header>
  )
}

// ── Sidebar icons — float on white, no panel ──────────────────────────────────
const NAV_TOP    = [IconSun, IconCalendarWeek, IconFolders, IconUmbrella]
const NAV_BOTTOM = [IconLayoutDashboard, IconBriefcase, IconUsers, IconSettings]
const NAV_LABELS = ['Mi día', 'Semana', 'Proyectos', 'Libre', 'Dashboard', 'Workspaces', 'Personas', 'Ajustes']

function SidebarIcons() {
  return (
    <aside style={{
      width: 52, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 8, paddingBottom: 8, gap: 2,
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {NAV_TOP.map((Icon, i) => (
          <div key={i} title={NAV_LABELS[i]} style={{
            width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i === 0 ? T.surface : 'transparent',
            cursor: 'pointer',
          }}>
            <Icon size={19} strokeWidth={i === 0 ? 2 : 1.5} color={i === 0 ? T.t1 : T.t3} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {NAV_BOTTOM.map((Icon, i) => (
          <div key={i} title={NAV_LABELS[4 + i]} style={{
            width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <Icon size={19} strokeWidth={1.5} color={T.t3} />
          </div>
        ))}
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: T.surface, color: T.t2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, marginTop: 4, cursor: 'pointer',
          fontFamily: FONT,
        }}>GV</div>
      </div>
    </aside>
  )
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      background: bg, color, borderRadius: 999,
      padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      fontFamily: FONT,
    }}>{label}</span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, chipLabel, chipBg, chipColor }: {
  label: string; value: string; sub?: string;
  chipLabel?: string; chipBg?: string; chipColor?: string;
}) {
  return (
    <div style={{ background: T.card, borderRadius: 16, padding: '16px 18px', flex: 1, boxShadow: T.sh }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: FONT }}>
          {label}
        </span>
        {chipLabel && chipBg && chipColor && (
          <Chip label={chipLabel} bg={chipBg} color={chipColor} />
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 500, color: T.t1, lineHeight: 1.1, letterSpacing: '-0.01em', fontFamily: FONT }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.t3, marginTop: 4, fontFamily: FONT }}>{sub}</div>}
    </div>
  )
}

// ── Time block ────────────────────────────────────────────────────────────────
const BLOCKS = [
  { time: '09:00–11:00', project: 'Iberdrola UX',   area: 'UX · Senior',   hours: '2h',   desc: 'Wireframes pantalla de settings' },
  { time: '11:30–12:30', project: 'Reunión equipo',  area: 'Interno',       hours: '1h',   desc: 'Sync semanal de proyectos' },
  { time: '14:00–14:30', project: 'BCS Research',    area: 'Research · Mid',hours: '0,5h', desc: 'Revisión entregable fase 1' },
]

function TimeBlock({ block }: { block: typeof BLOCKS[0] }) {
  const dot = PROJECT_DOT[block.project] ?? T.t3
  return (
    <div style={{
      background: T.card, borderRadius: 12,
      padding: '11px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer', boxShadow: T.sh,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: 999, background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: T.t3, minWidth: 80, flexShrink: 0, fontFamily: FONT }}>{block.time}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, marginBottom: 1, fontFamily: FONT }}>{block.project}</div>
        <div style={{ fontSize: 12, color: T.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
          {block.desc}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        <Chip label={block.hours} bg={T.surface} color={T.t1} />
        <span style={{ fontSize: 10, color: T.t3, fontFamily: FONT }}>{block.area}</span>
      </div>
      <IconDots size={14} strokeWidth={1.5} color={T.t3} />
    </div>
  )
}

// ── Week mini ─────────────────────────────────────────────────────────────────
const WEEK = [
  { d: 'L', h: '7,5', done: true },
  { d: 'M', h: '7,5', done: true },
  { d: 'X', h: '3,5', today: true },
  { d: 'J', h: null },
  { d: 'V', h: null },
]

function WeekMini() {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {WEEK.map(d => (
        <div key={d.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 9, color: T.t3, fontWeight: 500, fontFamily: FONT }}>{d.d}</span>
          <div style={{
            width: '100%', height: 30, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: d.today ? T.primary : d.done ? T.greenChip : T.shell,
            fontSize: 9, fontWeight: 600,
            color: d.today ? T.onPrimary : d.done ? T.greenOn : T.t3,
            fontFamily: FONT,
          }}>
            {d.h ? `${d.h}h` : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shortcut ──────────────────────────────────────────────────────────────────
function Shortcut({ Icon, label }: { Icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>; label: string }) {
  return (
    <button style={{
      width: '100%', background: T.shell, border: 'none',
      borderRadius: 10, padding: '9px 12px',
      display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
      fontFamily: FONT,
    }}>
      <Icon size={14} strokeWidth={1.5} color={T.t2} />
      <span style={{ fontSize: 12, fontWeight: 500, color: T.t2, fontFamily: FONT }}>{label}</span>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PocPage() {
  const [dayOffset, setDayOffset] = useState(0)
  const dayLabel = dayOffset === 0 ? 'Hoy, miércoles 27' : dayOffset < 0 ? 'Mar 26 may' : 'Jue 28 may'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: T.page, overflow: 'hidden',
      fontFamily: FONT,
    }}>
      <TopBar />

      {/* Body row: sidebar icons + gray shell */}
      <div style={{
        flex: 1, display: 'flex', overflow: 'hidden',
        padding: '0 16px 16px', gap: 8,
      }}>
        {/* Sidebar — no panel bg, icons float on white page */}
        <SidebarIcons />

        {/* Gray shell — the main content area */}
        <div style={{
          flex: 1, background: T.shell, borderRadius: 20,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          padding: 16, gap: 12,
        }}>
          {/* Title + meta */}
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: T.t1, letterSpacing: '-0.01em', fontFamily: FONT }}>
              Buenos días, Guille
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.t2, fontFamily: FONT }}>
              3 bloques · 3,5h de 7,5h imputadas hoy
            </p>
          </div>

          {/* KPI row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <KpiCard label="Hoy"         value="3,5h"  sub="de 7,5h objetivo"
              chipLabel="47%"  chipBg={T.amberChip} chipColor={T.amberOn} />
            <KpiCard label="Esta semana" value="18h"   sub="objetivo 37,5h"
              chipLabel="↑ 48%" chipBg={T.greenChip} chipColor={T.greenOn} />
            <KpiCard label="Mayo"        value="72h"   sub="84% del objetivo" />
          </div>

          {/* Main 2-col */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 256px', gap: 12, overflow: 'hidden' }}>

            {/* Left — day card */}
            <div style={{
              background: T.card, borderRadius: 16,
              display: 'flex', flexDirection: 'column',
              boxShadow: T.sh, overflow: 'hidden',
            }}>
              {/* Day nav */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderBottom: `1px solid ${T.bd}`, flexShrink: 0,
              }}>
                <button onClick={() => setDayOffset(d => d - 1)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, display: 'flex', borderRadius: 8 }}>
                  <IconArrowLeft size={14} strokeWidth={1.5} color={T.t2} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.t1, fontFamily: FONT }}>{dayLabel}</span>
                <button onClick={() => setDayOffset(d => d + 1)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, display: 'flex', borderRadius: 8 }}>
                  <IconArrowRight size={14} strokeWidth={1.5} color={T.t2} />
                </button>
              </div>

              {/* Block list — page-colored tray so white cards pop */}
              <div style={{
                flex: 1, overflowY: 'auto',
                background: T.surface, padding: 10,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {dayOffset === 0 ? (
                  <>
                    {BLOCKS.map(b => <TimeBlock key={b.project} block={b} />)}
                    <div style={{
                      borderRadius: 12, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', border: `1.5px dashed ${T.bd}`, color: T.t3,
                    }}>
                      <IconPlus size={13} strokeWidth={1.5} />
                      <span style={{ fontSize: 12, fontFamily: FONT }}>Añadir bloque después de las 14:30</span>
                    </div>
                  </>
                ) : (
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 10, color: T.t3, padding: 40,
                  }}>
                    <IconClock size={28} strokeWidth={1} />
                    <span style={{ fontSize: 13, fontFamily: FONT }}>
                      {dayOffset < 0 ? 'Sin bloques registrados' : 'Sin bloques para este día'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right aside — blue-gray surface panel */}
            <div style={{
              background: T.surface, borderRadius: 16,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Shortcuts */}
                <section>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontFamily: FONT }}>
                    Atajos
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Shortcut Icon={IconRepeat}   label="Repetir bloque de ayer" />
                    <Shortcut Icon={IconCalendar} label="Imputación masiva" />
                    <Shortcut Icon={IconBolt}     label="Bloque rápido 30min" />
                  </div>
                </section>

                {/* Week */}
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: FONT }}>
                      Esta semana
                    </div>
                    <Chip label="18 / 37,5h" bg={T.greenChip} color={T.greenOn} />
                  </div>
                  <WeekMini />
                  <div style={{ marginTop: 8, background: T.surface, borderRadius: 999, height: 3 }}>
                    <div style={{ width: '48%', height: '100%', background: T.greenOn, borderRadius: 999 }} />
                  </div>
                </section>

                {/* Projects */}
                <section>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontFamily: FONT }}>
                    Proyectos activos
                  </div>
                  {[
                    { name: 'Iberdrola UX',  pct: 72, dot: T.blueOn,  chip: T.blueChip },
                    { name: 'BCS Research',  pct: 45, dot: T.greenOn, chip: T.greenChip },
                    { name: 'Reuniones',     pct: 90, dot: T.amberOn, chip: T.amberChip },
                  ].map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: p.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: T.t1, fontWeight: 500, fontFamily: FONT }}>{p.name}</div>
                      <Chip label={`${p.pct}%`} bg={p.chip} color={p.dot} />
                      <IconChevronRight size={12} strokeWidth={1.5} color={T.t3} />
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
