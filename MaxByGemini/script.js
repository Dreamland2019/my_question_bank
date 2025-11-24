// 全局状态
let state = {
    questions: [],      // 所有题目
    chapters: {},       // 章节映射
    mode: 'practice',   // 'practice' | 'review'
    currentIndex: 0,    // 当前题目在 questions 数组中的索引（顺序模式）
    reviewQueue: [],    // 错题回顾模式下的题目ID列表
    reviewIndex: 0,     // 错题回顾模式下的队列索引
    wrongList: [],      // 存储所有错题ID的数组 (持久化)
    userAnswers: {},    // 临时存储用户当前题目的选择
};

const FILES = {
    json: 'question_bank.json'
};

const STORAGE_KEYS = {
    progress: 'mqb_practice_index',
    wrongList: 'mqb_wrong_list'
};

// DOM 元素
const els = {
    views: { home: document.getElementById('home-view'), quiz: document.getElementById('quiz-view') },
    chapterSelect: document.getElementById('chapter-selector'),
    progressBar: document.getElementById('progress-fill'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    submitBtn: document.getElementById('submit-btn'),
    navBtns: document.getElementById('nav-btns'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    explanation: document.getElementById('explanation-area'),
    backHomeBtn: document.getElementById('back-home-btn'),
    statsDisplay: document.getElementById('stats-display'),
    removeWrongBtn: document.getElementById('remove-wrong-btn'),
    wrongCountBadge: document.getElementById('wrong-count-badge')
};

// 初始化
window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    loadStorage();
    updateHomeStats();
    bindEvents();
});

async function loadData() {
    try {
        const res = await fetch(FILES.json);
        const data = await res.json();
        state.questions = data.questions;
        state.chapters = data.chapters;
        initChapterSelect();
    } catch (e) {
        alert('题库加载失败，请检查 question_bank.json 文件是否存在。');
        console.error(e);
    }
}

function loadStorage() {
    // 加载练习进度
    const savedIndex = localStorage.getItem(STORAGE_KEYS.progress);
    if (savedIndex) state.currentIndex = parseInt(savedIndex, 10);

    // 加载错题本
    const savedWrongs = localStorage.getItem(STORAGE_KEYS.wrongList);
    if (savedWrongs) state.wrongList = JSON.parse(savedWrongs);
}

function updateHomeStats() {
    const total = state.questions.length;
    const current = state.currentIndex + 1;
    const wrongCount = state.wrongList.length;

    els.statsDisplay.innerHTML = `当前进度: ${current} / ${total} <br> 累计错题: ${wrongCount}`;
    els.wrongCountBadge.textContent = `${wrongCount} 题待复习`;
}

function initChapterSelect() {
    els.chapterSelect.innerHTML = '<option value="" disabled selected>选择章节跳转</option>';
    // 创建章节选项
    for (const [key, name] of Object.entries(state.chapters)) {
        if(name) { // 只添加有名字的章节
             const opt = document.createElement('option');
             opt.value = key;
             opt.textContent = `${key} ${name}`;
             els.chapterSelect.appendChild(opt);
        }
    }
}

// 事件绑定
function bindEvents() {
    els.backHomeBtn.addEventListener('click', showHome);
    
    els.submitBtn.addEventListener('click', submitAnswer);
    els.nextBtn.addEventListener('click', () => navigate(1));
    els.prevBtn.addEventListener('click', () => navigate(-1));
    
    els.chapterSelect.addEventListener('change', (e) => {
        jumpToChapter(e.target.value);
    });

    els.removeWrongBtn.addEventListener('click', removeCurrentWrongQuestion);
}

// --- 导航逻辑 ---

function showHome() {
    els.views.quiz.classList.add('hidden');
    els.views.quiz.classList.remove('active');
    els.views.home.classList.remove('hidden');
    els.views.home.classList.add('active');
    els.backHomeBtn.classList.add('hidden');
    els.chapterSelect.classList.add('hidden');
    els.removeWrongBtn.classList.add('hidden');
    updateHomeStats();
}

function startPractice() {
    state.mode = 'practice';
    enterQuizMode();
    els.chapterSelect.classList.remove('hidden');
    renderQuestion();
}

function startReview() {
    if (state.wrongList.length === 0) {
        alert("太棒了！目前没有错题记录。");
        return;
    }
    state.mode = 'review';
    state.reviewQueue = [...state.wrongList]; // 复制一份
    state.reviewIndex = 0;
    enterQuizMode();
    els.removeWrongBtn.classList.remove('hidden');
    renderQuestion();
}

function enterQuizMode() {
    els.views.home.classList.add('hidden');
    els.views.home.classList.remove('active');
    els.views.quiz.classList.remove('hidden');
    els.views.quiz.classList.add('active');
    els.backHomeBtn.classList.remove('hidden');
}

function clearCache() {
    if(confirm('确定要清除所有进度和错题记录吗？此操作不可恢复。')) {
        localStorage.removeItem(STORAGE_KEYS.progress);
        localStorage.removeItem(STORAGE_KEYS.wrongList);
        location.reload();
    }
}

// --- 核心答题逻辑 ---

function getCurrentQuestion() {
    if (state.mode === 'practice') {
        return state.questions[state.currentIndex];
    } else {
        // 错题模式：通过ID找题目对象
        const id = state.reviewQueue[state.reviewIndex];
        return state.questions.find(q => q.id === id);
    }
}

function renderQuestion() {
    const q = getCurrentQuestion();
    if (!q) return; // 异常处理

    // 重置UI
    els.submitBtn.classList.remove('hidden');
    els.navBtns.classList.add('hidden');
    els.explanation.classList.add('hidden');
    state.userAnswers = []; // 清空当前选择
    els.removeWrongBtn.disabled = false;
    els.removeWrongBtn.textContent = "🗑️ 移除此题";

    // 顶部信息
    const total = state.mode === 'practice' ? state.questions.length : state.reviewQueue.length;
    const current = state.mode === 'practice' ? state.currentIndex + 1 : state.reviewIndex + 1;
    
    document.getElementById('current-index').textContent = current;
    document.getElementById('total-count').textContent = total;
    document.getElementById('chapter-tag').textContent = `第 ${q.chapter} 章`;
    // document.getElementById('type-tag').textContent = q.type; // 注释掉或删除这行，不再需要顶部标签
    document.getElementById('type-tag').style.display = 'none'; // 隐藏顶部的旧标签

    // 进度条
    const pct = (current / total) * 100;
    els.progressBar.style.width = `${pct}%`;

    // --- 修改开始：更醒目的题型标记 ---
    // 根据题型设置颜色（多选题用红色，其他用蓝色）
    let typeLabelHtml = `（${q.type}）`;
    if (q.type === '多选题') {
        typeLabelHtml = `<span style="color: #e74c3c; font-weight: bold;">（${q.type}）</span>`;
    } else {
        typeLabelHtml = `<span style="color: #3498db; font-weight: bold;">（${q.type}）</span>`;
    }

    // 使用 innerHTML 将题型和题目拼接在一起
    els.questionText.innerHTML = `${current}.${typeLabelHtml} ${q.question}`;
    // --- 修改结束 ---
    
    els.optionsContainer.innerHTML = '';
    Object.entries(q.options).forEach(([key, val]) => {
        const btn = document.createElement('div');
        btn.className = 'option-item';
        btn.dataset.key = key;
        btn.innerHTML = `<span class="option-tag">${key}.</span> ${val}`;
        btn.onclick = () => selectOption(key, q.type, btn);
        els.optionsContainer.appendChild(btn);
    });
}

function selectOption(key, type, btnElement) {
    // 如果已经提交了，不允许修改
    if (!els.submitBtn.classList.contains('hidden')) {
        if (type === '单选题' || type === '判断题') {
            // 单选互斥
            state.userAnswers = [key];
            document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
            btnElement.classList.add('selected');
        } else if (type === '多选题') {
            // 多选切换
            if (state.userAnswers.includes(key)) {
                state.userAnswers = state.userAnswers.filter(k => k !== key);
                btnElement.classList.remove('selected');
            } else {
                state.userAnswers.push(key);
                btnElement.classList.add('selected');
            }
        }
    }
}

function submitAnswer() {
    if (state.userAnswers.length === 0) return alert('请先选择答案');

    const q = getCurrentQuestion();
    const userAnsStr = state.userAnswers.sort().join('');
    const isCorrect = userAnsStr === q.correct_answer;

    // 1. UI 反馈
    els.submitBtn.classList.add('hidden');
    els.navBtns.classList.remove('hidden');
    
    // 标记选项
    document.querySelectorAll('.option-item').forEach(el => {
        const key = el.dataset.key;
        // 标记正确答案
        if (q.correct_answer.includes(key)) {
            el.classList.add('correct');
        }
        // 标记用户选错的
        if (state.userAnswers.includes(key) && !q.correct_answer.includes(key)) {
            el.classList.add('wrong');
        }
    });

    // 显示解析
    els.explanation.classList.remove('hidden');
    const resultIcon = document.getElementById('result-icon');
    const correctText = document.getElementById('correct-answer-text');
    
    if (isCorrect) {
        resultIcon.textContent = '✅ 回答正确';
        resultIcon.style.color = 'var(--success)';
        correctText.textContent = '';
    } else {
        resultIcon.textContent = '❌ 回答错误';
        resultIcon.style.color = 'var(--danger)';
        correctText.textContent = `正确答案：${q.correct_answer}`;
        
        // 如果在练习模式错题，加入错题本
        if (state.mode === 'practice') {
            addToWrongList(q.id);
        }
    }
    
    document.getElementById('explanation-text').innerText = q.explanation || "暂无解析";

    // 保存进度 (仅顺序练习模式)
    if (state.mode === 'practice') {
        localStorage.setItem(STORAGE_KEYS.progress, state.currentIndex);
    }
}

// --- 辅助逻辑 ---

function navigate(direction) {
    if (state.mode === 'practice') {
        const newIndex = state.currentIndex + direction;
        if (newIndex >= 0 && newIndex < state.questions.length) {
            state.currentIndex = newIndex;
            renderQuestion();
        } else {
            alert('已经是最后一题了');
        }
    } else {
        // Review mode
        const newIndex = state.reviewIndex + direction;
        if (newIndex >= 0 && newIndex < state.reviewQueue.length) {
            state.reviewIndex = newIndex;
            renderQuestion();
        } else {
            alert('错题回顾结束');
            showHome();
        }
    }
}

function jumpToChapter(chapterId) {
    if (!chapterId) return;
    // 找到该章节第一题的索引
    const index = state.questions.findIndex(q => q.chapter.startsWith(chapterId));
    if (index !== -1) {
        state.currentIndex = index;
        renderQuestion();
    } else {
        alert('该章节暂无题目');
    }
}

function addToWrongList(id) {
    if (!state.wrongList.includes(id)) {
        state.wrongList.push(id);
        localStorage.setItem(STORAGE_KEYS.wrongList, JSON.stringify(state.wrongList));
    }
}

function removeCurrentWrongQuestion() {
    const currentQ = getCurrentQuestion();
    if (!currentQ) return;

    // 从 wrongList 移除
    state.wrongList = state.wrongList.filter(id => id !== currentQ.id);
    localStorage.setItem(STORAGE_KEYS.wrongList, JSON.stringify(state.wrongList));

    // 从当前回顾队列移除
    state.reviewQueue.splice(state.reviewIndex, 1);
    
    els.removeWrongBtn.textContent = "已移除";
    els.removeWrongBtn.disabled = true;

    // 如果队列空了，回主页
    if (state.reviewQueue.length === 0) {
        setTimeout(() => {
            alert('恭喜！错题已全部消灭。');
            showHome();
        }, 1000);
    } else {
        // 否则如果不做操作，用户点下一题会自动跳到新的索引位置
        // 如果是最后一题被删了，reviewIndex 需要调整吗？
        // 实际上 render 时是用 index 取 queue，如果当前删了，nextBtn index+1 会跳过一个。
        // 简单的处理是：删除了当前题，不用自动跳，让用户点下一题（此时下一题已经是原队列的下下题，或者用户手动刷新）
        // 这里为了体验好，稍微复杂点：当前题删了，reviewIndex不动，但是数据变了，重新渲染这一页（其实是下一题填补上来了）
        
        if (state.reviewIndex >= state.reviewQueue.length) {
            state.reviewIndex = state.reviewQueue.length - 1;
        }
        // 稍微延迟一点跳转体验更好
        // setTimeout(() => renderQuestion(), 500);
    }
}
