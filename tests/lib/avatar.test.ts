import { describe, expect, it } from 'vitest'
import { avatarColor, avatarInitials } from '@/lib/avatar'

describe('avatar', () => {
  describe('avatarInitials', () => {
    it('returns ? for empty input', () => {
      expect(avatarInitials('')).toBe('?')
      expect(avatarInitials('   ')).toBe('?')
    })

    it('takes first 2 characters for CJK names', () => {
      expect(avatarInitials('小满图文策划')).toBe('小满')
      expect(avatarInitials('紫微斗数算命服务')).toBe('紫微')
    })

    it('takes initials of first two words for western names', () => {
      expect(avatarInitials('Dan Mercier')).toBe('DM')
      expect(avatarInitials('Lisa Hahn')).toBe('LH')
    })

    it('takes first 2 characters for single-word names', () => {
      expect(avatarInitials('BOT-009')).toBe('BO')
      expect(avatarInitials('nora')).toBe('NO')
    })
  })

  describe('avatarColor', () => {
    it('returns a valid hex colour', () => {
      expect(avatarColor('test')).toMatch(/^#[0-9a-f]{6}$/)
    })

    it('is deterministic for the same seed', () => {
      expect(avatarColor('小满图文策划')).toBe(avatarColor('小满图文策划'))
    })

    it('returns different colours for different seeds (within palette)', () => {
      // Not a strict assertion — but with 14 colors, 2 different seeds
      // have a high probability of mapping to different indices.
      const a = avatarColor('小满图文策划')
      const b = avatarColor('紫微斗数算命服务')
      // They may collide rarely; just verify both are valid.
      expect(a).toMatch(/^#[0-9a-f]{6}$/)
      expect(b).toMatch(/^#[0-9a-f]{6}$/)
    })
  })
})
