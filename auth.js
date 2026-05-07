// Initialize storage with multi-school support
function initStorage() {
    if (!localStorage.getItem('examforge_students')) {
        localStorage.setItem('examforge_students', JSON.stringify([]));
    }
    if (!localStorage.getItem('examforge_tests')) {
        localStorage.setItem('examforge_tests', JSON.stringify([]));
    }
    if (!localStorage.getItem('examforge_results')) {
        localStorage.setItem('examforge_results', JSON.stringify([]));
    }
    if (!localStorage.getItem('examforge_admin')) {
        localStorage.setItem('examforge_admin', JSON.stringify({
            username: 'admin',
            password: 'admin123',
            name: 'Super Administrator',
            photo: null
        }));
    }
    if (!localStorage.getItem('examforge_schools')) {
        localStorage.setItem('examforge_schools', JSON.stringify([]));
    }
    if (!localStorage.getItem('examforge_school_owners')) {
        localStorage.setItem('examforge_school_owners', JSON.stringify([]));
    }
}

initStorage();

let lastRegisteredStudent = null;
let studentPhotoData = null;

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Find the clicked button and activate it
    const clickedBtn = event.target;
    clickedBtn.classList.add('active');
    document.getElementById(tab + '-tab').classList.add('active');
    
    if (tab === 'register') {
        loadSchoolsDropdown();
        document.getElementById('autoFillArea').classList.add('hidden');
    }
}

function loadSchoolsDropdown() {
    const schools = JSON.parse(localStorage.getItem('examforge_schools'));
    const select = document.getElementById('regSchool');
    select.innerHTML = '<option value="">Select School</option>';
    
    if (schools.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "No schools available - Contact admin";
        opt.disabled = true;
        select.appendChild(opt);
        return;
    }
    
    schools.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
}

function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
        alert('Photo too large! Maximum size is 500KB.');
        return;
    }
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPG or PNG).');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        studentPhotoData = e.target.result;
        document.getElementById('photoPreview').innerHTML = `<img src="${studentPhotoData}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
}

function handleRegister(e) {
    e.preventDefault();
    
    const schoolId = document.getElementById('regSchool').value;
    if (!schoolId) {
        alert('Please select a school!');
        return;
    }
    
    const student = {
        id: Date.now(),
        name: document.getElementById('regName').value.trim(),
        gender: document.getElementById('regGender').value,
        session: document.getElementById('regSession').value,
        term: document.getElementById('regTerm').value,
        class: document.getElementById('regClass').value,
        subject: document.getElementById('regSubject').value,
        schoolId: schoolId,
        password: generatePassword(),
        photo: studentPhotoData,
        createdAt: new Date().toISOString()
    };
    
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    if (students.find(s => s.name.toLowerCase() === student.name.toLowerCase() && s.schoolId === student.schoolId)) {
        alert('A student with this name already exists in this school!');
        return;
    }
    
    students.push(student);
    localStorage.setItem('examforge_students', JSON.stringify(students));
    
    lastRegisteredStudent = student;
    
    document.getElementById('credName').textContent = student.name;
    document.getElementById('credPassword').textContent = student.password;
    document.getElementById('passwordModal').classList.add('active');
    
    document.getElementById('registerForm').reset();
    document.getElementById('photoPreview').innerHTML = '<span class="photo-placeholder">📷 Tap to upload photo</span>';
    studentPhotoData = null;
}

function closeModal() {
    document.getElementById('passwordModal').classList.remove('active');
    showTab('login');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
}

function autoFillAndClose() {
    document.getElementById('passwordModal').classList.remove('active');
    showTab('login');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    if (lastRegisteredStudent) {
        document.getElementById('loginName').value = lastRegisteredStudent.name;
        document.getElementById('loginPassword').value = lastRegisteredStudent.password;
        document.getElementById('loginPassword').focus();
    }
}

function autoFillCredentials() {
    if (lastRegisteredStudent) {
        document.getElementById('loginName').value = lastRegisteredStudent.name;
        document.getElementById('loginPassword').value = lastRegisteredStudent.password;
        document.getElementById('loginPassword').focus();
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Credentials filled!';
        btn.style.background = 'var(--success)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }
}

function copyPassword() {
    const password = document.getElementById('credPassword').textContent;
    navigator.clipboard.writeText(password).then(() => {
        const btn = event.target;
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = '📋', 1500);
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = password;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Password copied to clipboard!');
    });
}

function handleLogin(e) {
    e.preventDefault();
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!name || !password) {
        alert('Please enter both name and password!');
        return;
    }
    
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    const student = students.find(s => s.name.toLowerCase() === name.toLowerCase() && s.password === password);
    
    if (student) {
        sessionStorage.setItem('currentStudent', JSON.stringify(student));
        window.location.href = 'dashboard.html';
    } else {
        alert('Invalid name or password!');
    }
}

function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const role = document.getElementById('adminRole').value;
    
    if (!username || !password) {
        alert('Please enter username and password!');
        return;
    }
    
    if (!role) {
        alert('Please select a role!');
        return;
    }
    
    if (role === 'super') {
        const admin = JSON.parse(localStorage.getItem('examforge_admin'));
        if (username === admin.username && password === admin.password) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            sessionStorage.setItem('adminRole', 'super');
            sessionStorage.setItem('adminUser', JSON.stringify(admin));
            window.location.href = 'admin.html';
        } else {
            alert('Invalid Super Admin credentials!');
        }
    } else if (role === 'school') {
        const owners = JSON.parse(localStorage.getItem('examforge_school_owners'));
        const owner = owners.find(o => o.username === username && o.password === password);
        if (owner) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            sessionStorage.setItem('adminRole', 'school');
            sessionStorage.setItem('schoolOwner', JSON.stringify(owner));
            window.location.href = 'school-dashboard.html';
        } else {
            alert('Invalid School Owner credentials!');
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    if (students.length > 0) {
        const lastStudent = students[students.length - 1];
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (new Date(lastStudent.createdAt).getTime() > fiveMinutesAgo) {
            lastRegisteredStudent = lastStudent;
            const autoFillArea = document.getElementById('autoFillArea');
            if (autoFillArea) {
                autoFillArea.classList.remove('hidden');
                document.getElementById('autoFillName').textContent = lastStudent.name;
            }
        }
    }
});