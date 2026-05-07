function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('examforge_darkmode', isDark ? '1' : '0');
    
    const btn = document.getElementById('darkToggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

// Apply saved preference
document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('examforge_darkmode') === '1') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('darkToggle');
        if (btn) btn.textContent = '☀️';
    }
});