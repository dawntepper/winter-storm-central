import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Render a markdown string with GitHub-flavored extensions and Tailwind
 * Typography styling tuned for the dark theme. Used by BlogPost and by the
 * AdminBlog preview modal.
 */
export default function MarkdownRenderer({ children, className = '' }) {
  return (
    <article
      className={`prose prose-invert prose-slate max-w-none
        prose-headings:text-white prose-headings:font-bold
        prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
        prose-a:text-sky-400 hover:prose-a:text-sky-300
        prose-strong:text-white
        prose-code:text-amber-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700
        prose-blockquote:border-l-sky-500 prose-blockquote:text-slate-300
        prose-hr:border-slate-700
        prose-img:rounded-lg prose-img:border prose-img:border-slate-700
        ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ''}</ReactMarkdown>
    </article>
  );
}
