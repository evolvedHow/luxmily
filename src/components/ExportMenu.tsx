import { useState } from 'react'
import { Download } from 'lucide-react'
import { downloadCSV, downloadJSON, printReport } from '../export/export'
import { useResolved } from '../store/useBudget'
import { C } from '../theme/tokens'

export function ExportMenu() {
  const r = useResolved()
  const [open, setOpen] = useState(false)

  const item = (label: string, hint: string, fn: () => void) => (
    <button
      onClick={() => {
        fn()
        setOpen(false)
      }}
      className="w-full text-left px-3 py-2 rounded-xl transition-colors"
      style={{ background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${C.border}66`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="text-[13px]" style={{ color: C.text }}>
        {label}
      </div>
      <div className="text-[10.5px]" style={{ color: C.muted }}>
        {hint}
      </div>
    </button>
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
        style={{ background: C.surface, borderColor: open ? C.cap : C.border, color: open ? C.cap : C.muted }}
        aria-label="Export budget"
        title="Export budget"
      >
        <Download size={15} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-20 w-52 rounded-2xl border p-1.5"
          style={{ background: C.surface, borderColor: C.border }}
        >
          {item('Download JSON', 'Full model — backup, port, restore', () => downloadJSON(r))}
          {item('Download CSV', 'Open in Google Sheets / Excel', () => downloadCSV(r))}
          {item('Print / PDF', 'One-page report, browser-native', () => printReport())}
        </div>
      )}
    </div>
  )
}