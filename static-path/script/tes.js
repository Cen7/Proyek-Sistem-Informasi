document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text === '') return;

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'admin');
        messageElement.innerHTML = `
            <div class="avatar">A</div>
            <div class="text">${text}</div>
        `;
        chatMessages.appendChild(messageElement);
        messageInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendPhoto() {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', 'admin');
            messageElement.innerHTML = `
                <div class="avatar">A</div>
                <img src="${e.target.result}" class="photo" alt="photo">
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        reader.readAsDataURL(file);
    }

    // Example function to load initial chat
    function loadChat() {
        const messages = [
            { sender: 'user', text: 'Terjadi bug saat aplikasi dijalankan' },
            { sender: 'admin', text: 'Terima kasih, kami akan periksa' },
            { sender: 'user', text: 'Kapan kira-kira bisa diperbaiki?' },
            { sender: 'admin', text: 'Kami akan mencoba memperbaikinya dalam 2-3 hari ke depan' },
            { sender: 'user', photo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiZ_GsnkMqJBt47-IOALpancTcJR2xS0WtzQ&s' },
            { sender: 'admin', photo: 'path/to/photo2.jpg' }
          
        ];
        messages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', msg.sender);
            if (msg.text) {
                messageElement.innerHTML = `
                    <div class="avatar">${msg.sender === 'user' ? 'U' : 'A'}</div>
                    <div class="text">${msg.text}</div>
                `;
            } else if (msg.photo) {
                messageElement.innerHTML = `
                    <div class="avatar">${msg.sender === 'user' ? 'U' : 'A'}</div>
                    <img src="${msg.photo}" class="photo" alt="photo">
                `;
            }
            chatMessages.appendChild(messageElement);
        });
    }

    // Load chat on page load
    loadChat();

    document.querySelector('.chat-input button').addEventListener('click', sendMessage);
    document.getElementById('file-input').addEventListener('change', sendPhoto);
});
