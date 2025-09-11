// DOM utility functions for UI manipulation

export class DOMUtils {
    static show(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.display = 'block';
        }
    }

    static hide(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.display = 'none';
        }
    }

    static toggle(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
    }

    static addClass(element, className) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.add(className);
        }
    }

    static removeClass(element, className) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.remove(className);
        }
    }

    static toggleClass(element, className) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.toggle(className);
        }
    }

    static setText(element, text) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.textContent = text;
        }
    }

    static setHTML(element, html) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.innerHTML = html;
        }
    }

    static getValue(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        return element ? element.value : '';
    }

    static setValue(element, value) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.value = value;
        }
    }

    static clearValue(element) {
        this.setValue(element, '');
    }
}
