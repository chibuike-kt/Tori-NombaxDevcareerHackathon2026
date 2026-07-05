"use client";

const GREEN = "#00B37E";
const WHITE = "#FFFFFF";
const MUTED = "#8B98AB";
const PANEL = "#16202E";

/** Simplified SVG mock: ClassPay's pricing card in a browser frame, redirecting to a Nomba checkout in a phone frame. */
export function ClassPayMock() {
  return (
    <div className="rounded-2xl px-5 py-8" style={{ background: "#0F1728" }}>
      <svg
        viewBox="0 0 460 460"
        className="w-full h-auto"
        role="img"
        aria-label="A browser window showing the ClassPay pricing page, with an arrow to a phone showing the Nomba secure checkout screen"
      >
        {/* Browser frame — ClassPay pricing page */}
        <rect x={20} y={10} width={420} height={190} rx={12} fill={PANEL} stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
        <rect x={20} y={10} width={420} height={28} rx={12} fill="rgba(255,255,255,0.03)" />
        <circle cx={36} cy={24} r={4} fill="#FF5F56" />
        <circle cx={50} cy={24} r={4} fill="#FFBD2E" />
        <circle cx={64} cy={24} r={4} fill="#27C93F" />
        <rect x={150} y={18} width={180} height={12} rx={6} fill="rgba(255,255,255,0.06)" />
        <text x={240} y={27} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="monospace">classpay.ng/pricing</text>

        <text x={44} y={70} fontSize={16} fontWeight={700} fill={WHITE}>Pro Plan</text>
        <text x={44} y={92} fontSize={18} fontWeight={800} fill={GREEN}>₦25,000/month</text>

        <circle cx={48} cy={112} r={2.5} fill={GREEN} />
        <text x={58} y={116} fontSize={10} fill={MUTED}>Unlimited students</text>
        <circle cx={48} cy={130} r={2.5} fill={GREEN} />
        <text x={58} y={134} fontSize={10} fill={MUTED}>Automated fee reminders</text>
        <circle cx={48} cy={148} r={2.5} fill={GREEN} />
        <text x={58} y={152} fontSize={10} fill={MUTED}>Parent portal access</text>

        <rect x={300} y={140} width={120} height={40} rx={8} fill={GREEN} />
        <text x={360} y={165} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0F1728">Subscribe</text>

        {/* Arrow down to the checkout */}
        <line x1={230} y1={210} x2={230} y2={248} stroke={GREEN} strokeWidth={1.5} markerEnd="url(#classpay-arrow)" />
        <defs>
          <marker id="classpay-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={GREEN} />
          </marker>
        </defs>
        <text x={250} y={232} fontSize={10} fill={MUTED} fontStyle="italic">redirects to Nomba checkout</text>

        {/* Phone frame — Nomba checkout */}
        <rect x={140} y={255} width={180} height={195} rx={20} fill={PANEL} stroke="rgba(255,255,255,0.12)" strokeWidth={2} />
        <rect x={205} y={266} width={50} height={5} rx={2.5} fill="rgba(255,255,255,0.15)" />

        <text x={230} y={296} textAnchor="middle" fontSize={13} fontWeight={800} fill={GREEN}>Nomba</text>
        <text x={230} y={310} textAnchor="middle" fontSize={9} fill={MUTED}>Secure Checkout</text>

        <rect x={160} y={324} width={140} height={26} rx={6} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <text x={170} y={341} fontSize={10} fill={WHITE} fontFamily="monospace">•••• •••• •••• 4242</text>

        <rect x={160} y={356} width={65} height={22} rx={6} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <text x={168} y={371} fontSize={9} fill={MUTED} fontFamily="monospace">12/30</text>
        <rect x={235} y={356} width={65} height={22} rx={6} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
        <text x={243} y={371} fontSize={9} fill={MUTED} fontFamily="monospace">•••</text>

        <rect x={160} y={400} width={140} height={32} rx={8} fill={GREEN} />
        <text x={230} y={421} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0F1728">Pay ₦25,000</text>
      </svg>
    </div>
  );
}
