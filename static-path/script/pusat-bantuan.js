document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');
    const chatForm = document.getElementById('chat-form');
    const ticketId = window.location.pathname.split('/').pop();

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text === '') return;

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'admin');
       // <div class="avatar">A</div>
        messageElement.innerHTML = `
            
            <div class="text">${text}</div>
        `;
        chatMessages.appendChild(messageElement);
        messageInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Send message to server
        fetch(`/send-message?ticketId=${ticketId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });
    }

    function sendPhoto() {
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('photo', file);

        fetch(`/send-photo?ticketId=${ticketId}`, {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', 'admin');
            //<div class="avatar">A</div>
            messageElement.innerHTML = `
                
                <img src="${data.photoPath}" class="photo" alt="photo">
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        })
        .catch(error => console.error('Error uploading photo:', error));
    }

    document.querySelector('.chat-input button').addEventListener('click', sendMessage);
    document.getElementById('file-input').addEventListener('change', sendPhoto);
});