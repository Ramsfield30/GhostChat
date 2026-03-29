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
function showNotification(sender, message) {
    if (Notification.permission === 'granted') {
        new Notification('👻 GhostChat', {
            body: `${sender}: ${message}`,
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

    await db.from('messages').insert({
        sender_code: myCode,
        receiver_code: currentPartner,
        message: text,
        is_deleted: false
    })

    input.value = ''
    loadMessages()
}

// Load messages
async function loadMessages() {
    const myCode = localStorage.getItem('ghostCode')

    const { data } = await db
        .from('messages')
        .select('*')
        .or(`and(sender_code.eq.${myCode},receiver_code.eq.${currentPartner}),and(sender_code.eq.${currentPartner},receiver_code.eq.${myCode})`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

    const chatBox = document.getElementById('chatBox')
    chatBox.innerHTML = ''

    if (!data) return

    data.forEach(msg => {
        const div = document.createElement('div')
        div.classList.add(msg.sender_code === myCode ? 'msg-sent' : 'msg-received')
        div.innerHTML = `<span class="msg-sender">${msg.sender_code === myCode ? 'You' : msg.sender_code}</span>${msg.message}`
        chatBox.appendChild(div)
    })

    chatBox.scrollTop = chatBox.scrollHeight
}

// Real time updates
function subscribeToMessages() {
    const myCode = localStorage.getItem('ghostCode')

    db.channel('realtime-messages')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_code=eq.${myCode}`
            },
            (payload) => {
                console.log('New message received:', payload)
                loadMessages()
                showNotification(payload.new.sender_code, payload.new.message)
            }
        )
        .subscribe((status) => {
            console.log('Subscription status:', status)
        })
}

// Run on chat page
if (document.getElementById('chatBox')) {
    showMyCode()
    subscribeToMessages()
    requestNotifications()
}