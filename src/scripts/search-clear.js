// The themed clear button on the search field: empty it, tell search.js (it listens for input) so the empty state returns, and refocus.
const q = document.querySelector('#q');
document.querySelector('.ask-clear')?.addEventListener('click', () => {
  q.value = '';
  q.dispatchEvent(new Event('input', { bubbles: true }));
  q.focus();
});
