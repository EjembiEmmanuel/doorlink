import { describe, expect, it } from 'vitest'
import {
  extractDocumentLinks,
  extractPageLinks,
  inferKind,
  inferModel,
  isDisallowed,
  parseRobots,
  stripTags,
} from './harvest-parse'

const BASE = 'https://example.com/support/downloads'

describe('document link extraction', () => {
  it('finds PDF links and resolves them against the page', () => {
    const html = `
      <a href="/files/install.pdf">Installation manual</a>
      <a href="manuals/owner.pdf">Owner's manual</a>
    `
    const found = extractDocumentLinks(html, BASE)
    expect(found.map((f) => f.url)).toEqual([
      'https://example.com/files/install.pdf',
      'https://example.com/support/manuals/owner.pdf',
    ])
  })

  it('ignores links that are not documents', () => {
    const html = `
      <a href="/about">About us</a>
      <a href="/image.png">A picture</a>
      <a href="/contact.html">Contact</a>
    `
    expect(extractDocumentLinks(html, BASE)).toEqual([])
  })

  it('ignores mailto, tel, javascript and anchors', () => {
    const html = `
      <a href="mailto:x@example.com">Email</a>
      <a href="tel:+61000">Call</a>
      <a href="javascript:void(0)">Nothing</a>
      <a href="#top">Top</a>
    `
    expect(extractDocumentLinks(html, BASE)).toEqual([])
  })

  it('counts the same document linked twice as one', () => {
    const html = `
      <a href="/a.pdf">Manual</a>
      <a href="/a.pdf">Download the manual</a>
    `
    expect(extractDocumentLinks(html, BASE)).toHaveLength(1)
  })

  it('reads link text through nested markup', () => {
    const html = `<a href="/a.pdf"><span class="i"></span> <strong>Wiring</strong> diagram </a>`
    const [found] = extractDocumentLinks(html, BASE)
    expect(found.linkText).toBe('Wiring diagram')
    expect(found.inferredKind).toBe('WIRING_DIAGRAM')
  })

  it('decodes entities in hrefs and text', () => {
    const html = `<a href="/f.pdf?a=1&amp;b=2">Owner&#39;s manual</a>`
    const [found] = extractDocumentLinks(html, BASE)
    expect(found.linkText).toBe("Owner's manual")
    expect(found.url).toContain('a=1&b=2')
  })

  it('survives a malformed href instead of throwing', () => {
    const html = `<a href="ht tp://broken">Broken</a><a href="/ok.pdf">Fine</a>`
    expect(extractDocumentLinks(html, BASE)).toHaveLength(1)
  })

  it('marks everything unreviewed', () => {
    const [found] = extractDocumentLinks('<a href="/a.pdf">Manual</a>', BASE)
    expect(found.reviewed).toBe(false)
  })
})

describe('page links for one-level follow', () => {
  it('finds same-site article pages', () => {
    const html = `
      <a href="/hc/en-us/articles/123-SlideDriver-Installation">Installation manual</a>
      <a href="/hc/en-us/articles/456-SlideDriver-Parts">Parts diagrams</a>
    `
    expect(extractPageLinks(html, BASE)).toEqual([
      'https://example.com/hc/en-us/articles/123-SlideDriver-Installation',
      'https://example.com/hc/en-us/articles/456-SlideDriver-Parts',
    ])
  })

  // The refusals are what keep a portal crawl from becoming a crawl of
  // the web, so they matter more than the hits.
  it('refuses to leave the origin', () => {
    const html = `<a href="https://elsewhere.example/articles/1">Elsewhere</a>`
    expect(extractPageLinks(html, BASE)).toEqual([])
  })

  it('ignores links that are not pages', () => {
    const html = `
      <a href="/logo.png">Logo</a>
      <a href="/bundle.zip">Everything</a>
      <a href="/style.css">Style</a>
    `
    expect(extractPageLinks(html, BASE)).toEqual([])
  })

  it('accepts an extensionless path and the page extensions', () => {
    const html = `
      <a href="/downloads">Downloads</a>
      <a href="/a.html">A</a>
      <a href="/b.php">B</a>
      <a href="/c.aspx">C</a>
    `
    expect(extractPageLinks(html, BASE)).toHaveLength(4)
  })

  it('does not follow the page it is already on', () => {
    const html = `<a href="/support/downloads">This page</a><a href="/other">Other</a>`
    expect(extractPageLinks(html, BASE)).toEqual(['https://example.com/other'])
  })

  it('treats a fragment on the current page as the current page', () => {
    const html = `<a href="/support/downloads#section">Jump</a>`
    expect(extractPageLinks(html, BASE)).toEqual([])
  })

  it('counts one page linked twice as one', () => {
    const html = `<a href="/a.html">A</a><a href="/a.html">A again</a>`
    expect(extractPageLinks(html, BASE)).toHaveLength(1)
  })

  it('survives a malformed href instead of throwing', () => {
    const html = `<a href="ht tp://broken">Broken</a><a href="/ok.html">Fine</a>`
    expect(extractPageLinks(html, BASE)).toEqual(['https://example.com/ok.html'])
  })
})

describe('document type inference', () => {
  it.each([
    ['Installation manual', 'INSTALL_MANUAL'],
    ["Owner's manual", 'USER_MANUAL'],
    ['User guide', 'USER_MANUAL'],
    ['Wiring diagram', 'WIRING_DIAGRAM'],
    ['Spare parts list', 'PARTS_LIST'],
    ['Remote programming instructions', 'PROGRAMMING_GUIDE'],
    ['Troubleshooting guide', 'TROUBLESHOOTING_GUIDE'],
    ['Error code reference', 'TROUBLESHOOTING_GUIDE'],
    ['Specification sheet', 'SPEC_SHEET'],
    ['Safety instructions', 'SAFETY_DOCUMENT'],
    ['Warranty terms', 'WARRANTY'],
    ['Declaration of conformity', 'DECLARATION_OF_CONFORMITY'],
    ['Quick start guide', 'QUICK_START'],
  ])('reads %s as %s', (text, kind) => {
    expect(inferKind(text, '')).toBe(kind)
  })

  it('prefers the more specific reading', () => {
    // Contains both "installation" and "operating". Installation wins,
    // because that is what the document is for.
    expect(inferKind('Installation and operating instructions', '')).toBe('INSTALL_MANUAL')
  })

  it('falls back to the file name when the link text says nothing', () => {
    expect(inferKind('Download', 'sd800-installation-manual.pdf')).toBe('INSTALL_MANUAL')
  })

  it('returns null rather than guessing a type it cannot see', () => {
    expect(inferKind('Download', 'document.pdf')).toBeNull()
  })
})

describe('model inference', () => {
  it('picks up a clear model code', () => {
    expect(inferModel('SD800 installation manual', '')).toBe('SD800')
    expect(inferModel('', 'installation_manual_sd800-v8-0820.pdf')).toBe('sd800')
  })

  it('handles a separated code', () => {
    expect(inferModel('MT-60 owner manual', '')).toBe('MT-60')
  })

  // The refusals matter more than the hits. A wrong model attribution
  // puts the wrong manual in front of someone working on a live door.
  it('refuses when there is nothing model-shaped', () => {
    expect(inferModel('Installation manual', 'manual.pdf')).toBeNull()
  })

  it('does not mistake a bare year for a model', () => {
    expect(inferModel('', '2024.pdf')).toBeNull()
  })

  it('does not invent a code from a single letter and digits', () => {
    expect(inferModel('A4 paper size guide', '')).toBeNull()
  })
})

describe('robots.txt', () => {
  it('collects the wildcard rules', () => {
    const body = `
User-agent: *
Disallow: /private/
Disallow: /admin
    `
    expect(parseRobots(body, 'DoorlinkDocHarvester/1.0')).toEqual(['/private/', '/admin'])
  })

  it('ignores rules aimed at a different agent', () => {
    const body = `
User-agent: SomeOtherBot
Disallow: /everything/
    `
    expect(parseRobots(body, 'DoorlinkDocHarvester/1.0')).toEqual([])
  })

  it('ignores comments and blank lines', () => {
    const body = `
# a comment
User-agent: *

Disallow: /x/   # trailing comment
    `
    expect(parseRobots(body, 'DoorlinkDocHarvester/1.0')).toEqual(['/x/'])
  })

  it('blocks a disallowed path', () => {
    expect(isDisallowed('https://example.com/private/a.pdf', ['/private/'])).toBe(true)
  })

  it('allows a path no rule covers', () => {
    expect(isDisallowed('https://example.com/public/a.pdf', ['/private/'])).toBe(false)
  })

  it('treats an empty ruleset as permitting', () => {
    expect(isDisallowed('https://example.com/a.pdf', [])).toBe(false)
  })
})

describe('stripTags', () => {
  it('collapses markup and whitespace', () => {
    expect(stripTags('<b>  Hello </b>\n<i>world</i>')).toBe('Hello world')
  })
})
