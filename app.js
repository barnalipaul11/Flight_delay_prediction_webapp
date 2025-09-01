class FlightPredictApp {
    constructor() {
        this.currentPortal = 'landing';
        this.data = null;
        this.charts = {};
        //this.API_BASE_URL = 'http://127.0.0.1:8000';
        this.API_BASE_URL='https://model-api-flights.onrender.com';
        this.CHATBOT_API_URL = 'https://model-api-flights.onrender.com/chat'; 
        
        // Chatbot state
        this.chatState = {
            isOpen: false,
            messages: [],
            isTyping: false,
            hasNewMessage: true
        };

        this.init();
    }

    async init() {
        console.log('Initializing FlightPredict App with Real API Integration...');

        await this.loadData();
        await this.waitForDOM();
        this.initIcons();
        this.setupEventListeners();
        this.setupChatbot(); // Initialize chatbot
        this.populateDropdowns();
        this.initializeCharts();
        this.showPortal('landing');
        this.initNeonEffects();
        await this.loadAirlineMetricsFromBackend();

        console.log('App initialization complete with real API integration');
    }

    waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }

    initIcons() {
        try {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
                console.log('Lucide icons initialized');
            }
        } catch (error) {
            console.warn('Lucide icons not available:', error);
        }
    }

    // === CHATBOT IMPLEMENTATION ===
    setupChatbot() {
        console.log('Setting up chatbot...');
        
        const chatToggleBtn = document.getElementById('chatToggleBtn');
        const chatCloseBtn = document.getElementById('chatCloseBtn');
        const chatWindow = document.getElementById('chatWindow');
        const chatInput = document.getElementById('floatingChatInput');
        const sendBtn = document.getElementById('floatingSendBtn');
        const quickSuggestions = document.querySelectorAll('.suggestion-btn');
        
        if (!chatToggleBtn || !chatWindow) {
            console.error('Chatbot elements not found');
            return;
        }

        // Toggle chat window
        chatToggleBtn.addEventListener('click', () => {
            this.toggleChat();
        });

        // Close chat window
        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', () => {
                this.closeChat();
            });
        }

        // Send message on Enter
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Send button click
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // Quick suggestions
        quickSuggestions.forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.getAttribute('data-message');
                if (message) {
                    this.sendQuickMessage(message);
                }
            });
        });

        // Initialize with welcome message
        this.addWelcomeMessage();
        
        console.log('Chatbot setup complete');
    }

    toggleChat() {
        const chatWindow = document.getElementById('chatWindow');
        const notificationBadge = document.getElementById('notificationBadge');
        
        if (!chatWindow) return;

        this.chatState.isOpen = !this.chatState.isOpen;
        
        if (this.chatState.isOpen) {
            chatWindow.classList.add('open');
            // Hide notification badge when opening
            if (notificationBadge) {
                notificationBadge.style.display = 'none';
            }
            this.chatState.hasNewMessage = false;
            
            // Focus input after animation
            setTimeout(() => {
                const chatInput = document.getElementById('floatingChatInput');
                if (chatInput) chatInput.focus();
            }, 400);
        } else {
            chatWindow.classList.remove('open');
        }
    }

    closeChat() {
        const chatWindow = document.getElementById('chatWindow');
        if (chatWindow) {
            chatWindow.classList.remove('open');
            this.chatState.isOpen = false;
        }
    }

    addWelcomeMessage() {
        // Clear any existing messages first
        const messagesContainer = document.getElementById('floatingChatMessages');
        if (!messagesContainer) return;

        this.chatState.messages = [];
        
        const welcomeMessage = {
            type: 'bot',
            text: 'Hi! I\'m your AI travel assistant. Ask me about flight delays, rebooking options, or travel advice.',
            timestamp: new Date()
        };
        
        this.addMessageToUI(welcomeMessage);
        this.chatState.messages.push(welcomeMessage);
    }

    async sendMessage() {
        const chatInput = document.getElementById('floatingChatInput');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        // Add user message
        const userMessage = {
            type: 'user',
            text: message,
            timestamp: new Date()
        };
        
        this.addMessageToUI(userMessage);
        this.chatState.messages.push(userMessage);
        
        // Clear input
        chatInput.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Call chatbot API
            const response = await this.callChatbotAPI(message);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add bot response directly from API
            const botMessage = {
                type: 'bot',
                text: response.reply || 'I apologize, but I encountered an error processing your request.',
                timestamp: new Date(),
                intent: response.intent || 'unknown',
                context: response.context || {}
            };
            
            this.addMessageToUI(botMessage);
            this.chatState.messages.push(botMessage);
            
            // Log additional context for debugging
            if (response.actions && Object.keys(response.actions).length > 0) {
                console.log('Bot actions available:', response.actions);
            }
            
        } catch (error) {
            console.error('Chatbot API error:', error);
            
            this.hideTypingIndicator();
            
            // Add simple error message without fallback
            const botMessage = {
                type: 'bot',
                text: 'I\'m sorry, I\'m having trouble connecting to my backend service right now. Please try again in a moment.',
                timestamp: new Date()
            };
            
            this.addMessageToUI(botMessage);
            this.chatState.messages.push(botMessage);
        }
    }

    // Removed generateFallbackResponse method as requested

    // async sendQuickMessage(message) {
    //     const chatInput = document.getElementById('floatingChatInput');
    //     if (chatInput) {
    //         chatInput.value = message;
    //         await this.sendMessage();
    //     }
    // }

    // async callChatbotAPI(userMessage) {
    //     const payload = {
    //         message: userMessage,
    //         context: {
    //             current_portal: this.currentPortal,
    //             conversation_history: this.chatState.messages.slice(-5).map(msg => ({
    //                 type: msg.type,
    //                 text: msg.text,
    //                 timestamp: msg.timestamp
    //             })), // Last 5 messages for context
    //             timestamp: new Date().toISOString(),
    //             available_features: {
    //                 delay_prediction: true,
    //                 route_analysis: true,
    //                 alternative_flights: true,
    //                 airline_stats: true
    //             }
    //         }
    //     };

    //     console.log('Sending to chatbot API:', payload);

    //     const response = await fetch(this.CHATBOT_API_URL, {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //             'Accept': 'application/json'
    //         },
    //         body: JSON.stringify(payload)
    //     });

    //     if (!response.ok) {
    //         const errorText = await response.text();
    //         console.error('Chatbot API error details:', {
    //             status: response.status,
    //             statusText: response.statusText,
    //             body: errorText
    //         });
    //         throw new Error(`Chatbot API error: ${response.status} - ${response.statusText}`);
    //     }

    //     const data = await response.json();
    //     console.log('Chatbot API response:', data);
        
    //     return data;
    // }

    // addMessageToUI(message) {
    //     const messagesContainer = document.getElementById('floatingChatMessages');
    //     if (!messagesContainer) return;

    //     const messageElement = document.createElement('div');
    //     messageElement.className = `message ${message.type}-message`;
        
    //     const timeStr = this.formatMessageTime(message.timestamp);
        
    //     // Format the message text to handle line breaks and links
    //     const formattedText = this.formatMessageText(message.text);
        
    //     if (message.type === 'bot') {
    //         messageElement.innerHTML = `
    //             <div class="message-avatar">
    //                 <i data-lucide="bot" class="icon"></i>
    //             </div>
    //             <div class="message-content">
    //                 <div class="message-text">${formattedText}</div>
    //                 <div class="message-time">${timeStr}</div>
    //             </div>
    //         `;
    //     } else {
    //         messageElement.innerHTML = `
    //             <div class="message-avatar">
    //                 <i data-lucide="user" class="icon"></i>
    //             </div>
    //             <div class="message-content">
    //                 <div class="message-text">${this.escapeHtml(message.text)}</div>
    //                 <div class="message-time">${timeStr}</div>
    //             </div>
    //         `;
    //     }

    //     messagesContainer.appendChild(messageElement);
        
    //     // Re-initialize icons for new message
    //     this.initIcons();
        
    //     // Scroll to bottom
    //     this.scrollChatToBottom();
        
    //     // Show notification if chat is closed and it's a bot message
    //     if (!this.chatState.isOpen && message.type === 'bot') {
    //         this.showChatNotification();
    //     }
    // }

    // formatMessageText(text) {
    //     if (!text) return '';
        
    //     // Escape HTML first
    //     let formatted = this.escapeHtml(text);
        
    //     // Convert line breaks to <br>
    //     formatted = formatted.replace(/\n/g, '<br>');
        
    //     // Convert URLs to clickable links (simple regex for basic URLs)
    //     formatted = formatted.replace(
    //         /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi,
    //         '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
    //     );
        
    //     // Convert www. links to clickable links
    //     formatted = formatted.replace(
    //         /\[([^\]]+)\]\(([^)]+)\)/g,
    //         '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
    //     );
        
    //     return formatted;
    // }

    // showTypingIndicator() {
    //     const messagesContainer = document.getElementById('floatingChatMessages');
    //     if (!messagesContainer) return;

    //     // Remove existing typing indicator if any
    //     const existingTyping = document.getElementById('typingIndicator');
    //     if (existingTyping) {
    //         existingTyping.remove();
    //     }

    //     const typingElement = document.createElement('div');
    //     typingElement.className = 'typing-indicator';
    //     typingElement.id = 'typingIndicator';
    //     typingElement.innerHTML = `
    //         <div class="message-avatar">
    //             <i data-lucide="bot" class="icon"></i>
    //         </div>
    //         <div class="typing-dots">
    //             <div class="typing-dot"></div>
    //             <div class="typing-dot"></div>
    //             <div class="typing-dot"></div>
    //         </div>
    //     `;

    //     messagesContainer.appendChild(typingElement);
    //     this.initIcons();
    //     this.scrollChatToBottom();
    //     this.chatState.isTyping = true;
    // }

    // hideTypingIndicator() {
    //     const typingIndicator = document.getElementById('typingIndicator');
    //     if (typingIndicator) {
    //         typingIndicator.remove();
    //     }
    //     this.chatState.isTyping = false;
    // }

    // scrollChatToBottom() {
    //     const messagesContainer = document.getElementById('floatingChatMessages');
    //     if (messagesContainer) {
    //         setTimeout(() => {
    //             messagesContainer.scrollTop = messagesContainer.scrollHeight;
    //         }, 100);
    //     }
    // }

    // showChatNotification() {
    //     const notificationBadge = document.getElementById('notificationBadge');
    //     if (notificationBadge && !this.chatState.isOpen) {
    //         notificationBadge.style.display = 'flex';
    //         this.chatState.hasNewMessage = true;
    //     }
    // }

    // formatMessageTime(timestamp) {
    //     const now = new Date();
    //     const messageTime = new Date(timestamp);
    //     const diffMinutes = Math.floor((now - messageTime) / (1000 * 60));
        
    //     if (diffMinutes < 1) return 'Now';
    //     if (diffMinutes < 60) return `${diffMinutes}m ago`;
        
    //     const diffHours = Math.floor(diffMinutes / 60);
    //     if (diffHours < 24) return `${diffHours}h ago`;
        
    //     return messageTime.toLocaleDateString();
    // }

    // escapeHtml(text) {
    //     const div = document.createElement('div');
    //     div.textContent = text;
    //     return div.innerHTML;
    // }
    async sendQuickMessage(message) {
    const chatInput = document.getElementById('floatingChatInput');
    if (chatInput) {
        chatInput.value = message;
        await this.sendMessage();
    }
}

async callChatbotAPI(userMessage) {
    const payload = {
        message: userMessage,
        context: {
            current_portal: this.currentPortal,
            conversation_history: this.chatState.messages.slice(-5).map(msg => ({
                type: msg.type,
                text: msg.text,
                timestamp: msg.timestamp
            })), // Last 5 messages for context
            timestamp: new Date().toISOString(),
            available_features: {
                delay_prediction: true,
                route_analysis: true,
                alternative_flights: true,
                airline_stats: true
            }
        }
    };

    console.log('Sending to chatbot API:', payload);

    const response = await fetch(this.CHATBOT_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Chatbot API error details:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
        });
        throw new Error(`Chatbot API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Chatbot API response:', data);
    
    // Extract the response text from the JSON structure
    return {
        response: data.response || data.message || 'Sorry, I could not process your request.',
        timestamp: new Date().toISOString()
    };
}

addMessageToUI(message) {
    const messagesContainer = document.getElementById('floatingChatMessages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.type}-message`;
    
    const timeStr = this.formatMessageTime(message.timestamp);
    
    // Format the message text to handle line breaks and links
    const formattedText = this.formatMessageText(message.text);
    
    if (message.type === 'bot') {
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i data-lucide="bot" class="icon"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${formattedText}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i data-lucide="user" class="icon"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message.text)}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        `;
    }

    messagesContainer.appendChild(messageElement);
    
    // Re-initialize icons for new message
    this.initIcons();
    
    // Scroll to bottom
    this.scrollChatToBottom();
    
    // Show notification if chat is closed and it's a bot message
    if (!this.chatState.isOpen && message.type === 'bot') {
        this.showChatNotification();
    }
}

// Updated function to handle the API response
async sendMessage() {
    const input = document.getElementById('floatingChatInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!input || !input.value.trim()) return;
    
    const userMessage = input.value.trim();
    input.value = '';
    
    // Disable send button
    if (sendBtn) sendBtn.disabled = true;
    
    // Add user message to UI
    const userMsg = {
        type: 'user',
        text: userMessage,
        timestamp: new Date().toISOString()
    };
    this.chatState.messages.push(userMsg);
    this.addMessageToUI(userMsg);
    
    // Show typing indicator
    this.showTypingIndicator();
    
    try {
        // Call the API and get the structured response
        const apiResponse = await this.callChatbotAPI(userMessage);
        
        // Hide typing indicator
        this.hideTypingIndicator();
        
        // Add bot message to UI
        const botMsg = {
            type: 'bot',
            text: apiResponse.response, // Use the 'response' field from JSON
            timestamp: apiResponse.timestamp || new Date().toISOString()
        };
        this.chatState.messages.push(botMsg);
        this.addMessageToUI(botMsg);
        
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Hide typing indicator
        this.hideTypingIndicator();
        
        // Show error message
        const errorMsg = {
            type: 'bot',
            text: 'Sorry, I encountered an error while processing your message. Please try again.',
            timestamp: new Date().toISOString()
        };
        this.chatState.messages.push(errorMsg);
        this.addMessageToUI(errorMsg);
    } finally {
        // Re-enable send button
        if (sendBtn) sendBtn.disabled = false;
        
        // Focus back on input
        input.focus();
    }
}

formatMessageText(text) {
    if (!text) return '';
    
    // Escape HTML first
    let formatted = this.escapeHtml(text);
    
    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Convert URLs to clickable links (simple regex for basic URLs)
    formatted = formatted.replace(
        /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
    );
    
    // Convert markdown-style links to clickable links
    formatted = formatted.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
    );
    
    return formatted;
}

showTypingIndicator() {
    const messagesContainer = document.getElementById('floatingChatMessages');
    if (!messagesContainer) return;

    // Remove existing typing indicator if any
    const existingTyping = document.getElementById('typingIndicator');
    if (existingTyping) {
        existingTyping.remove();
    }

    const typingElement = document.createElement('div');
    typingElement.className = 'typing-indicator';
    typingElement.id = 'typingIndicator';
    typingElement.innerHTML = `
        <div class="message-avatar">
            <i data-lucide="bot" class="icon"></i>
        </div>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;

    messagesContainer.appendChild(typingElement);
    this.initIcons();
    this.scrollChatToBottom();
    this.chatState.isTyping = true;
}

hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
    this.chatState.isTyping = false;
}

scrollChatToBottom() {
    const messagesContainer = document.getElementById('floatingChatMessages');
    if (messagesContainer) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
}

showChatNotification() {
    const notificationBadge = document.getElementById('notificationBadge');
    if (notificationBadge && !this.chatState.isOpen) {
        notificationBadge.style.display = 'flex';
        this.chatState.hasNewMessage = true;
    }
}

formatMessageTime(timestamp) {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMinutes = Math.floor((now - messageTime) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return messageTime.toLocaleDateString();
}

escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
    // === END CHATBOT IMPLEMENTATION ===
    


    initNeonEffects() {
        const pulseElements = document.querySelectorAll('.portal-icon, .metric-value, .status');
        pulseElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                element.style.animation = 'pulse 0.6s ease-in-out';
            });
            element.addEventListener('mouseleave', () => {
                element.style.animation = '';
            });
        });

        const buttons = document.querySelectorAll('.btn, .nav-btn');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.createClickEffect(e.target, e.clientX, e.clientY);
            });
        });

        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transition = 'all 0.3s ease-out';
                card.style.boxShadow = '0 8px 40px rgba(0, 245, 255, 0.2)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
            });
        });

        console.log('Neon effects initialized');
    }

    createClickEffect(element, x, y) {
        const rect = element.getBoundingClientRect();
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.left = (x - rect.left) + 'px';
        ripple.style.top = (y - rect.top) + 'px';
        ripple.style.width = '0';
        ripple.style.height = '0';
        ripple.style.background = 'rgba(0, 245, 255, 0.6)';
        ripple.style.borderRadius = '50%';
        ripple.style.transform = 'translate(-50%, -50%)';
        ripple.style.animation = 'ripple 0.6s linear';
        ripple.style.pointerEvents = 'none';
        ripple.style.zIndex = '9999';

        element.style.position = 'relative';
        element.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    async loadData() {
        try {
            // Use static data for airports and airlines since these are standard IATA codes
            this.data = {
                airports: [
                    { code: "JFK", name: "John F. Kennedy International" },
                    { code: "LAX", name: "Los Angeles International" },
                    { code: "LHR", name: "Heathrow" },
                    { code: "SFO", name: "San Francisco International" },
                    { code: "ORD", name: "O'Hare International" },
                    { code: "ATL", name: "Hartsfield-Jackson Atlanta" },
                    { code: "DFW", name: "Dallas/Fort Worth International" },
                    { code: "DEN", name: "Denver International" },
                    { code: "LAS", name: "McCarran International" },
                    { code: "SEA", name: "Seattle-Tacoma International" },
                    { code: "BOS", name: "Logan International" },
                    { code: "MIA", name: "Miami International" },
                    { code: "PHX", name: "Phoenix Sky Harbor" },
                    { code: "CLT", name: "Charlotte Douglas" },
                    { code: "MSP", name: "Minneapolis-St. Paul" }
                ],
                airlines: [
                    { code: "AA", name: "American Airlines" },
                    { code: "DL", name: "Delta Air Lines" },
                    { code: "UA", name: "United Airlines" },
                    { code: "WN", name: "Southwest Airlines" },
                    { code: "AS", name: "Alaska Airlines" },
                    { code: "B6", name: "JetBlue Airways" },
                    { code: "NK", name: "Spirit Airlines" },
                    { code: "F9", name: "Frontier Airlines" },
                    { code: "G4", name: "Allegiant Air" },
                    { code: "HA", name: "Hawaiian Airlines" },
                    { code: "VX", name: "Virgin America" },
                    { code: "US", name: "US Airways" },
                    { code: "OO", name: "SkyWest Airlines" },
                    { code: "MQ", name: "American Eagle" },
                    { code: "EV", name: "ExpressJet" }
                ]
            };
            console.log('Static data loaded for airports and airlines');
        } catch (error) {
            console.error('Failed to initialize data:', error);
        }
    }

    async loadAirlineMetricsFromBackend() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/airline/metrics`);
            if (response.ok) {
                const backendMetrics = await response.json();
                console.log('Airline metrics loaded from backend');
            } else {
                console.warn('Could not load airline metrics from backend');
            }
        } catch (error) {
            console.warn('Failed to load airline metrics from backend:', error);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners with real API integration...');

        const portalElements = document.querySelectorAll('[data-portal]');
        portalElements.forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const portal = element.getAttribute('data-portal');
                if (portal && portal !== 'admin') { // Skip admin portal
                    this.showPortal(portal);
                    element.style.boxShadow = '0 0 30px rgba(0, 245, 255, 0.8)';
                    setTimeout(() => {
                        element.style.boxShadow = '';
                    }, 300);
                }
            });
        });

        const logoElement = document.querySelector('.logo[data-portal="landing"]');
        if (logoElement) {
            logoElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showPortal('landing');
            });
        }

        const navButtons = document.querySelectorAll('.nav-btn[data-portal]');
        navButtons.forEach(button => {
            const portal = button.getAttribute('data-portal');
            if (portal !== 'admin') { // Skip admin portal
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showPortal(portal);
                });
            }
        });

        const flightForm = document.getElementById('flightSearchForm');
        if (flightForm) {
            flightForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleFlightSearchRealAPI();
            });
        }

        const airlineSelect = document.getElementById('airlineSelect');
        if (airlineSelect) {
            airlineSelect.addEventListener('change', (e) => {
                this.updateAirlineMetrics(e.target.value);
                e.target.style.boxShadow = '0 0 15px rgba(0, 245, 255, 0.5)';
                setTimeout(() => {
                    e.target.style.boxShadow = '';
                }, 500);
            });
        }

        const routeSearchBtn = document.getElementById('routeSearchBtn');
        if (routeSearchBtn) {
            routeSearchBtn.addEventListener('click', () => this.handleRouteSearch());
        }

       
        console.log('Event listeners setup complete');
    }

    showPortal(portalId) {
        console.log(`SHOWING portal: ${portalId} with neon transition`);

        // Skip admin portal completely
        if (portalId === 'admin') {
            console.log('Admin portal disabled');
            return;
        }

        document.querySelectorAll('.portal').forEach(portal => {
            portal.classList.remove('active');
        });

        const targetPortal = document.getElementById(portalId);
        if (targetPortal) {
            targetPortal.classList.add('active');
            console.log(`Portal ${portalId} activated successfully`);
        } else {
            console.error(`Portal ${portalId} not found in DOM`);
            return;
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            const btnPortal = btn.getAttribute('data-portal');
            if (btnPortal === portalId) {
                btn.classList.add('active');
            }
        });

        this.currentPortal = portalId;

        setTimeout(() => {
            if (portalId === 'airline') {
                console.log('Initializing airline charts');
                this.updateAirlineCharts();
            }
        }, 300);

        console.log(`Portal navigation to ${portalId} completed`);
    }

    populateDropdowns() {
        console.log('Populating dropdowns with real data...');

        // Populate traveler portal dropdowns
        const originSelect = document.getElementById('originSelect');
        const destinationSelect = document.getElementById('destinationSelect');
        if (originSelect && destinationSelect && this.data && this.data.airports) {
            originSelect.innerHTML = '<option value="">Select Origin</option>';
            destinationSelect.innerHTML = '<option value="">Select Destination</option>';
            this.data.airports.forEach(airport => {
                const option1 = document.createElement('option');
                option1.value = airport.code;
                option1.textContent = `${airport.name} (${airport.code})`;
                const option2 = document.createElement('option');
                option2.value = airport.code;
                option2.textContent = `${airport.name} (${airport.code})`;
                originSelect.appendChild(option1);
                destinationSelect.appendChild(option2);
            });
        }
        
        // Populate airline dashboard route dropdowns
        const routeOriginSelect = document.getElementById('routeOriginSelect');
        const routeDestinationSelect = document.getElementById('routeDestinationSelect');
        if (routeOriginSelect && routeDestinationSelect && this.data && this.data.airports) {
            routeOriginSelect.innerHTML = '<option value="">Select Origin</option>';
            routeDestinationSelect.innerHTML = '<option value="">Select Destination</option>';
            this.data.airports.forEach(airport => {
                const option1 = document.createElement('option');
                option1.value = airport.code;
                option1.textContent = `${airport.name} (${airport.code})`;
                const option2 = document.createElement('option');
                option2.value = airport.code;
                option2.textContent = `${airport.name} (${airport.code})`;
                routeOriginSelect.appendChild(option1);
                routeDestinationSelect.appendChild(option2);
            });
        }

        // Populate airline dropdowns
        const airlineSelect = document.getElementById('airlineSelect');
        const userAirlineSelect = document.getElementById('userAirlineSelect');
        if (this.data && this.data.airlines) {
            if (airlineSelect) {
                airlineSelect.innerHTML = '<option value="">Select Airline</option>';
                this.data.airlines.forEach(airline => {
                    const option = document.createElement('option');
                    option.value = airline.code;
                    option.textContent = `${airline.name} (${airline.code})`;
                    airlineSelect.appendChild(option);
                });
            }
            if (userAirlineSelect) {
                userAirlineSelect.innerHTML = '<option value="">Select Airline</option>';
                this.data.airlines.forEach(airline => {
                    const option = document.createElement('option');
                    option.value = airline.code;
                    option.textContent = `${airline.name} (${airline.code})`;
                    userAirlineSelect.appendChild(option);
                });
            }
        }
        console.log('Dropdowns populated with real data');
    }

    async handleFlightSearchRealAPI() {
        console.log('Handling flight search with real API...');

        const originSelect = document.getElementById('originSelect');
        const destinationSelect = document.getElementById('destinationSelect');
        const dateInput = document.getElementById('flightDate');
        const timeInput = document.getElementById('flightTime');
        const airlineSelect = document.getElementById('userAirlineSelect');
        const scheduledTimeInput = document.getElementById('scheduledTime');
        const distanceInput = document.getElementById('flightDistance');

        const origin = originSelect?.value;
        const destination = destinationSelect?.value;
        const date = dateInput?.value;
        const timeStr = timeInput?.value;
        const airlineCode = airlineSelect?.value;
        const scheduledTime = parseInt(scheduledTimeInput?.value) || 0;
        const distance = parseInt(distanceInput?.value) || 0;

        if (!origin || !destination || !date || !timeStr || !airlineCode || !scheduledTime || !distance) {
            this.showNeonNotification('Please fill out all required fields', 'error');
            return;
        }

        if (origin === destination) {
            this.showNeonNotification('Origin and destination cannot be the same', 'error');
            return;
        }

        // Parse date and time
        const dateObj = new Date(date);
        const [hours, minutes] = timeStr.split(':').map(Number);
        const scheduledDeparture = hours * 100 + minutes;

        const payload = {
            year: dateObj.getFullYear(),
            month: dateObj.getMonth() + 1,
            day: dateObj.getDate(),
            airline: airlineCode,
            origin_airport: origin,
            destination_airport: destination,
            scheduled_departure: scheduledDeparture,
            scheduled_time: scheduledTime,
            distance: distance
        };

        console.log('Sending payload to API:', payload);

        try {
            this.showModal('loadingModal', 'Analyzing flight data...');

            // Call prediction API
            const predictionResponse = await fetch(`${this.API_BASE_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!predictionResponse.ok) {
                const errorText = await predictionResponse.text();
                throw new Error(`Prediction API error: ${predictionResponse.status} - ${errorText}`);
            }

            const predictionData = await predictionResponse.json();
            console.log('Received prediction response:', predictionData);

            this.hideModal('loadingModal');
            this.displayPredictionResults(predictionData);

            // Load route statistics and alternative flights
            await this.loadRouteData(origin, destination, date);

        } catch (error) {
            this.hideModal('loadingModal');
            this.showNeonNotification('API request failed: ' + error.message, 'error');
            console.error('Error calling API:', error);
        }
    }

    displayPredictionResults(data) {
        const predictionCard = document.getElementById('predictionResults');
        const probabilityElement = document.getElementById('delayProbability');
        const predictionTextElement = document.getElementById('predictionText');
        const confidenceElement = document.getElementById('confidenceScore');
        const statusElement = document.getElementById('predictionStatus');

        if (!predictionCard || !data.prediction) {
            console.error('Prediction result elements not found or invalid data');
            return;
        }

        const prediction = data.prediction;
        const probability = prediction.delay_probability || 0;
        const isDelayed = prediction.is_delayed || false;
        const predictionText = prediction.prediction_text || 'UNKNOWN';
        const confidence = prediction.confidence || 0;

        probabilityElement.textContent = `${Math.round(probability * 100)}%`;
        predictionTextElement.textContent = predictionText;
        confidenceElement.textContent = `${Math.round(confidence * 100)}%`;

        // Add pulse animation
        probabilityElement.style.animation = 'pulse 1s ease-in-out 3';
        predictionTextElement.style.animation = 'pulse 1s ease-in-out 3';
        confidenceElement.style.animation = 'pulse 1s ease-in-out 3';

        // Determine status based on prediction
        let statusClass = 'status--success';
        let statusText = 'Low Risk';
        
        if (isDelayed) {
            statusClass = 'status--error';
            statusText = 'High Risk - Delay Expected';
        } else if (probability > 0.3) {
            statusClass = 'status--warning';
            statusText = 'Medium Risk';
        }

        statusElement.innerHTML = `<span class="status ${statusClass}">${statusText}</span>`;

        // Show card with animation
        predictionCard.style.opacity = '0';
        predictionCard.classList.remove('hidden');
        predictionCard.style.transform = 'translateY(20px)';

        setTimeout(() => {
            predictionCard.style.transition = 'all 0.5s ease-out';
            predictionCard.style.opacity = '1';
            predictionCard.style.transform = 'translateY(0)';
        }, 100);
    }

    async loadRouteData(origin, destination, date) {
        try {
            // Call route flights API
            const routeResponse = await fetch(
                `${this.API_BASE_URL}/get_flights_by_route?origin_airport=${origin}&destination_airport=${destination}&date=${date}`
            );

            if (!routeResponse.ok) {
                throw new Error(`Route API error: ${routeResponse.status}`);
            }

            const routeData = await routeResponse.json();
            console.log('Received route data:', routeData);

            this.displayRouteStatistics(routeData);
            this.displayAlternativeFlights(routeData.flights || []);

        } catch (error) {
            console.error('Error loading route data:', error);
            this.showNeonNotification('Could not load route statistics', 'warning');
        }
    }

    async displayRouteStatistics(routeData) {
        const routeStatsCard = document.getElementById('routeStatsCard');
        const routeNameElement = document.getElementById('routeName');
        const totalFlightsElement = document.getElementById('totalFlights');
        const totalAirlinesElement = document.getElementById('totalAirlines');
        const avgArrivalDelayElement = document.getElementById('avgArrivalDelay');
        const avgDepartureDelayElement = document.getElementById('avgDepartureDelay');

        if (!routeStatsCard || !routeData) return;

        routeNameElement.textContent = routeData.route || 'N/A';
        totalFlightsElement.textContent = routeData.total_flights_available || '0';

        // Fetch extra analysis from /route-performance-all
        try {
            const [origin, destination] = routeData.route.split('->').map(s => s.trim());
            const resp = await fetch(`${this.API_BASE_URL}/route-performance-all?origin=${origin}&destination=${destination}`);
            if (resp.ok) {
                const analysis = await resp.json();
                totalAirlinesElement.textContent =
                    analysis.total_airlines != null ? Number(analysis.total_airlines).toLocaleString() : '--';
                avgArrivalDelayElement.textContent =
                    analysis.avg_arrival_delay != null ? `${analysis.avg_arrival_delay.toFixed(2)} min` : '--';
                avgDepartureDelayElement.textContent =
                    analysis.avg_departure_delay != null ? `${analysis.avg_departure_delay.toFixed(2)} min` : '--';
            } else {
                totalAirlinesElement.textContent = '--';
                avgArrivalDelayElement.textContent = '--';
                avgDepartureDelayElement.textContent = '--';
            }
        } catch (err) {
            totalAirlinesElement.textContent = '--';
            avgArrivalDelayElement.textContent = '--';
            avgDepartureDelayElement.textContent = '--';
        }

        // Show card with animation
        routeStatsCard.style.opacity = '0';
        routeStatsCard.classList.remove('hidden');
        setTimeout(() => {
            routeStatsCard.style.transition = 'all 0.5s ease-out';
            routeStatsCard.style.opacity = '1';
        }, 200);
    }

    displayAlternativeFlights(flights) {
        const alternativesCard = document.getElementById('alternativesCard');
        const alternativesList = document.getElementById('alternativesList');

        if (!alternativesCard || !alternativesList || !Array.isArray(flights)) return;

        // Take top 5 flights with lowest delay risk
        const topFlights = flights.slice(0, 5);

        if (topFlights.length === 0) {
            alternativesList.innerHTML = '<p>No alternative flights available for this route.</p>';
        } else {
            alternativesList.innerHTML = topFlights.map(flight => {
                const depStr = flight.scheduled_departure.toString().padStart(4, '0');
                const depFormatted = `${depStr.slice(0, 2)}:${depStr.slice(2)}`;
                
                const arrStr = flight.scheduled_arrival.toString().padStart(4, '0');
                const arrFormatted = `${arrStr.slice(0, 2)}:${arrStr.slice(2)}`;

                let riskClass = 'risk-low';
                let riskText = flight.delay_risk || 'Low';
                
                if (riskText.toLowerCase().includes('high')) {
                    riskClass = 'risk-high';
                } else if (riskText.toLowerCase().includes('medium')) {
                    riskClass = 'risk-medium';
                }

                return `
                    <div class="alternative-flight">
                        <div class="flight-info">
                            <div class="flight-route">${flight.airline} ${flight.flight_number} - ${depFormatted} → ${arrFormatted}</div>
                            <div class="flight-details">
                                Avg Arrival Delay: ${flight.avg_arrival_delay?.toFixed(1) || 'N/A'}min • 
                                Avg Departure Delay: ${flight.avg_departure_delay?.toFixed(1) || 'N/A'}min
                            </div>
                        </div>
                        <div class="risk-score">
                            <div class="risk-indicator ${riskClass}"></div>
                            <span>${riskText} Risk</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Show card with animation
        alternativesCard.style.opacity = '0';
        alternativesCard.classList.remove('hidden');

        setTimeout(() => {
            alternativesCard.style.transition = 'all 0.5s ease-out';
            alternativesCard.style.opacity = '1';
        }, 300);
    }

async handleRouteSearch() {
    const origin = document.getElementById('routeOriginSelect')?.value;
    const destination = document.getElementById('routeDestinationSelect')?.value;
    const routeStatsCard = document.getElementById('routeStatsCard');

    if (!origin || !destination) {
        this.showNeonNotification('Please select both an origin and a destination.', 'warning');
        return;
    }
    
    if (origin === destination) {
        this.showNeonNotification('Origin and destination cannot be the same.', 'error');
        return;
    }

    try {
        // Try to get data from multiple airlines and aggregate
        const airlines = ['AA', 'DL', 'UA', 'WN']; // Major airlines
        const routeDataArray = [];
        
        console.log(`Searching route data for ${origin} → ${destination} across multiple airlines...`);

        // Fetch data for each airline
        for (const airline of airlines) {
            try {
                const response = await fetch(`${this.API_BASE_URL}/route-performance?airline=${airline}&origin=${origin}&destination=${destination}`);
                
                if (response.ok) {
                    const data = await response.json();
                    routeDataArray.push(data);
                    console.log(`Found data for ${airline}:`, data);
                }
            } catch (err) {
                console.log(`No data for airline ${airline}:`, err.message);
            }
        }

        if (routeDataArray.length === 0) {
            throw new Error(`No flight data found for route ${origin} to ${destination}`);
        }

        // Aggregate the data from all airlines
        const aggregatedData = this.aggregateRouteData(routeDataArray);
        console.log('Aggregated route data:', aggregatedData);

        // Helper function to safely update DOM elements
        const updateElement = (id, value, fallback = '--') => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value ?? fallback;
                console.log(`Updated ${id} to: ${element.textContent}`);
            } else {
                console.error(`Element with ID '${id}' not found`);
            }
        };

        // Update all the route metrics
        updateElement('routeName', `${origin} → ${destination} (${routeDataArray.length} airlines)`);

        updateElement('totalFlights1', 
            aggregatedData.total_flights != null ? Number(aggregatedData.total_flights).toLocaleString() : '--'
        );

        updateElement('avgArrivalDelay1', 
            aggregatedData.avg_arrival_delay != null ? `${aggregatedData.avg_arrival_delay.toFixed(2)} min` : '--'
        );

        updateElement('avgDepartureDelay1', 
            aggregatedData.avg_departure_delay != null ? `${aggregatedData.avg_departure_delay.toFixed(2)} min` : '--'
        );

        // Update delay distribution
        if (aggregatedData.delay_distribution) {
            updateElement('delay_0_15', aggregatedData.delay_distribution['0-15min']);
            updateElement('delay_15_60', aggregatedData.delay_distribution['15-60min']);
            updateElement('delay_60_plus', aggregatedData.delay_distribution['60+min']);
        }

        // Show the route stats card
        if (routeStatsCard) {
            routeStatsCard.classList.remove('hidden');
        }

        this.showNeonNotification(`Route analysis complete for ${origin} → ${destination} (${routeDataArray.length} airlines)`, 'success');

    } catch (error) {
        console.error('Failed to load route performance:', error);
        this.showNeonNotification(error.message, 'error');

        // Reset all fields on error
        const fieldsToReset = ['totalFlights', 'avgArrivalDelay', 'avgDepartureDelay', 'delay_0_15', 'delay_15_60', 'delay_60_plus'];
        fieldsToReset.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '--';
        });

        if (routeStatsCard) {
            routeStatsCard.classList.add('hidden');
        }
    }
}
aggregateRouteData(dataArray) {
    if (dataArray.length === 0) return null;
    if (dataArray.length === 1) return dataArray[0];

    const aggregated = {
        total_flights: 0,
        avg_arrival_delay: 0,
        avg_departure_delay: 0,
        delay_distribution: {
            '0-15min': 0,
            '15-60min': 0,
            '60+min': 0
        }
    };

    let totalFlightsForAvg = 0;
    let weightedArrivalDelay = 0;
    let weightedDepartureDelay = 0;

    dataArray.forEach(data => {
        // Sum total flights
        aggregated.total_flights += data.total_flights || 0;
        
        // Calculate weighted averages for delays
        const flights = data.total_flights || 0;
        totalFlightsForAvg += flights;
        weightedArrivalDelay += (data.avg_arrival_delay || 0) * flights;
        weightedDepartureDelay += (data.avg_departure_delay || 0) * flights;
        
        // Sum delay distributions
        if (data.delay_distribution) {
            aggregated.delay_distribution['0-15min'] += data.delay_distribution['0-15min'] || 0;
            aggregated.delay_distribution['15-60min'] += data.delay_distribution['15-60min'] || 0;
            aggregated.delay_distribution['60+min'] += data.delay_distribution['60+min'] || 0;
        }
    });

    // Calculate weighted average delays
    if (totalFlightsForAvg > 0) {
        aggregated.avg_arrival_delay = weightedArrivalDelay / totalFlightsForAvg;
        aggregated.avg_departure_delay = weightedDepartureDelay / totalFlightsForAvg;
    }

    return aggregated;
}

    async updateAirlineMetrics(airlineCode) {
        const metricsContainer = document.getElementById('airlineMetrics');
        const rankingContainer = document.getElementById('rankingMetrics');
        if (!metricsContainer || !rankingContainer) return;

        if (!airlineCode) {
            metricsContainer.innerHTML = `
                <div class="metric-card"><span class="metric-label">On-Time Performance</span><span class="metric-value">--</span></div>
                <div class="metric-card"><span class="metric-label">Avg Arrival Delay</span><span class="metric-value">--</span></div>
                <div class="metric-card"><span class="metric-label">Avg Departure Delay</span><span class="metric-value">--</span></div>
                <div class="metric-card"><span class="metric-label">Monthly Flights</span><span class="metric-value">--</span></div>
            `;
            rankingContainer.innerHTML = `
                <div class="financial-metric"><span class="metric-label">Rank by Arrival Delay</span><span class="metric-value">--</span></div>
                <div class="financial-metric"><span class="metric-label">Rank by Departure Delay</span><span class="metric-value">--</span></div>
            `;
            if (this.charts.delayCauseChart) this.charts.delayCauseChart.destroy();
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/airline-delay-stats?airline=${airlineCode}`);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const stats = await response.json();

            const totalDelayPercentage = Object.values(stats.delays_by_cause).reduce((sum, value) => sum + value, 0);
            const onTimePerformance = 100 - totalDelayPercentage;

            metricsContainer.innerHTML = `
                <div class="metric-card">
                    <span class="metric-label">On-Time Performance</span>
                    <span class="metric-value">${onTimePerformance.toFixed(1)}%</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Avg Arrival Delay</span>
                    <span class="metric-value">${stats.avg_arrival_delay.toFixed(1)} min</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Avg Departure Delay</span>
                    <span class="metric-value">${stats.avg_departure_delay.toFixed(1)} min</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Monthly Flights</span>
                    <span class="metric-value">${stats.total_flights.toLocaleString()}</span>
                </div>
            `;

            rankingContainer.innerHTML = `
                <div class="financial-metric">
                    <span class="metric-label">Rank by Arrival Delay</span>
                    <span class="metric-value">${stats.ranking.rank_by_arrival_delay} / ${stats.ranking.total_airlines}</span>
                </div>
                <div class="financial-metric">
                    <span class="metric-label">Rank by Departure Delay</span>
                    <span class="metric-value">${stats.ranking.rank_by_departure_delay} / ${stats.ranking.total_airlines}</span>
                </div>
            `;
            
            this.createDelayCauseChart(stats.delays_by_cause);

        } catch (error) {
            console.error('Failed to load airline stats:', error);
            this.showNeonNotification(`Could not load stats for ${airlineCode}.`, 'error');
        }
    }

    initializeCharts() {
        this.charts = {};
    }

    updateAirlineCharts() {
        setTimeout(() => {
            // Charts are now loaded dynamically when airline is selected
        }, 300);
    }

    createDelayCauseChart(delayData) {
        const ctx = document.getElementById('delayCauseChart');
        if (!ctx) return;

        if (this.charts.delayCauseChart) {
            this.charts.delayCauseChart.destroy();
        }

        const labels = Object.keys(delayData).map(key =>
            key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        );
        const data = Object.values(delayData);

        this.charts.delayCauseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Delay Cause %',
                    data: data,
                    backgroundColor: [
                        '#00f5ff', // Neon Blue
                        '#ff10f0', // Neon Pink
                        '#39ff14', // Neon Green
                        '#ffac1c', // Neon Orange
                        '#bf00ff'  // Neon Purple
                    ],
                    borderColor: '#1a1a1a',
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#ffffff',
                            font: { size: 12 },
                            boxWidth: 20
                        }
                    }
                }
            }
        });
    }

    showModal(modalId, message) {
        const modal = document.getElementById(modalId);
        const messageElement = document.getElementById('loadingMessage');

        if (modal) {
            if (messageElement && message) {
                messageElement.textContent = message;
            }
            modal.style.opacity = '0';
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.style.transition = 'opacity 0.3s ease-out';
                modal.style.opacity = '1';
            }, 50);
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    }

    showNeonNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert--${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
            max-width: 400px;
            background: rgba(10, 10, 10, 0.95);
            backdrop-filter: blur(20px);
            border: 2px solid var(--neon-blue);
            box-shadow: 0 0 30px rgba(0, 245, 255, 0.5);
            animation: slideInRight 0.5s ease-out;
            padding: 16px;
            border-radius: 8px;
        `;

        const iconMap = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        };

        notification.innerHTML = `
            <i data-lucide="${iconMap[type]}" class="alert-icon" style="color: var(--neon-blue); margin-right: 12px;"></i>
            <div class="alert-content">
                <span class="alert-message" style="color: #ffffff;">${message}</span>
            </div>
        `;

        document.body.appendChild(notification);
        this.initIcons();

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease-out';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }

    // async updateRouteDelayDistribution(airline, origin, destination) {
    //     try {
    //          // Add this to your event listener setup (if not already present)
    //         document.getElementById('routeSearchBtn').addEventListener('click', () => {
    //             const airline = document.getElementById('airlineSelect').value; // Airline dropdown
    //             const origin = document.getElementById('routeOriginSelect').value; // Origin dropdown
    //             const destination = document.getElementById('routeDestinationSelect').value; // Destination dropdown
    //             app.updateRouteDelayDistribution(airline, origin, destination);
    //         });
    //         const resp = await fetch(`http://127.0.0.1:8000/route-performance?airline=${airline}&origin=${origin}&destination=${destination}`);
    //         if (!resp.ok) throw new Error('API error');
    //         const data = await resp.json();

    //         // Log the full API output to the browser console
    //         console.log('API output for route-performance:', data);

    //         document.getElementById('delay_0_15').textContent = data.delay_distribution?.['0-15min'] ?? '--';
    //         document.getElementById('delay_15_60').textContent = data.delay_distribution?.['15-60min'] ?? '--';
    //         document.getElementById('delay_60_plus').textContent = data.delay_distribution?.['60+min'] ?? '--';
    //         document.getElementById('totalFlights').textContent = data.total_flights ?? '--';
    //         document.getElementById('avgArrivalDelay').textContent = data.avg_arrival_delay != null ? `${data.avg_arrival_delay.toFixed(2)} min` : '--';
    //         document.getElementById('avgDepartureDelay').textContent = data.avg_departure_delay != null ? `${data.avg_departure_delay.toFixed(2)} min` : '--';
    //     } catch (err) {
    //         document.getElementById('delay_0_15').textContent = '--';
    //         document.getElementById('delay_15_60').textContent = '--';
    //         document.getElementById('delay_60_plus').textContent = '--';
    //         document.getElementById('totalFlights').textContent = '--';
    //         document.getElementById('avgArrivalDelay').textContent = '--';
    //         document.getElementById('avgDepartureDelay').textContent = '--';
    //     }
    // }
}

// Add required CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px currentColor); }
        50% { transform: scale(1.05); filter: drop-shadow(0 0 20px currentColor); }
    }

    @keyframes ripple {
        to { width: 60px; height: 60px; opacity: 0; }
    }

    .alternative-flight {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        margin-bottom: 10px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(0, 245, 255, 0.2);
        border-radius: 8px;
        transition: all 0.3s ease;
    }

    .alternative-flight:hover {
        border-color: rgba(0, 245, 255, 0.5);
        background: rgba(0, 0, 0, 0.5);
    }

    .flight-info { flex: 1; }

    .flight-route {
        font-weight: 600;
        color: #00f5ff;
        margin-bottom: 4px;
    }

    .flight-details {
        font-size: 12px;
        color: #cccccc;
    }

    .risk-score {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
    }

    .risk-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .risk-low { background-color: #39ff14; }
    .risk-medium { background-color: #ffac1c; }
    .risk-high { background-color: #ff10f0; }

    .route-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 20px;
    }

    .route-metric {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .route-metric .metric-label {
        font-size: 12px;
        color: #cccccc;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .route-metric .metric-value {
        font-size: 18px;
        font-weight: 600;
        color: #00f5ff;
    }

    .alert {
        display: flex;
        align-items: center;
        gap: 12px;
    }
`;
document.head.appendChild(style);

// Global app instance
let app = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing real API integrated app...');
    app = new FlightPredictApp();
});

// Fallback initialization
window.addEventListener('load', () => {
    if (!app) {
        console.log('Fallback initialization...');
        app = new FlightPredictApp();
    }
});