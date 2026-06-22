// Builds the redirect targets used by admin save/delete handlers so success and
// failure are both visible to the user (no more silent false "Saved").
export type OkFlag = 'saved' | 'deleted' | 'updated';

export function okRedirect(base: string, flag: OkFlag = 'saved'): string {
  return `${base}?${flag}=1`;
}

export function errRedirect(base: string, message: string): string {
  return `${base}?error=${encodeURIComponent(message)}`;
}
