import LegalPageLayout from './LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout
      title="Refund & Return Policy"
      subtitle="Our commitment to your satisfaction — and how we handle returns."
      lastUpdated="July 2025"
    >
      {/* Explicit Placeholder Notice Banner */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 mb-8 flex items-start gap-3 shadow-sm">
        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl font-black text-sm flex-shrink-0">
          ⚠️
        </div>
        <div>
          <span className="block text-xs font-black uppercase text-amber-800 tracking-wider">
            Notice
          </span>
          <p className="text-sm font-bold text-amber-900 mt-0.5 leading-relaxed">
            [PLACEHOLDER — replace with reviewed legal copy]
          </p>
          <p className="text-xs text-amber-700 font-medium mt-1">
            This Return & Refund Policy is a placeholder template for reference only. Please review with a legal professional before publishing official copy.
          </p>
        </div>
      </div>

      <h2 className="text-xl font-black text-slate-800 mt-0 mb-3">1. Quality Guarantee</h2>
      <p className="text-slate-600 font-medium leading-relaxed mb-6">
        Every FezySlimes product is handmade and checked for quality. If something arrives damaged or incorrect, we will resolve it promptly.
      </p>

      <h2 className="text-xl font-black text-slate-800 mb-3">2. Eligible Situations</h2>
      <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium mb-6">
        <li><strong>Damaged in transit:</strong> Slime arrived broken or leaked.</li>
        <li><strong>Wrong item received:</strong> You received a different product than ordered.</li>
        <li><strong>Missing items:</strong> Items are missing from your package.</li>
      </ul>

      <h2 className="text-xl font-black text-slate-800 mb-3">3. How to Request</h2>
      <p className="text-slate-600 font-medium leading-relaxed mb-6">
        Contact us within 3 days of delivery via WhatsApp (09155577753) or email (fezyslimes@gmail.com) with photo evidence of your issue.
      </p>
    </LegalPageLayout>
  );
}
