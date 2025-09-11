// UI management for the Fog of War game

import { DOMUtils } from './dom-utils.js';

export class UIManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.isMobile = this.checkIsMobile();
        this.currentMobileTab = 'game';
        this.initializeUI();
    }

    checkIsMobile() {
        const width = window.innerWidth;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return width <= 768 || isMobileUA;
    }

    initializeUI() {
        this.initMobileTabs();
        this.initAccordion();
        this.setupEventListeners();
    }

    initMobileTabs() {
        if (!this.isMobile) {
            DOMUtils.hide('mobileTabBar');
            DOMUtils.show('desktopLayout');
            return;
        }

        DOMUtils.show('mobileTabBar');
        DOMUtils.hide('desktopLayout');
        
        const tabs = document.querySelectorAll('.mobile-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchMobileTab(tabName);
            });
        });
        
        this.switchMobileTab('game');
    }

    switchMobileTab(tab) {
        if (!this.isMobile) return;
        
        this.currentMobileTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.mobile-tab').forEach(t => {
            t.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Show/hide content
        DOMUtils.hide('gameSection');
        DOMUtils.hide('playersSection');
        DOMUtils.hide('chatSection');
        
        switch(tab) {
            case 'game':
                DOMUtils.show('gameSection');
                break;
            case 'players':
                DOMUtils.show('playersSection');
                break;
            case 'chat':
                DOMUtils.show('chatSection');
                break;
        }
    }

    initAccordion() {
        // Show appropriate controls based on device type
        const desktopControls = document.getElementById('desktopControls');
        const mobileControls = document.getElementById('mobileControls');
        
        if (this.isMobile) {
            DOMUtils.hide(desktopControls);
            DOMUtils.show(mobileControls);
        } else {
            DOMUtils.show(desktopControls);
            DOMUtils.hide(mobileControls);
        }

        // Setup accordion functionality
        const accordionHeaders = document.querySelectorAll('.accordion-header');
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => this.toggleAccordion(header));
        });
    }

    toggleAccordion(header) {
        const content = header.nextElementSibling;
        const arrow = header.querySelector('.accordion-arrow');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(90deg)';
        } else {
            content.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    }

    setupEventListeners() {
        // Join/Leave buttons
        const joinBtn = document.getElementById('joinBtn');
        const leaveBtn = document.getElementById('leaveBtn');
        const startBtn = document.getElementById('startBtn');
        const copyUrlBtn = document.getElementById('copyUrlBtn');

        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinAsPlayer());
        }
        
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.leaveGame());
        }
        
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }
        
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => this.copyGameUrl());
        }

        // Mobile stats toggle
        this.setupMobileStatsToggle();
    }

    setupMobileStatsToggle() {
        const toggle = document.getElementById('mobileStatsToggle');
        const label = document.getElementById('mobileStatsLabel');
        const wrapper = document.querySelector('#mobileGameStats .stats-wrapper');
        let isVisible = true;
        
        if (toggle && wrapper) {
            toggle.addEventListener('click', () => {
                isVisible = !isVisible;
                wrapper.style.display = isVisible ? 'block' : 'none';
                if (label) {
                    label.textContent = isVisible ? 'Hide game stats' : 'Show game stats ->';
                }
            });
        }
    }

    updateButtonVisibility() {
        const joinControls = document.getElementById('joinControls');
        const gameOverlay = document.getElementById('gameOverlay');
        const joinBtn = document.getElementById('joinBtn');
        const leaveBtn = document.getElementById('leaveBtn');
        const startBtn = document.getElementById('startBtn');
        const hostIndicator = document.getElementById('hostIndicator');

        if (this.gameState.gameStarted) {
            DOMUtils.hide(joinControls);
            DOMUtils.show(gameOverlay);
        } else {
            DOMUtils.show(joinControls);
            DOMUtils.hide(gameOverlay);
            
            if (this.gameState.playerIndex >= 0) {
                DOMUtils.hide(joinBtn);
                DOMUtils.show(leaveBtn);
            } else {
                DOMUtils.show(joinBtn);
                DOMUtils.hide(leaveBtn);
            }
            
            if (this.gameState.isHost) {
                DOMUtils.show(startBtn);
                DOMUtils.show(hostIndicator);
            } else {
                DOMUtils.hide(startBtn);
                DOMUtils.hide(hostIndicator);
            }
        }
    }

    updateTurnDisplay() {
        const turnElement = document.getElementById('turnNumber');
        if (turnElement && this.gameState.gameState && this.gameState.gameState.turn !== undefined) {
            turnElement.textContent = this.gameState.gameState.turn;
        }
    }

    showGameEndModal(winnerName, winnerIndex) {
        const modal = document.getElementById('gameEndModal');
        const winnerText = document.getElementById('winnerText');
        const winnerColor = document.getElementById('winnerColor');
        
        if (modal && winnerText) {
            winnerText.textContent = winnerName;
            if (winnerColor && winnerIndex >= 0) {
                const playerColors = [
                    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
                    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff6348'
                ];
                winnerColor.style.backgroundColor = playerColors[winnerIndex % playerColors.length];
            }
            DOMUtils.show(modal);
        }
    }

    closeGameEndModal() {
        DOMUtils.hide('gameEndModal');
    }

    copyGameUrl() {
        navigator.clipboard.writeText(window.location.href).then(() => {
            const btn = document.getElementById('copyUrlBtn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.background = '#4CAF50';
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy URL:', err);
            
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                const btn = document.getElementById('copyUrlBtn');
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 2000);
                }
            } catch (err) {
                console.error('Fallback copy failed:', err);
            }
            
            document.body.removeChild(textArea);
        });
    }

    // Placeholder methods for game actions (to be implemented with socket integration)
    joinAsPlayer() {
        // Will be implemented when integrating with socket system
        console.log('Join as player clicked');
    }

    leaveGame() {
        // Will be implemented when integrating with socket system
        console.log('Leave game clicked');
    }

    startGame() {
        // Will be implemented when integrating with socket system
        console.log('Start game clicked');
    }
}
