document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('rejectedBallotRows');
  const template = document.getElementById('rejectedBallotTemplate');
  const addButton = document.getElementById('addRejectedBallot');
  if (!container || !template || !addButton) return;

  let nextIndex = 0;

  function renumberRows() {
    Array.from(container.querySelectorAll('.rejected-ballot-row')).forEach((row, index) => {
      const marker = row.querySelector('.row-number');
      if (marker) marker.textContent = '#' + (index + 1);
    });
  }

  function addRejectedBallot() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = template.innerHTML.replace(/__index__/g, String(nextIndex));
    nextIndex += 1;
    const row = wrapper.firstElementChild;
    container.appendChild(row);
    renumberRows();
    const select = row.querySelector('select');
    if (select) select.focus();
  }

  addButton.addEventListener('click', addRejectedBallot);
  container.addEventListener('click', (event) => {
    if (!event.target.classList.contains('remove-rejected-ballot')) return;
    event.target.closest('.rejected-ballot-row').remove();
    renumberRows();
  });
});
