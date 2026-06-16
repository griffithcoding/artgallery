// Wires any <input type="file"> to /api/upload, writing the returned public URL
// into a sibling hidden input within the same .admin-field. Set data-kind on the
// file input ("artworks" | "artists" | "posts") to choose the storage prefix.
document.querySelectorAll<HTMLInputElement>('input[type=file]').forEach((input) => {
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const field = input.closest('.admin-field');
    if (!field) return;
    const hidden = field.querySelector<HTMLInputElement>('input[type=hidden]');
    const msg = field.querySelector('small');
    if (msg) msg.textContent = 'Uploading…';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', input.dataset.kind ?? 'artworks');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      if (msg) msg.textContent = 'Upload failed.';
      return;
    }
    const { url } = await res.json();
    if (hidden) hidden.value = url;
    if (msg) msg.innerHTML = `Uploaded. <a href="${url}" target="_blank" style="color:#cfc9b8;">view</a>`;
  });
});
