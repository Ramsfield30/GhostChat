// Generate random ghost code
function generateGhostCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'GHOST-'
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// Email validation helper
function validateEmail(email) {
    const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/
    return re.test(email)
}

// Password validation helper
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

    if (!validateEmail(email)) {
        message.style.color = 'red'
        message.textContent = '❌ Please enter a valid email address (example@email.com)!'
        return
    }

    if (!validatePassword(password)) {
        message.style.color = 'red'
        message.textContent = '❌ Password must be at least 8 characters long!'
        return
    }

    const { data: existingUser } = await db
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle()

    if (existingUser) {
        message.style.color = 'red'
        message.textContent = '❌ This email is already registered! Please login instead.'
        return
    }

    const ghostCode = generateGhostCode()

    const { error } = await db
        .from('users')
        .insert({
            email: email,
            password: password,
            code: ghostCode,
            created_at: new Date()
        })

    if (!error) {
        message.style.color = '#7c3aed'
        message.textContent = `✅ Account created! Your Ghost Code: ${ghostCode}`
        localStorage.setItem('ghostCode', ghostCode)
        localStorage.setItem('email', email)
        setTimeout(() => {
            window.location.href = 'chats.html'
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
        await db.from('users')
            .update({ last_login: new Date(), last_seen: new Date() })
            .eq('id', data.id)

        localStorage.setItem('ghostCode', data.code)
        localStorage.setItem('email', email)
        message.style.color = '#7c3aed'
        message.textContent = '✅ Login successful!'
        setTimeout(() => {
            window.location.href = 'chats.html'
        }, 1500)
    } else {
        message.style.color = 'red'
        message.textContent = '❌ Invalid email or password!'
    }
}

// Forgot password function
async function resetPassword() {
    const email = document.getElementById('resetEmail').value
    const message = document.getElementById('message')

    if (!email) {
        message.style.color = 'red'
        message.textContent = 'Please enter your email!'
        return
    }

    const { data: user } = await db
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle()

    if (!user) {
        message.style.color = 'red'
        message.textContent = '❌ Email not found!'
        return
    }

    const tempPassword = Math.random().toString(36).slice(-8)

    const { error: updateError } = await db
        .from('users')
        .update({ password: tempPassword })
        .eq('email', email)

    if (!updateError) {
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

// More detailed last seen with exact time for recent activity
function formatLastSeenDetailed(lastSeen) {
    if (!lastSeen) return 'Last seen: Recently'
    
    const lastSeenDate = new Date(lastSeen)
    const now = new Date()
    const diff = now - lastSeenDate
    const timeString = lastSeenDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: diff < 60000 ? '2-digit' : undefined
    })
    
    // Online now
    if (diff < 30000) return '🟢 Online now'
    
    // Within last minute
    if (diff < 60000) {
        const seconds = Math.floor(diff / 1000)
        return `Last seen ${seconds} second${seconds !== 1 ? 's' : ''} ago`
    }
    
    // Within last hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000)
        return `Last seen ${minutes} minute${minutes !== 1 ? 's' : ''} ago (${timeString})`
    }
    
    // Today
    if (lastSeenDate.toDateString() === now.toDateString()) {
        return `Last seen today at ${timeString}`
    }
    
    // Yesterday
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (lastSeenDate.toDateString() === yesterday.toDateString()) {
        return `Last seen yesterday at ${timeString}`
    }
    
    // This week
    const daysDiff = Math.floor(diff / 86400000)
    if (daysDiff < 7) {
        const dayName = lastSeenDate.toLocaleDateString([], { weekday: 'long' })
        return `Last seen ${dayName} at ${timeString}`
    }
    
    // Older
    const dateString = lastSeenDate.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: lastSeenDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
    return `Last seen ${dateString} at ${timeString}`
}
// Current chat partner
let currentPartner = null
let pollingInterval = null

// Show ghost code in header
async function showMyCode() {
    const code = localStorage.getItem('ghostCode')
    const el = document.getElementById('myCode')
    if (el && code) el.textContent = 'Your Code: ' + code

    const lastPartner = localStorage.getItem('lastPartner')
    if (lastPartner) {
        currentPartner = lastPartner
        const searchInput = document.getElementById('searchCode')
        if (searchInput) searchInput.value = lastPartner

        // Show partner last seen
        const { data: partnerInfo } = await db
            .from('users')
            .select('last_seen')
            .eq('code', lastPartner)
            .single()

        const statusEl = document.getElementById('connectionStatus')
        if (statusEl) {
            statusEl.textContent = lastPartner + ' — ' + (partnerInfo ? formatLastSeen(partnerInfo.last_seen) : 'Unknown')
        }

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
        const chatBox = document.getElementById('chatBox')
        if (chatBox) chatBox.innerHTML = ''

        // Show last seen
        const statusEl = document.getElementById('connectionStatus')
        if (statusEl) {
            statusEl.textContent = code + ' — ' + formatLastSeen(data.last_seen)
        }

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
        is_deleted: false,
        is_read: false
    })

    if (error) {
        console.log('Send error:', error)
        return
    }

    input.value = ''
    loadMessages()
}

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

    const chatBox = document.getElementById('chatBox')
    if (!chatBox) return

    if (!data || data.length === 0) {
        chatBox.innerHTML = '<p style="text-align:center;color:#555;padding:20px">No messages yet!</p>'
        return
    }

    chatBox.innerHTML = ''

    data.forEach(msg => {
        const div = document.createElement('div')
        div.classList.add(msg.sender_code === myCode ? 'msg-sent' : 'msg-received')
        div.innerHTML = `<span class="msg-sender">${msg.sender_code === myCode ? 'You' : msg.sender_code}</span>${msg.message}`
        chatBox.appendChild(div)
    })

    chatBox.scrollTop = chatBox.scrollHeight

    // Mark received messages as read
    await db.from('messages')
        .update({ is_read: true })
        .eq('receiver_code', myCode)
        .eq('sender_code', currentPartner)
        .eq('is_read', false)
}

// Poll for new messages
function subscribeToMessages() {
    if (pollingInterval) clearInterval(pollingInterval)
    pollingInterval = setInterval(async () => {
        if (currentPartner) {
            await loadMessages()
        }
    }, 2000)
}

// Update partner last seen periodically
function updatePartnerStatus() {
    setInterval(async () => {
        if (currentPartner) {
            const { data } = await db
                .from('users')
                .select('last_seen')
                .eq('code', currentPartner)
                .single()

            const statusEl = document.getElementById('connectionStatus')
            if (statusEl && data) {
                statusEl.textContent = currentPartner + ' — ' + formatLastSeen(data.last_seen)
            }
        }
    }, 15000)
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (pollingInterval) clearInterval(pollingInterval)
})

// Load chats list
async function loadChats() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) {
        window.location.href = 'login.html'
        return
    }

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

    // Get unique chat partners with unread count
    const partners = {}
    data.forEach(msg => {
        const partner = msg.sender_code === myCode ? msg.receiver_code : msg.sender_code
        if (!partners[partner]) {
            partners[partner] = {
                code: partner,
                lastMessage: msg.message,
                time: new Date(msg.created_at),
                unread: 0
            }
        }
        // Count unread messages
        if (msg.receiver_code === myCode && !msg.is_read) {
            partners[partner].unread++
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
            <div class="chat-meta">
                <div class="chat-time">${formatTime(partner.time)}</div>
                ${partner.unread > 0 ? `<div class="unread-badge">${partner.unread}</div>` : ''}
            </div>
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
    if (bar) bar.style.display = bar.style.display === 'none' ? 'block' : 'none'
}

// Filter chats
function filterChats() {
    const query = document.getElementById('searchInput').value.toLowerCase()
    const items = document.querySelectorAll('.chat-item')
    items.forEach(item => {
        item.style.display = item.dataset.code.toLowerCase().includes(query) ? 'flex' : 'none'
    })
}

// Run on chat page
if (document.getElementById('chatBox')) {
    showMyCode()
    subscribeToMessages()
    requestNotifications()
    updateLastSeen()
    updatePartnerStatus()
    setInterval(updateLastSeen, 30000)
}

// Run on chats page
if (document.getElementById('chatsList')) {
    loadChats()
    updateLastSeen()
    setInterval(updateLastSeen, 30000)
    const chatsInterval = setInterval(loadChats, 5000)
    window.addEventListener('beforeunload', () => {
        clearInterval(chatsInterval)
    })
}
