import { describe, it, expect } from 'vitest';
import { okRedirect, errRedirect } from './adminResult';

describe('adminResult', () => {
  it('okRedirect defaults to ?saved=1', () => {
    expect(okRedirect('/admin/artists')).toBe('/admin/artists?saved=1');
  });
  it('okRedirect supports deleted/updated flags', () => {
    expect(okRedirect('/admin/fairs', 'deleted')).toBe('/admin/fairs?deleted=1');
    expect(okRedirect('/admin/inquiries', 'updated')).toBe('/admin/inquiries?updated=1');
  });
  it('errRedirect URL-encodes the message', () => {
    expect(errRedirect('/admin/artists', 'Save failed: bad UUID & null'))
      .toBe('/admin/artists?error=Save%20failed%3A%20bad%20UUID%20%26%20null');
  });
});
