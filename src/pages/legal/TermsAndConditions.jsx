import LegalPageLayout from './LegalPageLayout';

export default function TermsAndConditions() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle="Please read these terms carefully before purchasing or using our website."
      lastUpdated="July 2026"
    >
      <div className="space-y-8 text-slate-700 font-medium leading-relaxed">
        
        {/* Section 1 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">1. Introduction</h2>
          <p>
            Welcome to Fezyslimes. By accessing or purchasing from our website, you agree to these Terms &amp; Conditions. If you do not agree, please do not use our website.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">2. Products</h2>
          <ul className="list-disc pl-5 space-y-1.5 marker:text-cyan-400">
            <li>All slimes are handmade.</li>
            <li>Due to the handmade nature of our products, colours, scents, decorations, and textures may vary slightly from product photos.</li>
            <li>Product images are for illustration purposes only.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">3. Pricing</h2>
          <ul className="list-disc pl-5 space-y-1.5 marker:text-cyan-400">
            <li>All prices are listed in Nigerian Naira (₦).</li>
            <li>Prices may change without prior notice.</li>
            <li>Promotional offers are subject to availability.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">4. Orders</h2>
          <ul className="list-disc pl-5 space-y-1.5 marker:text-cyan-400">
            <li>Orders are only confirmed after full payment has been received.</li>
            <li>We reserve the right to cancel any order due to pricing errors, stock shortages, suspected fraud, or other unforeseen circumstances.</li>
            <li>Customers are responsible for providing accurate delivery information.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">5. Payment</h2>
          <p>
            We accept secure payments through our approved payment providers. Orders will not be processed until payment has been successfully confirmed.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">6. Shipping</h2>
          <ul className="list-disc pl-5 space-y-1.5 marker:text-cyan-400">
            <li>Orders are processed within 1–5 business days unless otherwise stated.</li>
            <li>Delivery times depend on the courier and destination.</li>
            <li>Shipping delays caused by the courier, weather, public holidays, or other circumstances beyond our control are not our responsibility.</li>
            <li>Customers will receive tracking information where available.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">7. Returns &amp; Refunds</h2>
          <p>
            Due to hygiene reasons, we do not accept returns of opened or used slime products.
          </p>
          <p className="font-bold text-slate-800">Refunds or replacements may be offered if:</p>
          <ul className="list-disc pl-5 space-y-1 marker:text-pink-400">
            <li>You received the wrong item.</li>
            <li>Your order arrived significantly damaged.</li>
            <li>Your order was incomplete.</li>
          </ul>
          <p className="text-sm bg-slate-50 border border-slate-200/60 rounded-xl p-3 font-semibold text-slate-700">
            Claims must be made within 48 hours of delivery and should include clear photos or videos of the issue.
          </p>
          <p className="font-bold text-slate-800 pt-1">Refunds will not be provided because:</p>
          <ul className="list-disc pl-5 space-y-1 marker:text-slate-400">
            <li>You changed your mind.</li>
            <li>You dislike the scent, texture, or colour after purchase.</li>
            <li>The slime becomes sticky due to weather or improper storage (activator can restore most slimes).</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">8. Product Care</h2>
          <p className="font-bold text-slate-800">To keep your slime in the best condition:</p>
          <ul className="list-disc pl-5 space-y-1.5 marker:text-cyan-400">
            <li>Wash your hands before playing.</li>
            <li>Store slime in its container with the lid tightly closed.</li>
            <li>Keep away from direct sunlight and excessive heat.</li>
            <li>Use activator if the slime becomes sticky.</li>
          </ul>
          <p className="text-xs text-slate-500 font-medium italic pt-1">
            Improper storage may affect the quality of the slime.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">9. Safety</h2>
          <ul className="list-disc pl-5 space-y-1.5 marker:text-red-400">
            <li>Slime is not food and should never be eaten.</li>
            <li>Not recommended for children under 3 years due to choking hazards from small charms or accessories.</li>
            <li>Adult supervision is recommended for young children.</li>
            <li>Stop using the product if skin irritation occurs.</li>
            <li>Some products may contain fragrance oils, colourants, glue, clay, or other ingredients that may cause allergic reactions in sensitive individuals.</li>
          </ul>
        </section>

        {/* Section 10 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">10. Intellectual Property</h2>
          <p>
            All content on this website—including product photos, videos, logos, branding, descriptions, and designs—is owned by Fezyslimes and may not be copied or used without written permission.
          </p>
        </section>

        {/* Section 11 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">11. Limitation of Liability</h2>
          <p>
            Fezyslimes is not responsible for injuries, allergic reactions, or damages resulting from misuse, improper storage, or failure to follow product care instructions.
          </p>
        </section>

        {/* Section 12 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">12. Privacy</h2>
          <p>
            Personal information provided during checkout will only be used to process your order and improve our services. We do not sell your personal information to third parties.
          </p>
        </section>

        {/* Section 13 */}
        <section className="space-y-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">13. Changes to These Terms</h2>
          <p>
            We may update these Terms &amp; Conditions at any time. Continued use of the website constitutes acceptance of the updated terms.
          </p>
        </section>

        {/* Section 14 */}
        <section className="space-y-2 pt-2 border-t border-slate-100">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">14. Contact Us</h2>
          <p>
            If you have any questions, please contact us:{' '}
            <a href="mailto:fezyslimes@gmail.com" className="font-bold text-pink-500 hover:underline">
              fezyslimes@gmail.com
            </a>
          </p>
        </section>

      </div>
    </LegalPageLayout>
  );
}
