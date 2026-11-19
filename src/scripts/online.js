// The offline line in the frame (Base.astro): shown with words only while the device is offline, hidden and empty otherwise.
const note = document.getElementById('offline');
const show = () => {
  const off = !navigator.onLine;
  note.textContent = off ? 'You are offline. Pages you have opened still work, and ticks are saved on this device.' : '';
  note.hidden = !off;
};
addEventListener('online', show);
addEventListener('offline', show);
show();
