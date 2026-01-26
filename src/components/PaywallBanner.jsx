/**
 * Paywall Banner Component
 *
 * Shows when users try to access premium features.
 * Prompts sign-in or upgrade to premium.
 */

import { useState } from 'react';

export function PaywallBanner({ feature, onSignIn, onUpgrade }) {
  const featureDescriptions = {
    actualAccumulations: {
      title: 'Actual Storm Totals',
      description: 'See real measured snowfall from 10,000+ weather stations',
      icon: '&#10003;'
    },
    locationSync: {
      title: 'Sync Locations',
      description: 'Access your saved locations on any device',
      icon: '&#128274;'
    },
    historicalData: {
      title: 'Historical Data',
      description: 'Compare this storm to past winters',
      icon: '&#128202;'
    }
  };

  const info = featureDescriptions[feature] || {
    title: 'Premium Feature',
    description: 'Upgrade to access this feature',
    icon: '&#11088;'
  };

  return (
    <div className="bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span
          className="text-2xl text-emerald-400 flex-shrink-0"
          dangerouslySetInnerHTML={{ __html: info.icon }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-1">{info.title}</h3>
          <p className="text-xs text-slate-400 mb-3">{info.description}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSignIn}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onUpgrade}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact paywall for inline use
 */
export function PaywallInline({ onSignIn, onUpgrade }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
      <span className="text-emerald-400 text-lg">&#128274;</span>
      <p className="text-slate-400 text-xs mt-1 mb-2">Premium feature</p>
      <div className="flex justify-center gap-2">
        <button
          onClick={onSignIn}
          className="px-2 py-1 text-[10px] text-slate-400 hover:text-white transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={onUpgrade}
          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium rounded transition-colors"
        >
          Upgrade
        </button>
      </div>
    </div>
  );
}

/**
 * Premium badge/button
 */
export function PremiumBadge({ onClick, size = 'sm' }) {
  const sizes = {
    xs: 'text-[8px] px-1.5 py-0.5',
    sm: 'text-[9px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1'
  };

  return (
    <button
      onClick={onClick}
      className={`bg-emerald-500/20 text-emerald-400 font-medium rounded hover:bg-emerald-500/30 transition-colors ${sizes[size]}`}
    >
      PREMIUM
    </button>
  );
}

/**
 * Pricing card for upgrade modal
 */
export function PricingCard({ plan, price, period, features, recommended, onSelect }) {
  return (
    <div className={`rounded-xl border p-4 ${
      recommended
        ? 'border-emerald-500 bg-emerald-500/5'
        : 'border-slate-700 bg-slate-800/50'
    }`}>
      {recommended && (
        <div className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wide mb-2">
          Recommended
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{plan}</h3>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-2xl font-bold text-white">${price}</span>
        <span className="text-slate-400 text-sm">/{period}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-emerald-400">&#10003;</span>
            {feature}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSelect(plan)}
        className={`w-full mt-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          recommended
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
            : 'bg-slate-700 hover:bg-slate-600 text-white'
        }`}
      >
        Select Plan
      </button>
    </div>
  );
}

/**
 * Upgrade modal with pricing
 */
export function UpgradeModal({ isOpen, onClose, onSelectPlan }) {
  if (!isOpen) return null;

  const plans = [
    {
      plan: 'Storm Pass',
      price: 3,
      period: 'storm',
      features: [
        'Actual snowfall totals',
        'Sync up to 10 locations',
        'Valid for current storm'
      ],
      recommended: false
    },
    {
      plan: 'Premium',
      price: 8,
      period: 'month',
      features: [
        'Actual snowfall totals',
        'Sync up to 10 locations',
        'All storms this month',
        'Email alerts'
      ],
      recommended: true
    },
    {
      plan: 'Season Pass',
      price: 19,
      period: 'season',
      features: [
        'Everything in Premium',
        'Historical comparisons',
        'Full winter season access',
        'Priority support'
      ],
      recommended: false
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white">Upgrade to Premium</h2>
          <p className="text-slate-400 text-sm mt-1">
            Get actual measured snowfall from 10,000+ weather stations
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PricingCard
              key={plan.plan}
              {...plan}
              onSelect={onSelectPlan}
            />
          ))}
        </div>

        {/* Footer */}
        <p className="text-slate-500 text-xs text-center mt-6">
          Secure payment via Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

export default PaywallBanner;
