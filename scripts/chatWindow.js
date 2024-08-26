export class ChatWindow {
  constructor() {
    this.minimizedWindow = document.getElementById('connect-button');
    this.expandedWindow = document.getElementById('expandedWindow');
    this.closeButton = document.getElementById('destroy-button');
    this.microphoneButton = document.getElementById('microphone-button');
    this.sendButton = document.getElementById('send-button');
    this.textArea = document.getElementById('textArea');
    this.msgHistory = document.getElementById('msgHistory');
    this.charLimit = 200;

    this.init();
  }

  init() {
    // Анимация появления свернутого окна
    setTimeout(() => {
      this.minimizedWindow.style.animationPlayState = 'running';
    }, 2000);

    // Разворачивание окна при нажатии на свернутое окно
    this.minimizedWindow.addEventListener('click', this.expandWindow.bind(this));

    // Сворачивание окна при нажатии на кнопку закрытия
    this.closeButton.addEventListener('click', this.collapseWindow.bind(this));

    // Отслеживание изменений в текстовом поле для отображения кнопки отправки
    this.textArea.addEventListener('input', this.toggleSendButton.bind(this));

    // Обработчик нажатия клавиши Enter для отправки сообщения
    this.textArea.addEventListener('keypress', this.handleEnterPress.bind(this));

    // Обработчик нажатия кнопки отправки
    this.sendButton.addEventListener('click', this.sendMessage.bind(this));

    // Обработчик кнопки микрофона
    this.microphoneButton.addEventListener('click', this.activateMicrophone.bind(this));

    // Обработчик прокрутки
    this.msgHistory.addEventListener('scroll', this.updateFadeOut.bind(this));

    // Начальное обновление состояния
    this.updateFadeOut();
  }

  expandWindow() {
    this.minimizedWindow.style.display = 'none';
    this.expandedWindow.style.display = 'flex';
  }

  collapseWindow() {
    this.expandedWindow.style.display = 'none';
    this.minimizedWindow.style.display = 'block';
  }

  toggleSendButton() {
    if (this.textArea.value.trim() !== '') {
      this.sendButton.style.display = 'flex';
      this.microphoneButton.style.display = 'none';
    } else {
      this.sendButton.style.display = 'none';
      this.microphoneButton.style.display = 'flex';
    }

    if (this.textArea.value.length > this.charLimit) {
      this.textArea.classList.add('chat-container__textarea--error');
      this.sendButton.disabled = true; // Блокируем кнопку отправки
    } else {
      this.textArea.classList.remove('chat-container__textarea--error');
      this.sendButton.disabled = false; // Разблокируем кнопку отправки
    }
  }

  handleEnterPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Предотвратить переход на новую строку
      this.sendMessage();
    }
  }

  async sendMessage() {
    if (this.textArea.value.trim() === '' || this.textArea.value.length > this.charLimit) return;

    // Добавляем сообщение пользователя в историю сообщений
    const userMessage = `<div class="message user">${this.textArea.value}</div>`;
    this.msgHistory.innerHTML = userMessage + this.msgHistory.innerHTML;

    const systemMessage = `<div class="message system">Это ответ от системы на ваше сообщение. Это ответ от системы на ваше сообщение. Это ответ от системы на ваше сообщение. Это ответ от системы на ваше сообщение. Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.Это ответ от системы на ваше сообщение.</div>`;
    this.msgHistory.innerHTML = systemMessage + this.msgHistory.innerHTML;

    this.msgHistory.scrollTop = this.msgHistory.scrollHeight; // Прокрутка вниз для отображения нового сообщения

    const txtAreaValue = this.textArea.value;
    this.textArea.value = ''; // Очищаем текстовое поле
    this.sendButton.style.display = 'none'; // Скрываем кнопку отправки
    this.microphoneButton.style.display = 'flex'; // Показываем кнопку микрофона

    // Отправляем сообщение на сервер
    const playResponse = await fetchWithRetries(`${API_KEY.url}/agents/${agentId}/chat/${chatId}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_KEY.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        streamId: streamId,
        sessionId: sessionId,
        messages: [
          {
            role: 'user',
            content: txtAreaValue,
            created_at: new Date().toString(),
          },
        ],
      }),
    });

    const playResponseData = await playResponse.json();
    if (playResponse.status === 200 && playResponseData.chatMode === 'TextOnly') {
      const systemReply = `<div class="message system">${playResponseData.result}</div>`;
      this.msgHistory.innerHTML = systemReply + this.msgHistory.innerHTML;
      this.msgHistory.scrollTop = this.msgHistory.scrollHeight; // Прокрутка вниз
    }
  }

  activateMicrophone() {
    destroyConnection();
    // Логика для активации микрофона
  }

  updateFadeOut() {
    const messages = this.msgHistory.querySelectorAll('.message');
    const fadeStart = 50; // Начало зоны плавного исчезновения
    const fadeEnd = 200; // Конец зоны плавного исчезновения

    messages.forEach((message) => {
      const rect = message.getBoundingClientRect();
      const containerRect = this.msgHistory.getBoundingClientRect();

      if (rect.bottom > containerRect.bottom - fadeStart) {
        message.style.opacity = '1';
      } else if (rect.bottom < containerRect.bottom - fadeEnd) {
        message.style.opacity = '0.1';
      } else {
        const opacity = 0.1 + ((rect.bottom - containerRect.bottom + fadeEnd) / (fadeEnd - fadeStart)) * (1 - 0.1);
        message.style.opacity = opacity.toString();
      }
    });
  }
}
