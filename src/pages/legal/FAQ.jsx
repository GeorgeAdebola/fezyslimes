import LegalPageLayout from './LegalPageLayout';
import { Truck, CreditCard, PackageCheck, HeartHandshake, ShieldAlert } from 'lucide-react';

export default function FAQ() {
  const faqs = [
    {
      category: 'Shipping & Delivery',
      icon: Truck,
      items: [
        {
          q: 'How long does shipping take?',
          a: 'Orders within Lagos are delivered within 1–2 business days. Deliveries outside Lagos take 2–4 business days depending on location.'
        },
        {
          q: 'What are the shipping fees?',
          a: 'Shipping rates: Lekki (₦4,000), VI (₦6,000), Mainland (₦10,000), Ibadan (₦8,000), Oyo State (₦15,000), Abuja (₦16,000), and Port Harcourt (₦15,000).'
        },
        {
          q: 'Do you deliver nationwide in Nigeria?',
          a: 'Yes! We ship securely across all states in Nigeria using reliable logistics partners.'
        }
      ]
    },
    {
      category: 'Payment Methods',
      icon: CreditCard,
      items: [
        {
          q: 'What payment options do you accept?',
          a: 'We process all payments securely via Paystack. You can pay using Nigerian Debit/Credit cards, Bank Transfer, USSD, or Apple Pay.'
        }
      ]
    },
    {
      category: 'Order Tracking & Status',
      icon: PackageCheck,
      items: [
        {
          q: 'How can I track my order?',
          a: 'Visit our Track Order page anytime and enter your Order ID or tracking code.'
        }
      ]
    },
    {
      category: 'Slime Care & Safety',
      icon: HeartHandshake,
      items: [
        {
          q: 'Are your slimes safe and non-toxic?',
          a: 'Yes, all FezySlimes products are made with non-toxic, child-safe ingredients. However, slimes are NOT edible.'
        }
      ]
    }
  ];

  return (
    <LegalPageLayout
      title="Frequently Asked Questions (FAQ)"
      subtitle="Find quick answers to common questions about shipping, payments, tracking, and slime care."
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
            This FAQ section provides draft answers for reference only. Please review and update prior to final publication.
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {faqs.map((sec, idx) => {
          const IconComp = sec.icon;
          return (
            <div key={idx} className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2.5 border-b border-slate-100 pb-2">
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl">
                  <IconComp className="w-5 h-5" />
                </div>
                {sec.category}
              </h3>
              <div className="space-y-4 pt-1">
                {sec.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 sm:p-5">
                    <h4 className="font-extrabold text-slate-800 text-base mb-1.5">{item.q}</h4>
                    <p className="text-slate-600 font-medium text-sm leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </LegalPageLayout>
  );
}
