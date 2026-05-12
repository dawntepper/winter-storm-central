/**
 * Admin Blog Page (/admin/blog)
 *
 * Static-blog admin: lists existing posts (from src/content/blog via the
 * blogPosts util) and provides a form that generates a downloadable .md
 * file. The user commits the downloaded file to the repo to publish.
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import matter from 'gray-matter';
import AdminGate from './AdminGate';
import MarkdownRenderer from './MarkdownRenderer';
import {
  getAllPostsIncludingDrafts,
  formatPostDate
} from '../utils/blogPosts';

const LOCAL_STORAGE_DRAFT_KEY = 'blog_admin_draft';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parseTagInput(value) {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

const DEFAULT_FORM_DATA = {
  title: '',
  slug: '',
  date: todayISO(),
  excerpt: '',
  author: 'Dawn Tepper',
  tags: [],
  heroImage: '',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  draft: false,
  body: ''
};

function formDataToMarkdown(formData) {
  const frontmatter = {
    title: formData.title,
    slug: formData.slug,
    date: formData.date,
    excerpt: formData.excerpt,
    author: formData.author,
    tags: formData.tags,
    hero_image: formData.heroImage,
    seo: {
      title: formData.seoTitle,
      description: formData.seoDescription,
      keywords: formData.seoKeywords
    },
    draft: formData.draft
  };
  return matter.stringify(formData.body || '', frontmatter);
}

function downloadMarkdown(formData) {
  const md = formDataToMarkdown(formData);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${formData.slug || 'post'}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function PreviewModal({ formData, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-white">Preview</h3>
            <p className="text-xs text-slate-400">Rendered with the same styles as the live post page</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-6 sm:p-8">
          {formData.heroImage && (
            <div className="mb-6 aspect-[16/9] bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
              <img
                src={formData.heroImage}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { e.target.parentElement.style.display = 'none'; }}
              />
            </div>
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{formData.title || 'Untitled'}</h1>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-6">
            <span className="text-slate-400">{formData.author}</span>
            <span>·</span>
            <span>{formatPostDate(formData.date)}</span>
            {formData.tags.length > 0 && (
              <>
                <span>·</span>
                <span>{formData.tags.join(', ')}</span>
              </>
            )}
          </div>
          <MarkdownRenderer>{formData.body || '_Nothing to preview yet — write some body content._'}</MarkdownRenderer>
        </div>
      </div>
    </div>
  );
}

function PostForm({ post, onCancel, onDownloaded }) {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  // Load draft on mount (only when not editing a real post)
  useEffect(() => {
    if (!post) {
      const saved = localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(parsed.data);
          setHasSavedDraft(true);
          setLastSaved(new Date(parsed.timestamp));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // Populate form when editing an existing post
  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title || '',
        slug: post.slug || '',
        date: post.date || todayISO(),
        excerpt: post.excerpt || '',
        author: post.author || 'Dawn Tepper',
        tags: post.tags || [],
        heroImage: post.heroImage || '',
        seoTitle: post.seoTitle || '',
        seoDescription: post.seoDescription || '',
        seoKeywords: post.seoKeywords || '',
        draft: !!post.draft,
        body: post.body || ''
      });
    }
  }, [post]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateSlug = () => {
    handleChange('slug', slugify(formData.title));
  };

  const saveToBrowser = () => {
    localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({ data: formData, timestamp: new Date().toISOString() })
    );
    setHasSavedDraft(true);
    setLastSaved(new Date());
  };

  const clearSavedDraft = () => {
    localStorage.removeItem(LOCAL_STORAGE_DRAFT_KEY);
    setHasSavedDraft(false);
    setLastSaved(null);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = evt.target.result;
        const { data, content } = matter(raw);
        const seo = data.seo || {};
        setFormData({
          title: data.title || '',
          slug: data.slug || file.name.replace(/\.md$/i, ''),
          date: data.date || todayISO(),
          excerpt: data.excerpt || '',
          author: data.author || 'Dawn Tepper',
          tags: Array.isArray(data.tags) ? data.tags : [],
          heroImage: data.hero_image || '',
          seoTitle: seo.title || '',
          seoDescription: seo.description || '',
          seoKeywords: seo.keywords || '',
          draft: !!data.draft,
          body: content || ''
        });
        setImportStatus({ type: 'success', message: 'Imported — review and download' });
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err) {
        setImportStatus({ type: 'error', message: `Invalid markdown: ${err.message}` });
        setTimeout(() => setImportStatus(null), 5000);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) {
      alert('Title and slug are required.');
      return;
    }
    downloadMarkdown(formData);
    clearSavedDraft();
    onDownloaded?.(formData.slug);
  };

  const excerptCount = formData.excerpt.length;
  const excerptOver = excerptCount > 300;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Import */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={handleImport}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium border border-slate-600 cursor-pointer flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import Markdown
        </button>
        {importStatus && (
          <span className={`text-xs ${importStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {importStatus.message}
          </span>
        )}
      </div>

      {/* Title & slug */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            placeholder="What to actually do before a hurricane"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Slug *
            <button type="button" onClick={handleGenerateSlug} className="ml-2 text-xs text-sky-400 hover:text-sky-300">
              Generate from title
            </button>
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            placeholder="what-to-do-before-a-hurricane"
          />
        </div>
      </div>

      {/* Date & author */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Date *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Author</label>
          <input
            type="text"
            value={formData.author}
            onChange={(e) => handleChange('author', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Excerpt */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center justify-between">
          <span>Excerpt</span>
          <span className={`text-xs ${excerptOver ? 'text-red-400' : 'text-slate-500'}`}>
            {excerptCount}/300
          </span>
        </label>
        <textarea
          value={formData.excerpt}
          onChange={(e) => handleChange('excerpt', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          placeholder="1-2 sentence summary shown on the listing page."
        />
      </div>

      {/* Tags & hero image */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={formData.tags.join(', ')}
            onChange={(e) => handleChange('tags', parseTagInput(e.target.value))}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            placeholder="hurricane prep, el nino"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Hero image path</label>
          <input
            type="text"
            value={formData.heroImage}
            onChange={(e) => handleChange('heroImage', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            placeholder="/blog-images/your-image.jpg"
          />
        </div>
      </div>

      {/* SEO */}
      <div className="border-t border-slate-700 pt-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">SEO (optional — falls back to title/excerpt)</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={formData.seoTitle}
            onChange={(e) => handleChange('seoTitle', e.target.value)}
            placeholder="SEO title"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
          />
          <textarea
            value={formData.seoDescription}
            onChange={(e) => handleChange('seoDescription', e.target.value)}
            placeholder="SEO description"
            rows={2}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
          />
          <input
            type="text"
            value={formData.seoKeywords}
            onChange={(e) => handleChange('seoKeywords', e.target.value)}
            placeholder="SEO keywords (comma-separated)"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Draft toggle */}
      <div className="flex items-center justify-between bg-slate-700/30 border border-slate-700 rounded-lg px-4 py-3">
        <div>
          <span className="text-sm text-white">Draft</span>
          <p className="text-xs text-slate-500">Drafts are excluded from /blog and return 404 if visited directly.</p>
        </div>
        <button
          type="button"
          onClick={() => handleChange('draft', !formData.draft)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            formData.draft ? 'bg-amber-500' : 'bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              formData.draft ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Body (Markdown)</label>
        <textarea
          value={formData.body}
          onChange={(e) => handleChange('body', e.target.value)}
          rows={24}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm leading-relaxed focus:outline-none focus:border-sky-500"
          style={{ minHeight: '600px' }}
          placeholder="Write your post in Markdown..."
        />
      </div>

      {/* How to publish */}
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-xs text-sky-100 leading-relaxed">
        <strong className="text-sky-300">How to publish:</strong> Click{' '}
        <span className="font-medium">Download Markdown</span> to get the .md file. Save it to{' '}
        <code className="px-1 py-0.5 bg-slate-900/60 rounded text-sky-300">src/content/blog/</code>{' '}
        in the repo, commit, and push. Netlify rebuilds and the post is live at{' '}
        <code className="px-1 py-0.5 bg-slate-900/60 rounded text-sky-300">/blog/{formData.slug || '[slug]'}</code>.
      </div>

      {/* Save-to-browser footer */}
      {!post && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {hasSavedDraft && lastSaved && (
              <span className="text-emerald-400">
                ✓ Saved to browser {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasSavedDraft && (
              <button
                type="button"
                onClick={clearSavedDraft}
                className="text-slate-400 hover:text-red-400 cursor-pointer"
              >
                Clear saved
              </button>
            )}
            <button
              type="button"
              onClick={saveToBrowser}
              className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded cursor-pointer flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save to Browser
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-3 border-t border-slate-700">
        <button
          type="submit"
          className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {post ? 'Update Post (download .md)' : 'Download Markdown'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg cursor-pointer"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {showPreview && (
        <PreviewModal formData={formData} onClose={() => setShowPreview(false)} />
      )}
    </form>
  );
}

function PostListItem({ post, onEdit, onDownload }) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-white truncate">{post.title}</h3>
            {post.draft && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">DRAFT</span>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-1">/{post.slug}</p>
          <p className="text-sm text-slate-300 line-clamp-2">{post.excerpt}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
            <span>{formatPostDate(post.date)}</span>
            {post.tags.length > 0 && <span>{post.tags.join(', ')}</span>}
            <span className="text-slate-600">src/content/blog/{post.slug}.md</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(post)}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded cursor-pointer"
          >
            Edit & re-export
          </button>
          <button
            onClick={() => onDownload(post)}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded cursor-pointer"
          >
            Download .md
          </button>
          {!post.draft && (
            <Link
              to={`/blog/${post.slug}`}
              className="px-3 py-1.5 text-xs text-center bg-slate-700 hover:bg-slate-600 text-white rounded"
            >
              View
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminBlogInner() {
  const posts = getAllPostsIncludingDrafts();
  const [editingPost, setEditingPost] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [downloadedSlug, setDownloadedSlug] = useState(null);

  const handleEdit = (post) => {
    setEditingPost(post);
    setShowForm(true);
    setDownloadedSlug(null);
  };

  const handleDownload = (post) => {
    downloadMarkdown({
      title: post.title,
      slug: post.slug,
      date: post.date,
      excerpt: post.excerpt,
      author: post.author,
      tags: post.tags,
      heroImage: post.heroImage,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      seoKeywords: post.seoKeywords,
      draft: post.draft,
      body: post.body
    });
    setDownloadedSlug(post.slug);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-slate-400 hover:text-white">← Admin</Link>
            <h1 className="text-lg font-bold text-white">Blog Admin</h1>
          </div>
          <Link to="/blog" className="text-sm text-slate-400 hover:text-white">View public blog →</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {downloadedSlug && (
          <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-lg text-emerald-200 text-sm flex items-start justify-between gap-3">
            <div>
              <strong className="text-emerald-300">Downloaded {downloadedSlug}.md.</strong>{' '}
              Move it to <code className="px-1 py-0.5 bg-slate-900/60 rounded">src/content/blog/</code>, commit,
              and push. Netlify will rebuild and publish to{' '}
              <code className="px-1 py-0.5 bg-slate-900/60 rounded">/blog/{downloadedSlug}</code>.
            </div>
            <button onClick={() => setDownloadedSlug(null)} className="text-emerald-300 hover:text-white cursor-pointer flex-shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {showForm ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingPost ? `Edit: ${editingPost.title}` : 'New Post'}
            </h2>
            <PostForm
              post={editingPost}
              onCancel={() => { setShowForm(false); setEditingPost(null); }}
              onDownloaded={(slug) => {
                setDownloadedSlug(slug);
                setShowForm(false);
                setEditingPost(null);
              }}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">All Posts ({posts.length})</h2>
              <button
                onClick={() => { setEditingPost(null); setShowForm(true); }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg cursor-pointer"
              >
                + New Post
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Posts are stored as markdown files in <code className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">src/content/blog/</code>.
              To <strong>delete</strong> a post, remove its file from the repo and commit.
              Use <em>Edit & re-export</em> to download an updated version after changes.
            </p>

            {posts.length === 0 ? (
              <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
                <p className="text-slate-400 mb-4">No blog posts yet</p>
                <button
                  onClick={() => { setEditingPost(null); setShowForm(true); }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg cursor-pointer"
                >
                  Write your first post
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => (
                  <PostListItem
                    key={post.slug}
                    post={post}
                    onEdit={handleEdit}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminBlog() {
  return (
    <AdminGate>
      <AdminBlogInner />
    </AdminGate>
  );
}
