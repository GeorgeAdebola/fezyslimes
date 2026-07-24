import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LegalPageLayout({ title, subtitle, lastUpdated, children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50/50 pt-28 pb-20 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* Back Button & Header */}
        <div className="space-y-4 text-left">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-cyan-600 hover:border-cyan-200 text-xs font-black transition-all shadow-xs group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </button>

          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-100/70 border border-cyan-200 text-cyan-700 text-xs font-black uppercase tracking-wider mb-3">
              Legal &amp; Policy
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-slate-500 font-medium text-base mt-2 leading-relaxed">
                {subtitle}
              </p>
            )}
            {lastUpdated && (
              <p className="text-xs text-slate-400 font-semibold mt-3">
                Last updated: {lastUpdated}
              </p>
            )}
          </div>
        </div>

        {/* Legal Document Card */}
        <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-100 text-left space-y-6">
          {children}
        </div>

        {/* Footer info banner */}
        <div className="text-center text-xs font-bold text-slate-400 pt-4">
          Questions about this policy? Contact us at{' '}
          <a href="mailto:fezyslimes@gmail.com" className="text-cyan-500 hover:underline">
            fezyslimes@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
