// Wires any <input type="file"> to /api/upload, writing the returned public URL
// into a sibling hidden input within the same .admin-field. Set data-kind on the
// file input ("artworks" | "artists" | "posts") to choose the storage prefix.
// Shows an instant local preview on select, and the current image on edit forms.
document.querySelectorAll<HTMLInputElement>('input[type=file]').forEach((input) => {
  const field = input.closest('.admin-field');
  if (!field) return;
  const hidden = field.querySelector<HTMLInputElement>('input[type=hidden]');
  const msg = field.querySelector('small');

  let preview = field.querySelector<HTMLDivElement>('.admin-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'admin-preview';
    preview.style.display = 'none';
    preview.innerHTML = '<img alt="preview" />';
    field.appendChild(preview);
  }
  const previewImg = preview.querySelector('img') as HTMLImageElement;

  // Show the existing image when editing (hidden input already holds a URL).
  if (hidden && hidden.value) {
    previewImg.src = hidden.value;
    preview.style.display = 'block';
  }

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    previewImg.src = URL.createObjectURL(file); // instant local preview
    preview!.style.display = 'block';
    if (msg) msg.textContent = 'Uploading…';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', input.dataset.kind ?? 'artworks');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) { if (msg) msg.textContent = 'Upload failed.'; return; }
      const { url } = await res.json();
      if (hidden) hidden.value = url;
      if (msg) msg.textContent = 'Uploaded ✓';
    } catch {
      if (msg) msg.textContent = 'Upload failed.';
    }
  });
});
