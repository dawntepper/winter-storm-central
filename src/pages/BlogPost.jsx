import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPostBySlug, getRelatedPosts, formatPostDate } from '../utils/blogPosts';
import MarkdownRenderer from '../components/MarkdownRenderer';

const SITE_URL = 'https://stormtracking.io';

function setMeta(post) {
  if (!post) return;
  const title = post.seoTitle || post.title;
  const desc = post.seoDescription || post.excerpt || '';
  const url = `${SITE_URL}/blog/${post.slug}`;
  const img = post.heroImage
    ? (post.heroImage.startsWith('http') ? post.heroImage : `${SITE_URL}${post.heroImage}`)
    : `${SITE_URL}/og-image.png`;

  document.title = `${title} | StormTracking`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  if (post.seoKeywords) {
    document.querySelector('meta[name="keywords"]')?.setAttribute('content', post.seoKeywords);
  }
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
  document.querySelector('meta[property="og:image"]')?.setAttribute('content', img);
  document.querySelector('meta[property="og:type"]')?.setAttribute('content', 'article');
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="twitter:image"]')?.setAttribute('content', img);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
}

function PostNotFound({ slug }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">📰</div>
        <h1 className="text-2xl font-bold text-white mb-2">Post not found</h1>
        <p className="text-slate-400 mb-6">
          We couldn't find a post at "{slug}". It may have been moved or unpublished.
        </p>
        <Link to="/blog" className="inline-block px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors">
          Back to blog
        </Link>
      </div>
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  useEffect(() => {
    if (post) setMeta(post);
  }, [post]);

  if (!post) return <PostNotFound slug={slug} />;

  const related = getRelatedPosts(post);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
            <span className="text-xl">📡</span>
            <span className="text-lg sm:text-xl font-bold">StormTracking</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs sm:text-sm">
            <Link to="/blog" className="text-slate-400 hover:text-sky-400 transition-colors">All posts</Link>
            <Link to="/alerts" className="text-red-400 hover:bg-red-500/25 font-medium bg-red-500/15 px-2 py-1 rounded border border-red-500/30 transition-colors">Live Alerts</Link>
            <Link to="/radar" className="text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 px-2 py-1 rounded border border-emerald-500/30 transition-colors">Live Radar</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {post.heroImage && (
          <div className="mb-8 -mx-4 sm:mx-0 aspect-[16/9] bg-slate-800 overflow-hidden sm:rounded-xl border border-slate-700">
            <img
              src={post.heroImage}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { e.target.parentElement.style.display = 'none'; }}
            />
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="text-slate-400">{post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span>·</span>
            <span>{post.readingTime} min read</span>
          </div>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.tags.map(tag => (
                <span key={tag} className="text-[11px] px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <MarkdownRenderer>{post.body}</MarkdownRenderer>

        {related.length > 0 && (
          <section className="mt-16 pt-8 border-t border-slate-800">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Related posts</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map(r => (
                <Link
                  key={r.slug}
                  to={`/blog/${r.slug}`}
                  className="block p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-sky-500/40 transition-colors"
                >
                  <h3 className="text-sm font-semibold text-white mb-1">{r.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{r.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <Link to="/blog" className="hover:text-sky-400 transition-colors">← All posts</Link>
          <a href="/feed.xml" className="hover:text-sky-400 transition-colors">RSS feed</a>
        </footer>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            datePublished: post.date,
            author: { '@type': 'Person', name: post.author },
            publisher: {
              '@type': 'Organization',
              name: 'StormTracking',
              url: SITE_URL
            },
            url: `${SITE_URL}/blog/${post.slug}`,
            image: post.heroImage ? `${SITE_URL}${post.heroImage}` : `${SITE_URL}/og-image.png`,
            keywords: post.seoKeywords || post.tags.join(', ')
          })
        }}
      />
    </div>
  );
}
