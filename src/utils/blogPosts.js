/**
 * Blog post catalog.
 *
 * Loads every src/content/blog/*.md at build time via Vite's import.meta.glob
 * with the ?raw suffix, parses frontmatter with gray-matter, and exposes
 * helpers used by BlogIndex, BlogPost, AdminBlog, and the build scripts.
 */

import matter from 'gray-matter';

// ?raw gives us the file content as a string. eager: true means the imports
// are inlined at build time — no async loading at runtime.
const postModules = import.meta.glob('/src/content/blog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const WORDS_PER_MINUTE = 200;

function parseTags(input) {
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === 'string') {
    return input.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function readingTimeFor(body) {
  const wordCount = (body || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

function normalize(raw, path) {
  const { data, content } = matter(raw);
  const fallbackSlug = path
    .split('/')
    .pop()
    .replace(/\.md$/, '');

  const seo = data.seo || {};

  return {
    slug: data.slug || fallbackSlug,
    title: data.title || fallbackSlug,
    date: data.date || '',
    excerpt: data.excerpt || '',
    author: data.author || 'Dawn Tepper',
    tags: parseTags(data.tags),
    heroImage: data.hero_image || '',
    seoTitle: seo.title || '',
    seoDescription: seo.description || '',
    seoKeywords: seo.keywords || '',
    draft: !!data.draft,
    body: content,
    readingTime: readingTimeFor(content)
  };
}

const ALL_POSTS = Object.entries(postModules)
  .map(([path, raw]) => normalize(raw, path))
  .filter(Boolean);

const BY_SLUG = new Map(ALL_POSTS.map(p => [p.slug, p]));

function sortByDateDesc(a, b) {
  return (b.date || '').localeCompare(a.date || '');
}

export function getPublishedPosts() {
  return ALL_POSTS.filter(p => !p.draft).sort(sortByDateDesc);
}

export function getAllPostsIncludingDrafts() {
  return [...ALL_POSTS].sort(sortByDateDesc);
}

export function getPostBySlug(slug) {
  const post = BY_SLUG.get(slug);
  if (!post || post.draft) return null;
  return post;
}

export function getRelatedPosts(post, limit = 3) {
  if (!post || !post.tags?.length) return [];
  return getPublishedPosts()
    .filter(p => p.slug !== post.slug && p.tags.some(t => post.tags.includes(t)))
    .slice(0, limit);
}

export function formatPostDate(date) {
  if (!date) return '';
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return date;
  }
}
