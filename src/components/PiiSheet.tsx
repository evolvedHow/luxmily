import { X } from 'lucide-react'
import { C, money } from '../theme/tokens'
import type { PersonalCpiResult } from '../pi/personalCpi'

const rate = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(d)}%`

/**
 * "How does pII work?" — the math, shown with the reader's own numbers rather
 * than a generic worked example. People do not trust an inflation figure they
 * cannot reproduce, so every step here is checkable against the card.
 */
export function PiiSheet({
  open,
  onClose,
  result,
}: {
  open: boolean
  onClose: () => void
  result: PersonalCpiResult
}) {
  if (!open) return null

  const top = result.contributions.filter((c) => c.inflationPct != null).slice(0, 3)
  const gap = result.ratePct != null && result.officialPct != null ? result.ratePct - result.officialPct : null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md md:max-w-2xl max-h-[88dvh] rounded-t-3xl border-x border-t flex flex-col"
        style={{ background: C.bg, borderColor: C.border }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pii-sheet-title"
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b" style={{ borderColor: C.border }}>
          <div id="pii-sheet-title" className="text-[14px] font-semibold" style={{ color: C.text }}>
            How pII works
          </div>
          <button
            onClick={onClose}
            aria-label="Close pII help"
            className="w-8 h-8 rounded-full border flex items-center justify-center"
            style={{ borderColor: C.border, color: C.muted }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-4">
          <Para>
            <B>pII — personal Inflation index.</B> The headline inflation number describes a basket that is not
            yours. BLS builds CPI-U from a national average household: about{' '}
            <B>41% housing, 14% food, 13% transportation</B>, and so on. Those weights are the whole story. If you
            own your home outright and drive a paid-off car, you are being told about someone else's cost of living.
          </Para>

          <Para>
            pII keeps <B>the official BLS price data</B> and swaps out <B>only the weights</B> — replacing the
            national basket with the allocation you just built. Same rates, your shape.
          </Para>

          <Step n={1} title="Map each budget line to its CPI series">
            Rent/Mortgage → <Code>Shelter</Code>, Groceries → <Code>Food at home</Code>, Gasoline →{' '}
            <Code>Motor fuel</Code>, and so on. A few lines blend two series (a car payment is part new-vehicle,
            part used-car). A handful with no clean CPI counterpart — home insurance, subscriptions, internet —
            use a flat assumed rate, labelled as such.
          </Step>

          <Step n={2} title="Drop savings from the basket">
            401(k), Roth, emergency buffer and investments are <B>not consumption</B> — money saved does not get
            repriced. Here that holds <Money v={result.excludedPlan} /> out, leaving{' '}
            <Money v={result.coveredPlan} />/mo of planned spending as your basket.
          </Step>

          <Step n={3} title="Weight by your dollars, not the nation's">
            Each line's weight is its share of that basket:{' '}
            <Code>weight = line plan ÷ {money(result.coveredPlan)}</Code>. This is the step that makes the number
            yours. The <B>You</B> and <B>CPI</B> columns on the card are exactly this comparison — your weight
            beside the national one, renormalized over the same set of lines so they add to 100% both ways.
          </Step>

          <Step n={4} title="Reprice, then add it up">
            Each series' 12-month change is read straight from the BLS snapshot, multiplied by your weight, and
            summed:
            <div
              className="tnum text-[11px] mt-2 rounded-xl border px-3 py-2 leading-relaxed"
              style={{ borderColor: C.border, background: C.surface, color: C.text }}
            >
              pII = Σ ( weight<sub>line</sub> × inflation<sub>line</sub> )
            </div>
          </Step>

          {top.length > 0 && (
            <div>
              <SectionTitle>Your three biggest contributors right now</SectionTitle>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border }}>
                {top.map((c, i) => (
                  <div
                    key={`${c.themeId}.${c.catId}`}
                    className="flex items-baseline gap-2 px-3 py-2 text-[11.5px]"
                    style={{ background: C.surface, borderTop: i ? `1px solid ${C.border}` : undefined }}
                  >
                    <span className="flex-1 truncate" style={{ color: C.text }}>
                      {c.label}
                    </span>
                    <span className="tnum shrink-0" style={{ color: C.muted }}>
                      {c.weightPct.toFixed(1)}% × {rate(c.inflationPct, 1)} =
                    </span>
                    <span className="tnum w-12 text-right shrink-0" style={{ color: C.cap }}>
                      {c.contributionPts.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-1.5 leading-snug" style={{ color: C.muted }}>
                Those trailing figures are <B>percentage points of your pII</B> — add every line's and you get{' '}
                {rate(result.ratePct)}.
              </p>
            </div>
          )}

          <div>
            <SectionTitle>Reading your number</SectionTitle>
            <Para>
              Yours is <B>{rate(result.ratePct)}</B> against a headline of <B>{rate(result.officialPct)}</B>
              {gap != null && Math.abs(gap) >= 0.05 && (
                <>
                  {' '}— {rate(Math.abs(gap))} {gap > 0 ? 'above' : 'below'} the national figure
                  {gap > 0
                    ? ', because your plan leans into the categories that are rising fastest.'
                    : ", because your plan is light in the categories doing the most damage nationally."}
                </>
              )}
              {gap != null && Math.abs(gap) < 0.05 && ' — essentially in line with the national basket.'}
            </Para>
            <Para>
              The practical use: this is the raise you need next year simply to stand still. Below the headline
              means the news overstates your problem; above it means it understates it. Shift an allocation and the
              number moves — that is the optimizer and pII working as one tool.
            </Para>
          </div>

          <div>
            <SectionTitle>Honest limits</SectionTitle>
            <Bullet>
              CPI measures <B>price change</B>, not price level. A low pII in an expensive city still means
              expensive — it means costs there are rising slowly.
            </Bullet>
            <Bullet>
              Rates are <B>U.S. city average</B>, not local. Your ZIP localizes the benchmark dollars, not these
              inflation rates.
            </Bullet>
            <Bullet>
              The mapping is one-to-one and coarse. A phone line is priced off the whole{' '}
              <Code>Education and communication</Code> series, which also carries tuition.
            </Bullet>
            <Bullet>
              Lines with no CPI counterpart use a flat assumed rate; they move your number a little, so treat pII as
              a well-grounded estimate rather than an official statistic.
            </Bullet>
          </div>

          <div className="text-[10px] leading-snug pb-2" style={{ color: C.muted }}>
            Source: BLS Consumer Price Index for All Urban Consumers (CPI-U), {result.area}, not seasonally
            adjusted. Snapshot <span className="tnum">{result.version}</span>, latest published month{' '}
            <span className="tnum">{result.asOf ?? 'n/a'}</span>. Embedded in the app — no network call, nothing
            about your budget leaves the browser.{' '}
            <a
              href="https://www.bls.gov/cpi/"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
              style={{ color: C.cap }}
            >
              bls.gov/cpi
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- tiny presentational helpers ---------- */

const B = ({ children }: { children: React.ReactNode }) => (
  <strong style={{ color: C.text, fontWeight: 600 }}>{children}</strong>
)

const Money = ({ v }: { v: number }) => <span className="tnum">{money(v)}</span>

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1 rounded text-[11px]" style={{ background: `${C.border}88`, color: C.cap }}>
    {children}
  </code>
)

const Para = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] leading-relaxed" style={{ color: C.muted }}>
    {children}
  </p>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[9.5px] uppercase tracking-[0.16em] mb-1.5" style={{ color: C.muted }}>
    {children}
  </div>
)

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <div
        className="tnum shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] mt-0.5"
        style={{ borderColor: C.cap, color: C.cap }}
      >
        {n}
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold" style={{ color: C.text }}>
          {title}
        </div>
        <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: C.muted }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-1.5 text-[11.5px] leading-relaxed py-[2px]" style={{ color: C.muted }}>
    <span style={{ color: C.cap }}>•</span>
    <span>{children}</span>
  </div>
)
