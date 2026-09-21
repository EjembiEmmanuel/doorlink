import { describe, expect, it } from 'vitest'
import { DocumentOrigin, DocumentRights, Region, VerificationState } from '@prisma/client'
import {
  aliasSpellings,
  isConfidentMatch,
  matchModel,
  normaliseLoose,
  normaliseModel,
  segments,
} from './normalise'
import { rankDocuments, scoreDocument, type RankableDocument } from './ranking'
import { isConfirmedOfficial, manualAccess } from '../manual-access'

function doc(overrides: Partial<RankableDocument> & { id: string }): RankableDocument {
  return {
    title: 'Installation manual',
    kind: 'INSTALL_MANUAL',
    modelCode: null,
    modelName: null,
    manufacturerName: null,
    categoryName: null,
    aliasNormalised: [],
    origin: DocumentOrigin.UNKNOWN,
    verification: VerificationState.UNVERIFIED,
    region: Region.UNKNOWN,
    searchText: null,
    ...overrides,
  }
}

describe('model number normalisation', () => {
  it('collapses the separators manufacturers disagree about', () => {
    for (const written of ['MT60', 'MT-60', 'MT 60', 'mt60', 'mt-60', ' MT 60 ']) {
      expect(normaliseModel(written)).toBe('mt60')
    }
  })

  it('keeps a slash, which is a real distinction not a separator', () => {
    expect(normaliseModel('MT60/2')).not.toBe(normaliseModel('MT602'))
    // The looser form is available when a caller explicitly wants it.
    expect(normaliseLoose('MT60/2')).toBe('mt602')
  })

  it('splits letter and digit runs', () => {
    expect(segments('MT60')).toEqual(['mt', '60'])
    expect(segments('CAD-4')).toEqual(['cad', '4'])
    expect(segments('SD800')).toEqual(['sd', '800'])
  })
})

describe('alias spellings', () => {
  it('generates the forms a person might type', () => {
    const spellings = aliasSpellings('MT60')
    expect(spellings).toContain('MT60')
    expect(spellings).toContain('MT-60')
    expect(spellings).toContain('MT 60')
    expect(spellings).toContain('mt60')
  })

  it('always keeps the manufacturer original', () => {
    expect(aliasSpellings('Roll-A-Pro')).toContain('Roll-A-Pro')
  })

  it('does not invent variants for a code with no structure', () => {
    // Nothing to split, so nothing to respell.
    expect(aliasSpellings('X').filter((s) => s.includes('-'))).toEqual([])
  })
})

describe('match classification', () => {
  it('reports an exact match on what the manufacturer printed', () => {
    expect(matchModel('MT60', 'MT60')).toBe('exact')
  })

  it('reports a separator difference as normalised, not exact', () => {
    expect(matchModel('mt-60', 'MT60')).toBe('normalised')
  })

  it('treats a prefix as a suggestion', () => {
    expect(matchModel('MT6', 'MT60')).toBe('prefix')
    expect(isConfidentMatch('prefix')).toBe(false)
  })

  it('refuses to prefix-match on a query too short to mean anything', () => {
    // "M" must not claim every Merlin model.
    expect(matchModel('M', 'MT60')).toBe('none')
    expect(matchModel('MT', 'MT60')).toBe('none')
  })

  it('only exact and normalised are stated as fact', () => {
    expect(isConfidentMatch('exact')).toBe(true)
    expect(isConfidentMatch('normalised')).toBe(true)
    expect(isConfidentMatch('contains')).toBe(false)
    expect(isConfidentMatch('none')).toBe(false)
  })

  it('ignores an empty query', () => {
    expect(matchModel('   ', 'MT60')).toBe('none')
  })
})

describe('search ranking', () => {
  const context = { query: 'MT60' }

  it('puts the exact model above everything else', () => {
    const results = rankDocuments(
      [
        doc({ id: 'manufacturer', manufacturerName: 'Merlin MT60 Group' }),
        doc({ id: 'body', searchText: 'see also MT60' }),
        doc({ id: 'exact', modelCode: 'MT60' }),
        doc({ id: 'partial', modelCode: 'MT600' }),
      ],
      context
    )
    expect(results[0].document.id).toBe('exact')
    expect(results[0].reason).toBe('exact-model')
  })

  it('ranks a known alias above a partial model match', () => {
    const results = rankDocuments(
      [
        doc({ id: 'partial', modelCode: 'MT600' }),
        doc({ id: 'alias', modelCode: 'Merlin Professional', aliasNormalised: ['mt60'] }),
      ],
      context
    )
    expect(results[0].document.id).toBe('alias')
    expect(results[0].reason).toBe('model-alias')
  })

  it('ranks document body text last', () => {
    const results = rankDocuments(
      [
        doc({ id: 'body', searchText: 'MT60 appears on page 30' }),
        doc({ id: 'category', categoryName: 'MT60 openers' }),
      ],
      context
    )
    expect(results[0].document.id).toBe('category')
    expect(results[1].reason).toBe('document-text')
  })

  it('prefers the official document over a mirror of the same model', () => {
    const results = rankDocuments(
      [
        doc({ id: 'mirror', modelCode: 'MT60', origin: DocumentOrigin.THIRD_PARTY_GUIDE }),
        doc({
          id: 'official',
          modelCode: 'MT60',
          origin: DocumentOrigin.MANUFACTURER_ORIGINAL,
          verification: VerificationState.REACHABLE,
        }),
      ],
      context
    )
    expect(results[0].document.id).toBe('official')
  })

  it('prefers the Australian document for an Australian reader', () => {
    const results = rankDocuments(
      [
        doc({ id: 'us', modelCode: 'MT60', region: Region.US }),
        doc({ id: 'au', modelCode: 'MT60', region: Region.AU }),
      ],
      { query: 'MT60', preferRegion: Region.AU }
    )
    expect(results[0].document.id).toBe('au')
  })

  it('never lets provenance lift a weak match over a strong one', () => {
    // The whole point of the tier gaps: an official, verified, Australian
    // keyword hit still loses to a plain exact model match.
    const results = rankDocuments(
      [
        doc({
          id: 'decorated-body',
          searchText: 'MT60',
          origin: DocumentOrigin.MANUFACTURER_ORIGINAL,
          verification: VerificationState.REACHABLE,
          region: Region.AU,
        }),
        doc({ id: 'plain-exact', modelCode: 'MT60' }),
      ],
      { query: 'MT60', preferRegion: Region.AU }
    )
    expect(results[0].document.id).toBe('plain-exact')
  })

  it('drops documents that match nothing', () => {
    expect(rankDocuments([doc({ id: 'unrelated', title: 'Gate hinge kit' })], context)).toEqual([])
  })

  it('returns nothing for an empty query rather than everything', () => {
    expect(scoreDocument(doc({ id: 'a', modelCode: 'MT60' }), { query: '  ' })).toBeNull()
  })
})

describe('how a document may be opened', () => {
  const base = {
    fileKey: null,
    sourceUrl: null,
    rights: DocumentRights.LINK_ONLY,
    verification: VerificationState.UNVERIFIED,
  }

  it('links to the publisher when rights are link-only', () => {
    const access = manualAccess({ ...base, sourceUrl: 'https://example.com/m.pdf' })
    expect(access).toEqual({ mode: 'link', url: 'https://example.com/m.pdf', external: true })
  })

  it('never serves a stored file it has no right to redistribute', () => {
    // A file present with LINK_ONLY rights is not a licence to serve it.
    const access = manualAccess({
      ...base,
      fileKey: 'manuals/x.pdf',
      sourceUrl: 'https://example.com/m.pdf',
      rights: DocumentRights.LINK_ONLY,
    })
    expect(access.mode).toBe('link')
  })

  it('says so plainly when a document is behind a login', () => {
    const access = manualAccess({
      ...base,
      sourceUrl: 'https://portal.example.com/m.pdf',
      verification: VerificationState.RESTRICTED,
    })
    expect(access.mode).toBe('restricted')
  })

  it('does not offer a link already known to be dead', () => {
    const access = manualAccess({
      ...base,
      sourceUrl: 'https://example.com/gone.pdf',
      verification: VerificationState.BROKEN,
    })
    expect(access).toEqual({ mode: 'unavailable', reason: 'link-broken' })
  })

  it('reports a record with no source at all', () => {
    expect(manualAccess(base)).toEqual({ mode: 'unavailable', reason: 'no-source' })
  })
})

describe('official badge', () => {
  it('needs both an official origin and a confirmed link', () => {
    expect(
      isConfirmedOfficial({
        origin: 'MANUFACTURER_ORIGINAL',
        verification: VerificationState.REACHABLE,
      })
    ).toBe(true)
  })

  it('withholds the badge from an unverified record on an official domain', () => {
    expect(
      isConfirmedOfficial({
        origin: 'MANUFACTURER_ORIGINAL',
        verification: VerificationState.UNVERIFIED,
      })
    ).toBe(false)
  })

  it('never calls a third-party mirror official', () => {
    expect(
      isConfirmedOfficial({
        origin: 'THIRD_PARTY_GUIDE',
        verification: VerificationState.REACHABLE,
      })
    ).toBe(false)
  })
})
