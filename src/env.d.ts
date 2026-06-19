/// <reference types="astro/client" />
declare namespace App {
  // Single admin role — the gallery owner. (The artist/creator portal was removed.)
  type Role = 'super_admin';
  interface Locals {
    user?: { id: string; email: string; role: Role };
  }
}
