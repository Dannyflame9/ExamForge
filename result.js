document.addEventListener('DOMContentLoaded', function() {
    const testId = sessionStorage.getItem('viewResult');
    const student = JSON.parse(sessionStorage.getItem('currentStudent'));
    
    if (!testId || !student) {
        window.location.href = 'index.html';
        return;
    }
    
    const tests = JSON.parse(localStorage.getItem('examforge_tests'));
    const results = JSON.parse(localStorage.getItem('examforge_results'));
    
    const test = tests.find(t => t.id === parseInt(testId));
    const result = results.find(r => r.studentId === student.id && r.testId === parseInt(testId));
    
    if (!test || !result) {
        alert('Result not found!');
        window.location.href = 'dashboard.html';
        return;
    }
    
    const container = document.getElementById('resultContainer');
    
    const isPassed = result.score >= 60;
    const statusColor = isPassed ? 'var(--success)' : 'var(--danger)';
    const statusText = isPassed ? '🎉 Congratulations! You Passed!' : '📚 Keep Practicing!';
    
    // Determine test type label
    let testTypeLabel = `Week ${test.week} Test`;
    let testTypeBadge = 'badge-week';
    if (test.week === 7) {
        testTypeLabel = 'Week 7 - Mid Term Test';
        testTypeBadge = 'badge-midterm';
    } else if (test.week === 11) {
        testTypeLabel = 'Final Examination';
        testTypeBadge = 'badge-exam';
    }
    
    container.innerHTML = `
        <h2 style="font-size: 28px; margin-bottom: 8px;">${statusText}</h2>
        <p style="color: var(--text-light); margin-bottom: 24px;">
            <span class="test-badge ${testTypeBadge}">${testTypeLabel}</span>
            <span class="test-badge" style="margin-left: 8px; background: var(--primary-light); color: var(--primary);">${test.subject}</span>
        </p>
        
        <div class="score-circle" style="border-color: ${statusColor}; color: ${statusColor};">
            ${result.score}%
        </div>
        
        <div class="score-details">
            <div class="score-item">
                <div style="font-size: 32px; font-weight: 800; color: var(--success);">${result.correct}</div>
                <div style="color: var(--text-light); font-size: 14px;">Correct</div>
            </div>
            <div class="score-item">
                <div style="font-size: 32px; font-weight: 800; color: var(--danger);">${result.total - result.correct}</div>
                <div style="color: var(--text-light); font-size: 14px;">Wrong</div>
            </div>
            <div class="score-item">
                <div style="font-size: 32px; font-weight: 800; color: var(--primary);">${result.total}</div>
                <div style="color: var(--text-light); font-size: 14px;">Total</div>
            </div>
        </div>
        
        <div style="background: var(--bg); padding: 24px; border-radius: 12px; text-align: left; margin: 24px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
                <p><strong>Subject:</strong> ${test.subject}</p>
                <p><strong>Class:</strong> ${test.class}</p>
                <p><strong>Time Used:</strong> ${result.timeUsed} minutes</p>
                <p><strong>Date:</strong> ${new Date(result.completedAt).toLocaleString()}</p>
            </div>
        </div>
        
        <h3 style="margin: 40px 0 24px; font-size: 22px;">📝 Answer Review</h3>
    `;
    
    // Show review in original question order (Question 1, 2, 3...) for consistency
    test.questions.forEach((q, i) => {
        const userAnswer = result.answers[i]; // This is the original option index
        const isCorrect = userAnswer === q.correct;
        const userLetter = userAnswer !== null ? String.fromCharCode(65 + userAnswer) : '-';
        const correctLetter = String.fromCharCode(65 + q.correct);
        
        const reviewDiv = document.createElement('div');
        reviewDiv.style.cssText = 'text-align: left; margin-bottom: 24px; padding: 24px; background: var(--bg); border-radius: 16px; border: 2px solid ' + (isCorrect ? 'var(--success)' : 'var(--danger)') + ';';
        
        let optionsHtml = '';
        q.options.forEach((opt, optIndex) => {
            let optClass = 'option';
            let optStyle = '';
            let icon = '';
            
            if (optIndex === q.correct) {
                optClass += ' correct';
                icon = ' ✅ Correct Answer';
            } else if (optIndex === userAnswer && !isCorrect) {
                optClass += ' wrong';
                icon = ' ❌ Your Answer';
            } else {
                optStyle = 'opacity: 0.6;';
            }
            
            optionsHtml += `
                <div class="${optClass}" style="${optStyle} margin-bottom: 8px; cursor: default;">
                    <div class="option-letter">${String.fromCharCode(65 + optIndex)}</div>
                    <div>${opt}${icon}</div>
                </div>
            `;
        });
        
        const explanationHtml = q.explanation ? `
            <div class="explanation-box">
                <h4>💡 Explanation</h4>
                <p>${q.explanation}</p>
            </div>
        ` : '';
        
        reviewDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <span style="font-weight: 700; font-size: 16px; color: var(--primary);">Question ${i + 1}</span>
                <span style="padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${isCorrect ? '#d1fae5' : '#fee2e2'}; color: ${isCorrect ? '#065f46' : '#991b1b'};">
                    ${isCorrect ? 'Correct' : 'Wrong'}
                </span>
            </div>
            <p style="font-size: 16px; margin-bottom: 16px; font-weight: 500;">${q.question}</p>
            <div style="margin-bottom: 8px;">
                ${optionsHtml}
            </div>
            ${explanationHtml}
        `;
        
        container.appendChild(reviewDiv);
    });
});