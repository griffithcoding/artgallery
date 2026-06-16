/// <reference types="astro/client" />
declare namespace App {
  type Role = 'super_admin' | 'creator' | 'contributor';
  interface Locals {
    user?: { id: string; email: string; role: Role };
  }
}
