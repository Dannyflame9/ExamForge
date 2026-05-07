let currentTest = null;
let currentQuestion = 0;
let answers = [];
let timeRemaining = 0;
let timerInterval = null;
let startTime = null;
let totalDuration = 0;
let randomizedQuestions = []; // Questions shuffled, but numbered 1-10 systematically

document.addEventListener('DOMContentLoaded', function() {
    const testId = sessionStorage.getItem('currentTest');
    const student = JSON.parse(sessionStorage.getItem('currentStudent'));
    
    if (!testId || !student) {
        window.location.href = 'index.html';
        return;
    }
    
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    currentTest = tests.find(t => t.id === parseInt(testId));
    
    if (!currentTest) {
        alert('Test not found!');
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Check if already completed
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    if (results.some(r => r.studentId === student.id && r.testId === currentTest.id)) {
        alert('You have already completed this test!');
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Randomize: different question at each position 1-10 for each student
    randomizeQuestions();
    
    answers = new Array(randomizedQuestions.length).fill(null);
    totalDuration = currentTest.duration * 60;
    timeRemaining = totalDuration;
    startTime = new Date();

    // Anti-tab switch detection
    let tabSwitchCount = 0;
    const maxTabSwitches = 3;
    
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            tabSwitchCount++;
            if (tabSwitchCount >= maxTabSwitches) {
                alert('⚠️ You have left the exam page too many times. Your test will be auto-submitted now.');
                submitTest();
            } else {
                alert(`⚠️ Warning: You left the exam page! (${tabSwitchCount}/${maxTabSwitches} warnings)\n\nIf you leave ${maxTabSwitches - tabSwitchCount} more time(s), your test will be submitted automatically.`);
            }
        }
    });
    
    // Prevent right-click
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    
    // Prevent copy/paste
    document.addEventListener('copy', function(e) {
        e.preventDefault();
    });
    document.addEventListener('paste', function(e) {
        e.preventDefault();
    });
    document.addEventListener('cut', function(e) {
        e.preventDefault();
    });

    // ========== AUTO-SAVE ==========
    setInterval(autoSave, 30000); // Save every 30 seconds
    restoreAutoSave(); // Try to restore previous session
    // ========== END AUTO-SAVE ==========
    
    // Set header info
    let testTitle = `Week ${currentTest.week} - ${currentTest.subject}`;
    if (currentTest.type === 'midterm' || currentTest.week === 7) testTitle = `Mid Term - ${currentTest.subject}`;
    else if (currentTest.type === 'exam' || currentTest.week === 11) testTitle = `Examination - ${currentTest.subject}`;
    
    document.getElementById('testTitle').textContent = testTitle;
    document.getElementById('testMeta').textContent = `${currentTest.class} • ${currentTest.duration} minutes • ${currentTest.questions.length} questions`;
    document.getElementById('totalQNum').textContent = randomizedQuestions.length;
    document.getElementById('summaryTotal').textContent = randomizedQuestions.length;
    
    buildPalette();
    showQuestion(0);
    startTimer();
});

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function randomizeQuestions() {
    // Create copies of all questions with their original indices
    const questionPool = currentTest.questions.map((q, originalIndex) => ({
        ...q,
        originalIndex: originalIndex
    }));
    
    // Shuffle the pool
    const shuffledPool = shuffleArray(questionPool);
    
    // Assign to positions 1-10 (systematic numbering, different content per student)
    randomizedQuestions = shuffledPool.map((q, positionIndex) => ({
        displayNumber: positionIndex + 1, // Always 1, 2, 3, 4, 5...
        question: q.question,
        options: shuffleArray(q.options), // Shuffle options too
        correct: -1, // Will be set after shuffling options
        explanation: q.explanation,
        originalIndex: q.originalIndex
    }));
    
    // Find correct answers after option shuffle
    randomizedQuestions.forEach((rq, i) => {
        const originalQ = currentTest.questions[rq.originalIndex];
        rq.correct = rq.options.indexOf(originalQ.options[originalQ.correct]);
    });
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitTest();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('timer').textContent = timeStr;
    
    // Update circular progress
    const progress = timeRemaining / totalDuration;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (progress * circumference);
    const progressCircle = document.getElementById('timerProgress');
    progressCircle.style.strokeDashoffset = offset;
    
    // Color changes + sounds
    const timerWrapper = document.querySelector('.timer-ring');
    timerWrapper.classList.remove('warning', 'danger');
    
    if (timeRemaining === 60) {
        timerWrapper.classList.add('danger');
        playBeep(800, 0.3); // 1 minute warning
    } else if (timeRemaining === 30) {
        timerWrapper.classList.add('danger');
        playBeep(1000, 0.5); // 30 seconds warning
    } else if (timeRemaining <= 10 && timeRemaining > 0) {
        timerWrapper.classList.add('danger');
        playBeep(1200, 0.2); // Final countdown beeps
    } else if (timeRemaining <= 300 && timeRemaining > 60) {
        timerWrapper.classList.add('warning');
        if (timeRemaining === 300) playBeep(600, 0.3); // 5 minutes warning
    }
}

function playBeep(frequency, duration) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // Audio not supported, silently fail
    }
}

function buildPalette() {
    const grid = document.getElementById('paletteGrid');
    grid.innerHTML = '';
    
    randomizedQuestions.forEach((q, i) => {
        const btn = document.createElement('button');
        btn.className = 'palette-btn';
        btn.textContent = i + 1;
        btn.id = `palette-${i}`;
        btn.onclick = () => jumpToQuestion(i);
        grid.appendChild(btn);
    });
}

function updatePalette() {
    randomizedQuestions.forEach((q, i) => {
        const btn = document.getElementById(`palette-${i}`);
        btn.classList.remove('current', 'answered', 'not-answered');
        
        if (i === currentQuestion) {
            btn.classList.add('current');
        } else if (answers[i] !== null) {
            btn.classList.add('answered');
        } else {
            btn.classList.add('not-answered');
        }
    });
    
    // Update summary
    const answered = answers.filter(a => a !== null).length;
    document.getElementById('summaryAnswered').textContent = answered;
    document.getElementById('summaryNotAnswered').textContent = answers.length - answered;
}

function jumpToQuestion(index) {
    currentQuestion = index;
    showQuestion(index);
}

function showQuestion(index) {
    currentQuestion = index;
    const q = randomizedQuestions[index];
    
    // Update question number display
    document.getElementById('currentQNum').textContent = q.displayNumber;
    
    // Update question text
    document.getElementById('questionText').textContent = q.question;
    
    // Build options with letters A, B, C, D
    const optionsArea = document.getElementById('optionsArea');
    optionsArea.innerHTML = '';
    
    q.options.forEach((opt, i) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = `exam-option ${answers[index] === i ? 'selected' : ''}`;
        optionDiv.onclick = () => selectAnswer(i);
        
        optionDiv.innerHTML = `
            <div class="option-letter-box">${String.fromCharCode(65 + i)}</div>
            <div class="option-text">${opt}</div>
        `;
        
        optionsArea.appendChild(optionDiv);
    });
    
    // Update answer status
    const statusEl = document.getElementById('answerStatus');
    if (answers[index] !== null) {
        statusEl.textContent = `Answered: ${String.fromCharCode(65 + answers[index])}`;
        statusEl.className = 'answered-text';
    } else {
        statusEl.textContent = 'Not answered';
        statusEl.className = 'not-answered-text';
    }
    
    // Update navigation buttons
    document.getElementById('prevBtn').style.visibility = index === 0 ? 'hidden' : 'visible';
    
    if (index === randomizedQuestions.length - 1) {
        document.getElementById('nextBtn').classList.add('hidden');
        document.getElementById('submitBtn').classList.remove('hidden');
    } else {
        document.getElementById('nextBtn').classList.remove('hidden');
        document.getElementById('submitBtn').classList.add('hidden');
    }
    
    updatePalette();
}

function selectAnswer(optionIndex) {
    answers[currentQuestion] = optionIndex;
    showQuestion(currentQuestion);
}

function nextQuestion() {
    if (currentQuestion < randomizedQuestions.length - 1) {
        showQuestion(currentQuestion + 1);
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        showQuestion(currentQuestion - 1);
    }
}

function confirmSubmit() {
    const answered = answers.filter(a => a !== null).length;
    const total = answers.length;
    
    document.getElementById('modalAnswered').textContent = answered;
    document.getElementById('modalTotal').textContent = total;
    
    const warningEl = document.getElementById('modalWarning');
    if (answered < total) {
        warningEl.textContent = `⚠️ You have ${total - answered} unanswered question(s)!`;
        warningEl.style.display = 'block';
    } else {
        warningEl.style.display = 'none';
    }
    
    document.getElementById('submitModal').classList.add('active');
}

function closeSubmitModal() {
    document.getElementById('submitModal').classList.remove('active');
}

// Toggle calculator modal
        function toggleCalculator() {
            document.getElementById('calc-modal').classList.toggle('show');
        }

        // Calculator state variables
        let calcExpression = '';
        let calcHistory = '';

        function calcAppend(val) {
            if (calcExpression === '0' && val !== '.') {
                calcExpression = val;
            } else {
                calcExpression += val;
            }
            document.getElementById('calc-input').textContent = calcExpression;
        }

        function calcOperator(op) {
            calcExpression += ' ' + op + ' ';
            document.getElementById('calc-input').textContent = calcExpression;
        }

        function calcFunction(fn) {
            let result;
            const val = parseFloat(calcExpression) || 0;
            
            switch(fn) {
                case 'sin': result = Math.sin(val * Math.PI / 180); break;
                case 'cos': result = Math.cos(val * Math.PI / 180); break;
                case 'tan': result = Math.tan(val * Math.PI / 180); break;
                case 'log': result = Math.log10(val); break;
                case 'ln': result = Math.log(val); break;
                case 'sqrt': result = Math.sqrt(val); break;
                case 'cbrt': result = Math.cbrt(val); break;
                case 'square': result = val * val; break;
                case 'cube': result = val * val * val; break;
                case 'inv': result = 1 / val; break;
                case 'abs': result = Math.abs(val); break;
                case 'fact': 
                    result = 1;
                    for(let i = 2; i <= val; i++) result *= i;
                    break;
                case 'pow':
                    calcExpression += ' ** ';
                    document.getElementById('calc-input').textContent = calcExpression;
                    return;
            }
            
            calcHistory = calcExpression + ' = ' + result;
            document.getElementById('calc-history').textContent = calcHistory;
            calcExpression = String(result);
            document.getElementById('calc-input').textContent = calcExpression;
        }

        function calcClear() {
            calcExpression = '0';
            calcHistory = '';
            document.getElementById('calc-input').textContent = calcExpression;
            document.getElementById('calc-history').textContent = '';
        }

        function calcBackspace() {
            calcExpression = calcExpression.slice(0, -1) || '0';
            document.getElementById('calc-input').textContent = calcExpression;
        }

        function calcEquals() {
            try {
                // Replace display symbols with JS operators
                let expr = calcExpression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
                const result = eval(expr);
                calcHistory = calcExpression + ' = ' + result;
                document.getElementById('calc-history').textContent = calcHistory;
                calcExpression = String(result);
                document.getElementById('calc-input').textContent = calcExpression;
            } catch(e) {
                document.getElementById('calc-input').textContent = 'Error';
                calcExpression = '0';
            }
}

function submitTest() {
    closeSubmitModal();
    clearInterval(timerInterval);
    
    const student = JSON.parse(sessionStorage.getItem('currentStudent'));
    const endTime = new Date();
    const timeUsed = Math.round((endTime - startTime) / 60000);
    
    // Calculate score using randomized questions' correct answers
    let correct = 0;
    answers.forEach((answer, index) => {
        if (answer === randomizedQuestions[index].correct) {
            correct++;
        }
    });
    
    const score = Math.round((correct / randomizedQuestions.length) * 100);
    
    // Convert answers back to original question order for storage
    const originalOrderAnswers = new Array(currentTest.questions.length).fill(null);
    answers.forEach((answer, randomizedIndex) => {
        const rq = randomizedQuestions[randomizedIndex];
        if (answer !== null) {
            // Find which original option this shuffled option corresponds to
            const selectedOptionText = rq.options[answer];
            const originalOptionIndex = currentTest.questions[rq.originalIndex].options.indexOf(selectedOptionText);
            originalOrderAnswers[rq.originalIndex] = originalOptionIndex;
        }
    });
    
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    results.push({
        id: Date.now(),
        studentId: student.id,
        testId: currentTest.id,
        answers: originalOrderAnswers,
        score: score,
        correct: correct,
        total: randomizedQuestions.length,
        timeUsed: timeUsed,
        completedAt: endTime.toISOString()
    });
    
    localStorage.setItem('examforge_results', JSON.stringify(results));
    
    sessionStorage.setItem('viewResult', currentTest.id);
    window.location.href = 'result.html';
}

function autoSave() {
    if (!currentTest) return;
    
    const saveData = {
        testId: currentTest.id,
        answers: answers,
        currentQuestion: currentQuestion,
        timeRemaining: timeRemaining,
        savedAt: new Date().toISOString()
    };
    
    sessionStorage.setItem('examforge_autosave_' + currentTest.id, JSON.stringify(saveData));
}

function restoreAutoSave() {
    const saved = sessionStorage.getItem('examforge_autosave_' + currentTest.id);
    if (!saved) return;
    
    const data = JSON.parse(saved);
    
    if (data.answers && data.answers.some(a => a !== null)) {
        if (confirm('You have unsaved progress from a previous session. Would you like to restore it?')) {
            answers = data.answers;
            timeRemaining = data.timeRemaining;
            showQuestion(data.currentQuestion || 0);
            updateTimerDisplay();
        }
    }
    
    // Clear auto-save after restore attempt
    sessionStorage.removeItem('examforge_autosave_' + currentTest.id);
}