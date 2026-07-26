import { getHazardEducationalContent } from '../../content/severe-weather/educational';

export default function HazardEducationalContent({ contentKey }) {
  const content = getHazardEducationalContent(contentKey);

  return (
    <div className="mt-12 space-y-10 border-t border-slate-800 pt-10">
      {content.sections.map((section) => (
        <section key={section.heading} aria-labelledby={slugify(section.heading)}>
          <h2 id={slugify(section.heading)} className="text-lg font-semibold text-white mb-3">
            {section.heading}
          </h2>
          <div className="space-y-3 max-w-3xl">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 48)} className="text-sm sm:text-[15px] text-slate-300 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}

      {content.faq?.length > 0 && (
        <section aria-labelledby="hazard-faq-heading">
          <h2 id="hazard-faq-heading" className="text-lg font-semibold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4 max-w-3xl">
            {content.faq.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-semibold text-slate-100 mb-1">{item.q}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.source && (
        <section aria-labelledby="hazard-sources-heading">
          <h2 id="hazard-sources-heading" className="text-lg font-semibold text-white mb-3">
            {content.source.heading}
          </h2>
          <div className="space-y-2 max-w-3xl">
            {content.source.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="text-sm text-slate-400 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
