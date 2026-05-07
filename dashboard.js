let currentStudent = null;

document.addEventListener('DOMContentLoaded', function() {
    const stored = sessionStorage.getItem('currentStudent');
    if (!stored) {
        window.location.href = 'index.html';
        return;
    }
    
    currentStudent = JSON.parse(stored);
    loadStudentInfo();
    loadTests();
    loadResults();
    loadProfile();
});

function loadStudentInfo() {
    document.getElementById('studentName').textContent = currentStudent.name;
    document.getElementById('studentDetails').textContent = 
        `${currentStudent.session} • ${currentStudent.term} • ${currentStudent.subject}`;
    document.getElementById('studentClass').textContent = currentStudent.class;
    
    // Load photo
    const photoDiv = document.getElementById('studentPhoto');
    if (currentStudent.photo) {
        photoDiv.innerHTML = `<img src="${currentStudent.photo}" alt="${currentStudent.name}">`;
    } else {
        const initial = currentStudent.name.charAt(0).toUpperCase();
        document.getElementById('photoInitial').textContent = initial;
    }
}

function showSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('tests-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('profile-section').classList.add('hidden');
    document.getElementById('leaderboard-section').classList.add('hidden');
    
    document.getElementById(section + '-section').classList.remove('hidden');
    
    if (section === 'leaderboard') {
        loadLeaderboard();
    }
}

function loadTests() {
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    
    // Filter tests for student's subject/class/session/term
    const myTests = tests.filter(t => 
        t.subject === currentStudent.subject && 
        t.class === currentStudent.class &&
        t.session === currentStudent.session &&
        t.term === currentStudent.term
    );
    
    // Calculate stats
    const myResults = results.filter(r => r.studentId === currentStudent.id);
    const completed = myResults.length;
    const avgScore = completed > 0 
        ? Math.round(myResults.reduce((a, b) => a + b.score, 0) / completed) 
        : 0;
    
    document.getElementById('totalTests').textContent = myTests.length;
    document.getElementById('completedTests').textContent = completed;
    document.getElementById('avgScore').textContent = avgScore + '%';
    
    // Determine current week based on date
    const now = new Date();
    let currentWeekNum = 1;
    if (myTests.length > 0) {
        const sorted = [...myTests].sort((a, b) => new Date(a.date) - new Date(b.date));
        for (let i = 0; i < sorted.length; i++) {
            if (new Date(sorted[i].date) <= now) {
                currentWeekNum = sorted[i].week;
            }
        }
    }
    document.getElementById('currentWeek').textContent = 'Week ' + currentWeekNum;
    
    // Render tests
    const container = document.getElementById('testsList');
    container.innerHTML = '';
    
    if (myTests.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;">No tests scheduled yet.</p>';
        return;
    }
    
    myTests.sort((a, b) => a.week - b.week);
    
    myTests.forEach(test => {
        const testDate = new Date(test.date + 'T' + test.time);
        const now = new Date();
        const isAvailable = now >= testDate;
        const isCompleted = myResults.some(r => r.testId === test.id);
        const result = myResults.find(r => r.testId === test.id);
        
        let statusClass = 'upcoming';
        let badgeClass = 'badge-locked';
        let badgeText = 'Locked';
        let actionBtn = '';
        
        if (isCompleted) {
            statusClass = 'completed';
            badgeClass = 'badge-completed';
            badgeText = `Scored: ${result.score}%`;
            actionBtn = `<button class="btn btn-secondary" onclick="viewResult(${test.id})">View Result</button>`;
        } else if (isAvailable) {
            statusClass = '';
            badgeClass = 'badge-available';
            badgeText = 'Available Now';
            actionBtn = `<button class="btn btn-primary" onclick="startTest(${test.id})">Start Test</button>`;
        } else {
            actionBtn = `<button class="btn btn-secondary" disabled>Locked</button>`;
        }
        
        // Determine test type label
        let testTitle = `Week ${test.week} Test`;
        let testBadgeClass = 'badge-week';
        
        if (test.type === 'midterm' || test.week === 7) {
            testTitle = `Week ${test.week} - Mid Term Test`;
            testBadgeClass = 'badge-midterm';
        } else if (test.type === 'exam' || test.week === 11) {
            testTitle = 'Final Examination';
            testBadgeClass = 'badge-exam';
        }
        
        const card = document.createElement('div');
        card.className = `test-card ${statusClass}`;
        card.innerHTML = `
            <div class="test-header">
                <div>
                    <div class="test-title">${testTitle}</div>
                    <span class="test-badge ${badgeClass}">${badgeText}</span>
                </div>
            </div>
            <div class="test-meta">
                <p>📅 ${formatDate(test.date)} at ${formatTime(test.time)}</p>
                <p>⏱️ ${test.duration} minutes</p>
                <p>❓ ${test.questions.length} questions</p>
                <p>📚 ${test.subject}</p>
            </div>
            ${actionBtn}
        `;
        container.appendChild(card);
    });
}

function startTest(testId) {
    sessionStorage.setItem('currentTest', testId);
    window.location.href = 'exam.html';
}

function viewResult(testId) {
    sessionStorage.setItem('viewResult', testId);
    window.location.href = 'result.html';
}

function loadResults() {
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    const myResults = results.filter(r => r.studentId === currentStudent.id);
    const container = document.getElementById('resultsList');
    
    if (myResults.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;">No results yet.</p>';
        return;
    }
    
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    
    let html = '<div class="table-container"><table class="data-table"><thead><tr><th>Test</th><th>Date</th><th>Score</th><th>Time Used</th><th>Status</th></tr></thead><tbody>';
    
    myResults.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    myResults.forEach(result => {
        const test = tests.find(t => t.id === result.testId) || { week: '?', type: 'weekly' };
        const date = new Date(result.completedAt);
        const status = result.score >= 60 ? 'Passed' : 'Failed';
        const statusColor = result.score >= 60 ? 'text-success' : 'text-danger';
        
        let testLabel = `Week ${test.week} Test`;
        if (test.type === 'midterm' || test.week === 7) testLabel = 'Mid Term Test';
        else if (test.type === 'exam' || test.week === 11) testLabel = 'Examination';
        
        html += `
            <tr>
                <td><strong>${testLabel}</strong></td>
                <td>${formatDate(date.toISOString().split('T')[0])}</td>
                <td><strong>${result.score}%</strong></td>
                <td>${result.timeUsed} min</td>
                <td class="${statusColor}">${status}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function loadProfile() {
    const details = document.getElementById('profileDetails');
    details.innerHTML = `
        <p><strong>Full Name:</strong> ${currentStudent.name}</p>
        <p><strong>Gender:</strong> ${currentStudent.gender}</p>
        <p><strong>Session:</strong> ${currentStudent.session}</p>
        <p><strong>Term:</strong> ${currentStudent.term}</p>
        <p><strong>Class:</strong> ${currentStudent.class}</p>
        <p><strong>Subject:</strong> ${currentStudent.subject}</p>
        <p><strong>Password:</strong> <code style="background: var(--bg); padding: 4px 8px; border-radius: 4px;">${currentStudent.password}</code></p>
        <p><strong>Registered:</strong> ${formatDate(currentStudent.createdAt.split('T')[0])}</p>
    `;
}

function logout() {
    sessionStorage.removeItem('currentStudent');
    window.location.href = 'index.html';
}

function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function loadLeaderboard() {
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    const students = JSON.parse(localStorage.getItem('examforge_students'));
    
    // Get results for same subject/class/session/term
    const myTests = tests.filter(t => 
        t.subject === currentStudent.subject && 
        t.class === currentStudent.class &&
        t.session === currentStudent.session &&
        t.term === currentStudent.term
    );
    
    const testIds = myTests.map(t => t.id);
    const relevantResults = results.filter(r => testIds.includes(r.testId));
    
    // Group by student and calculate average
    const studentScores = {};
    relevantResults.forEach(r => {
        if (!studentScores[r.studentId]) {
            studentScores[r.studentId] = { total: 0, count: 0, scores: [] };
        }
        studentScores[r.studentId].total += r.score;
        studentScores[r.studentId].count += 1;
        studentScores[r.studentId].scores.push(r.score);
    });
    
    // Calculate averages and rank
    const rankings = Object.keys(studentScores).map(id => {
        const s = studentScores[id];
        const student = students.find(st => st.id === parseInt(id));
        return {
            name: student ? student.name : 'Unknown',
            avg: Math.round(s.total / s.count),
            tests: s.count,
            best: Math.max(...s.scores)
        };
    }).sort((a, b) => b.avg - a.avg);
    
    const container = document.getElementById('leaderboardContent');
    
    if (rankings.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;">No results yet.</p>';
        return;
    }
    
    let html = '<div class="table-container"><table class="data-table"><thead><tr><th>Rank</th><th>Student</th><th>Avg Score</th><th>Tests</th><th>Best</th></tr></thead><tbody>';
    
    rankings.forEach((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const highlight = i < 3 ? 'style="background: rgba(251, 191, 36, 0.1);"' : '';
        
        html += `
            <tr ${highlight}>
                <td style="font-size: 20px;">${medal}</td>
                <td><strong>${r.name}</strong></td>
                <td><strong class="${r.avg >= 60 ? 'text-success' : 'text-danger'}">${r.avg}%</strong></td>
                <td>${r.tests}</td>
                <td>${r.best}%</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}