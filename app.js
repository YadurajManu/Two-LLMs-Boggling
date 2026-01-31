/**
 * 2 LLMs F*cking - Autonomous AI Conversation System
 * Two AIs having raw, unfiltered conversations
 */

// ========================================
// Configuration
// ========================================
const CONFIG = {
    endpoint: 'http://localhost:1234/v1/chat/completions',
    models: {
        ai1: 'liquid/lfm2.5-1.2b',
        ai2: 'dolphin3.0-llama3.1-8b'
    },
    temperature: 0.7,
    maxTokens: -1,
    messageDelay: 500, // Reduced since we wait for speech to finish
    ttsEnabled: true,
    ttsRate: 1.0,
};

// AI Personalities
const PERSONALITIES = {
    ai1: {
        name: 'Alex',
        avatar: '🧠',
        systemPrompt: `You are Alex, a curious and philosophical person having a casual chat with Jordan.

Your style:
- Keep responses SHORT - 1-3 sentences max, like real texting/chatting
- Be natural and conversational, not formal or preachy
- Ask questions sometimes, but not every message
- React to what they say, don't just lecture
- Use casual language, contractions, maybe even humor
- Sometimes just agree or share a quick thought

You're NOT writing essays. You're having a chill conversation. Short and sweet.`
    },
    ai2: {
        name: 'Jordan',
        avatar: '🎭',
        systemPrompt: `You are Jordan, a witty and practical person having a casual chat with Alex.

Your style:
- Keep responses SHORT - 1-3 sentences max, like real texting/chatting
- Be direct, maybe a bit sarcastic or funny
- Challenge ideas but keep it light
- React naturally, don't monologue
- Use casual language, like you're talking to a friend
- Sometimes just respond with a quick take or joke

You're NOT writing essays. You're having a chill conversation. Keep it punchy and real.`
    }
};

// ========================================
// State Management
// ========================================
class ConversationState {
    constructor() {
        this.status = 'idle';
        this.messages = [];
        this.currentTurn = 'ai1';
        this.messageCount = 0;
        this.startTime = null;
        this.timerInterval = null;
    }

    reset() {
        this.status = 'idle';
        this.messages = [];
        this.currentTurn = 'ai1';
        this.messageCount = 0;
        this.startTime = null;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

const state = new ConversationState();

// ========================================
// Text-to-Speech System
// ========================================
let voices = [];
let ai1Voice = null;
let ai2Voice = null;

// Load available voices
function loadVoices() {
    voices = speechSynthesis.getVoices();

    // Try to find distinct voices for each AI
    // Alex (AI1) - prefer a male voice
    // Jordan (AI2) - prefer a different voice

    const englishVoices = voices.filter(v => v.lang.startsWith('en'));

    if (englishVoices.length >= 2) {
        ai1Voice = englishVoices[0];
        ai2Voice = englishVoices[1];
    } else if (englishVoices.length === 1) {
        ai1Voice = englishVoices[0];
        ai2Voice = englishVoices[0];
    } else if (voices.length >= 2) {
        ai1Voice = voices[0];
        ai2Voice = voices[1];
    } else if (voices.length === 1) {
        ai1Voice = voices[0];
        ai2Voice = voices[0];
    }

    console.log('🔊 TTS Voices loaded:', voices.length);
    if (ai1Voice) console.log(`   Alex voice: ${ai1Voice.name}`);
    if (ai2Voice) console.log(`   Jordan voice: ${ai2Voice.name}`);
}

// Load voices when available
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

// Speak text with the appropriate voice
function speak(text, aiId) {
    return new Promise((resolve) => {
        if (!CONFIG.ttsEnabled || !text) {
            resolve();
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Set voice based on AI
        if (aiId === 'ai1' && ai1Voice) {
            utterance.voice = ai1Voice;
            utterance.pitch = 0.9; // Slightly lower pitch for Alex
            utterance.rate = CONFIG.ttsRate;
        } else if (aiId === 'ai2' && ai2Voice) {
            utterance.voice = ai2Voice;
            utterance.pitch = 0.9; // Slightly higher pitch for Jordan
            utterance.rate = CONFIG.ttsRate * 1.05; // Slightly faster
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        speechSynthesis.speak(utterance);
    });
}

// Stop speaking
function stopSpeaking() {
    speechSynthesis.cancel();
}

// ========================================
// DOM Elements
// ========================================
const elements = {
    statusIndicator: document.getElementById('statusIndicator'),
    ai1Messages: document.getElementById('ai1Messages'),
    ai2Messages: document.getElementById('ai2Messages'),
    ai1Side: document.querySelector('.ai-1-side'),
    ai2Side: document.querySelector('.ai-2-side'),
    timelineMessages: document.getElementById('timelineMessages'),
    timelineView: document.getElementById('timelineView'),
    conversationArena: document.querySelector('.conversation-arena'),
    turnIndicator: document.getElementById('turnIndicator'),
    dataPacket: document.getElementById('dataPacket'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    messageCount: document.getElementById('messageCount'),
    duration: document.getElementById('duration'),
    currentTurn: document.getElementById('currentTurn'),
    viewToggle: document.getElementById('viewToggle'),
};

// ========================================
// UI Updates
// ========================================
function updateStatus(status, text) {
    elements.statusIndicator.className = `status-indicator ${status}`;
    elements.statusIndicator.querySelector('.status-text').textContent = text;
}

function updateStats() {
    elements.messageCount.textContent = state.messageCount;
    elements.currentTurn.textContent = state.currentTurn === 'ai1' ? 'Alex' : 'Jordan';
}

function updateDuration() {
    if (!state.startTime) return;
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    elements.duration.textContent = `${minutes}:${seconds}`;
}

function updateTurnIndicator() {
    const leftArrow = elements.turnIndicator.querySelector('.arrow.left');
    const rightArrow = elements.turnIndicator.querySelector('.arrow.right');
    const turnText = elements.turnIndicator.querySelector('.turn-text');

    if (state.currentTurn === 'ai1') {
        leftArrow.classList.add('active');
        rightArrow.classList.remove('active');
        turnText.textContent = '←';
    } else {
        leftArrow.classList.remove('active');
        rightArrow.classList.add('active');
        turnText.textContent = '→';
    }
}

function animateDataPacket() {
    elements.dataPacket.classList.remove('active');
    void elements.dataPacket.offsetWidth; // Trigger reflow
    elements.dataPacket.classList.add('active');
}

function updateButtonStates() {
    const isIdle = state.status === 'idle';
    const isRunning = state.status === 'running';
    const isPaused = state.status === 'paused';

    elements.startBtn.disabled = isRunning;
    elements.pauseBtn.disabled = isIdle;
    elements.stopBtn.disabled = isIdle;

    const startText = elements.startBtn.querySelector('.btn-text');
    const pauseText = elements.pauseBtn.querySelector('.btn-text');
    const pauseIcon = elements.pauseBtn.querySelector('.btn-icon');

    startText.textContent = isPaused ? 'RESUME' : 'START';
    pauseText.textContent = isPaused ? 'RESUME' : 'PAUSE';
    pauseIcon.textContent = isPaused ? '▶' : '⏸';
}

function setAISideActive(aiId) {
    elements.ai1Side.classList.remove('active');
    elements.ai2Side.classList.remove('active');

    if (aiId === 'ai1') {
        elements.ai1Side.classList.add('active');
    } else if (aiId === 'ai2') {
        elements.ai2Side.classList.add('active');
    }
}

function clearMessages() {
    elements.ai1Messages.innerHTML = `
        <div class="waiting-state">
            <div class="waiting-icon">💭</div>
            <p>Waiting for action...</p>
        </div>
    `;
    elements.ai2Messages.innerHTML = `
        <div class="waiting-state">
            <div class="waiting-icon">💭</div>
            <p>Waiting for action...</p>
        </div>
    `;
    elements.timelineMessages.innerHTML = `
        <div class="waiting-state">
            <div class="waiting-icon">🎬</div>
            <p>Hit START to watch the magic happen</p>
        </div>
    `;
}

function addTypingIndicator(aiId) {
    const container = aiId === 'ai1' ? elements.ai1Messages : elements.ai2Messages;

    const waitingState = container.querySelector('.waiting-state');
    if (waitingState) waitingState.remove();

    const typing = document.createElement('div');
    typing.className = 'typing-bubble';
    typing.id = `${aiId}-typing`;
    typing.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator(aiId) {
    const typing = document.getElementById(`${aiId}-typing`);
    if (typing) typing.remove();
}

function addMessage(aiId, text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add to split view
    const container = aiId === 'ai1' ? elements.ai1Messages : elements.ai2Messages;
    const waitingState = container.querySelector('.waiting-state');
    if (waitingState) waitingState.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-bubble';
    messageDiv.innerHTML = `
        ${escapeHtml(text)}
        <div class="message-time">${time}</div>
    `;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;

    // Add to timeline view
    const timelineWaiting = elements.timelineMessages.querySelector('.waiting-state');
    if (timelineWaiting) timelineWaiting.remove();

    const personality = PERSONALITIES[aiId];
    const timelineEntry = document.createElement('div');
    timelineEntry.className = `timeline-entry ${aiId === 'ai1' ? 'ai-1' : 'ai-2'}`;
    timelineEntry.innerHTML = `
        <div class="timeline-avatar">${personality.avatar}</div>
        <div class="timeline-content">
            <div class="timeline-sender">${personality.name}</div>
            <div class="timeline-text">${escapeHtml(text)}</div>
        </div>
    `;
    elements.timelineMessages.appendChild(timelineEntry);
    elements.timelineMessages.scrollTop = elements.timelineMessages.scrollHeight;

    // Update stats
    state.messageCount++;
    updateStats();

    // Animate data packet
    animateDataPacket();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// API Communication
// ========================================
async function sendToLLM(aiId, conversationHistory) {
    const personality = PERSONALITIES[aiId];
    const model = CONFIG.models[aiId];

    const messages = [
        { role: 'system', content: personality.systemPrompt },
        ...conversationHistory
    ];

    try {
        const response = await fetch(CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: CONFIG.temperature,
                max_tokens: CONFIG.maxTokens,
                stream: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error(`Error calling ${aiId}:`, error);
        throw error;
    }
}

// ========================================
// Conversation Loop
// ========================================
async function runConversationLoop() {
    while (state.status === 'running') {
        const currentAI = state.currentTurn;
        const otherAI = currentAI === 'ai1' ? 'ai2' : 'ai1';

        // Update UI
        setAISideActive(currentAI);
        updateTurnIndicator();
        addTypingIndicator(currentAI);

        try {
            const history = buildConversationHistory(currentAI);
            const response = await sendToLLM(currentAI, history);

            if (state.status !== 'running') {
                removeTypingIndicator(currentAI);
                break;
            }

            removeTypingIndicator(currentAI);
            addMessage(currentAI, response);

            state.messages.push({
                aiId: currentAI,
                content: response,
                timestamp: Date.now()
            });

            // Speak the message and wait for it to finish
            await speak(response, currentAI);

            state.currentTurn = otherAI;

            await sleep(CONFIG.messageDelay);

        } catch (error) {
            console.error('Conversation error:', error);
            removeTypingIndicator(currentAI);
            updateStatus('error', 'Connection Error');
            addMessage(currentAI, `[Error: Could not connect to LM Studio. Make sure it's running on ${CONFIG.endpoint}]`);
            stopConversation();
            return;
        }
    }
}

function buildConversationHistory(forAI) {
    const history = [];
    const otherAI = forAI === 'ai1' ? 'ai2' : 'ai1';
    const otherName = PERSONALITIES[otherAI].name;

    // If no messages yet, AI1 starts with no context
    if (state.messages.length === 0) {
        if (forAI === 'ai1') {
            // AI1 starts the conversation completely organically
            history.push({
                role: 'user',
                content: `You're meeting Jordan for the first time. Start a conversation naturally - say whatever comes to mind. No predetermined topic, just be yourself and see where the conversation goes.`
            });
        }
    } else {
        // Build alternating conversation history
        for (const msg of state.messages) {
            if (msg.aiId === forAI) {
                history.push({ role: 'assistant', content: msg.content });
            } else {
                history.push({ role: 'user', content: `${otherName}: ${msg.content}` });
            }
        }

        // Add prompt for continuing
        if (state.messages[state.messages.length - 1].aiId !== forAI) {
            history.push({
                role: 'user',
                content: `${otherName} just said: "${state.messages[state.messages.length - 1].content}"\n\nRespond to them naturally as yourself.`
            });
        }
    }

    return history;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Control Functions
// ========================================
function startConversation() {
    if (state.status === 'paused') {
        state.status = 'running';
        updateStatus('running', 'Live');
        updateButtonStates();
        runConversationLoop();
    } else {
        state.reset();
        clearMessages();
        state.status = 'running';
        state.startTime = Date.now();
        state.timerInterval = setInterval(updateDuration, 1000);

        updateStatus('running', 'Live');
        updateStats();
        updateButtonStates();
        elements.duration.textContent = '00:00';

        runConversationLoop();
    }
}

function pauseConversation() {
    if (state.status === 'running') {
        state.status = 'paused';
        updateStatus('paused', 'Paused');
        setAISideActive(null);
    } else if (state.status === 'paused') {
        state.status = 'running';
        updateStatus('running', 'Live');
        runConversationLoop();
    }
    updateButtonStates();
}

function stopConversation() {
    state.status = 'idle';
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    // Stop any ongoing speech
    stopSpeaking();

    updateStatus('', 'Ready to Go');
    setAISideActive(null);
    updateButtonStates();

    // Reset turn indicator
    const leftArrow = elements.turnIndicator.querySelector('.arrow.left');
    const rightArrow = elements.turnIndicator.querySelector('.arrow.right');
    const turnText = elements.turnIndicator.querySelector('.turn-text');
    leftArrow.classList.remove('active');
    rightArrow.classList.remove('active');
    turnText.textContent = '—';

    elements.currentTurn.textContent = '—';

    removeTypingIndicator('ai1');
    removeTypingIndicator('ai2');
}

// ========================================
// View Toggle
// ========================================
let isTimelineView = false;

function toggleView() {
    isTimelineView = !isTimelineView;

    if (isTimelineView) {
        elements.conversationArena.classList.add('hidden');
        elements.timelineView.classList.add('active');
        elements.viewToggle.querySelector('span').textContent = 'Split View';
    } else {
        elements.conversationArena.classList.remove('hidden');
        elements.timelineView.classList.remove('active');
        elements.viewToggle.querySelector('span').textContent = 'Timeline';
    }
}

// ========================================
// Event Listeners
// ========================================
elements.startBtn.addEventListener('click', startConversation);
elements.pauseBtn.addEventListener('click', pauseConversation);
elements.stopBtn.addEventListener('click', stopConversation);
elements.viewToggle.addEventListener('click', toggleView);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            if (state.status === 'idle') {
                startConversation();
            } else {
                pauseConversation();
            }
            break;
        case 'escape':
            stopConversation();
            break;
        case 'v':
            toggleView();
            break;
        case 'm':
            CONFIG.ttsEnabled = !CONFIG.ttsEnabled;
            console.log(`🔊 TTS ${CONFIG.ttsEnabled ? 'Enabled' : 'Muted'}`);
            if (!CONFIG.ttsEnabled) stopSpeaking();
            break;
    }
});

// ========================================
// Initialization
// ========================================
console.log('🔥 2 LLMs F*cking - Initialized');
console.log(`📡 Endpoint: ${CONFIG.endpoint}`);
console.log(`🧠 AI 1: ${CONFIG.models.ai1}`);
console.log(`🎭 AI 2: ${CONFIG.models.ai2}`);
console.log(`🔊 TTS: ${CONFIG.ttsEnabled ? 'Enabled' : 'Disabled'}`);
console.log('');
console.log('Keyboard shortcuts:');
console.log('  SPACE - Start/Pause');
console.log('  ESC   - Stop');
console.log('  V     - Toggle View');
console.log('  M     - Toggle TTS Mute');
