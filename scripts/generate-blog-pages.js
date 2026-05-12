#!/usr/bin/env node

// Generate static HTML for the blog: dist/blog/index.html (listing) and
// dist/blog/[slug]/index.html for each non-draft post. Also writes
// dist/feed.xml (RSS 2.0). Mirrors the storm pages generator pattern.

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
const BASE_URL = 'https://stormtracking.io';
const WORDS_PER_MINUTE = 200;
const RSS_LIMIT = 20;

function loadPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
      const { data, content } = matter(raw);
      const slug = data.slug || filename.replace(/\.md$/, '');
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const readingTime = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
      return {
        slug,
        title: data.title || slug,
        date: data.date || '',
        excerpt: data.excerpt || '',
        author: data.author || 'Dawn Tepper',
        tags: Array.isArray(data.tags) ? data.tags : [],
        heroImage: data.hero_image || '',
        seoTitle: data.seo?.title || '',
        seoDescription: data.seo?.description || '',
        seoKeywords: data.seo?.keywords || '',
        draft: !!data.draft,
        body: content,
        readingTime
      };
    })
    .filter(p => p.slug);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRssDate(dateStr) {
  if (!dateStr) return new Date().toUTCString();
  try {
    return new Date(dateStr + 'T12:00:00Z').toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

function rewriteMeta(html, { title, description, url, image, keywords }) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(/(<meta\s+name="title"\s+content=")[^"]*"/, `$1${escapeAttr(title)}"`);

  if (/<meta\s+name="description"/.test(out)) {
    out = out.replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${escapeAttr(description)}"`);
  } else {
    out = out.replace('</head>', `  <meta name="description" content="${escapeAttr(description)}" />\n  </head>`);
  }

  if (keywords) {
    if (/<meta\s+name="keywords"/.test(out)) {
      out = out.replace(/(<meta\s+name="keywords"\s+content=")[^"]*"/, `$1${escapeAttr(keywords)}"`);
    } else {
      out = out.replace('</head>', `  <meta name="keywords" content="${escapeAttr(keywords)}" />\n  </head>`);
    }
  }

  if (/<link\s+rel="canonical"/.test(out)) {
    out = out.replace(/(<link\s+rel="canonical"\s+href=")[^"]*"/, `$1${url}"`);
  } else {
    out = out.replace('</head>', `  <link rel="canonical" href="${url}" />\n  </head>`);
  }

  out = out.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${escapeAttr(title)}"`);
  out = out.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${escapeAttr(description)}"`);
  out = out.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${url}"`);
  if (image) {
    out = out.replace(/(<meta\s+property="og:image"\s+content=")[^"]*"/, `$1${escapeAttr(image)}"`);
  }

  out = out.replace(/(<meta\s+(?:name|property)="twitter:title"\s+content=")[^"]*"/, `$1${escapeAttr(title)}"`);
  out = out.replace(/(<meta\s+(?:name|property)="twitter:description"\s+content=")[^"]*"/, `$1${escapeAttr(description)}"`);
  if (image) {
    out = out.replace(/(<meta\s+(?:name|property)="twitter:image"\s+content=")[^"]*"/, `$1${escapeAttr(image)}"`);
  }

  return out;
}

function insertJsonLd(html, jsonLd) {
  const tag = `<script type="application/ld+json">\n    ${JSON.stringify(jsonLd, null, 2)}\n    </script>`;
  if (/<script\s+type="application\/ld\+json">/.test(html)) {
    return html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/, tag);
  }
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

function buildIndexHTML(baseHTML, posts) {
  const title = 'Storm & Weather Prep — Articles and guides | StormTracking';
  const description = 'Articles and guides for staying ahead of severe weather: prep, seasonal outlooks, and context for active events from StormTracking.';

  let html = rewriteMeta(baseHTML, {
    title,
    description,
    url: `${BASE_URL}/blog`,
    image: `${BASE_URL}/og-image.png`
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'StormTracking Blog',
    description,
    url: `${BASE_URL}/blog`,
    blogPost: posts.slice(0, 10).map(p => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${BASE_URL}/blog/${p.slug}`,
      datePublished: p.date,
      author: { '@type': 'Person', name: p.author }
    }))
  };

  return insertJsonLd(html, jsonLd);
}

function buildPostHTML(baseHTML, post) {
  const url = `${BASE_URL}/blog/${post.slug}`;
  const title = post.seoTitle || `${post.title} | StormTracking`;
  const description = post.seoDescription || post.excerpt || '';
  const image = post.heroImage
    ? (post.heroImage.startsWith('http') ? post.heroImage : `${BASE_URL}${post.heroImage}`)
    : `${BASE_URL}/og-image.png`;

  let html = rewriteMeta(baseHTML, {
    title,
    description,
    url,
    image,
    keywords: post.seoKeywords || post.tags.join(', ')
  });

  // og:type should be "article" for blog posts
  html = html.replace(/(<meta\s+property="og:type"\s+content=")[^"]*"/, '$1article"');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'StormTracking',
      url: BASE_URL
    },
    url,
    image,
    keywords: post.seoKeywords || post.tags.join(', ')
  };

  return insertJsonLd(html, jsonLd);
}

function buildRssFeed(posts) {
  const items = posts.slice(0, RSS_LIMIT).map(p => {
    const url = `${BASE_URL}/blog/${p.slug}`;
    return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${formatRssDate(p.date)}</pubDate>
      <author>noreply@stormtracking.io (${escapeXml(p.author)})</author>
      <description>${escapeXml(p.excerpt)}</description>
      <content:encoded><![CDATA[${p.body}]]></content:encoded>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>StormTracking Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Articles and guides for staying ahead of severe weather.</description>
    <language>en-us</language>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('Error: dist/index.html not found. Run vite build first.');
    process.exit(1);
  }

  const allPosts = loadPosts();
  const published = allPosts
    .filter(p => !p.draft)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Always emit feed.xml (even if empty) so the autodiscovery link doesn't 404
  fs.writeFileSync(path.join(DIST_DIR, 'feed.xml'), buildRssFeed(published), 'utf-8');
  console.log(`Wrote dist/feed.xml (${Math.min(published.length, RSS_LIMIT)} items)`);

  if (published.length === 0) {
    console.log('No published blog posts to generate pages for.');
    return;
  }

  const baseHTML = fs.readFileSync(indexPath, 'utf-8');

  // Listing page
  const blogDir = path.join(DIST_DIR, 'blog');
  fs.mkdirSync(blogDir, { recursive: true });
  fs.writeFileSync(path.join(blogDir, 'index.html'), buildIndexHTML(baseHTML, published), 'utf-8');
  console.log('Generated dist/blog/index.html');

  // Per-post pages
  for (const post of published) {
    const dir = path.join(blogDir, post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildPostHTML(baseHTML, post), 'utf-8');
  }
  console.log(`Generated ${published.length} post pages in dist/blog/`);
}

main();
