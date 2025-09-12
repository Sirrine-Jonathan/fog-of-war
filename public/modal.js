// Modal system
class Modal {
    constructor() {
        this.createModalContainer();
    }

    createModalContainer() {
        if (document.getElementById('modalContainer')) return;
        
        const container = document.createElement('div');
        container.id = 'modalContainer';
        container.className = 'modal-overlay';
        container.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title"></h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer">
                    <button class="btn modal-cancel">Cancel</button>
                    <button class="btn modal-confirm">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        
        // Event listeners
        container.querySelector('.modal-close').onclick = () => this.hide();
        container.querySelector('.modal-cancel').onclick = () => this.hide();
        container.onclick = (e) => {
            if (e.target === container) this.hide();
        };
    }

    show(options = {}) {
        const container = document.getElementById('modalContainer');
        const title = container.querySelector('.modal-title');
        const body = container.querySelector('.modal-body');
        const confirmBtn = container.querySelector('.modal-confirm');
        const cancelBtn = container.querySelector('.modal-cancel');
        
        title.textContent = options.title || 'Confirm';
        body.textContent = options.message || 'Are you sure?';
        confirmBtn.textContent = options.confirmText || 'Confirm';
        cancelBtn.textContent = options.cancelText || 'Cancel';
        
        // Set button styles
        confirmBtn.className = `btn modal-confirm ${options.confirmClass || ''}`;
        
        // Set up confirm handler
        confirmBtn.onclick = () => {
            this.hide();
            if (options.onConfirm) options.onConfirm();
        };
        
        container.style.display = 'flex';
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    hide() {
        document.getElementById('modalContainer').style.display = 'none';
        if (this.resolve) this.resolve(false);
    }
}

// Global modal instance
window.modal = new Modal();

// Convenience function
window.showModal = (options) => window.modal.show(options);