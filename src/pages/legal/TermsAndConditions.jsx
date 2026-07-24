import LegalPageLayout from './LegalPageLayout';

export default function TermsAndConditions() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle="Please read these terms carefully before purchasing from FezySlimes."
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
            These Terms & Conditions are a placeholder template for reference only. Please review with a legal professional before publishing official copy.
          </p>
        </div>
      </div>

      <h2 className="text-xl font-black text-slate-800 mt-0 mb-3">1. Acceptance of Terms</h2>
      <p className="text-slate-600 font-medium leading-relaxed mb-6">
        By accessing or placing an order on the FezySlimes website, you agree to be bound by these Terms and Conditions.
      </p>

      <h2 className="text-xl font-black text-slate-800 mb-3">2. Products</h2>
      <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium mb-6">
        <li>All slimes are handmade and may have slight variations in colour, texture, or size compared to photos.</li>
        <li>All slimes are for sensory/play use only. They are <strong>NOT edible</strong>.</li>
        <li>Not suitable for children under 6 years old without close adult supervision.</li>
      </ul>

      <h2 className="text-xl font-black text-slate-800 mb-3">3. Ordering &amp; Delivery</h2>
      <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium mb-6">
        <li>All prices are listed in Nigerian Naira (₦).</li>
        <li>Orders are confirmed after successful payment via Paystack.</li>
        <li>We deliver nationwide across Nigeria via third-party logistics.</li>
      </ul>
    </LegalPageLayout>
  );
}
