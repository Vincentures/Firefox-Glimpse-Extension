const LABELS = { alt: "Alt", ctrl: "Ctrl", shift: "Shift" };
const buttons = [...document.querySelectorAll("#modifier-picker button")];
const hintKey = document.getElementById("hint-key");

function render(mod) {
  for (const btn of buttons) {
    btn.classList.toggle("active", btn.dataset.mod === mod);
  }
  hintKey.textContent = LABELS[mod];
}

browser.storage.local.get({ glimpseModifier: "alt" }).then((res) => {
  render(res.glimpseModifier);
});

for (const btn of buttons) {
  btn.addEventListener("click", () => {
    browser.storage.local.set({ glimpseModifier: btn.dataset.mod });
    render(btn.dataset.mod);
  });
}
