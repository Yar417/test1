document.addEventListener('DOMContentLoaded', async () => {
  const { ChatWindow } = await import('https://yar417.github.io/test1/scripts/chatWindow.js');
  new ChatWindow();
});
