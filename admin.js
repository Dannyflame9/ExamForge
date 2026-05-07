let questionCount = 0;
let currentMaxQuestions = 10;
let currentDuration = 10;
let editingTestId = null; // Track if we're editing

document.addEventListener('DOMContentLoaded', function() {
    if (!sessionStorage.getItem('adminLoggedIn') || sessionStorage.getItem('adminRole') !== 'super') {
        window.location.href = 'index.html';
        return;
    }
    
    // Load admin photo and name immediately
    loadAdminPhoto();
    
    loadStudents();
    loadExistingTests();
    loadPerformance();
    
    document.getElementById('testDate').valueAsDate = new Date();
});

function showAdminSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    event.target.classList.add('active');
    
    // Hide ALL possible sections (old + new)
    const allSections = [
        'students-section',
        'tests-section', 
        'performance-section',
        'backup-section',
        'sync-section',
        'schools-section'
    ];
    
    allSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    // Show the requested section
    const target = document.getElementById(section + '-section');
    if (target) {
        target.classList.remove('hidden');
    } else {
        console.error('Section not found:', section + '-section');
    }
    
    // Reset edit mode when switching away from tests
    if (section !== 'tests') {
        cancelEdit();
    }
    
    // Load school data if on schools tab
    if (section === 'schools') {
        loadSchoolsTable();
        loadOwnersTable();
        loadOwnerSchoolDropdown();
    }
}

function handleTestTypeChange() {
    const type = document.getElementById('testType').value;
    const weekSelect = document.getElementById('testWeek');
    const durationInput = document.getElementById('testDuration');
    const countInput = document.getElementById('testQuestionCount');
    const infoText = document.getElementById('testTypeInfo');
    const questionBankArea = document.getElementById('questionBankArea');
    
    if (editingTestId) {
        infoText.textContent = 'Editing mode - Type cannot be changed';
        return;
    }
    
    weekSelect.disabled = false;
    
    if (type === 'weekly') {
        currentMaxQuestions = 10;
        currentDuration = 10;
        infoText.textContent = 'Weekly Test: 10 questions, 10 minutes';
        Array.from(weekSelect.options).forEach(opt => {
            opt.disabled = opt.value === '7' || opt.value === '11' || opt.value === '';
        });
        if (questionBankArea) questionBankArea.classList.add('hidden');
    } else if (type === 'midterm') {
        currentMaxQuestions = 30;
        currentDuration = 30;
        weekSelect.value = '7';
        weekSelect.disabled = true;
        infoText.textContent = 'Mid Term Test: 30 questions, 30 minutes (Week 7)';
        if (questionBankArea) {
            questionBankArea.classList.remove('hidden');
            loadQuestionBank();
        }
    } else if (type === 'exam') {
        currentMaxQuestions = 50;
        currentDuration = 60;
        weekSelect.value = '11';
        weekSelect.disabled = true;
        infoText.textContent = 'Final Examination: 50 questions, 1 hour (Week 11)';
        if (questionBankArea) {
            questionBankArea.classList.remove('hidden');
            loadQuestionBank();
        }
    } else {
        weekSelect.disabled = true;
        infoText.textContent = 'Select a test type to see details';
        if (questionBankArea) questionBankArea.classList.add('hidden');
        return;
    }
    
    durationInput.value = currentDuration;
    countInput.value = currentMaxQuestions;
    
    updateQuestionSlots(currentMaxQuestions);
    updateQuestionCounter();
}

function loadQuestionBank() {
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    const currentSubject = document.getElementById('testSubject').value;
    const currentClass = document.getElementById('testClass').value;
    const currentSession = document.getElementById('testSession').value;
    const currentTerm = document.getElementById('testTerm').value;
    
    console.log('Current filters:', { currentSubject, currentClass, currentSession, currentTerm });
    console.log('All tests:', tests);
    
    // Populate filter dropdowns if empty
    const subjectFilter = document.getElementById('bankFilterSubject');
    const classFilter = document.getElementById('bankFilterClass');
    
    if (subjectFilter.options.length <= 1) {
        const subjects = [...new Set(tests.map(t => t.subject))].sort();
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            subjectFilter.appendChild(opt);
        });
    }
    
    if (classFilter.options.length <= 1) {
        const classes = [...new Set(tests.map(t => t.class))].sort();
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            classFilter.appendChild(opt);
        });
    }
    
    // Apply filters - use CURRENT form values if dropdown is "Same as current"
    const filterSubject = subjectFilter.value || currentSubject;
    const filterClass = classFilter.value || currentClass;
    const filterType = document.getElementById('bankFilterType').value;
    
    console.log('Applied filters:', { filterSubject, filterClass, filterType });
    
    // Get ALL previous tests that match filters
    // RELAXED: Don't require exact session/term match - just show all available
    let sourceTests = tests.filter(t => {
        const matchSubject = t.subject === filterSubject;
        const matchClass = t.class === filterClass;
        // Session and term are optional matches - comment out if too strict
        // const matchSession = t.session === currentSession;
        // const matchTerm = t.term === currentTerm;
        
        return matchSubject && matchClass;
    });
    
    console.log('After subject/class filter:', sourceTests);
    
    // Exclude current test type (don't show midterms when creating midterm)
    const currentType = document.getElementById('testType').value;
    sourceTests = sourceTests.filter(t => {
        // Don't show tests of the SAME type we're creating
        if (currentType === 'midterm' && t.type === 'midterm') return false;
        if (currentType === 'exam' && t.type === 'exam') return false;
        return true;
    });
    
    console.log('After excluding same type:', sourceTests);
    
    // Filter by type if specified
    if (filterType !== 'all') {
        sourceTests = sourceTests.filter(t => t.type === filterType);
    }
    
    console.log('After type filter:', sourceTests);
    
    const container = document.getElementById('bankQuestionsList');
    
    if (sourceTests.length === 0) {
        container.innerHTML = `
            <p style="text-align:center;color:var(--text-light);padding:20px;">
                No previous tests found.<br>
                <span style="font-size: 12px;">
                    Subject: ${filterSubject}, Class: ${filterClass}, Type: ${filterType}<br>
                    Created tests: ${tests.length} total
                </span>
            </p>`;
        return;
    }
    
    // Collect all questions from filtered tests
    let allBankQuestions = [];
    sourceTests.forEach(test => {
        const typeLabel = test.type === 'weekly' ? `Week ${test.week}` : 
                         test.type === 'midterm' ? 'Mid Term' : 'Examination';
        
        test.questions.forEach((q, qi) => {
            allBankQuestions.push({
                ...q,
                sourceType: typeLabel,
                sourceTestId: test.id,
                uniqueId: `${test.id}-${qi}`
            });
        });
    });
    
    console.log('Total bank questions:', allBankQuestions.length);
    
    window._bankQuestions = allBankQuestions;
    if (!window._selectedBankQuestions) window._selectedBankQuestions = new Set();
    
    container.innerHTML = allBankQuestions.map((q, i) => `
        <div class="bank-question-item" id="bank-q-${q.uniqueId}" onclick="toggleBankQuestion('${q.uniqueId}')">
            <div style="display: flex; align-items: start; gap: 12px;">
                <div class="bank-checkbox" id="bank-check-${q.uniqueId}">
                    ${window._selectedBankQuestions.has(q.uniqueId) ? '✓' : ''}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 6px; font-size: 14px;">
                        <span style="color: var(--primary); background: var(--primary-light); padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase;">${q.sourceType}</span>
                        <span style="margin-left: 8px;">${q.question}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-light); display: flex; gap: 12px; flex-wrap: wrap;">
                        ${q.options.map((opt, oi) => `<span>${String.fromCharCode(65 + oi)}) ${opt}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Re-apply visual selection state
    window._selectedBankQuestions.forEach(id => {
        const item = document.getElementById(`bank-q-${id}`);
        const check = document.getElementById(`bank-check-${id}`);
        if (item) item.classList.add('selected');
        if (check) check.innerHTML = '✓';
    });
    
    updateBankCounter();
}

function toggleBankQuestion(uniqueId) {
    const item = document.getElementById(`bank-q-${uniqueId}`);
    const checkbox = document.getElementById(`bank-check-${uniqueId}`);
    
    if (!window._selectedBankQuestions) window._selectedBankQuestions = new Set();
    
    if (window._selectedBankQuestions.has(uniqueId)) {
        window._selectedBankQuestions.delete(uniqueId);
        item.classList.remove('selected');
        checkbox.innerHTML = '';
    } else {
        // Don't exceed max
        if (window._selectedBankQuestions.size >= currentMaxQuestions) {
            alert(`You can only select up to ${currentMaxQuestions} questions!`);
            return;
        }
        window._selectedBankQuestions.add(uniqueId);
        item.classList.add('selected');
        checkbox.innerHTML = '✓';
    }
    
    updateBankCounter();
}

function updateBankCounter() {
    const count = window._selectedBankQuestions ? window._selectedBankQuestions.size : 0;
    const el = document.getElementById('bankSelectedCount');
    if (el) el.textContent = count;
}

function clearBankSelection() {
    window._selectedBankQuestions = new Set();
    loadQuestionBank(); // Refresh visual state
}

function addSelectedBankQuestions() {
    if (!window._selectedBankQuestions || window._selectedBankQuestions.size === 0) {
        alert('Please select at least one question from the bank!');
        return;
    }
    
    const selectedQuestions = window._bankQuestions.filter(q => 
        window._selectedBankQuestions.has(q.uniqueId)
    );
    
    // Get all existing question data (not just texts)
    const existingQuestions = [];
    document.querySelectorAll('.question-builder').forEach((div, index) => {
        const qText = div.querySelector('.q-text')?.value.trim() || '';
        const opts = Array.from(div.querySelectorAll('.q-opt')).map(i => i.value.trim());
        const correct = div.querySelector('.q-correct')?.value;
        
        if (qText) {
            existingQuestions.push({
                question: qText,
                options: opts,
                correct: correct,
                originalIndex: index
            });
        }
    });
    
    // Calculate total after merge
    const newQuestions = selectedQuestions.filter(sq => {
        return !existingQuestions.some(eq => 
            eq.question.toLowerCase() === sq.question.trim().toLowerCase()
        );
    });
    
    const totalAfterMerge = existingQuestions.length + newQuestions.length;
    
    if (totalAfterMerge > currentMaxQuestions) {
        alert(`You have ${existingQuestions.length} questions. Adding ${newQuestions.length} new ones would give you ${totalAfterMerge}, but maximum is ${currentMaxQuestions}!\n\nPlease remove some questions or select fewer.`);
        return;
    }
    
    // REBUILD everything: existing + new + empty slots
    document.getElementById('questionsList').innerHTML = '';
    questionCount = 0;
    
    // Re-add all existing questions
    existingQuestions.forEach(eq => {
        addQuestion({
            question: eq.question,
            options: eq.options,
            correct: parseInt(eq.correct) || 0,
            explanation: ''
        });
    });
    
    // Add new bank questions
    newQuestions.forEach(q => {
        addQuestion({
            question: q.question,
            options: q.options,
            correct: q.correct,
            explanation: q.explanation || ''
        });
    });
    
    // Fill remaining with empty slots
    const totalNow = document.querySelectorAll('.question-builder').length;
    const remaining = currentMaxQuestions - totalNow;
    for (let i = 0; i < remaining; i++) {
        addQuestion();
    }
    
    updateQuestionCounter();
    clearBankSelection();
    
    // Visual feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = `✅ Total: ${totalAfterMerge} questions (${existingQuestions.length} existing + ${newQuestions.length} new)`;
    setTimeout(() => {
        btn.textContent = originalText;
    }, 3000);
}

function loadStudents() {
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    const tbody = document.getElementById('studentsTable');
    
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-light);">No students registered yet.</td></tr>';
        return;
    }
    
    students.forEach(student => {
        const studentResults = results.filter(r => r.studentId === student.id);
        const avgScore = studentResults.length > 0 
            ? Math.round(studentResults.reduce((a, b) => a + b.score, 0) / studentResults.length) 
            : 0;
        
        const photoHtml = student.photo 
            ? `<img src="${student.photo}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`
            : `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">${student.name.charAt(0).toUpperCase()}</div>`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${photoHtml}</td>
            <td><strong>${student.name}</strong></td>
            <td>${student.gender}</td>
            <td>${student.session}</td>
            <td>${student.term}</td>
            <td>${student.class}</td>
            <td>${student.subject}</td>
            <td><code style="background: var(--bg); padding: 4px 8px; border-radius: 4px;">${student.password}</code></td>
            <td>${studentResults.length}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="performance-bar">
                        <div class="performance-fill" style="width: ${avgScore}%; background: ${avgScore >= 60 ? 'var(--success)' : 'var(--danger)'}"></div>
                    </div>
                    <span style="font-weight: 600;">${avgScore}%</span>
                </div>
            </td>
            <td>
                <button onclick="deleteStudent(${student.id})" class="btn btn-danger" style="width: auto; padding: 8px 14px; font-size: 13px;">
                    🗑️ Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterStudents() {
    const nameFilter = document.getElementById('searchName').value.toLowerCase();
    const sessionFilter = document.getElementById('filterSession').value;
    const classFilter = document.getElementById('filterClass').value;
    const subjectFilter = document.getElementById('filterSubject').value;
    
    const rows = document.querySelectorAll('#studentsTable tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const name = cells[0].textContent.toLowerCase();
        const session = cells[2].textContent;
        const cls = cells[4].textContent;
        const subject = cells[5].textContent;
        
        const matchName = name.includes(nameFilter);
        const matchSession = !sessionFilter || session === sessionFilter;
        const matchClass = !classFilter || cls === classFilter;
        const matchSubject = !subjectFilter || subject === subjectFilter;
        
        row.style.display = (matchName && matchSession && matchClass && matchSubject) ? '' : 'none';
    });
}

function addQuestion(prefillData = null) {
    if (questionCount >= currentMaxQuestions) {
        alert(`Maximum ${currentMaxQuestions} questions allowed!`);
        return;
    }
    
    questionCount++;
    const div = document.createElement('div');
    div.className = 'question-builder';
    div.id = `question-${questionCount}`;
    
    const qText = prefillData ? prefillData.question : '';
    const opts = prefillData ? prefillData.options : ['', '', '', ''];
    const correct = prefillData ? prefillData.correct : '';
    const explanation = prefillData ? (prefillData.explanation || '') : '';
    
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4>Question ${questionCount}</h4>
            <button type="button" onclick="removeQuestion(${questionCount})" class="btn btn-danger" style="width: auto; padding: 8px 16px; font-size: 13px;">Remove</button>
        </div>
        <div class="form-group">
            <input type="text" placeholder="Enter question text" required class="q-text" style="width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 8px;" value="${escapeHtml(qText)}">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <input type="text" placeholder="Option A" required class="q-opt" style="padding: 10px; border: 2px solid var(--border); border-radius: 8px;" value="${escapeHtml(opts[0])}">
            <input type="text" placeholder="Option B" required class="q-opt" style="padding: 10px; border: 2px solid var(--border); border-radius: 8px;" value="${escapeHtml(opts[1])}">
            <input type="text" placeholder="Option C" required class="q-opt" style="padding: 10px; border: 2px solid var(--border); border-radius: 8px;" value="${escapeHtml(opts[2])}">
            <input type="text" placeholder="Option D" required class="q-opt" style="padding: 10px; border: 2px solid var(--border); border-radius: 8px;" value="${escapeHtml(opts[3])}">
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
            <select class="q-correct" required style="width: 100%; padding: 10px; border: 2px solid var(--border); border-radius: 8px;">
                <option value="">Select correct option</option>
                <option value="0" ${correct === 0 ? 'selected' : ''}>Option A</option>
                <option value="1" ${correct === 1 ? 'selected' : ''}>Option B</option>
                <option value="2" ${correct === 2 ? 'selected' : ''}>Option C</option>
                <option value="3" ${correct === 3 ? 'selected' : ''}>Option D</option>
            </select>
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
            <textarea class="q-explanation" placeholder="Enter explanation for this answer (optional but recommended)..." rows="3" style="width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 8px; resize: vertical;">${escapeHtml(explanation)}</textarea>
        </div>
    `;
    
    document.getElementById('questionsList').appendChild(div);
    updateQuestionCounter();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function removeQuestion(id) {
    const el = document.getElementById(`question-${id}`);
    if (el) {
        el.remove();
        questionCount--;
        const questions = document.querySelectorAll('.question-builder');
        questions.forEach((q, i) => {
            q.querySelector('h4').textContent = `Question ${i + 1}`;
            q.id = `question-${i + 1}`;
            q.querySelector('button').setAttribute('onclick', `removeQuestion(${i + 1})`);
        });
        updateQuestionCounter();
    }
}

function updateQuestionSlots(targetCount) {
    const current = document.querySelectorAll('.question-builder').length;
    if (current < targetCount) {
        for (let i = current; i < targetCount; i++) {
            addQuestion();
        }
    } else if (current > targetCount) {
        for (let i = current; i > targetCount; i--) {
            removeQuestion(i);
        }
    }
}

function updateQuestionCounter() {
    document.getElementById('questionCounter').textContent = `(${questionCount} of ${currentMaxQuestions})`;
}

function createTest(e) {
    e.preventDefault();
    
    const testType = document.getElementById('testType').value;
    if (!testType && !editingTestId) {
        alert('Please select a test type!');
        return;
    }
    
    const week = parseInt(document.getElementById('testWeek').value);
    
    const test = {
        id: editingTestId || Date.now(),
        week: week,
        type: editingTestId ? document.getElementById('testType').dataset.originalType : testType,
        subject: document.getElementById('testSubject').value,
        class: document.getElementById('testClass').value,
        session: document.getElementById('testSession').value,
        term: document.getElementById('testTerm').value,
        date: document.getElementById('testDate').value,
        time: document.getElementById('testTime').value,
        duration: parseInt(document.getElementById('testDuration').value),
        questions: []
    };
    
    // Collect questions
    const questionDivs = document.querySelectorAll('.question-builder');
    let valid = true;
    
    questionDivs.forEach(div => {
        const question = div.querySelector('.q-text').value.trim();
        const options = Array.from(div.querySelectorAll('.q-opt')).map(i => i.value.trim());
        const correct = parseInt(div.querySelector('.q-correct').value);
        const explanation = div.querySelector('.q-explanation').value.trim();
        
        if (!question || options.some(o => !o) || isNaN(correct)) {
            valid = false;
            return;
        }
        
        test.questions.push({ question, options, correct, explanation });
    });
    
    if (!valid) {
        alert('Please fill in all question fields!');
        return;
    }
    
    const expectedCount = editingTestId ? currentMaxQuestions : currentMaxQuestions;
    if (test.questions.length !== expectedCount) {
        alert(`Please add exactly ${expectedCount} questions! Currently have ${test.questions.length}.`);
        return;
    }
    
    let tests = JSON.parse(localStorage.getItem('examforge_tests'));
    
    if (editingTestId) {
        // Update existing test
        const index = tests.findIndex(t => t.id === editingTestId);
        if (index !== -1) {
            // Keep the same ID, update everything else
            tests[index] = test;
            localStorage.setItem('examforge_tests', JSON.stringify(tests));
            alert('Test updated successfully!');
        }
    } else {
        // Check for duplicates
        const exists = tests.some(t => 
            t.week === test.week && 
            t.subject === test.subject && 
            t.class === test.class &&
            t.session === test.session &&
            t.term === test.term
        );
        
        if (exists) {
            alert('A test for this week already exists for this subject/class combination!');
            return;
        }
        
        tests.push(test);
        localStorage.setItem('examforge_tests', JSON.stringify(tests));
        alert('Test created successfully!');
    }
    
    resetForm();
    loadExistingTests();
}

function resetForm() {
    document.getElementById('createTestForm').reset();
    document.getElementById('questionsList').innerHTML = '';
    document.getElementById('testWeek').disabled = true;
    document.getElementById('testDuration').value = 10;
    document.getElementById('testQuestionCount').value = 10;
    document.getElementById('testTypeInfo').textContent = 'Select a test type to see details';
    document.getElementById('testType').disabled = false;
    
    // Remove edit mode UI
    const editBanner = document.getElementById('editBanner');
    if (editBanner) editBanner.remove();
    
    const submitBtn = document.querySelector('#createTestForm button[type="submit"]');
    submitBtn.textContent = 'Create Test';
    
    editingTestId = null;
    questionCount = 0;
    currentMaxQuestions = 10;
    currentDuration = 10;
    updateQuestionCounter();
    addQuestion();
}

function cancelEdit() {
    if (editingTestId) {
        resetForm();
    }
}

function editTest(id) {
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    const test = tests.find(t => t.id === id);
    
    if (!test) {
        alert('Test not found!');
        return;
    }
    
    // Switch to tests section
    showAdminSection('tests');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item')[1].classList.add('active'); // Tests tab
    
    // Set edit mode
    editingTestId = id;
    
    // Populate form
    document.getElementById('testType').value = test.type;
    document.getElementById('testType').disabled = true;
    document.getElementById('testType').dataset.originalType = test.type;
    
    document.getElementById('testWeek').value = test.week;
    document.getElementById('testWeek').disabled = true;
    
    document.getElementById('testSubject').value = test.subject;
    document.getElementById('testClass').value = test.class;
    document.getElementById('testSession').value = test.session;
    document.getElementById('testTerm').value = test.term;
    document.getElementById('testDate').value = test.date;
    document.getElementById('testTime').value = test.time;
    document.getElementById('testDuration').value = test.duration;
    document.getElementById('testQuestionCount').value = test.questions.length;
    
    // Set max questions based on type
    currentMaxQuestions = test.questions.length;
    currentDuration = test.duration;
    
    let typeLabel = 'Weekly Test';
    if (test.type === 'midterm') typeLabel = 'Mid Term Test';
    else if (test.type === 'exam') typeLabel = 'Final Examination';
    
    document.getElementById('testTypeInfo').textContent = `Editing ${typeLabel}: ${test.questions.length} questions, ${test.duration} minutes`;
    
    // Show edit banner
    let editBanner = document.getElementById('editBanner');
    if (!editBanner) {
        editBanner = document.createElement('div');
        editBanner.id = 'editBanner';
        editBanner.className = 'edit-banner';
        document.querySelector('.create-form').insertBefore(editBanner, document.getElementById('createTestForm'));
    }
    editBanner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>✏️ Editing: <strong>${typeLabel}</strong> - Week ${test.week} - ${test.subject} - ${test.class}</span>
            <button onclick="cancelEdit()" class="btn btn-danger" style="width: auto; padding: 8px 16px; font-size: 13px;">Cancel Edit</button>
        </div>
    `;
    
    // Change submit button
    const submitBtn = document.querySelector('#createTestForm button[type="submit"]');
    submitBtn.textContent = '💾 Save Changes';
    
    // Clear and populate questions
    document.getElementById('questionsList').innerHTML = '';
    questionCount = 0;
    
    test.questions.forEach(q => {
        addQuestion(q);
    });
    
    updateQuestionCounter();
    
    // Scroll to form
    document.querySelector('.create-form').scrollIntoView({ behavior: 'smooth' });
}

function loadExistingTests() {
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    const container = document.getElementById('existingTests');
    
    container.innerHTML = '';
    
    if (tests.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;">No tests created yet.</p>';
        return;
    }
    
    tests.sort((a, b) => b.id - a.id);
    
    tests.forEach(test => {
        let badgeClass = 'badge-week';
        let typeLabel = `Week ${test.week}`;
        
        if (test.type === 'midterm' || test.week === 7) {
            badgeClass = 'badge-midterm';
            typeLabel = 'Week 7 - Mid Term';
        } else if (test.type === 'exam' || test.week === 11) {
            badgeClass = 'badge-exam';
            typeLabel = 'Final Examination';
        }
        
        // Check if test has been taken
        const results = JSON.parse(localStorage.getItem('examforge_results'));
        const hasResults = results.some(r => r.testId === test.id);
        
        const card = document.createElement('div');
        card.className = 'test-card';
        card.innerHTML = `
            <div class="test-header">
                <div>
                    <div class="test-title">${typeLabel}</div>
                    <span class="test-badge ${badgeClass}">${test.subject}</span>
                    ${hasResults ? '<span class="test-badge" style="margin-left: 6px; background: #fee2e2; color: #991b1b;">Taken</span>' : ''}
                </div>
            </div>
            <div class="test-meta">
                <p>🏫 ${test.class} • ${test.session}</p>
                <p>📅 ${test.date} at ${test.time}</p>
                <p>⏱️ ${test.duration} min • ${test.questions.length} questions</p>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button onclick="editTest(${test.id})" class="btn btn-primary" style="flex: 1; padding: 10px; font-size: 14px;">✏️ Edit</button>
                <button onclick="deleteTest(${test.id})" class="btn btn-danger" style="width: auto; padding: 10px 16px; font-size: 14px;">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function deleteTest(id) {
    if (!confirm('Are you sure you want to delete this test? All results will be lost!')) return;
    
    let tests = JSON.parse(localStorage.getItem('examforge_tests'));
    tests = tests.filter(t => t.id !== id);
    localStorage.setItem('examforge_tests', JSON.stringify(tests));
    
    let results = JSON.parse(localStorage.getItem('examforge_results'));
    results = results.filter(r => r.testId !== id);
    localStorage.setItem('examforge_results', JSON.stringify(results));
    
    // Cancel edit if deleting edited test
    if (editingTestId === id) {
        cancelEdit();
    }
    
    loadExistingTests();
    loadPerformance();
}

function loadPerformance() {
    const subjectFilter = document.getElementById('perfSubject').value;
    const classFilter = document.getElementById('perfClass').value;
    const typeFilter = document.getElementById('perfType').value;
    
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    
    const tbody = document.getElementById('performanceTable');
    tbody.innerHTML = '';
    
    let filtered = results;
    
    if (subjectFilter) {
        filtered = filtered.filter(r => {
            const test = tests.find(t => t.id === r.testId);
            return test && test.subject === subjectFilter;
        });
    }
    
    if (classFilter) {
        filtered = filtered.filter(r => {
            const student = students.find(s => s.id === r.studentId);
            return student && student.class === classFilter;
        });
    }
    
    if (typeFilter) {
        filtered = filtered.filter(r => {
            const test = tests.find(t => t.id === r.testId)
                return test && test.type === typeFilter;
        });
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light);">No results found.</td></tr>';
        return;
    }
    
    filtered.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    filtered.forEach(result => {
        const student = students.find(s => s.id === result.studentId);
        const test = tests.find(t => t.id === result.testId);
        
        if (!student || !test) return;
        
        let testLabel = `Week ${test.week}`;
        if (test.type === 'midterm' || test.week === 7) testLabel = 'Mid Term';
        else if (test.type === 'exam' || test.week === 11) testLabel = 'Examination';
        
        const isPassed = result.score >= 60;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${student.name}</strong></td>
            <td>${student.class}</td>
            <td>${test.subject}</td>
            <td>${testLabel}</td>
            <td><strong class="${isPassed ? 'text-success' : 'text-danger'}">${result.score}%</strong></td>
            <td>
                <div class="performance-bar">
                    <div class="performance-fill" style="width: ${result.score}%; background: ${isPassed ? 'var(--success)' : 'var(--danger)'}"></div>
                </div>
            </td>
            <td>${new Date(result.completedAt).toLocaleDateString()}</td>
        `;
        tbody.appendChild(row);
    });
}

// ========== BACKUP & RESTORE ==========

let pendingImportData = null;

function exportData() {
    const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        examforge_students: JSON.parse(localStorage.getItem('examforge_students') || '[]'),
        examforge_tests: JSON.parse(localStorage.getItem('examforge_tests') || '[]'),
        examforge_results: JSON.parse(localStorage.getItem('examforge_results') || '[]'),
        examforge_admin: JSON.parse(localStorage.getItem('examforge_admin') || '{}')
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const date = new Date().toISOString().split('T')[0];
    const filename = `examforge-backup-${date}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Visual feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ Downloaded!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate structure
            if (!data.examforge_students || !data.examforge_tests || !data.examforge_results) {
                alert('Invalid backup file! Missing required data.');
                return;
            }
            
            pendingImportData = data;
            
            // Show preview
            const preview = document.getElementById('importPreview');
            const content = document.getElementById('importPreviewContent');
            
            const studentsCount = data.examforge_students.length;
            const testsCount = data.examforge_tests.length;
            const resultsCount = data.examforge_results.length;
            const exportDate = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'Unknown';
            
            content.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
                    <p><strong>Exported:</strong> ${exportDate}</p>
                    <p><strong>Version:</strong> ${data.version || 'Unknown'}</p>
                    <p><strong>Students:</strong> ${studentsCount}</p>
                    <p><strong>Tests:</strong> ${testsCount}</p>
                    <p><strong>Results:</strong> ${resultsCount}</p>
                </div>
            `;
            
            preview.classList.remove('hidden');
            
        } catch (err) {
            alert('Error reading file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function importData() {
    if (!pendingImportData) {
        alert('Please select a backup file first!');
        return;
    }
}

function confirmImport() {
    if (!pendingImportData) return;
    
    if (!confirm('⚠️ This will REPLACE all current data with the backup. Are you sure?')) {
        return;
    }
    
    localStorage.setItem('examforge_students', JSON.stringify(pendingImportData.examforge_students));
    localStorage.setItem('examforge_tests', JSON.stringify(pendingImportData.examforge_tests));
    localStorage.setItem('examforge_results', JSON.stringify(pendingImportData.examforge_results));
    
    if (pendingImportData.examforge_admin) {
        localStorage.setItem('examforge_admin', JSON.stringify(pendingImportData.examforge_admin));
    }
    
    // Reset
    pendingImportData = null;
    document.getElementById('importFile').value = '';
    document.getElementById('importPreview').classList.add('hidden');
    
    // Refresh everything
    loadStudents();
    loadExistingTests();
    loadPerformance();
    
    alert('✅ Data restored successfully! All pages will now use the imported data.');
}

function cancelImport() {
    pendingImportData = null;
    document.getElementById('importFile').value = '';
    document.getElementById('importPreview').classList.add('hidden');
}

// ========== DELETE STUDENTS ==========

function deleteStudent(studentId) {
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
        alert('Student not found!');
        return;
    }
    
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    const studentResultCount = results.filter(r => r.studentId === studentId).length;
    
    let confirmMsg = `Are you sure you want to delete "${student.name}"?`;
    if (studentResultCount > 0) {
        confirmMsg += `\n\n⚠️ This student has ${studentResultCount} test result(s) that will also be deleted.`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    // Remove student
    const updatedStudents = students.filter(s => s.id !== studentId);
    localStorage.setItem('examforge_students', JSON.stringify(updatedStudents));
    
    // Remove their results
    const updatedResults = results.filter(r => r.studentId !== studentId);
    localStorage.setItem('examforge_results', JSON.stringify(updatedResults));
    
    // Refresh
    loadStudents();
    loadPerformance();
    
    // Visual feedback
    alert(`✅ "${student.name}" has been deleted successfully.`);
}

function deleteAllStudents() {
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    
    if (students.length === 0) {
        alert('No students to delete!');
        return;
    }
    
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    
    const confirmMsg = `⚠️ DANGER ZONE ⚠️\n\nYou are about to delete ALL ${students.length} registered student(s) and ${results.length} test result(s).\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" to confirm:`;
    
    const userInput = prompt(confirmMsg);
    
    if (userInput !== 'DELETE ALL') {
        alert('Deletion cancelled. No students were removed.');
        return;
    }
    
    // Clear all students and results
    localStorage.setItem('examforge_students', JSON.stringify([]));
    localStorage.setItem('examforge_results', JSON.stringify([]));
    
    // Refresh
    loadStudents();
    loadPerformance();
    loadExistingTests(); // Refresh "Taken" badges
    
    alert(`✅ All ${students.length} student(s) and their results have been deleted.`);
}

// ========== SCHOOL & OWNER MANAGEMENT ==========

function registerSchool(e) {
    e.preventDefault();
    
    const schools = JSON.parse(localStorage.getItem('examforge_schools'));
    const name = document.getElementById('schoolName').value.trim();
    const code = document.getElementById('schoolCode').value.trim().toUpperCase();
    
    if (schools.find(s => s.code === code)) {
        alert('School code already exists!');
        return;
    }
    
    const school = {
        id: 'school_' + Date.now(),
        name: name,
        code: code,
        createdAt: new Date().toISOString()
    };
    
    schools.push(school);
    localStorage.setItem('examforge_schools', JSON.stringify(schools));
    
    alert(`✅ School registered!\n\nName: ${name}\nCode: ${code}`);
    document.getElementById('schoolForm').reset();
    loadSchoolsTable();
    loadOwnerSchoolDropdown();
}

function registerOwner(e) {
    e.preventDefault();
    
    const owners = JSON.parse(localStorage.getItem('examforge_school_owners'));
    const name = document.getElementById('ownerName').value.trim();
    const username = document.getElementById('ownerUsername').value.trim();
    let password = document.getElementById('ownerPassword').value.trim();
    const schoolId = document.getElementById('ownerSchool').value;
    
    if (owners.find(o => o.username === username)) {
        alert('Username already exists!');
        return;
    }
    
    if (!password) {
        password = generatePassword();
    }
    
    const owner = {
        id: 'owner_' + Date.now(),
        name: name,
        username: username,
        password: password,
        schoolId: schoolId,
        createdAt: new Date().toISOString()
    };
    
    owners.push(owner);
    localStorage.setItem('examforge_school_owners', JSON.stringify(owners));
    
    alert(`✅ Owner registered!\n\nName: ${name}\nUsername: ${username}\nPassword: ${password}\n\nSave these credentials!`);
    document.getElementById('ownerForm').reset();
    loadOwnersTable();
}

function loadSchoolsTable() {
    const schools = JSON.parse(localStorage.getItem('examforge_schools'));
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    const tbody = document.getElementById('schoolsTable');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (schools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No schools registered yet.</td></tr>';
        return;
    }
    
    schools.forEach(s => {
        const count = students.filter(st => st.schoolId === s.id).length;
        tbody.innerHTML += `
            <tr>
                <td><code>${s.id}</code></td>
                <td><strong>${s.name}</strong></td>
                <td><span class="test-badge badge-week">${s.code}</span></td>
                <td>${count}</td>
                <td>
                    <button onclick="deleteSchool('${s.id}')" class="btn btn-danger" style="width: auto; padding: 6px 12px; font-size: 12px;">🗑️</button>
                </td>
            </tr>
        `;
    });
}

function loadOwnersTable() {
    const owners = JSON.parse(localStorage.getItem('examforge_school_owners'));
    const schools = JSON.parse(localStorage.getItem('examforge_schools'));
    const tbody = document.getElementById('ownersTable');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (owners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No owners registered yet.</td></tr>';
        return;
    }
    
    owners.forEach(o => {
        const school = schools.find(s => s.id === o.schoolId);
        tbody.innerHTML += `
            <tr>
                <td>${o.name}</td>
                <td><code>${o.username}</code></td>
                <td>${school ? school.name : 'Unknown'}</td>
                <td><code>${o.password}</code></td>
                <td>
                    <button onclick="deleteOwner('${o.id}')" class="btn btn-danger" style="width: auto; padding: 6px 12px; font-size: 12px;">🗑️</button>
                </td>
            </tr>
        `;
    });
}

function loadOwnerSchoolDropdown() {
    const schools = JSON.parse(localStorage.getItem('examforge_schools'));
    const select = document.getElementById('ownerSchool');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select School</option>';
    schools.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
}

function deleteSchool(schoolId) {
    if (!confirm('Delete this school? All associated students and data will remain but unlinked.')) return;
    
    let schools = JSON.parse(localStorage.getItem('examforge_schools'));
    schools = schools.filter(s => s.id !== schoolId);
    localStorage.setItem('examforge_schools', JSON.stringify(schools));
    loadSchoolsTable();
    loadOwnerSchoolDropdown();
}

function deleteOwner(ownerId) {
    if (!confirm('Delete this owner?')) return;
    
    let owners = JSON.parse(localStorage.getItem('examforge_school_owners'));
    owners = owners.filter(o => o.id !== ownerId);
    localStorage.setItem('examforge_school_owners', JSON.stringify(owners));
    loadOwnersTable();
}

// ========== SYNC CODE SYSTEM ==========

function generateSyncCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 10; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function createSyncCode() {
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    
    const syncData = {
        code: generateSyncCode(),
        tests: tests,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    
    // Store in local sync store (in real app, this goes to server)
    const syncStore = JSON.parse(localStorage.getItem('examforge_sync_store') || '{}');
    syncStore[syncData.code] = syncData;
    localStorage.setItem('examforge_sync_store', JSON.stringify(syncStore));
    
    // Display to admin
    const display = document.getElementById('syncCodeDisplay');
    if (display) {
        display.innerHTML = `
            <div style="background: var(--bg); padding: 24px; border-radius: 12px; text-align: center; border: 2px dashed var(--primary);">
                <p style="color: var(--text-light); margin-bottom: 8px;">Your Sync Code</p>
                <div style="font-size: 32px; font-weight: 800; color: var(--primary); letter-spacing: 4px; font-family: monospace;">${syncData.code}</div>
                <p style="color: var(--text-light); margin-top: 8px; font-size: 13px;">Valid until: ${new Date(syncData.expiresAt).toLocaleDateString()}</p>
                <p style="color: var(--text-light); font-size: 12px; margin-top: 4px;">Tests included: ${tests.length}</p>
            </div>
        `;
    }
    
    return syncData.code;
}

// ========== SUPER ADMIN: VIEW ALL SCHOOLS ==========

function loadAllSchoolsData() {
    const allStudents = JSON.parse(localStorage.getItem('examforge_students'));
    const allResults = JSON.parse(localStorage.getItem('examforge_results'));
    const schools = JSON.parse(localStorage.getItem('examforge_schools'));
    
    const container = document.getElementById('allSchoolsOverview');
    if (!container) return;
    
    let html = '<div class="stats-grid">';
    
    schools.forEach(school => {
        const schoolStudents = allStudents.filter(s => s.schoolId === school.id);
        const studentIds = schoolStudents.map(s => s.id);
        const schoolResults = allResults.filter(r => studentIds.includes(r.studentId));
        
        const avgScore = schoolResults.length > 0 
            ? Math.round(schoolResults.reduce((a, b) => a + b.score, 0) / schoolResults.length) 
            : 0;
        
        html += `
            <div class="stat-card" style="cursor: pointer;" onclick="viewSchoolDetail('${school.id}')">
                <h3>${school.name}</h3>
                <div class="value" style="font-size: 28px;">${schoolStudents.length} students</div>
                <p style="color: var(--text-light); margin-top: 8px;">${schoolResults.length} tests taken • Avg: ${avgScore}%</p>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

let adminNewPhotoData = null;

function loadAdminProfile() {
    const admin = JSON.parse(localStorage.getItem('examforge_admin'));
    
    document.getElementById('adminDisplayName').value = admin.name || 'Super Administrator';
    document.getElementById('adminEditUsername').value = admin.username || 'admin';
    
    // Load photo preview
    const preview = document.getElementById('adminPhotoPreview');
    if (admin.photo) {
        preview.innerHTML = `<img src="${admin.photo}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        preview.innerHTML = '<span class="photo-placeholder" style="font-size: 60px;">🛡️</span>';
    }
}

function handleAdminPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
        alert('Photo too large! Maximum size is 500KB.');
        return;
    }
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        adminNewPhotoData = e.target.result;
        document.getElementById('adminPhotoPreview').innerHTML = `<img src="${adminNewPhotoData}" style="width: 100%; height: 100%; object-fit: cover;">`;
    };
    reader.readAsDataURL(file);
}

function saveAdminProfile(e) {
    e.preventDefault();
    
    const admin = JSON.parse(localStorage.getItem('examforge_admin'));
    
    const currentPassword = document.getElementById('adminCurrentPassword').value;
    const newPassword = document.getElementById('adminNewPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    const newUsername = document.getElementById('adminEditUsername').value.trim();
    const newName = document.getElementById('adminDisplayName').value.trim();
    
    // Verify current password
    if (currentPassword !== admin.password) {
        alert('❌ Current password is incorrect!');
        return;
    }
    
    // Check username uniqueness
    if (newUsername !== admin.username) {
        const owners = JSON.parse(localStorage.getItem('examforge_school_owners'));
        if (owners.find(o => o.username === newUsername)) {
            alert('❌ This username is already taken by a school owner!');
            return;
        }
    }
    
    // Validate new password
    if (newPassword) {
        if (newPassword.length < 6) {
            alert('❌ New password must be at least 6 characters!');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('❌ New passwords do not match!');
            return;
        }
    }
    
    // Update admin data
    admin.name = newName;
    admin.username = newUsername;
    if (newPassword) {
        admin.password = newPassword;
    }
    if (adminNewPhotoData) {
        admin.photo = adminNewPhotoData;
    }
    
    localStorage.setItem('examforge_admin', JSON.stringify(admin));
    sessionStorage.setItem('adminUser', JSON.stringify(admin));
    
    // Reset form fields
    document.getElementById('adminCurrentPassword').value = '';
    document.getElementById('adminNewPassword').value = '';
    document.getElementById('adminConfirmPassword').value = '';
    adminNewPhotoData = null;
    
    // Refresh photo display everywhere
    loadAdminPhoto();
    
    alert('✅ Profile updated successfully!');
}

function loadAdminPhoto() {
    const admin = JSON.parse(localStorage.getItem('examforge_admin'));
    if (!admin) return;
    
    // Load into header (if you have a header photo element)
    const headerPhoto = document.getElementById('adminHeaderPhoto');
    if (headerPhoto) {
        if (admin.photo) {
            headerPhoto.innerHTML = `<img src="${admin.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            headerPhoto.innerHTML = `<span style="font-size: 24px;">🛡️</span>`;
        }
    }
    
    // Load into profile page preview
    const profilePreview = document.getElementById('adminPhotoPreview');
    if (profilePreview && admin.photo) {
        profilePreview.innerHTML = `<img src="${admin.photo}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }
    
    // Update header name
    const headerName = document.getElementById('adminHeaderName');
    if (headerName && admin.name) {
        headerName.textContent = 'Welcome, ' + admin.name;
    }
}

function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = 'index.html';
}