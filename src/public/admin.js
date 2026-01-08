const buttons = document.querySelectorAll("[data-copy-link]");

const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
};

buttons.forEach((button) => {
  button.addEventListener("click", async () => {
    const link = button.getAttribute("data-copy-link");
    if (!link) {
      return;
    }
    const ok = await copyText(link);
    const label = ok ? "Copied" : "Copy failed";
    button.textContent = label;
    setTimeout(() => {
      button.textContent = "Copy link";
    }, 2000);
  });
});
