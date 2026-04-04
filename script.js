// ==================== HELPER FUNCTIONS ====================

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
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

// Email validation helper
function validateEmail(email) {
    const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/
    return re.test(email)
}

// Password validation helper (at least 8 chars)
function validatePassword(password) {
    return password.length >= 8
}

// Simple hash function for demo (REPLACE with bcrypt or Supabase Auth in production)
// Note: This is NOT secure for production! Use Supabase Auth instead.
async function hashPassword(password) {
    // This is a simple hash for demo purposes only
    // In production, use: await bcrypt.hash(password, 10) or Supabase Auth
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
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

// Show loading spinner
function showLoading(elementId, show) {
    const element = document.getElementById(elementId)
    if (!element) return
    if (show) {
        element.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...'
        element.style.color = '#7c3aed'
    } else if (element.innerHTML.includes('Loading')) {
        element.innerHTML = ''
    }
}

// Show user-friendly message
function showMessage(message, isError = true) {
    const msgDiv = document.getElementById('message')
    if (!msgDiv) return
    msgDiv.style.color = isError ? '#ef4444' : '#7c3aed'
    msgDiv.textContent = message
    // Clear message after 5 seconds
    setTimeout(() => {
        if (msgDiv.textContent === message) {
            msgDiv.textContent = ''
        }
    }, 5000)
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text)
        showMessage('✅ Code copied to clipboard!', false)
    } catch (err) {
        showMessage('❌ Failed to copy code')
    }
}

// Logout function
function logout() {
    localStorage.removeItem('ghostCode')
    localStorage.removeItem('email')
    localStorage.removeItem('lastPartner')
    if (pollingInterval) clearInterval(pollingInterval)
    window.location.href = 'login.html'
}

// ==================== AUTHENTICATION ====================

// Sign up function (with password hashing)
async function signUp() {
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const message = document.getElementById('message')

    if (!email || !password) {
        showMessage('Please fill all fields!')
        return
    }

    if (!validateEmail(email)) {
        showMessage('❌ Please enter a valid email address (example@email.com)!')
        return
    }

    if (!validatePassword(password)) {
        showMessage('❌ Password must be at least 8 characters long!')
        return
    }

    showLoading('message', true)

    try {
        // Check if user exists
        const { data: existingUser, error: checkError } = await db
            .from('users')
            .select('email')
            .eq('email', email)
            .maybeSingle()

        if (existingUser) {
            showMessage('❌ This email is already registered! Please login instead.')
            showLoading('message', false)
            return
        }

        const ghostCode = generateGhostCode()
        const hashedPassword = await hashPassword(password)

        const { error: insertError } = await db
            .from('users')
            .insert({
                email: email,
                password_hash: hashedPassword,  // Store hash, not plain text!
                code: ghostCode,
                created_at: new Date(),
                last_seen: new Date()
            })

        if (insertError) {
            console.error('Signup error:', insertError)
            showMessage('❌ Error creating account: ' + insertError.message)
        } else {
            showMessage(`✅ Account created! Your Ghost Code: ${ghostCode}`, false)
            localStorage.setItem('ghostCode', ghostCode)
            localStorage.setItem('email', email)
            setTimeout(() => {
                window.location.href = 'chats.html'
            }, 3000)
        }
    } catch (error) {
        console.error('Signup error:', error)
        showMessage('❌ Network error. Please try again.')
    } finally {
        showLoading('message', false)
    }
}

// Login function (with password hash comparison)
async function login() {
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const message = document.getElementById('message')

    if (!email || !password) {
        showMessage('Please fill all fields!')
        return
    }

    showLoading('message', true)

    try {
        const hashedPassword = await hashPassword(password)

        const { data, error } = await db
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password_hash', hashedPassword)
            .maybeSingle()

        if (error) {
            console.error('Login error:', error)
            showMessage('❌ Database error. Please try again.')
        } else if (data) {
            // Update last seen and online status
            await db.from('users')
                .update({ last_login: new Date(), last_seen: new Date(), is_online: true })
                .eq('id', data.id)

            localStorage.setItem('ghostCode', data.code)
            localStorage.setItem('email', email)
            showMessage('✅ Login successful!', false)
            setTimeout(() => {
                window.location.href = 'chats.html'
            }, 1500)
        } else {
            showMessage('❌ Invalid email or password!')
        }
    } catch (error) {
        console.error('Login error:', error)
        showMessage('❌ Network error. Please try again.')
    } finally {
        showLoading('message', false)
    }
}

// Forgot password function
async function resetPassword() {
    const email = document.getElementById('resetEmail').value.trim()
    const message = document.getElementById('message')

    if (!email) {
        showMessage('Please enter your email!')
        return
    }

    showLoading('message', true)

    try {
        const { data: user, error: findError } = await db
            .from('users')
            .select('email')
            .eq('email', email)
            .maybeSingle()

        if (findError) {
            showMessage('❌ Database error. Please try again.')
        } else if (!user) {
            showMessage('❌ Email not found!')
        } else {
            const tempPassword = Math.random().toString(36).slice(-8)
            const hashedTemp = await hashPassword(tempPassword)

            const { error: updateError } = await db
                .from('users')
                .update({ password_hash: hashedTemp })
                .eq('email', email)

            if (!updateError) {
                showMessage(`✅ Temporary password: ${tempPassword} (copy this now!)`, false)
            } else {
                showMessage('❌ Error resetting password!')
            }
        }
    } catch (error) {
        console.error('Reset error:', error)
        showMessage('❌ Network error. Please try again.')
    } finally {
        showLoading('message', false)
    }
}

// ==================== CHAT FUNCTIONS ====================

// Update last seen
async function updateLastSeen() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) return
    try {
        await db.from('users').update({ 
            last_seen: new Date(),
            is_online: true
        }).eq('code', myCode)
    } catch (error) {
        console.error('Update last seen error:', error)
    }
}

// Set user offline on page unload
async function setOffline() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) return
    try {
        await db.from('users').update({ is_online: false }).eq('code', myCode)
    } catch (error) {
        console.error('Set offline error:', error)
    }
}

// Format last seen text
function formatLastSeen(lastSeen, isOnline) {
    if (isOnline) return '🟢 Online'
    if (!lastSeen) return '⚫ Offline'
    const diff = new Date() - new Date(lastSeen)
    if (diff < 60000) return 'Last seen just now'
    if (diff < 3600000) return 'Last seen ' + Math.floor(diff / 60000) + ' min ago'
    if (diff < 86400000) return 'Last seen ' + Math.floor(diff / 3600000) + ' hr ago'
    return 'Last seen ' + new Date(lastSeen).toLocaleDateString()
}

// Current chat partner
let currentPartner = null
let pollingInterval = null
let typingTimeout = null

// Show ghost code in header
async function showMyCode() {
    const code = localStorage.getItem('ghostCode')
    const el = document.getElementById('myCode')
    if (el && code) {
        el.innerHTML = `Your Code: ${code} <i class="fa-regular fa-copy" onclick="copyToClipboard('${code}')" style="cursor:pointer; margin-left:5px;"></i>`
    }

    const lastPartner = localStorage.getItem('lastPartner')
    if (lastPartner && document.getElementById('searchCode')) {
        currentPartner = lastPartner
        const searchInput = document.getElementById('searchCode')
        if (searchInput) searchInput.value = lastPartner

        // Show partner last seen
        const { data: partnerInfo } = await db
            .from('users')
            .select('last_seen, is_online')
            .eq('code', lastPartner)
            .maybeSingle()

        const statusEl = document.getElementById('connectionStatus')
        if (statusEl && partnerInfo) {
            statusEl.textContent = lastPartner + ' — ' + formatLastSeen(partnerInfo.last_seen, partnerInfo.is_online)
        } else if (statusEl) {
            statusEl.textContent = lastPartner + ' — Connecting...'
        }

        loadMessages()
    }
}

// Request notification permission (on user action)
async function requestNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission()
    }
}

// Show notification
function showNotification(sender, msg) {
    if (Notification.permission === 'granted' && document.hidden) {
        new Notification('👻 GhostChat', {
            body: `${sender}: ${msg.substring(0, 100)}`,
            icon: '👻'
        })
    }
}

// Debounced typing status
let typingDebounceTimer = null

async function setTyping(isTyping) {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode || !currentPartner) return

    // Clear existing debounce timer
    if (typingDebounceTimer) clearTimeout(typingDebounceTimer)

    if (isTyping) {
        // Send typing start immediately
        try {
            await db.from('typing').upsert({
                sender_code: myCode,
                receiver_code: currentPartner,
                is_typing: true,
                updated_at: new Date()
            }, { onConflict: 'sender_code,receiver_code' })
        } catch (error) {
            console.error('Typing error:', error)
        }

        // Set timeout to clear typing status after 2 seconds of no input
        typingDebounceTimer = setTimeout(() => {
            setTyping(false)
        }, 2000)
    } else {
        try {
            await db.from('typing').upsert({
                sender_code: myCode,
                receiver_code: currentPartner,
                is_typing: false,
                updated_at: new Date()
            }, { onConflict: 'sender_code,receiver_code' })
        } catch (error) {
            console.error('Typing error:', error)
        }
    }
}

// Check if partner is typing
async function checkTyping() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode || !currentPartner) return

    try {
        const { data } = await db
            .from('typing')
            .select('*')
            .eq('sender_code', currentPartner)
            .eq('receiver_code', myCode)
            .maybeSingle()

        const indicator = document.getElementById('typingIndicator')
        if (indicator && data && data.is_typing) {
            const diff = new Date() - new Date(data.updated_at)
            indicator.textContent = diff < 3000 ? currentPartner + ' is typing...' : ''
        } else if (indicator) {
            indicator.textContent = ''
        }
    } catch (error) {
        console.error('Check typing error:', error)
    }
}

// Start chat with another ghost
async function startChat() {
    const codeInput = document.getElementById('searchCode')
    const code = codeInput ? codeInput.value.trim() : ''
    if (!code) {
        showMessage('Please enter a Ghost Code!')
        return
    }

    if (code === localStorage.getItem('ghostCode')) {
        showMessage('❌ You cannot chat with yourself!')
        return
    }

    showLoading('connectionStatus', true)

    try {
        const { data, error } = await db
            .from('users')
            .select('code, last_seen, is_online')
            .eq('code', code)
            .maybeSingle()

        if (error) {
            showMessage('❌ Error finding user: ' + error.message)
        } else if (data) {
            currentPartner = code
            localStorage.setItem('lastPartner', code)
            const chatBox = document.getElementById('chatBox')
            if (chatBox) chatBox.innerHTML = ''

            const statusEl = document.getElementById('connectionStatus')
            if (statusEl) {
                statusEl.textContent = code + ' — ' + formatLastSeen(data.last_seen, data.is_online)
            }

            loadMessages()
            showMessage('Connected to ' + code, false)
        } else {
            showMessage('❌ Ghost Code not found!')
        }
    } catch (error) {
        console.error('Start chat error:', error)
        showMessage('❌ Network error. Please try again.')
    } finally {
        showLoading('connectionStatus', false)
    }
}

// Send message with validation
async function sendMessage() {
    const input = document.getElementById('msgInput')
    const text = input ? input.value.trim() : ''
    if (!text) return
    if (!currentPartner) {
        showMessage('Please connect to a chat partner first!')
        return
    }

    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) {
        window.location.href = 'login.html'
        return
    }

    // Clear typing status
    await setTyping(false)

    try {
        const { error } = await db.from('messages').insert({
            sender_code: myCode,
            receiver_code: currentPartner,
            message: text,
            is_deleted: false,
            is_read: false,
            created_at: new Date()
        })

        if (error) {
            console.error('Send error:', error)
            showMessage('❌ Failed to send message: ' + error.message)
            return
        }

        if (input) input.value = ''
        loadMessages()
        
        // Auto-resize textarea
        input.style.height = 'auto'
    } catch (error) {
        console.error('Send error:', error)
        showMessage('❌ Network error. Please try again.')
    }
}

// Auto-resize textarea
function autoResizeTextarea() {
    const textarea = document.getElementById('msgInput')
    if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
}

// Load messages with XSS protection
async function loadMessages() {
    const myCode = localStorage.getItem('ghostCode')
    if (!currentPartner || !myCode) return

    try {
        const { data, error } = await db
            .from('messages')
            .select('*')
            .or(`and(sender_code.eq.${myCode},receiver_code.eq.${currentPartner}),and(sender_code.eq.${currentPartner},receiver_code.eq.${myCode})`)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Load error:', error)
            return
        }

        const chatBox = document.getElementById('chatBox')
        if (!chatBox) return

        if (!data || data.length === 0) {
            chatBox.innerHTML = '<p style="text-align:center;color:#555;padding:20px">✨ No messages yet! Send a message to start chatting ✨</p>'
            return
        }

        chatBox.innerHTML = ''

        data.forEach(msg => {
            const div = document.createElement('div')
            div.classList.add(msg.sender_code === myCode ? 'msg-sent' : 'msg-received')
            // Escape HTML to prevent XSS
            const senderName = msg.sender_code === myCode ? 'You' : escapeHtml(msg.sender_code)
            const messageText = escapeHtml(msg.message)
            div.innerHTML = `<span class="msg-sender">${senderName}</span>${messageText}`
            chatBox.appendChild(div)
        })

        chatBox.scrollTop = chatBox.scrollHeight

        // Mark received messages as read
        await db.from('messages')
            .update({ is_read: true })
            .eq('receiver_code', myCode)
            .eq('sender_code', currentPartner)
            .eq('is_read', false)
    } catch (error) {
        console.error('Load messages error:', error)
    }
}

// Poll for new messages (consider switching to Realtime)
function subscribeToMessages() {
    if (pollingInterval) clearInterval(pollingInterval)
    pollingInterval = setInterval(async () => {
        if (currentPartner) {
            await loadMessages()
            await checkTyping()
        }
    }, 3000) // Increased to 3 seconds to reduce load
}

// Update partner last seen periodically
function updatePartnerStatus() {
    setInterval(async () => {
        if (currentPartner) {
            try {
                const { data } = await db
                    .from('users')
                    .select('last_seen, is_online')
                    .eq('code', currentPartner)
                    .maybeSingle()

                const statusEl = document.getElementById('connectionStatus')
                if (statusEl && data) {
                    statusEl.textContent = currentPartner + ' — ' + formatLastSeen(data.last_seen, data.is_online)
                }
            } catch (error) {
                console.error('Update partner status error:', error)
            }
        }
    }, 15000)
}

// ==================== CHATS LIST FUNCTIONS ====================

// Load chats list
async function loadChats() {
    const myCode = localStorage.getItem('ghostCode')
    if (!myCode) {
        window.location.href = 'login.html'
        return
    }

    const codeBar = document.getElementById('myCodeBar')
    if (codeBar) {
        codeBar.innerHTML = `👻 Your Code: ${myCode} <i class="fa-regular fa-copy" onclick="copyToClipboard('${myCode}')" style="cursor:pointer; margin-left:8px;"></i> <i class="fa-solid fa-right-from-bracket" onclick="logout()" style="cursor:pointer; margin-left:12px; color:#ef4444;"></i>`
    }

    try {
        const { data, error } = await db
            .from('messages')
            .select('*')
            .or(`sender_code.eq.${myC