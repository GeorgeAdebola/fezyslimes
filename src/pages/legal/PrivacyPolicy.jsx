import LegalPageLayout from './LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How FezySlimes collects, uses, and protects your personal information."
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
            This Privacy Policy is a placeholder template for reference only. Please review with a legal professional before publishing official copy.
          </p>
        </div>
      </div>

      <h2 className="text-xl font-black text-slate-800 mt-0 mb-3">1. Who We Are</h2>
      <p className="text-slate-600 font-medium leading-relaxed mb-6">
        FezySlimes is a premium handmade slime brand based in Lagos, Nigeria, operated by Tire &amp; Tase.
        We sell sensory slime products online via our website. Our contact email is{' '}
        <a href="mailto:fezyslimes@gmail.com" className="text-cyan-500 font-bold">fezyslimes@gmail.com</a>.
      </p>

      <h2 className="text-xl font-black text-slate-800 mb-3">2. Information We Collect</h2>
      <p className="text-slate-600 font-medium leading-relaxed mb-2">When you use our website, we may collect:</p>
      <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium mb-6">
        <li><strong>Account information:</strong> name, email address, and password when you register.</li>
        <li><strong>Order information:</strong> delivery address, phone number, and items purchased.</li>
        <li><strong>Payment information:</strong> processed securely by Paystack — we never store card details.</li>
        <li><strong>Usage data:</strong> pages visited, browser type, and device information.</li>
      </ul>

      <h2 className="text-xl font-black text-slate-800 mb-3">3. How We Use Your Information</h2>
      <ul className="list-disc pl-5 space-y-2 text-slate-600 font-medium mb-6">
        <li>To process and fulfil your orders.</li>
        <li>To send order confirmations and delivery updates.</li>
        <li>To provide customer support.</li>
        <li>To improve our website and product offerings.</li>
      </ul>

      <h2 className="text-xl font-black text-slate-800 mb-3">4. Data Storage &amp; Security</h2>
      <p className="text-slate-600 font-medium leading-relaxed mb-6">
        Your data is stored securely in Google Firebase (Firestore), protected by encryption and Firebase Security Rules. Payment transactions are processed by Paystack.
      </p>

      <h2 className="text-xl font-black text-slate-800 mb-3">5. Sharing Your Information</h2>
      <p className="text-slate-600 font-medium leading-relaxed mb-6">
        We do <strong>not</strong> sell or rent your personal data. We only share information with delivery logistics providers to deliver your order, and Paystack for transactions.
      </p>
    </LegalPageLayout>
  );
}
