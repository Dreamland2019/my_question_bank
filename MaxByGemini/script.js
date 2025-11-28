// 全局状态
let state = {
    questions: [],
    chapters: {},
    metadata: null,
    mode: 'practice', 
    currentIndex: 0,
    reviewQueue: [],
    reviewIndex: 0,
    wrongList: [],
    // 【新增】重点列表相关
    priorityList: [], 
    priorityIndex: 0, 
    userAnswers: {},
};

const FILES = {
    json: 'question_bank.json'
};

const STORAGE_KEYS = {
    progress: 'mqb_practice_index',
    wrongList: 'mqb_wrong_list',
    reviewIndex: 'mqb_review_index',
    // 【新增】重点存储 Key
    priorityList: 'mqb_priority_list',
    priorityIndex: 'mqb_priority_index'
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
    wrongCountBadge: document.getElementById('wrong-count-badge'),
    headerTitle: document.getElementById('header-title'), // 标题
    starBtn: document.getElementById('star-btn'),         // 星号按钮
    priorityCountBadge: document.getElementById('priority-count-badge'), // 首页计数
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

    if (localStorage.getItem(STORAGE_KEYS.priorityList)) {
    state.priorityList = JSON.parse(localStorage.getItem(STORAGE_KEYS.priorityList));
    }
}

function updateHomeStats() {
    const total = state.questions.length;
    const current = state.currentIndex + 1;
    // 更新首页统计
    els.statsDisplay.innerHTML = `当前进度: ${current} / ${total}`;
    els.wrongCountBadge.textContent = `${state.wrongList.length} 题待复习`;
    // 【新增】
    els.priorityCountBadge.textContent = `${state.priorityList.length} 题重点`;
}

function initChapterSelect() {
    // 1. 清空并添加默认提示
    els.chapterSelect.innerHTML = '';
    
    // 2. 添加默认的“占位符”（显示在框里，但不能选）
    const defaultOpt = document.createElement('option');
    defaultOpt.value = "";
    defaultOpt.textContent = "📍 跳转到章节...";
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    els.chapterSelect.appendChild(defaultOpt);

    // 3. 【关键修改】添加一个“取消”选项
    const cancelOpt = document.createElement('option');
    cancelOpt.value = "CANCEL_ACTION"; // 特殊标记
    cancelOpt.textContent = "❌ 取消 (保持当前进度)";
    els.chapterSelect.appendChild(cancelOpt);

    // 4. 循环添加真实章节
    for (const [key, name] of Object.entries(state.chapters)) {
        if(name) { 
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
     els.starBtn.addEventListener('click', togglePriority); // 绑定星号点击
    
    els.chapterSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        
        // 如果用户选了“取消”
        if (val === "CANCEL_ACTION") {
            // 重置选择器回到“跳转到章节...”的文字状态
            e.target.value = ""; 
            // 移除焦点，让手机键盘/选择框收起
            e.target.blur(); 
            return;
        }

        // 正常跳转
        jumpToChapter(val);
        
        // 跳转后也建议重置选择框显示，避免一直显示着刚才选的章节，
        // 这样下次用户再点的时候，逻辑更清晰
        e.target.value = ""; 
        e.target.blur();
    });

    els.removeWrongBtn.onclick = handleRemoveQuestion; 
}

// 【新增】切换标记状态
function togglePriority() {
    const q = getCurrentQuestion();
    if (!q) return;

    const idx = state.priorityList.indexOf(q.id);
    if (idx === -1) {
        // 添加标记
        state.priorityList.push(q.id);
        els.starBtn.textContent = "★ 已标记";
        els.starBtn.classList.add('starred');
    } else {
        // 取消标记
        state.priorityList.splice(idx, 1);
        els.starBtn.textContent = "☆ 标记";
        els.starBtn.classList.remove('starred');
    }
    // 保存
    localStorage.setItem(STORAGE_KEYS.priorityList, JSON.stringify(state.priorityList));
}

// --- 导航逻辑 ---
function updateHeaderTitle() {
    if (!els.headerTitle) return; // 防止找不到元素报错

    if (state.mode === 'practice') {
        els.headerTitle.textContent = "📖 顺序刷题";
    } else if (state.mode === 'review') {
        els.headerTitle.textContent = "✍️ 错题回顾";
    } else if (state.mode === 'priority') {
        els.headerTitle.textContent = "⭐ 重点标记";
    } else {
        // 默认情况
        els.headerTitle.textContent = "马原题库";
    }
}

function showHome() {
    // 1. 切换视图
    els.views.quiz.classList.add('hidden');
    els.views.quiz.classList.remove('active');
    els.views.home.classList.remove('hidden');
    els.views.home.classList.add('active');
    
    // 2. 隐藏导航栏上的按钮
    els.backHomeBtn.classList.add('hidden');
    els.chapterSelect.classList.add('hidden');
    els.removeWrongBtn.classList.add('hidden');
    if (els.starBtn) els.starBtn.classList.add('hidden'); // 如果你有这个按钮的话

    // 3. 【关键】将标题重置回题库名称
    // 如果 JSON 里有 metadata.title 就用那个，否则默认显示 "马原题库"
    const libTitle = (state.metadata && state.metadata.title) ? state.metadata.title : "马原题库";
    if (els.headerTitle) {
        els.headerTitle.textContent = libTitle;
    }

    // 4. 更新统计数据
    updateHomeStats();
}

function startPractice() {
    state.mode = 'practice';
    enterQuizMode();
    els.chapterSelect.classList.remove('hidden');
    renderQuestion();
}

function startPriority() {
    if (state.priorityList.length === 0) {
        alert("目前没有标记重点题目。在错题回顾中点击“★”即可添加。");
        return;
    }
    state.mode = 'priority';
    state.reviewQueue = [...state.priorityList]; // 复用 reviewQueue 队列逻辑
    
    // 读取重点进度
    const savedIndex = parseInt(localStorage.getItem(STORAGE_KEYS.priorityIndex) || 0);
    if (savedIndex >= state.reviewQueue.length) {
        state.reviewIndex = 0;
    } else {
        state.reviewIndex = savedIndex;
    }

    enterQuizMode();
    // 重点模式下，也显示移除按钮（用于移出重点列表）
    els.removeWrongBtn.classList.remove('hidden'); 
    renderQuestion();
}

function startReview() {
    if (state.wrongList.length === 0) {
        alert("太棒了！目前没有错题记录。");
        return;
    }
    state.mode = 'review';
    state.reviewQueue = [...state.wrongList]; // 复制一份

    // --- 修改开始：读取进度 ---
    const savedReviewIndex = parseInt(localStorage.getItem(STORAGE_KEYS.reviewIndex) || 0);
    
    // 校验进度是否越界（防止删题后旧索引超过数组长度）
    if (savedReviewIndex >= state.reviewQueue.length) {
        state.reviewIndex = 0;
    } else {
        state.reviewIndex = savedReviewIndex;
    }
    // --- 修改结束 ---

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

    // 【关键】这里必须调用一次更新标题！
    updateHeaderTitle();
}

function clearCache() {
    if(confirm('确定要清除所有进度和错题记录吗？此操作不可恢复。')) {
        localStorage.removeItem(STORAGE_KEYS.progress);
        localStorage.removeItem(STORAGE_KEYS.wrongList);
        localStorage.removeItem(STORAGE_KEYS.reviewIndex);
        localStorage.removeItem(STORAGE_KEYS.priorityList);
        localStorage.removeItem(STORAGE_KEYS.priorityIndex);
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
     if (state.mode === 'priority') {
        els.removeWrongBtn.textContent = "🗑️ 移出重点";
        els.starBtn.classList.add('hidden'); // 重点模式下不需要再显示标记按钮（本身就是重点）
    } else if (state.mode === 'review') {
        els.removeWrongBtn.textContent = "🗑️ 移除此题";
        els.starBtn.classList.remove('hidden'); // 错题模式显示标记按钮
        updateStarBtnState(q.id); // 更新星星状态
    } else {
        // 练习模式
        els.removeWrongBtn.classList.add('hidden');
        els.starBtn.classList.add('hidden'); 
    }

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

function updateStarBtnState(qid) {
    if (state.priorityList.includes(qid)) {
        els.starBtn.textContent = "★ 已标记";
        els.starBtn.classList.add('starred');
    } else {
        els.starBtn.textContent = "☆ 标记";
        els.starBtn.classList.remove('starred');
    }
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

        if (state.mode === 'review') {
            localStorage.setItem(STORAGE_KEYS.reviewIndex, state.reviewIndex);
        } else if (state.mode === 'priority') {
            localStorage.setItem(STORAGE_KEYS.priorityIndex, state.reviewIndex);
        }
    } else {
        // 结束
        if (state.mode === 'priority') {
            localStorage.setItem(STORAGE_KEYS.priorityIndex, 0);
            alert('重点回顾结束');
        } else {
            localStorage.setItem(STORAGE_KEYS.reviewIndex, 0);
            alert('错题回顾结束');
        }
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

function handleRemoveQuestion() {
    const currentQ = getCurrentQuestion();
    if (!currentQ) return;

    if (state.mode === 'review') {
        // 逻辑A: 从错题本移除
        state.wrongList = state.wrongList.filter(id => id !== currentQ.id);
        localStorage.setItem(STORAGE_KEYS.wrongList, JSON.stringify(state.wrongList));
        
        // 从当前队列移除并处理索引
        removeFromQueueAndSave(STORAGE_KEYS.reviewIndex);

    } else if (state.mode === 'priority') {
        // 逻辑B: 从重点本移除
        state.priorityList = state.priorityList.filter(id => id !== currentQ.id);
        localStorage.setItem(STORAGE_KEYS.priorityList, JSON.stringify(state.priorityList));
        
        // 从当前队列移除并处理索引
        removeFromQueueAndSave(STORAGE_KEYS.priorityIndex);
    }
    
    els.removeWrongBtn.textContent = "已移除";
    els.removeWrongBtn.disabled = true;
}

// 提取公共的队列移除逻辑
function removeFromQueueAndSave(storageKeyIndex) {
    state.reviewQueue.splice(state.reviewIndex, 1);
    
    if (state.reviewIndex >= state.reviewQueue.length) {
        state.reviewIndex = Math.max(0, state.reviewQueue.length - 1);
    }
    localStorage.setItem(storageKeyIndex, state.reviewIndex);

    if (state.reviewQueue.length === 0) {
        localStorage.removeItem(storageKeyIndex);
        setTimeout(() => {
            alert('当前列表已清空！');
            showHome();
        }, 1000);
    }
}
