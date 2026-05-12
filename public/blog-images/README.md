# Blog images

Put blog post hero images and inline images here. They'll be served from
`https://stormtracking.io/blog-images/<filename>`.

Reference them in post frontmatter as:

```yaml
hero_image: "/blog-images/your-image.jpg"
```

Or inline in markdown body:

```markdown
![alt text](/blog-images/your-image.jpg)
```

Suggested conventions:

- Use lowercase, hyphenated filenames: `el-nino-2026-hero.jpg`
- Match the post slug as a prefix when possible
- Aim for 1600x900 or larger for hero images; the site renders them responsively
- JPG for photos, PNG for graphics/screenshots, AVIF/WebP fine too
