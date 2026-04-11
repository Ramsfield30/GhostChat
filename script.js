// Hash password using SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

// Generate random ghost code
function generateGhostCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'GHOST-'
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// Email validation
function validateEmail(email) {
    const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/
    return re.test(email)
}

// Password validation
function validatePassword(password) {
    return password.length >= 8
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

// Auto resize textarea
function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

// Sign up
async function signUp() {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const message = document.getElementById('message')

    if (!email || !password) { message.style.color = 'red'; message.textContent = 'Please fill all fields!'; return }
    if (!validateEmail(email)) { message.style.color = 'red'; message.textContent = '❌ Invalid email!'; return }
    if (!validatePassword(password)) { message.style.color = 'red'; message.textContent = '❌ Password must be 8+ characters!'; return }

    const { data: existingUser } = await db.from('users').select('email').eq('email', email).maybeSingle()
    if (existingUser) { message.style.color = 'red'; message.textContent = '❌ Email already registered!'; return }

    const ghostCode = generateGhostCode()
    const hashedPassword = await hashPassword(password)
    const { error } = await db.from('users').insert({ email, password: hashedPassword, code: ghostCode, created_at: new Date() })

    if (!error) {
        message.style.color = '#7c3aed'
        message.textContent = `✅ Account created! Your Ghost Code: ${ghostCode}`
        localStorage.setItem('ghostCode', ghostCode)
        localStorage.setItem('email', email)
        setTimeout(() => { window.location.href = 'chats.html' }, 3000)
    } else {
        message.style.color = 'red'
        message.textContent = '❌ Error: ' + error.message
    }
}

// Login
async function login() {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const message = document.getElementById('message')

    if (!email || !password) { message.style.color = 'red'; message.textContent = 'Please fill all fields!'; return }

    const hashedPassword = await hashPassword(password)
    const { data } = await db.from('users').select('*').eq('email', email).eq('password', hashedPassword).single()

    if (data) {
        await db.from('users').update({ last_login: new Date(), last_seen: new Date() }).eq('id', data.id)
        localStorage.setItem('ghostCode', data.code)
        localStorage.setItem('email', email)
        message.style.color = '#7c3aed'
        message.textContent = '✅ Login successful!'
        setTimeout(() => { window.location.href = 'chats.html' }, 1500)
    } else {
        message.style.color = 'red'
        message.textContent = '❌ Invalid email or password!'
    }
}

// Google Sign-in
async function signInWithGoogle() {
    const btn = document.getElementById('googleBtn')
    if (btn) {
        btn.innerHTML = '<span class="spinner"></span> Connecting...'
        btn.disabled = true
    }

    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://ghost-chat-one.vercel.app/auth-callback.html'
        }
    })

    if (error) {
        console.log('Google error:', error)
        if (btn) {
            btn.innerHTML = '<i class="fa-brands fa-google"></i> Continue with Google'
            btn.disabled = false
        }
    }
}

// Reset password
async function resetPassword() {
    const email = document.getElementById('resetEmail').value
    const message = document.getElementById('message')

    if (!email) { message.style.color = 'red'; message.textContent = 'Please enter your email!'; return }

    const { data: user } = await db.from('users').select('email').eq('email', email).maybeSingle()
    if (!user) { message.style.color = 'red'; message.textContent = '❌ Email not found!'; return }

    const tempPassword = Math.random().toString(36).slice(-8)
    const hashedTemp = await hashPassword(tempPassword)
    const { error } = await db.from('users').update({ password: hashedTemp }).eq('email', email)

    if (!error) {
        message.style.color = '#7c3aed'
        message.textContent = `✅ Temporary password: ${tempPassword} (copy this now!)`
    } else {
        message.style.color = 'red'
        message.textContent = '❌ Error resetting password!'
    }
}

// Update last seen
async function updateLastSeen() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) return
    await db.from('users').update({ last_seen: new Date() }).eq('code', myCode)
}

// Format last seen
function formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Never online'
    const diff = new Date() - new Date(lastSeen)
    if (diff < 30000) return '🟢 Online'
    if (diff < 60000) return 'Last seen just now'
    if (diff < 3600000) return 'Last seen ' + Math.floor(diff / 60000) + ' min ago'
    if (diff < 86400000) return 'Last seen ' + Math.floor(diff / 3600000) + ' hr ago'
    return 'Last seen ' + new Date(lastSeen).toLocaleDateString()
}

// Typing
let typingTimeout = null

async function setTyping(isTyping) {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode || !currentPartner) return
    await db.from('typing').upsert({
        sender_code: myCode,
        receiver_code: currentPartner,
        is_typing: isTyping,
        updated_at: new Date()
    }, { onConflict: 'sender_code,receiver_code' })
}

function onTyping() {
    setTyping(true)
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => setTyping(false), 2000)
}

async function checkTyping() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode || !currentPartner) return

    const { data } = await db.from('typing')
        .select('*')
        .eq('sender_code', currentPartner)
        .eq('receiver_code', myCode)
        .single()

    const statusEl = document.getElementById('connectionStatus')
    if (!statusEl) return

    if (data && data.is_typing) {
        const diff = new Date() - new Date(data.updated_at)
        if (diff < 3000) {
            statusEl.textContent = '✏️ typing...'
            statusEl.style.color = '#7c3aed'
            return
        }
    }

    const { data: partnerInfo } = await db.from('users')
        .select('last_seen')
        .eq('code', currentPartner)
        .single()

    statusEl.style.color = '#aaa'
    statusEl.textContent = currentPartner + ' — ' + (partnerInfo ? formatLastSeen(partnerInfo.last_seen) : '')
}

// Reply
let replyingTo = null

function replyTo(msgId, msgText, sender) {
    replyingTo = { id: msgId, text: msgText, sender }
    const replyBar = document.getElementById('replyBar')
    if (replyBar) {
        replyBar.style.display = 'flex'
        replyBar.innerHTML = `
            <div class="reply-preview">
                <span class="reply-sender">${sender}</span>
                <span class="reply-text">${msgText.substring(0, 60)}${msgText.length > 60 ? '...' : ''}</span>
            </div>
            <i class="fa-solid fa-xmark" onclick="cancelReply()"></i>
        `
    }
    document.getElementById('msgInput').focus()
}

function cancelReply() {
    replyingTo = null
    const replyBar = document.getElementById('replyBar')
    if (replyBar) replyBar.style.display = 'none'
}

// Swipe to reply
function addSwipeListeners() {
    const chatBox = document.getElementById('chatBox')
    if (!chatBox) return

    let startX = 0
    let target = null

    chatBox.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX
        target = e.target.closest('.msg-sent, .msg-received')
    }, { passive: true })

    chatBox.addEventListener('touchmove', (e) => {
        if (!target) return
        const diff = startX - e.touches[0].clientX
        if (diff > 0 && diff < 80) {
            target.style.transform = `translateX(-${diff}px)`
            target.style.transition = 'none'
        }
    }, { passive: true })

    chatBox.addEventListener('touchend', (e) => {
        if (!target) return
        const diff = startX - e.changedTouches[0].clientX
        if (diff > 50) {
            const msgId = target.dataset.id
            const msgText = target.querySelector('.msg-text').textContent
            const sender = target.querySelector('.msg-sender').textContent
            replyTo(msgId, msgText, sender)
        }
        target.style.transform = 'translateX(0)'
        target.style.transition = 'transform 0.2s ease'
        target = null
    })
}

// State
let currentPartner = null
let pollingInterval = null
let lastMessageCount = 0

// Show ghost code
async function showMyCode() {
    const code = localStorage.getItem('ghostCode')
    const el = document.getElementById('myCode')
    if (el && code) el.textContent = code

    const lastPartner = localStorage.getItem('lastPartner')
    if (lastPartner) {
        currentPartner = lastPartner
        const searchInput = document.getElementById('searchCode')
        if (searchInput) searchInput.value = lastPartner

        const { data: partnerInfo } = await db.from('users').select('last_seen').eq('code', lastPartner).single()
        const statusEl = document.getElementById('connectionStatus')
        if (statusEl) statusEl.textContent = lastPartner + ' — ' + (partnerInfo ? formatLastSeen(partnerInfo.last_seen) : 'Unknown')

        await loadMessages()
    }
}

// Notifications
async function requestNotifications() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported')
        return
    }
    if (Notification.permission === 'default') {
        await Notification.requestPermission()
    }
    console.log('Notification permission:', Notification.permission)
}

function showNotification(sender, msg) {
    try {
        if (Notification.permission === 'granted') {
            new Notification('👻 GhostChat', { body: `${sender}: ${msg}`, icon: '👻' })
        }
    } catch(e) {
        console.log('Notification error:', e)
    }
}

// Start chat
async function startChat() {
    const code = document.getElementById('searchCode').value.trim()
    if (!code) return

    const { data } = await db.from('users').select('*').eq('code', code).single()

    if (data) {
        currentPartner = code
        localStorage.setItem('lastPartner', code)
        lastMessageCount = 0
        const statusEl = document.getElementById('connectionStatus')
        if (statusEl) statusEl.textContent = code + ' — ' + formatLastSeen(data.last_seen)
        await loadMessages()
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

    const msgData = {
        sender_code: myCode,
        receiver_code: currentPartner,
        message: text,
        is_deleted: false,
        is_read: false
    }

    if (replyingTo) {
        msgData.reply_to = replyingTo.id
        msgData.reply_preview = replyingTo.text.substring(0, 100)
    }

    const { error } = await db.from('messages').insert(msgData)
    if (error) { console.log('Send error:', error); return }

    input.value = ''
    input.style.height = 'auto'
    cancelReply()
    setTyping(false)
    await loadMessages()
}

// Format message time
function formatMsgTime(timestamp) {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Load messages
async function loadMessages() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) return

    if (!currentPartner) {
        currentPartner = localStorage.getItem('lastPartner')
    }
    if (!currentPartner) return

    const { data, error } = await db
        .from('messages')
        .select('*')
        .or(`sender_code.eq.${myCode},receiver_code.eq.${myCode}`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

    if (error) { console.log('Load error:', error); return }

    const chatBox = document.getElementById('chatBox')
    if (!chatBox) return

    const filtered = (data || []).filter(msg =>
        (msg.sender_code === myCode && msg.receiver_code === currentPartner) ||
        (msg.sender_code === currentPartner && msg.receiver_code === myCode)
    )

    if (filtered.length === 0) {
        chatBox.innerHTML = '<p style="text-align:center;color:#555;padding:20px">No messages yet!</p>'
        return
    }

    if (filtered.length > lastMessageCount) {
        const newMsgs = filtered.slice(lastMessageCount)
        newMsgs.forEach(msg => {
            if (msg.receiver_code === myCode) showNotification(msg.sender_code, msg.message)
        })
    }
    lastMessageCount = filtered.length

    let html = ''
    filtered.forEach(msg => {
        const isMe = msg.sender_code === myCode
        const side = isMe ? 'msg-sent' : 'msg-received'
        const sender = isMe ? 'You' : msg.sender_code
        const replyHtml = msg.reply_preview ?
            `<div class="reply-quote">${msg.reply_preview}</div>` : ''
        const time = formatMsgTime(msg.created_at)

        html += `
            <div class="${side}" data-id="${msg.id}">
                <span class="msg-sender">${sender}</span>
                ${replyHtml}
                <span class="msg-text">${msg.message}</span>
                <span class="msg-time">${time}</span>
            </div>
        `
    })

    chatBox.innerHTML = html
    chatBox.scrollTop = chatBox.scrollHeight

    await db.from('messages')
        .update({ is_read: true })
        .eq('receiver_code', myCode)
        .eq('sender_code', currentPartner)
        .eq('is_read', false)

    if (localStorage.getItem('autoDelete') === 'true') {
        const myMsgs = filtered.filter(m => m.sender_code === myCode)
        const theirMsgs = filtered.filter(m => m.sender_code === currentPartner)
        if (myMsgs.length > 0 && theirMsgs.length > 0) {
            const lastTheirMsg = theirMsgs[theirMsgs.length - 1]
            const toDelete = myMsgs.filter(m => new Date(m.created_at) < new Date(lastTheirMsg.created_at))
            if (toDelete.length > 0) {
                await db.from('messages').update({ is_deleted: true }).in('id', toDelete.map(m => m.id))
            }
        }
    }
}

// Realtime subscription
function subscribeToMessages() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) return

    if (pollingInterval) clearInterval(pollingInterval)
    pollingInterval = setInterval(async () => {
        if (currentPartner) await checkTyping()
    }, 3000)

    db.channel('ghostchat-' + myCode)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            },
            async (payload) => {
                const msg = payload.new
                const myCode = localStorage.getItem('ghostCode')
                if (msg.sender_code === myCode || msg.receiver_code === myCode) {
                    if (!currentPartner) {
                        currentPartner = msg.sender_code === myCode ? msg.receiver_code : msg.sender_code
                        localStorage.setItem('lastPartner', currentPartner)
                    }
                    await loadMessages()
                    if (msg.receiver_code === myCode) showNotification(msg.sender_code, msg.message)
                }
            }
        )
        .subscribe((status) => {
            console.log('Realtime status:', status)
        })
}

// Settings
function loadSettings() {
    const autoDelete = localStorage.getItem('autoDelete') === 'true'
    const toggle = document.getElementById('autoDeleteToggle')
    if (toggle) toggle.checked = autoDelete
}

function saveSettings() {
    const toggle = document.getElementById('autoDeleteToggle')
    if (toggle) {
        localStorage.setItem('autoDelete', toggle.checked)
        const msg = document.getElementById('settingsMessage')
        if (msg) {
            msg.textContent = '✅ Settings saved!'
            setTimeout(() => msg.textContent = '', 2000)
        }
    }
}

function logout() {
    localStorage.clear()
    window.location.href = 'index.html'
}

// Load chats
async function loadChats() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) { window.location.href = 'login.html'; return }

    const codeBar = document.getElementById('myCodeBar')
    if (codeBar) codeBar.textContent = '👻 Your Code: ' + myCode

    const { data, error } = await db
        .from('messages')
        .select('*')
        .or(`sender_code.eq.${myCode},receiver_code.eq.${myCode}`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

    if (error) { console.log('Error:', error); return }

    const chatsList = document.getElementById('chatsList')
    if (!chatsList) return

    if (!data || data.length === 0) {
        chatsList.innerHTML = `
            <div class="no-chats">
                <i class="fa-solid fa-ghost"></i>
                No chats yet! Start a new chat 👆
            </div>
        `
        return
    }

    const partners = {}
    data.forEach(msg => {
        const partner = msg.sender_code === myCode ? msg.receiver_code : msg.sender_code
        if (!partners[partner]) {
            partners[partner] = { code: partner, lastMessage: msg.message, time: new Date(msg.created_at), unread: 0 }
        }
        if (msg.receiver_code === myCode && !msg.is_read) partners[partner].unread++
    })

    let html = ''
    Object.values(partners).forEach(partner => {
        html += `
            <div class="chat-item" data-code="${partner.code}" onclick="openChat('${partner.code}')">
                <div class="chat-avatar">👻</div>
                <div class="chat-info">
                    <div class="chat-name">${partner.code}</div>
                    <div class="chat-preview">${partner.lastMessage}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${formatTime(partner.time)}</div>
                    ${partner.unread > 0 ? `<div class="unread-badge">${partner.unread}</div>` : ''}
                </div>
            </div>
        `
    })
    chatsList.innerHTML = html
}

function formatTime(date) {
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString()
}

function openChat(code) {
    localStorage.setItem('lastPartner', code)
    window.location.href = 'chat.html'
}

function toggleSearch() {
    const bar = document.getElementById('searchBar')
    if (bar) bar.style.display = bar.style.display === 'none' ? 'block' : 'none'
}

function filterChats() {
    const query = document.getElementById('searchInput').value.toLowerCase()
    document.querySelectorAll('.chat-item').forEach(item => {
        item.style.display = item.dataset.code.toLowerCase().includes(query) ? 'flex' : 'none'
    })
}

window.addEventListener('beforeunload', () => {
    if (pollingInterval) clearInterval(pollingInterval)
    setTyping(false)
})

// Run on chat page
if (document.getElementById('chatBox')) {
    showMyCode()
    subscribeToMessages()
    requestNotifications()
    updateLastSeen()
    addSwipeListeners()
    setInterval(updateLastSeen, 30000)
    setInterval(checkTyping, 2000)
}

// Run on chats page
if (document.getElementById('chatsList')) {
    loadChats()
    updateLastSeen()
    setInterval(updateLastSeen, 30000)
    const chatsInterval = setInterval(loadChats, 5000)
    window.addEventListener('beforeunload', () => clearInterval(chatsInterval))
}

// Run on settings page
if (document.getElementById('autoDeleteToggle')) {
    loadSettings()
}