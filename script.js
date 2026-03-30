// Generate random ghost code
function generateGhostCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'GHOST-'
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// Toggle password visibility
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId)
    if (input.type === 'password') {
        input.type = 'text'
        icon.classList.replace('fa-eye', 'fa-eye-slash')
    } else {
        input.type = 'password'
        icon.classList.replace('fa-eye-slash', 'fa-eye')
    }
}

// Sign up function
async function signUp() {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const message = document.getElementById('message')

    if (!email || !password) {
        message.style.color = 'red'
        message.textContent = 'Please fill all fields!'
        return
    }

    const ghostCode = generateGhostCode()

    const { error } = await db
        .from('users')
        .insert({
            email: email,
            password: password,
            code: ghostCode
        })

    if (!error) {
        message.style.color = '#7c3aed'
        message.textContent = `✅ Account created! Your Ghost Code: ${ghostCode}`
        localStorage.setItem('ghostCode', ghostCode)
        localStorage.setItem('email', email)
        setTimeout(() => {
            window.location.href = 'chat.html'
        }, 3000)
    } else {
        message.style.color = 'red'
        message.textContent = '❌ Error: ' + error.message
    }
}

// Login function
async function login() {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const message = document.getElementById('message')

    if (!email || !password) {
        message.style.color = 'red'
        message.textContent = 'Please fill all fields!'
        return
    }

    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single()

    if (data) {
        localStorage.setItem('ghostCode', data.code)
        localStorage.setItem('email', email)
        message.style.color = '#7c3aed'
        message.textContent = '✅ Login successful!'
        setTimeout(() => {
            window.location.href = 'chat.html'
        }, 1500)
    } else {
        message.style.color = 'red'
        message.textContent = '❌ Invalid email or password!'
    }
}

// Current chat partner
let currentPartner = null

// Show ghost code in header
function showMyCode() {
    const code = localStorage.getItem('ghostCode')
    const el = document.getElementById('myCode')
    if (el && code) el.textContent = 'Your Code: ' + code

    const lastPartner = localStorage.getItem('lastPartner')
    if (lastPartner) {
        currentPartner = lastPartner
        document.getElementById('searchCode').value = lastPartner
        document.getElementById('connectionStatus').textContent = '🟢 Connected to ' + lastPartner
        loadMessages()
    }
}

// Request notification permission
async function requestNotifications() {
    if ('Notification' in window) {
        await Notification.requestPermission()
    }
}

// Show notification
function showNotification(sender, msg) {
    if (Notification.permission === 'granted') {
        new Notification('👻 GhostChat', {
            body: `${sender}: ${msg}`,
            icon: '👻'
        })
    }
}

// Start chat with another ghost
async function startChat() {
    const code = document.getElementById('searchCode').value.trim()
    if (!code) return

    const { data } = await db
        .from('users')
        .select('*')
        .eq('code', code)
        .single()

    if (data) {
        currentPartner = code
        localStorage.setItem('lastPartner', code)
        document.getElementById('chatBox').innerHTML = ''
        document.getElementById('connectionStatus').textContent = '🟢 Connected to ' + code
        loadMessages()
    } else {
        alert('Ghost Code not found!')
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('msgInput')
    const text = input.value.trim()
    if (!text || !currentPartner) return

    const myCode = localStorage.getItem('ghostCode')

    const { error } = await db.from('messages').insert({
        sender_code: myCode,
        receiver_code: currentPartner,
        message: text,
        is_deleted: false
    })

    if (error) {
        console.log('Send error:', error)
        return
    }

    input.value = ''
    loadMessages()
}

// Track last message count for notifications
let lastMessageCount = 0

// Load messages
async function loadMessages() {
    const myCode = localStorage.getItem('ghostCode')
    if (!currentPartner || !myCode) return

    const { data, error } = await db
        .from('messages')
        .select('*')
        .or(`sender_code.eq.${myCode},sender_code.eq.${currentPartner}`)
        .or(`receiver_code.eq.${myCode},receiver_code.eq.${currentPartner}`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

    if (error) {
        console.log('Load error:', error)
        return
    }

    if (!data || data.length === 0) {
        document.getElementById('chatBox').innerHTML = '<p style="text-align:center;color:#555;padding:20px">No messages yet!</p>'
        return
    }

    const chatBox = document.getElementById('chatBox')
    chatBox.innerHTML = ''

    data.forEach(msg => {
        const div = document.createElement('div')
        div.classList.add(msg.sender_code === myCode ? 'msg-sent' : 'msg-received')
        div.innerHTML = `<span class="msg-sender">${msg.sender_code === myCode ? 'You' : msg.sender_code}</span>${msg.message}`
        chatBox.appendChild(div)
    })

    chatBox.scrollTop = chatBox.scrollHeight
}


// Poll for new messages every 2 seconds
function subscribeToMessages() {
    console.log('Polling started!')
    setInterval(async () => {
        if (currentPartner) {
            await loadMessages()
        }
    }, 2000)
}

// Run on chat page
if (document.getElementById('chatBox')) {
    showMyCode()
    subscribeToMessages()
    requestNotifications()
}
// Load chats list
async function loadChats() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) {
        window.location.href = 'login.html'
        return
    }

    // Show my code
    const codeBar = document.getElementById('myCodeBar')
    if (codeBar) codeBar.textContent = '👻 Your Code: ' + myCode

    const { data, error } = await db
        .from('messages')
        .select('*')
        .or(`sender_code.eq.${myCode},receiver_code.eq.${myCode}`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.log('Error:', error)
        return
    }

    const chatsList = document.getElementById('chatsList')

    if (!data || data.length === 0) {
        chatsList.innerHTML = `
            <div class="no-chats">
                <i class="fa-solid fa-ghost"></i>
                No chats yet! Start a new chat 👆
            </div>
        `
        return
    }

    // Get unique chat partners
    const partners = {}
    data.forEach(msg => {
        const partner = msg.sender_code === myCode ? msg.receiver_code : msg.sender_code
        if (!partners[partner]) {
            partners[partner] = {
                code: partner,
                lastMessage: msg.message,
                time: new Date(msg.created_at)
            }
        }
    })

    chatsList.innerHTML = ''
    Object.values(partners).forEach(partner => {
        const item = document.createElement('div')
        item.classList.add('chat-item')
        item.dataset.code = partner.code
        item.innerHTML = `
            <div class="chat-avatar">👻</div>
            <div class="chat-info">
                <div class="chat-name">${partner.code}</div>
                <div class="chat-preview">${partner.lastMessage}</div>
            </div>
            <div class="chat-time">${formatTime(partner.time)}</div>
        `
        item.onclick = () => openChat(partner.code)
        chatsList.appendChild(item)
    })
}

// Format time
function formatTime(date) {
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString()
}

// Open chat with partner
function openChat(code) {
    localStorage.setItem('lastPartner', code)
    window.location.href = 'chat.html'
}

// Toggle search bar
function toggleSearch() {
    const bar = document.getElementById('searchBar')
    bar.style.display = bar.style.display === 'none' ? 'block' : 'none'
}

// Filter chats
function filterChats() {
    const query = document.getElementById('searchInput').value.toLowerCase()
    const items = document.querySelectorAll('.chat-item')
    items.forEach(item => {
        item.style.display = item.dataset.code.toLowerCase().includes(query) ? 'flex' : 'none'
    })
}

// Run on chats page
if (document.getElementById('chatsList')) {
    loadChats()
    setInterval(loadChats, 5000)
}
