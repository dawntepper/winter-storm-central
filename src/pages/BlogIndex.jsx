import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublishedPosts, formatPostDate } from '../utils/blogPosts';

const SITE_URL = 'https://stormtracking.io';

function updateMeta() {
  const title = 'Storm & Weather Prep — Articles and guides | StormTracking';
  const desc = 'Articles and guides for staying ahead of severe weather: prep, seasonal outlooks, and context for active events from StormTracking.';
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', `${SITE_URL}/blog`);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${SITE_URL}/blog`);
}

function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="block bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-sky-500/40 transition-colors group"
    >
      {post.heroImage && (
        <div className="aspect-[16/9] bg-slate-900 overflow-hidden">
          <img
            src={post.heroImage}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span>·</span>
          <span>{post.readingTime} min read</span>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-sky-300 transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 mb-4">
            {post.excerpt}
          </p>
        )}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 bg-slate-700/60 text-slate-300 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function BlogIndex() {
  const posts = getPublishedPosts();

  useEffect(() => {
    updateMeta();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
            <span className="text-xl">📡</span>
            <span className="text-lg sm:text-xl font-bold">StormTracking</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs sm:text-sm">
            <Link to="/alerts" className="text-red-400 hover:bg-red-500/25 font-medium bg-red-500/15 px-2 py-1 rounded border border-red-500/30 transition-colors">Live Alerts</Link>
            <Link to="/radar" className="text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 px-2 py-1 rounded border border-emerald-500/30 transition-colors">Live Radar</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <section className="mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Storm & Weather Prep</h1>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl">
            Articles and guides for staying ahead of the weather — prep, seasonal outlooks,
            and context for the storms we're tracking.
          </p>
        </section>

        {posts.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
            <p className="text-slate-400">No posts yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {posts.map(post => <PostCard key={post.slug} post={post} />)}
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <Link to="/" className="hover:text-sky-400 transition-colors">← Back to StormTracking</Link>
          <a href="/feed.xml" className="hover:text-sky-400 transition-colors">RSS feed</a>
        </footer>
      </main>
    </div>
  );
}
